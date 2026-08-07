import { requireAccess } from "./access-control";
import { getFinancialBenefitsV2 } from "./evaluation-benefits-v2";
import { ensureCaregiverPlatformSchema } from "./caregiver-platform-v1";
import { ensureReferralRewardsSchema } from "./referral-rewards-v1";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  getUser,
  json,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const VERSION = "4.0.0";
const STAFF_FINANCE_MODULE = "staff.financial_credits";
const OPEN_CREDIT_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];
const MILESTONE_SIZE = 10;
const MILESTONE_REWARD_TOMAN = 5_000_000;

type JsonRecord = Record<string, unknown>;

type WalletRow = {
  id: string;
  direction: string;
  transactionType: string;
  amountToman: number;
  title: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

type CreditRequestRow = {
  id: string;
  caregiverId?: string;
  requestedAmountToman: number;
  eligibilityPath: string;
  eligibilitySnapshotJson?: string;
  note: string | null;
  status: string;
  decisionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const upper = (value: unknown) => str(value).toUpperCase();
const amount = (value: unknown) => Math.max(0, Math.trunc(Number(value || 0)));

function safeObject(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}

function parseObject(value: unknown): JsonRecord {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return safeObject(parsed);
  } catch {
    return {};
  }
}

async function safeAll<T>(env: Env, sql: string, bindings: unknown[] = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...bindings).all<T>();
    return result.results || [];
  } catch {
    return [];
  }
}

async function ensureSchemas(env: Env) {
  await Promise.all([
    ensureCaregiverPlatformSchema(env),
    ensureReferralRewardsSchema(env),
  ]);
}

function randomSixDigitCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(100_000 + (value % 900_000));
}

async function ensureReferralCode(env: Env, caregiverId: string) {
  const existing = await env.DB.prepare(`SELECT referral_code AS referralCode
    FROM caregiver_referral_codes WHERE caregiver_id=? LIMIT 1`)
    .bind(caregiverId).first<{ referralCode: string }>();
  if (existing?.referralCode) return existing.referralCode;
  const createdAt = nowIso();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = randomSixDigitCode();
    await env.DB.prepare(`INSERT OR IGNORE INTO caregiver_referral_codes(caregiver_id,referral_code,created_at)
      VALUES(?,?,?)`).bind(caregiverId, candidate, createdAt).run();
    const row = await env.DB.prepare(`SELECT referral_code AS referralCode
      FROM caregiver_referral_codes WHERE caregiver_id=? LIMIT 1`)
      .bind(caregiverId).first<{ referralCode: string }>();
    if (row?.referralCode) return row.referralCode;
  }
  throw new Error("referral_code_exhausted");
}

async function caregiverIdentity(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT c.id,c.membership_code AS membershipCode,c.full_name AS fullName,c.mobile,
      c.city,c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.cooperation_status AS cooperationStatus,c.active,
      COALESCE(u.status,'ACTIVE') AS accountStatus
    FROM caregivers c LEFT JOIN users u ON u.caregiver_id=c.id
    WHERE c.id=? LIMIT 1`).bind(caregiverId).first<JsonRecord>();
}

async function financialBenefitsFor(request: Request, env: Env, actor: AuthUser, caregiverId: string) {
  const url = new URL("/api/benefits/summary", request.url);
  url.searchParams.set("caregiverId", caregiverId);
  const internalActor: AuthUser = actor.role.toUpperCase() === "CAREGIVER"
    ? actor
    : { ...actor, role: "ADMIN" };
  const response = await getFinancialBenefitsV2(new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  }), env, internalActor);
  const payload = await response.clone().json().catch(() => ({})) as { data?: JsonRecord; message?: string };
  if (!response.ok || !payload.data) throw new Error(payload.message || "محاسبه تسهیلات مراقب انجام نشد.");
  return payload.data;
}

function loanArray(benefits: JsonRecord) {
  return Array.isArray(benefits.loans) ? benefits.loans.map(safeObject) : [];
}

function resolveBenefit(benefits: JsonRecord, benefitKey: string, requestedAmountToman = 0) {
  const allowance = safeObject(benefits.allowance);
  const loans = loanArray(benefits);
  if (benefitKey === "ASSISTANCE_2M") return { benefitType: "ASSISTANCE", item: allowance };
  const keyed = loans.find((item) => String(item.key || "") === benefitKey);
  if (keyed) return { benefitType: "LOAN", item: keyed };
  if (requestedAmountToman > 0) {
    const amountMatched = [...loans].sort((a, b) => Number(b.amountToman || 0) - Number(a.amountToman || 0))
      .find((item) => Number(item.amountToman || 0) === requestedAmountToman);
    if (amountMatched) return { benefitType: "LOAN", item: amountMatched };
  }
  return null;
}

async function walletData(env: Env, caregiverId: string) {
  const [totals, pending, transactions, settlements, creditRequests] = await Promise.all([
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE 0 END),0) AS creditToman,
      COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount_toman ELSE 0 END),0) AS debitToman
      FROM caregiver_wallet_transactions WHERE caregiver_id=?`).bind(caregiverId)
      .first<{ creditToman: number; debitToman: number }>(),
    env.DB.prepare(`SELECT COALESCE(SUM(amount_toman),0) AS pendingToman
      FROM caregiver_settlement_requests WHERE caregiver_id=? AND status IN ('REQUESTED','APPROVED')`)
      .bind(caregiverId).first<{ pendingToman: number }>(),
    safeAll<WalletRow>(env, `SELECT id,direction,transaction_type AS transactionType,amount_toman AS amountToman,
      title,description,reference_type AS referenceType,reference_id AS referenceId,created_at AS createdAt
      FROM caregiver_wallet_transactions WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 150`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT id,amount_toman AS amountToman,account_holder_name AS accountHolderName,
      iban,account_number AS accountNumber,bank_name AS bankName,note,status,decision_note AS decisionNote,
      reviewed_at AS reviewedAt,paid_at AS paidAt,payment_tracking_number AS paymentTrackingNumber,
      created_at AS createdAt,updated_at AS updatedAt FROM caregiver_settlement_requests
      WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 60`, [caregiverId]),
    safeAll<CreditRequestRow>(env, `SELECT id,requested_amount_toman AS requestedAmountToman,
      eligibility_path AS eligibilityPath,eligibility_snapshot_json AS eligibilitySnapshotJson,
      note,status,decision_note AS decisionNote,reviewed_at AS reviewedAt,created_at AS createdAt,
      updated_at AS updatedAt FROM caregiver_credit_requests WHERE caregiver_id=?
      ORDER BY created_at DESC LIMIT 60`, [caregiverId]),
  ]);
  const creditToman = Number(totals?.creditToman || 0);
  const debitToman = Number(totals?.debitToman || 0);
  const balanceToman = creditToman - debitToman;
  const pendingSettlementToman = Number(pending?.pendingToman || 0);
  return {
    summary: {
      creditToman,
      debitToman,
      receivableToman: creditToman,
      payableToman: debitToman,
      netToman: balanceToman,
      balanceToman,
      pendingSettlementToman,
      availableToman: Math.max(0, balanceToman - pendingSettlementToman),
    },
    transactions,
    settlements,
    creditRequests: creditRequests.map((row) => ({
      ...row,
      eligibilitySnapshot: parseObject(row.eligibilitySnapshotJson),
      eligibilitySnapshotJson: undefined,
    })),
  };
}

async function referralData(env: Env, caregiverId: string) {
  const [cases, milestones] = await Promise.all([
    safeAll<JsonRecord>(env, `SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,
      c.full_name AS referredName,c.membership_code AS referredMembershipCode,c.mobile AS referredMobile,
      r.referral_code AS referralCode,r.status,
      r.referrer_confirmation_status AS referrerConfirmationStatus,
      r.referrer_confirmed_at AS referrerConfirmedAt,r.referrer_rejected_at AS referrerRejectedAt,
      r.registration_reward_toman AS registrationRewardToman,
      r.contract_reward_toman AS contractRewardToman,
      r.registration_reward_transaction_id AS registrationRewardTransactionId,
      r.contract_reward_transaction_id AS contractRewardTransactionId,
      r.registration_payment_at AS registrationPaymentAt,r.contract_payment_at AS contractPaymentAt,
      r.created_at AS createdAt,r.updated_at AS updatedAt
      FROM caregiver_referral_cases r
      JOIN caregivers c ON c.id=r.referred_caregiver_id
      WHERE r.referrer_caregiver_id=? ORDER BY r.created_at DESC LIMIT 200`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT milestone_number AS milestoneNumber,reward_toman AS rewardToman,
      wallet_transaction_id AS walletTransactionId,awarded_at AS awardedAt
      FROM caregiver_referral_milestones WHERE caregiver_id=? ORDER BY milestone_number DESC`, [caregiverId]),
  ]);
  const totalReferrals = cases.length;
  const completedReferrals = cases.filter((item) => String(item.status) === "COMPLETED" && item.contractRewardTransactionId).length;
  const approvedRegistrations = cases.filter((item) => Boolean(item.registrationRewardTransactionId)).length;
  const awaitingMyConfirmation = cases.filter((item) => String(item.referrerConfirmationStatus) === "PENDING").length;
  const confirmedCaseRewards = cases.reduce((sum, item) => sum
    + (item.registrationRewardTransactionId ? Number(item.registrationRewardToman || 0) : 0)
    + (item.contractRewardTransactionId ? Number(item.contractRewardToman || 0) : 0), 0);
  const milestoneRewardToman = milestones.reduce((sum, item) => sum + Number(item.rewardToman || 0), 0);
  const progressInCycle = completedReferrals % MILESTONE_SIZE;
  return {
    summary: {
      totalReferrals,
      approvedRegistrations,
      completedReferrals,
      awaitingMyConfirmation,
      confirmedRewardToman: confirmedCaseRewards + milestoneRewardToman,
      milestoneRewardsCount: milestones.length,
      milestoneRewardToman,
      progressInCycle,
      remainingToMilestone: progressInCycle === 0 && completedReferrals > 0 ? MILESTONE_SIZE : MILESTONE_SIZE - progressInCycle,
      nextMilestoneTarget: Math.floor(completedReferrals / MILESTONE_SIZE) * MILESTONE_SIZE + MILESTONE_SIZE,
      milestoneSize: MILESTONE_SIZE,
      nextMilestoneRewardToman: MILESTONE_REWARD_TOMAN,
    },
    cases,
    milestones,
  };
}

function allocations(wallet: Awaited<ReturnType<typeof walletData>>) {
  const requestItems = wallet.creditRequests.map((item) => ({
    id: item.id,
    kind: "BENEFIT_REQUEST",
    title: String(safeObject(item.eligibilitySnapshot).benefitTitle || "درخواست تسهیلات"),
    amountToman: item.requestedAmountToman,
    status: item.status,
    createdAt: item.createdAt,
    source: item.eligibilityPath,
  }));
  const creditItems = wallet.transactions.filter((item) => item.direction === "CREDIT").map((item) => ({
    id: item.id,
    kind: "WALLET_CREDIT",
    title: item.title,
    amountToman: item.amountToman,
    status: "POSTED",
    createdAt: item.createdAt,
    source: item.transactionType,
  }));
  return [...requestItems, ...creditItems].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 120);
}

export async function buildCaregiverFinancialProfileV4(
  request: Request,
  env: Env,
  actor: AuthUser,
  caregiverId: string,
) {
  await ensureSchemas(env);
  const caregiver = await caregiverIdentity(env, caregiverId);
  if (!caregiver) throw new Error("caregiver_not_found");
  const [benefits, wallet, referralCode, referrals] = await Promise.all([
    financialBenefitsFor(request, env, actor, caregiverId),
    walletData(env, caregiverId),
    ensureReferralCode(env, caregiverId),
    referralData(env, caregiverId),
  ]);
  return {
    version: VERSION,
    generatedAt: nowIso(),
    caregiver: { ...caregiver, referralCode },
    evaluation: safeObject(benefits.evaluation),
    allowance: safeObject(benefits.allowance),
    loans: loanArray(benefits),
    benefitRules: safeObject(benefits.rules),
    service: {
      contracts: Array.isArray(benefits.contracts) ? benefits.contracts : [],
      credit: safeObject(benefits.credit),
    },
    referrals,
    wallet: {
      ...wallet,
      allocations: allocations(wallet),
    },
    dataUnity: {
      evaluationSource: "caregiver_evaluation_periods:FINAL",
      benefitsSource: "getFinancialBenefitsV2",
      walletSource: "caregiver_wallet_transactions",
      referralSource: "caregiver_referral_cases",
      profileVersion: VERSION,
    },
  };
}

async function caregiverProfile(request: Request, env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  }
  const profile = await buildCaregiverFinancialProfileV4(request, env, actor, actor.caregiverId);
  await audit(request, env, actor, "READ_OWN_FINANCIAL_PROFILE_V4", "caregiver", actor.caregiverId);
  return json({ data: profile });
}

async function staffProfile(request: Request, env: Env, actor: AuthUser, caregiverId: string) {
  const denied = await requireAccess(env, actor, STAFF_FINANCE_MODULE, "view");
  if (denied) return denied;
  try {
    const profile = await buildCaregiverFinancialProfileV4(request, env, actor, caregiverId);
    await audit(request, env, actor, "READ_CAREGIVER_FINANCIAL_PROFILE_V4", "caregiver", caregiverId);
    return json({ data: profile });
  } catch (error) {
    if (error instanceof Error && error.message === "caregiver_not_found") {
      return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
    }
    throw error;
  }
}

async function createBenefitRequest(request: Request, env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  }
  await ensureSchemas(env);
  const body = await readBody(request) || {};
  const benefits = await financialBenefitsFor(request, env, actor, actor.caregiverId);
  const requestedKey = str(body.benefitKey || body.tierKey).trim();
  let selected = requestedKey ? resolveBenefit(benefits, requestedKey) : null;
  if (!selected) {
    const eligibleLoans = loanArray(benefits).filter((item) => Boolean(item.eligible))
      .sort((a, b) => Number(b.amountToman || 0) - Number(a.amountToman || 0));
    selected = eligibleLoans[0] ? { benefitType: "LOAN", item: eligibleLoans[0] } : null;
  }
  if (!selected || !Boolean(selected.item.eligible)) {
    return fail("هنوز شرایط سابقه و امتیاز ارزیابی برای این تسهیلات احراز نشده است.", 409, "credit_not_eligible");
  }
  const benefitKey = String(selected.item.key || requestedKey || "");
  if (!benefitKey) return fail("نوع تسهیلات معتبر نیست.", 400, "invalid_benefit_key");
  const open = await env.DB.prepare(`SELECT id,status FROM caregiver_credit_requests
    WHERE caregiver_id=? AND status IN ('REQUESTED','UNDER_REVIEW','APPROVED') LIMIT 1`)
    .bind(actor.caregiverId).first<{ id: string; status: string }>();
  if (open) return fail("برای شما یک درخواست تسهیلات باز وجود دارد.", 409, "credit_request_exists");

  const evaluation = safeObject(benefits.evaluation);
  const timestamp = nowIso();
  const id = randomId("crq_");
  const snapshot = {
    profileVersion: VERSION,
    benefitKey,
    benefitType: selected.benefitType,
    benefitTitle: selected.item.title || (selected.benefitType === "ASSISTANCE" ? "کمک‌هزینه ماندگاری دوماهه" : "وام مراقبین"),
    amountToman: Number(selected.item.amountToman || 0),
    eligibleAtRequest: true,
    serviceMode: selected.item.serviceMode,
    targetMonths: selected.item.targetMonths,
    serviceDays: selected.item.serviceDays,
    scoreMode: selected.item.scoreMode,
    scoreThreshold: selected.item.scoreThreshold,
    comparison: selected.item.comparison,
    evaluationMetric: safeObject(selected.item.evaluation).metric,
    evaluationFinalizedPeriods: evaluation.finalizedPeriods,
    evaluationAverageScore: evaluation.averageScore,
    evaluationMinimumScore: evaluation.minimumScore,
    evaluationLatestScore: evaluation.latestScore,
    evaluationSource: "caregiver_evaluation_periods:FINAL",
    calculatedAt: benefits.calculatedAt || timestamp,
  };
  await env.DB.prepare(`INSERT INTO caregiver_credit_requests(
    id,caregiver_id,requested_amount_toman,eligibility_path,continuous_days,cumulative_days,
    eligibility_snapshot_json,note,status,requested_by_user_id,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,'REQUESTED',?,?,?)`).bind(
    id,
    actor.caregiverId,
    Number(selected.item.amountToman || 0),
    benefitKey,
    selected.item.serviceMode === "CONTINUOUS" ? Number(selected.item.serviceDays || 0) : 0,
    selected.item.serviceMode === "CUMULATIVE" ? Number(selected.item.serviceDays || 0) : 0,
    JSON.stringify(snapshot),
    str(body.note) || null,
    actor.id,
    timestamp,
    timestamp,
  ).run();
  await audit(request, env, actor, "CREATE_EVALUATION_LINKED_BENEFIT_REQUEST", "credit_request", id, snapshot);
  return json({ data: { id, status: "REQUESTED", ...snapshot, createdAt: timestamp } }, 201);
}

async function decideBenefitRequest(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await requireAccess(env, actor, STAFF_FINANCE_MODULE, "update");
  if (denied) return denied;
  await ensureSchemas(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تصمیم معتبر نیست.");
  const decision = upper(body.status || body.decision);
  const reason = str(body.reason || body.decisionNote || body.note).trim();
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"].includes(decision)) return fail("وضعیت تصمیم معتبر نیست.");
  if (!reason) return fail("ثبت دلیل تصمیم الزامی است.", 400, "reason_required");
  const row = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,requested_amount_toman AS requestedAmountToman,
      eligibility_path AS eligibilityPath,eligibility_snapshot_json AS eligibilitySnapshotJson,status
    FROM caregiver_credit_requests WHERE id=? LIMIT 1`).bind(id).first<CreditRequestRow>();
  if (!row?.caregiverId) return fail("درخواست اعتبار پیدا نشد.", 404, "credit_request_not_found");
  const current = upper(row.status);
  const valid = (decision === "UNDER_REVIEW" && current === "REQUESTED")
    || (decision === "APPROVED" && ["REQUESTED", "UNDER_REVIEW"].includes(current))
    || (decision === "REJECTED" && ["REQUESTED", "UNDER_REVIEW"].includes(current))
    || (decision === "CANCELLED" && OPEN_CREDIT_STATUSES.includes(current));
  if (!valid) return fail("تغییر وضعیت درخواست اعتبار مجاز نیست.", 409, "invalid_transition");

  let currentEligibility: JsonRecord | null = null;
  if (decision === "APPROVED") {
    const benefits = await financialBenefitsFor(request, env, actor, row.caregiverId);
    const snapshot = parseObject(row.eligibilitySnapshotJson);
    const benefitKey = String(snapshot.benefitKey || row.eligibilityPath || "");
    const selected = resolveBenefit(benefits, benefitKey, Number(row.requestedAmountToman || 0));
    if (!selected || !Boolean(selected.item.eligible)) {
      return json({
        message: "در زمان تصمیم، شرط سابقه و امتیاز ارزیابی این تسهیلات احراز نیست.",
        error: "credit_not_eligible",
        data: {
          benefitKey,
          evaluation: benefits.evaluation,
          allowance: benefits.allowance,
          loans: benefits.loans,
        },
      }, 409);
    }
    currentEligibility = {
      benefitKey: selected.item.key || benefitKey,
      benefitType: selected.benefitType,
      amountToman: selected.item.amountToman,
      serviceMode: selected.item.serviceMode,
      serviceDays: selected.item.serviceDays,
      evaluation: selected.item.evaluation,
      evaluationSource: "caregiver_evaluation_periods:FINAL",
      verifiedAt: nowIso(),
    };
  }

  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_credit_requests SET status=?,reviewed_by_user_id=?,reviewed_at=?,
    decision_note=?,updated_at=? WHERE id=?`).bind(decision, actor.id, timestamp, reason, timestamp, id).run();
  await audit(request, env, actor, `CREDIT_REQUEST_${decision}`, "credit_request", id, {
    caregiverId: row.caregiverId,
    previousStatus: current,
    reason,
    evaluationLinkedEligibility: currentEligibility,
  });
  return json({ data: { id, status: decision, reason, eligibility: currentEligibility, updatedAt: timestamp } });
}

export async function routeCaregiverFinancialProfileV4(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const relevant = path === "/api/caregiver/platform/financial-profile"
    || path === "/api/caregiver/platform/credit-requests"
    || /^\/api\/staff\/financial-credits\/caregivers\/[^/]+\/profile$/.test(path)
    || /^\/api\/staff\/financial-credits\/credit-requests\/[^/]+$/.test(path);
  if (!relevant) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  let response: Response;
  if (path === "/api/caregiver/platform/financial-profile" && method === "GET") {
    response = await caregiverProfile(request, env, actor);
  } else if (path === "/api/caregiver/platform/credit-requests" && method === "POST") {
    response = await createBenefitRequest(request, env, actor);
  } else {
    const profileMatch = path.match(/^\/api\/staff\/financial-credits\/caregivers\/([^/]+)\/profile$/);
    const creditMatch = path.match(/^\/api\/staff\/financial-credits\/credit-requests\/([^/]+)$/);
    if (profileMatch && method === "GET") {
      response = await staffProfile(request, env, actor, decodeURIComponent(profileMatch[1]));
    } else if (creditMatch && method === "PATCH") {
      response = await decideBenefitRequest(request, env, actor, decodeURIComponent(creditMatch[1]));
    } else {
      response = fail("مسیر کارنامه مالی پیدا نشد.", 404, "financial_profile_route_not_found");
    }
  }
  return securityHeaders(response);
}
