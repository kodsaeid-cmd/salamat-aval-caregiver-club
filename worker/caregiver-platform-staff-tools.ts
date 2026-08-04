import { requireAccess } from "./access-control";
import { ensureCaregiverPlatformSchema } from "./caregiver-platform-v1";
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

const MODULE = "staff.financial_credits";
const LOAN_AMOUNT_TOMAN = 500_000_000;
const CONTINUOUS_TARGET_DAYS = 730;
const CUMULATIVE_TARGET_DAYS = 1_200;
const DAY_MS = 86_400_000;
const OPEN_SETTLEMENT_STATUSES = ["REQUESTED", "APPROVED"];
const OPEN_CREDIT_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];

type JsonRecord = Record<string, unknown>;
type FinanceAction = "view" | "create" | "update" | "delete";
type ContractIntervalRow = {
  caregiverId: string;
  status: string | null;
  startsAt: string | null;
  endsAt: string | null;
};
type Interval = { start: string; end: string };
type Authorized = { actor: AuthUser; response?: never } | { actor?: never; response: Response };

const digits = (value: string) => value
  .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
  .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
const normalize = (value: unknown) => digits(str(value))
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim();
const upper = (value: unknown) => str(value).trim().toUpperCase();
const amount = (value: unknown) => Math.max(0, Math.trunc(Number(digits(str(value)).replace(/[,٬،\s]/g, "")) || 0));
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(value)) ? str(value) : null;
const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
const daysInclusive = (start: string, end: string) => Math.max(0, Math.floor((dateValue(end) - dateValue(start)) / DAY_MS) + 1);
const addDays = (value: string, days: number) => new Date(dateValue(value) + days * DAY_MS).toISOString().slice(0, 10);
const duration = (days: number) => ({ months: Math.floor(Math.max(0, days) / 30), days: Math.max(0, days) % 30 });
const progress = (value: number, target: number) => Math.min(100, Math.round((Math.max(0, value) / target) * 1_000) / 10);

async function safeFirst<T>(env: Env, sql: string, bindings: unknown[] = []) {
  try {
    return await env.DB.prepare(sql).bind(...bindings).first<T>();
  } catch {
    return null;
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

async function authorize(request: Request, env: Env, action: FinanceAction): Promise<Authorized> {
  const actor = await getUser(request, env);
  if (!actor) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  const denied = await requireAccess(env, actor, MODULE, action);
  return denied ? { response: securityHeaders(denied) } : { actor };
}

function contractStatus(value: unknown) {
  const normalized = upper(value).replace(/[‌\s_-]+/g, "");
  if (["ACTIVE", "APPROVED", "فعال", "جاری"].includes(normalized)) return "ACTIVE";
  if (["COMPLETED", "ENDED", "EXPIRED", "پایانیافته", "خاتمهیافته", "تمامشده", "منقضی"].includes(normalized)) return "COMPLETED";
  return "IGNORED";
}

function mergeIntervals(source: Interval[]) {
  const rows = source
    .filter((row) => row.start <= row.end)
    .sort((left, right) => left.start.localeCompare(right.start));
  const merged: Interval[] = [];
  for (const row of rows) {
    const previous = merged[merged.length - 1];
    if (!previous || dateValue(row.start) > dateValue(previous.end) + DAY_MS) merged.push({ ...row });
    else if (row.end > previous.end) previous.end = row.end;
  }
  return merged;
}

function calculateEligibility(rows: ContractIntervalRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  let hasActiveContract = false;
  const intervals: Interval[] = [];
  for (const row of rows) {
    const status = contractStatus(row.status);
    if (status === "IGNORED") continue;
    const start = isoDate(row.startsAt);
    if (!start || start > today) continue;
    let end = isoDate(row.endsAt);
    if (!end && status === "ACTIVE") end = today;
    if (!end) continue;
    if (end > today) end = today;
    if (end < start) continue;
    intervals.push({ start, end });
    if (status === "ACTIVE" && start <= today && end >= today) hasActiveContract = true;
  }
  const merged = mergeIntervals(intervals);
  const cumulativeDays = merged.reduce((sum, row) => sum + daysInclusive(row.start, row.end), 0);
  const longestDays = merged.reduce((maximum, row) => Math.max(maximum, daysInclusive(row.start, row.end)), 0);
  const currentInterval = hasActiveContract ? merged.find((row) => row.start <= today && row.end >= today) || null : null;
  const currentContinuousDays = currentInterval ? daysInclusive(currentInterval.start, today) : 0;
  const eligibleContinuous = longestDays >= CONTINUOUS_TARGET_DAYS;
  const eligibleCumulative = cumulativeDays >= CUMULATIVE_TARGET_DAYS;
  const eligible = eligibleContinuous || eligibleCumulative;
  const remainingContinuousDays = eligibleContinuous
    ? 0
    : hasActiveContract
      ? Math.max(0, CONTINUOUS_TARGET_DAYS - currentContinuousDays)
      : CONTINUOUS_TARGET_DAYS;
  const remainingCumulativeDays = Math.max(0, CUMULATIVE_TARGET_DAYS - cumulativeDays);
  const remainingActiveDays = eligible ? 0 : Math.min(remainingContinuousDays, remainingCumulativeDays);
  const projectedEligibilityDate = eligible
    ? today
    : hasActiveContract
      ? addDays(today, Math.max(0, remainingActiveDays - 1))
      : null;
  return {
    eligible,
    eligibleBy: eligibleContinuous ? "CONTINUOUS" : eligibleCumulative ? "CUMULATIVE" : null,
    status: eligible ? "ELIGIBLE" : hasActiveContract ? "IN_PROGRESS" : merged.length ? "PAUSED" : "NO_CONTRACTS",
    amountToman: LOAN_AMOUNT_TOMAN,
    progressPercent: Math.max(progress(longestDays, CONTINUOUS_TARGET_DAYS), progress(cumulativeDays, CUMULATIVE_TARGET_DAYS)),
    remainingActiveDays,
    remainingDuration: duration(remainingActiveDays),
    projectedEligibilityDate,
    continuous: {
      longestDays,
      currentDays: currentContinuousDays,
      targetDays: CONTINUOUS_TARGET_DAYS,
      progressPercent: progress(longestDays, CONTINUOUS_TARGET_DAYS),
      remainingDays: Math.max(0, CONTINUOUS_TARGET_DAYS - longestDays),
      active: hasActiveContract,
    },
    cumulative: {
      days: cumulativeDays,
      targetDays: CUMULATIVE_TARGET_DAYS,
      progressPercent: progress(cumulativeDays, CUMULATIVE_TARGET_DAYS),
      remainingDays: remainingCumulativeDays,
    },
  };
}

async function contractsForCaregivers(env: Env, caregiverIds: string[]) {
  if (!caregiverIds.length) return new Map<string, ContractIntervalRow[]>();
  const placeholders = caregiverIds.map(() => "?").join(",");
  const rows = await safeAll<ContractIntervalRow>(env, `SELECT caregiver_id AS caregiverId,status,
    starts_at AS startsAt,ends_at AS endsAt FROM contracts WHERE caregiver_id IN (${placeholders})`, caregiverIds);
  const grouped = new Map<string, ContractIntervalRow[]>();
  for (const id of caregiverIds) grouped.set(id, []);
  for (const row of rows) grouped.get(row.caregiverId)?.push(row);
  return grouped;
}

async function walletSummary(env: Env, caregiverId: string) {
  const [totals, pending] = await Promise.all([
    safeFirst<{ balanceToman: number; creditToman: number; debitToman: number }>(env, `SELECT
      COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE -amount_toman END),0) AS balanceToman,
      COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE 0 END),0) AS creditToman,
      COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount_toman ELSE 0 END),0) AS debitToman
      FROM caregiver_wallet_transactions WHERE caregiver_id=?`, [caregiverId]),
    safeFirst<{ pendingToman: number; pendingCount: number }>(env, `SELECT
      COALESCE(SUM(amount_toman),0) AS pendingToman,COUNT(*) AS pendingCount
      FROM caregiver_settlement_requests WHERE caregiver_id=? AND status IN ('REQUESTED','APPROVED')`, [caregiverId]),
  ]);
  const balanceToman = Number(totals?.balanceToman || 0);
  const pendingSettlementToman = Number(pending?.pendingToman || 0);
  return {
    balanceToman,
    availableToman: Math.max(0, balanceToman - pendingSettlementToman),
    pendingSettlementToman,
    pendingSettlementCount: Number(pending?.pendingCount || 0),
    totalCreditToman: Number(totals?.creditToman || 0),
    totalDebitToman: Number(totals?.debitToman || 0),
  };
}

function requestFilters(url: URL, kind: "settlement" | "credit") {
  const query = normalize(url.searchParams.get("q"));
  const statusParam = upper(url.searchParams.get(kind === "settlement" ? "settlementStatus" : "creditStatus"));
  const allowed = kind === "settlement"
    ? ["REQUESTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"]
    : ["REQUESTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"];
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (query) {
    const like = `%${query}%`;
    clauses.push("(replace(replace(c.full_name,'ي','ی'),'ك','ک') LIKE ? OR c.membership_code LIKE ? OR c.mobile LIKE ?)");
    bindings.push(like, like, like);
  }
  if (statusParam && allowed.includes(statusParam)) {
    clauses.push(`${kind === "settlement" ? "s" : "r"}.status=?`);
    bindings.push(statusParam);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", bindings };
}

async function financialDashboard(request: Request, env: Env) {
  const auth = await authorize(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const url = new URL(request.url);
  const settlementFilter = requestFilters(url, "settlement");
  const creditFilter = requestFilters(url, "credit");
  const [summary, settlements, creditRequests, recentTransactions] = await Promise.all([
    safeFirst<JsonRecord>(env, `SELECT
      (SELECT COUNT(*) FROM caregivers WHERE cooperation_status IS NULL OR cooperation_status<>'حذف‌شده') AS caregiverCount,
      (SELECT COUNT(*) FROM caregiver_settlement_requests WHERE status='REQUESTED') AS settlementRequested,
      (SELECT COALESCE(SUM(amount_toman),0) FROM caregiver_settlement_requests WHERE status='REQUESTED') AS settlementRequestedToman,
      (SELECT COUNT(*) FROM caregiver_credit_requests WHERE status IN ('REQUESTED','UNDER_REVIEW')) AS creditRequested,
      (SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE -amount_toman END),0) FROM caregiver_wallet_transactions) AS totalWalletBalance,
      (SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE 0 END),0) FROM caregiver_wallet_transactions) AS totalWalletCredits,
      (SELECT COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount_toman ELSE 0 END),0) FROM caregiver_wallet_transactions) AS totalWalletDebits,
      (SELECT COALESCE(SUM(amount_toman),0) FROM caregiver_settlement_requests WHERE status='PAID') AS paidSettlementToman`),
    safeAll<JsonRecord>(env, `SELECT s.id,s.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,c.mobile,s.amount_toman AS amountToman,
      s.account_holder_name AS accountHolderName,s.iban,s.account_number AS accountNumber,
      s.bank_name AS bankName,s.note,s.status,s.decision_note AS decisionNote,
      reviewer.full_name AS reviewerName,payer.full_name AS payerName,s.reviewed_at AS reviewedAt,
      s.paid_at AS paidAt,s.payment_tracking_number AS paymentTrackingNumber,
      s.created_at AS createdAt,s.updated_at AS updatedAt
      FROM caregiver_settlement_requests s JOIN caregivers c ON c.id=s.caregiver_id
      LEFT JOIN users reviewer ON reviewer.id=s.reviewed_by_user_id
      LEFT JOIN users payer ON payer.id=s.paid_by_user_id
      ${settlementFilter.where}
      ORDER BY CASE s.status WHEN 'REQUESTED' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,s.created_at DESC LIMIT 200`, settlementFilter.bindings),
    safeAll<JsonRecord>(env, `SELECT r.id,r.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,c.mobile,r.requested_amount_toman AS requestedAmountToman,
      r.eligibility_path AS eligibilityPath,r.continuous_days AS continuousDays,
      r.cumulative_days AS cumulativeDays,r.note,r.status,r.decision_note AS decisionNote,
      reviewer.full_name AS reviewerName,r.reviewed_at AS reviewedAt,r.created_at AS createdAt,
      r.updated_at AS updatedAt FROM caregiver_credit_requests r JOIN caregivers c ON c.id=r.caregiver_id
      LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by_user_id
      ${creditFilter.where}
      ORDER BY CASE r.status WHEN 'REQUESTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 200`, creditFilter.bindings),
    safeAll<JsonRecord>(env, `SELECT t.id,t.caregiver_id AS caregiverId,c.full_name AS caregiverName,
      c.membership_code AS membershipCode,t.direction,t.transaction_type AS transactionType,
      t.amount_toman AS amountToman,t.title,t.description,t.reference_type AS referenceType,
      t.reference_id AS referenceId,u.full_name AS createdByName,t.created_at AS createdAt
      FROM caregiver_wallet_transactions t JOIN caregivers c ON c.id=t.caregiver_id
      LEFT JOIN users u ON u.id=t.created_by_user_id ORDER BY t.created_at DESC LIMIT 80`),
  ]);
  return securityHeaders(json({
    data: {
      summary: summary || {},
      settlements,
      creditRequests,
      recentTransactions,
      policy: {
        amountToman: LOAN_AMOUNT_TOMAN,
        continuousTargetDays: CONTINUOUS_TARGET_DAYS,
        continuousTargetMonths: 24,
        cumulativeTargetDays: CUMULATIVE_TARGET_DAYS,
        cumulativeTargetMonths: 40,
      },
      source: "financial-credits-hub-v1",
      generatedAt: nowIso(),
    },
  }));
}

async function searchCaregivers(request: Request, env: Env) {
  const auth = await authorize(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const url = new URL(request.url);
  const query = normalize(url.searchParams.get("q"));
  const page = clamp(Math.trunc(Number(url.searchParams.get("page") || 1)), 1, 100_000);
  const pageSize = clamp(Math.trunc(Number(url.searchParams.get("pageSize") || 25)), 10, 50);
  const offset = (page - 1) * pageSize;
  const like = `%${query}%`;
  const where = `(c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده')
    AND (?='' OR replace(replace(c.full_name,'ي','ی'),'ك','ک') LIKE ? OR c.membership_code LIKE ?
      OR c.mobile LIKE ? OR c.national_id LIKE ?)`;
  const [count, rows] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM caregivers c WHERE ${where}`)
      .bind(query, like, like, like, like).first<{ total: number }>(),
    env.DB.prepare(`SELECT c.id,c.membership_code AS membershipCode,c.full_name AS fullName,
      c.mobile,c.national_id AS nationalId,c.cooperation_status AS fileStatus,
      c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      COALESCE((SELECT SUM(CASE WHEN t.direction='CREDIT' THEN t.amount_toman ELSE -t.amount_toman END)
        FROM caregiver_wallet_transactions t WHERE t.caregiver_id=c.id),0) AS balanceToman,
      COALESCE((SELECT SUM(s.amount_toman) FROM caregiver_settlement_requests s
        WHERE s.caregiver_id=c.id AND s.status IN ('REQUESTED','APPROVED')),0) AS pendingSettlementToman,
      COALESCE((SELECT COUNT(*) FROM caregiver_settlement_requests s
        WHERE s.caregiver_id=c.id AND s.status IN ('REQUESTED','APPROVED')),0) AS openSettlementCount,
      (SELECT r.status FROM caregiver_credit_requests r WHERE r.caregiver_id=c.id
        ORDER BY r.created_at DESC LIMIT 1) AS latestCreditStatus,
      (SELECT r.created_at FROM caregiver_credit_requests r WHERE r.caregiver_id=c.id
        ORDER BY r.created_at DESC LIMIT 1) AS latestCreditCreatedAt
      FROM caregivers c WHERE ${where}
      ORDER BY CASE WHEN ?<>'' AND replace(replace(c.full_name,'ي','ی'),'ك','ک') LIKE ? THEN 0 ELSE 1 END,
        c.full_name,c.membership_code LIMIT ? OFFSET ?`)
      .bind(query, like, like, like, like, query, like, pageSize, offset).all<JsonRecord>(),
  ]);
  const caregivers = rows.results || [];
  const ids = caregivers.map((row) => str(row.id)).filter(Boolean);
  const groupedContracts = await contractsForCaregivers(env, ids);
  const enriched = caregivers.map((row) => {
    const balanceToman = Number(row.balanceToman || 0);
    const pendingSettlementToman = Number(row.pendingSettlementToman || 0);
    return {
      ...row,
      wallet: {
        balanceToman,
        pendingSettlementToman,
        availableToman: Math.max(0, balanceToman - pendingSettlementToman),
        openSettlementCount: Number(row.openSettlementCount || 0),
      },
      creditEligibility: calculateEligibility(groupedContracts.get(str(row.id)) || []),
    };
  });
  const total = Number(count?.total || 0);
  await audit(request, env, auth.actor, "READ_FINANCIAL_CAREGIVER_DIRECTORY", "financial_directory", "caregivers", {
    query, page, pageSize, resultCount: enriched.length,
  });
  return securityHeaders(json({
    data: {
      caregivers: enriched,
      query,
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      policy: { amountToman: LOAN_AMOUNT_TOMAN, continuousTargetDays: CONTINUOUS_TARGET_DAYS, cumulativeTargetDays: CUMULATIVE_TARGET_DAYS },
    },
  }));
}

async function caregiverFinancialContext(request: Request, env: Env, caregiverId: string) {
  const auth = await authorize(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const caregiver = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,
    mobile,national_id AS nationalId,city,address,cooperation_status AS fileStatus,
    professional_level AS professionalLevel,professional_score AS professionalScore,
    license_status AS licenseStatus FROM caregivers WHERE id=? LIMIT 1`)
    .bind(caregiverId).first<JsonRecord>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  const [wallet, contracts, transactions, settlements, creditRequests] = await Promise.all([
    walletSummary(env, caregiverId),
    safeAll<JsonRecord>(env, `SELECT id,contract_number AS contractNumber,family_name AS familyName,
      service_type AS serviceType,status,starts_at AS startsAt,ends_at AS endsAt,
      monthly_hours AS scheduledHours,logged_hours AS loggedHours,overtime_hours AS overtimeHours,
      absent_hours AS absentHours,payment_rate AS paymentRate,payment_type AS paymentType
      FROM contracts WHERE caregiver_id=? ORDER BY starts_at DESC,created_at DESC`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT t.id,t.direction,t.transaction_type AS transactionType,
      t.amount_toman AS amountToman,t.title,t.description,t.reference_type AS referenceType,
      t.reference_id AS referenceId,u.full_name AS createdByName,t.created_at AS createdAt
      FROM caregiver_wallet_transactions t LEFT JOIN users u ON u.id=t.created_by_user_id
      WHERE t.caregiver_id=? ORDER BY t.created_at DESC LIMIT 200`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT id,amount_toman AS amountToman,account_holder_name AS accountHolderName,
      iban,account_number AS accountNumber,bank_name AS bankName,note,status,
      decision_note AS decisionNote,reviewed_at AS reviewedAt,paid_at AS paidAt,
      payment_tracking_number AS paymentTrackingNumber,created_at AS createdAt,updated_at AS updatedAt
      FROM caregiver_settlement_requests WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 100`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT id,requested_amount_toman AS requestedAmountToman,
      eligibility_path AS eligibilityPath,continuous_days AS continuousDays,
      cumulative_days AS cumulativeDays,note,status,decision_note AS decisionNote,
      reviewed_at AS reviewedAt,created_at AS createdAt,updated_at AS updatedAt
      FROM caregiver_credit_requests WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 50`, [caregiverId]),
  ]);
  const eligibilityRows = contracts.map((row) => ({
    caregiverId,
    status: str(row.status),
    startsAt: str(row.startsAt) || null,
    endsAt: str(row.endsAt) || null,
  }));
  const creditEligibility = calculateEligibility(eligibilityRows);
  await audit(request, env, auth.actor, "READ_CAREGIVER_FINANCIAL_FILE", "caregiver", caregiverId, {
    walletBalanceToman: wallet.balanceToman,
    eligible: creditEligibility.eligible,
  });
  return securityHeaders(json({
    data: { caregiver, wallet, creditEligibility, contracts, transactions, settlements, creditRequests, source: "financial-credits-hub-v1" },
  }));
}

function requiredReason(body: JsonRecord | null) {
  const reason = str(body?.reason || body?.decisionNote || body?.description).trim();
  return reason.length >= 3 ? reason : null;
}

async function createWalletEntry(request: Request, env: Env, actor: AuthUser, body: JsonRecord, forcedKind?: string) {
  const caregiverId = str(body.caregiverId);
  const value = amount(body.amountToman);
  const kind = upper(forcedKind || body.kind || body.transactionType || "TOPUP");
  const reason = requiredReason(body);
  if (!caregiverId) return securityHeaders(fail("انتخاب مراقب الزامی است."));
  if (!value) return securityHeaders(fail("مبلغ تراکنش باید بیشتر از صفر باشد."));
  if (!reason) return securityHeaders(fail("ثبت دلیل تراکنش الزامی است.", 400, "reason_required"));
  const caregiver = await env.DB.prepare("SELECT id,full_name AS fullName FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId).first<{ id: string; fullName: string }>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));

  let direction = "CREDIT";
  let transactionType = "ADMIN_TOPUP";
  let title = str(body.title) || "شارژ مدیریتی کیف پول";
  let referenceType = "ADMIN_ADJUSTMENT";
  let referenceId = str(body.referenceId || body.idempotencyKey) || randomId("adjref_");
  if (kind === "REFERRAL_REWARD") {
    transactionType = "REFERRAL_REWARD";
    title = str(body.title) || "پاداش معرفی پرونده مراقبت";
    referenceType = "REFERRAL_CASE";
    referenceId = str(body.referralCaseId || body.referenceId);
    if (!referenceId) return securityHeaders(fail("شناسه پرونده معرفی‌شده الزامی است."));
  } else if (kind === "DEBIT" || kind === "ADMIN_DEBIT") {
    direction = "DEBIT";
    transactionType = "ADMIN_DEBIT";
    title = str(body.title) || "اصلاح بدهکار کیف پول";
    const wallet = await walletSummary(env, caregiverId);
    if (value > wallet.balanceToman) {
      return securityHeaders(fail("مانده کیف پول برای ثبت برداشت مدیریتی کافی نیست.", 409, "insufficient_wallet_balance"));
    }
  } else if (!["TOPUP", "ADMIN_TOPUP", "CREDIT"].includes(kind)) {
    return securityHeaders(fail("نوع تراکنش کیف پول معتبر نیست."));
  }

  const id = randomId("wtx_");
  const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
      id,caregiver_id,direction,transaction_type,amount_toman,title,description,
      reference_type,reference_id,created_by_user_id,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, caregiverId, direction, transactionType, value, title, reason,
      referenceType, referenceId, actor.id, timestamp,
    ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) {
      return securityHeaders(fail(
        transactionType === "REFERRAL_REWARD"
          ? "برای این پرونده معرفی‌شده قبلاً پاداش ثبت شده است."
          : "این تراکنش قبلاً ثبت شده است.",
        409,
        "duplicate_wallet_reference",
      ));
    }
    throw error;
  }
  const wallet = await walletSummary(env, caregiverId);
  await audit(request, env, actor, transactionType === "REFERRAL_REWARD" ? "GRANT_REFERRAL_REWARD" : "ADMIN_WALLET_ADJUSTMENT", "wallet_transaction", id, {
    caregiverId, caregiverName: caregiver.fullName, direction, transactionType, amountToman: value,
    reason, referenceType, referenceId,
  });
  return securityHeaders(json({
    data: { id, caregiverId, direction, transactionType, amountToman: value, title, reason, referenceType, referenceId, createdAt: timestamp, wallet },
  }, 201));
}

async function createWalletAdjustment(request: Request, env: Env, forcedKind?: string) {
  const auth = await authorize(request, env, "create");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات تراکنش معتبر نیست."));
  return createWalletEntry(request, env, auth.actor, body, forcedKind);
}

async function decideSettlement(request: Request, env: Env, id: string) {
  const auth = await authorize(request, env, "update");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات تصمیم معتبر نیست."));
  const decision = upper(body.status || body.decision);
  const reason = requiredReason(body);
  if (!["APPROVED", "REJECTED", "PAID"].includes(decision)) return securityHeaders(fail("وضعیت تصمیم معتبر نیست."));
  if (!reason) return securityHeaders(fail("ثبت دلیل تصمیم الزامی است.", 400, "reason_required"));
  const row = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,amount_toman AS amountToman,status
    FROM caregiver_settlement_requests WHERE id=? LIMIT 1`).bind(id)
    .first<{ id: string; caregiverId: string; amountToman: number; status: string }>();
  if (!row) return securityHeaders(fail("درخواست تسویه پیدا نشد.", 404, "settlement_not_found"));
  const current = upper(row.status);
  if (decision === "APPROVED" && current !== "REQUESTED") return securityHeaders(fail("فقط درخواست جدید قابل تأیید است.", 409, "invalid_transition"));
  if (decision === "REJECTED" && !OPEN_SETTLEMENT_STATUSES.includes(current)) return securityHeaders(fail("این درخواست قابل رد نیست.", 409, "invalid_transition"));
  if (decision === "PAID" && current !== "APPROVED") return securityHeaders(fail("ابتدا درخواست باید تأیید شود.", 409, "invalid_transition"));
  const timestamp = nowIso();
  if (decision === "PAID") {
    const tracking = str(body.paymentTrackingNumber).trim();
    if (!tracking) return securityHeaders(fail("شماره پیگیری پرداخت الزامی است."));
    const wallet = await walletSummary(env, row.caregiverId);
    if (row.amountToman > wallet.balanceToman) return securityHeaders(fail("مانده کیف پول برای ثبت پرداخت کافی نیست.", 409, "insufficient_wallet_balance"));
    const transactionId = randomId("wtx_");
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
          id,caregiver_id,direction,transaction_type,amount_toman,title,description,
          reference_type,reference_id,created_by_user_id,created_at
        ) VALUES(?,?,'DEBIT','SETTLEMENT',?,'تسویه کیف پول',?,'SETTLEMENT_REQUEST',?,?,?)`)
          .bind(transactionId, row.caregiverId, row.amountToman, reason, id, auth.actor.id, timestamp),
        env.DB.prepare(`UPDATE caregiver_settlement_requests SET status='PAID',reviewed_by_user_id=COALESCE(reviewed_by_user_id,?),
          reviewed_at=COALESCE(reviewed_at,?),paid_by_user_id=?,paid_at=?,payment_tracking_number=?,
          decision_note=?,updated_at=? WHERE id=? AND status='APPROVED'`)
          .bind(auth.actor.id, timestamp, auth.actor.id, timestamp, tracking, reason, timestamp, id),
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "database_error";
      if (/UNIQUE|unique/i.test(detail)) return securityHeaders(fail("این تسویه قبلاً در دفتر کیف پول ثبت شده است.", 409, "settlement_already_recorded"));
      throw error;
    }
  } else {
    await env.DB.prepare(`UPDATE caregiver_settlement_requests SET status=?,reviewed_by_user_id=?,
      reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(
      decision, auth.actor.id, timestamp, reason, timestamp, id,
    ).run();
  }
  const wallet = await walletSummary(env, row.caregiverId);
  await audit(request, env, auth.actor, `SETTLEMENT_${decision}`, "settlement_request", id, {
    caregiverId: row.caregiverId, amountToman: row.amountToman, reason,
    paymentTrackingNumber: decision === "PAID" ? str(body.paymentTrackingNumber) : null,
  });
  return securityHeaders(json({ data: { id, status: decision, reason, wallet, updatedAt: timestamp } }));
}

async function decideCreditRequest(request: Request, env: Env, id: string) {
  const auth = await authorize(request, env, "update");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات تصمیم معتبر نیست."));
  const decision = upper(body.status || body.decision);
  const reason = requiredReason(body);
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"].includes(decision)) return securityHeaders(fail("وضعیت تصمیم معتبر نیست."));
  if (!reason) return securityHeaders(fail("ثبت دلیل تصمیم الزامی است.", 400, "reason_required"));
  const row = await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,status FROM caregiver_credit_requests WHERE id=? LIMIT 1")
    .bind(id).first<{ id: string; caregiverId: string; status: string }>();
  if (!row) return securityHeaders(fail("درخواست اعتبار پیدا نشد.", 404, "credit_request_not_found"));
  const current = upper(row.status);
  const valid = (decision === "UNDER_REVIEW" && current === "REQUESTED")
    || (decision === "APPROVED" && ["REQUESTED", "UNDER_REVIEW"].includes(current))
    || (decision === "REJECTED" && ["REQUESTED", "UNDER_REVIEW"].includes(current))
    || (decision === "CANCELLED" && OPEN_CREDIT_STATUSES.includes(current));
  if (!valid) return securityHeaders(fail("تغییر وضعیت درخواست اعتبار مجاز نیست.", 409, "invalid_transition"));
  const contracts = await safeAll<ContractIntervalRow>(env, `SELECT caregiver_id AS caregiverId,status,
    starts_at AS startsAt,ends_at AS endsAt FROM contracts WHERE caregiver_id=?`, [row.caregiverId]);
  const eligibility = calculateEligibility(contracts);
  if (decision === "APPROVED" && !eligibility.eligible) {
    return securityHeaders(json({
      message: "مراقب در زمان تصمیم هنوز شرط ۲۴ ماه پیوسته یا ۴۰ ماه تجمیعی را تکمیل نکرده است.",
      error: "credit_not_eligible",
      data: { eligibility },
    }, 409));
  }
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_credit_requests SET status=?,reviewed_by_user_id=?,reviewed_at=?,
    decision_note=?,updated_at=? WHERE id=?`).bind(
    decision, auth.actor.id, timestamp, reason, timestamp, id,
  ).run();
  await audit(request, env, auth.actor, `CREDIT_REQUEST_${decision}`, "credit_request", id, {
    caregiverId: row.caregiverId, previousStatus: current, reason, eligibility,
  });
  return securityHeaders(json({ data: { id, status: decision, reason, eligibility, updatedAt: timestamp } }));
}

export async function routeCaregiverPlatformStaffTools(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (!url.pathname.startsWith("/api/staff/financial-credits")) return null;

  if (url.pathname === "/api/staff/financial-credits" && method === "GET") return financialDashboard(request, env);
  if (url.pathname === "/api/staff/financial-credits/caregivers" && method === "GET") return searchCaregivers(request, env);
  if (url.pathname === "/api/staff/financial-credits/wallet-adjustments" && method === "POST") return createWalletAdjustment(request, env);
  if (url.pathname === "/api/staff/financial-credits/rewards" && method === "POST") return createWalletAdjustment(request, env, "REFERRAL_REWARD");

  const caregiverMatch = url.pathname.match(/^\/api\/staff\/financial-credits\/caregivers\/([^/]+)$/);
  if (caregiverMatch && method === "GET") return caregiverFinancialContext(request, env, decodeURIComponent(caregiverMatch[1]));
  const settlementMatch = url.pathname.match(/^\/api\/staff\/financial-credits\/settlements\/([^/]+)$/);
  if (settlementMatch && method === "PATCH") return decideSettlement(request, env, decodeURIComponent(settlementMatch[1]));
  const creditMatch = url.pathname.match(/^\/api\/staff\/financial-credits\/credit-requests\/([^/]+)$/);
  if (creditMatch && method === "PATCH") return decideCreditRequest(request, env, decodeURIComponent(creditMatch[1]));

  return securityHeaders(fail("مسیر اعتبارات مالی پیدا نشد.", 404, "financial_credits_route_not_found"));
}
