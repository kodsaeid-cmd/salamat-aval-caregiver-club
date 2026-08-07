import { requireAccess } from "./access-control";
import { ensureReferralRewardsSchema, routeReferralRewardsV1 } from "./referral-rewards-v1";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  getUser,
  hashPassword,
  json,
  normalizeMobile,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const REGISTRATION_REWARD_TOMAN = 200_000;
const CONTRACT_REWARD_TOMAN = 300_000;
const MILESTONE_SIZE = 10;
const MILESTONE_REWARD_TOMAN = 5_000_000;
const STAFF_FINANCE_MODULE = "staff.financial_credits";

type JsonRecord = Record<string, unknown>;
type ReferrerConfirmation = "PENDING" | "APPROVED" | "REJECTED";

type ReferralCaseRow = {
  id: string;
  referrerCaregiverId: string;
  referredCaregiverId: string;
  status: string;
  referrerConfirmationStatus: ReferrerConfirmation;
  registrationRewardTransactionId: string | null;
  contractRewardTransactionId: string | null;
};

function upper(value: unknown) {
  return str(value).toUpperCase();
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

async function resolveReferrerByCode(env: Env, referralCode: string, registeringMobile: string) {
  if (!referralCode) return null;
  if (!/^\d{6}$/.test(referralCode)) throw new Error("invalid_referral_code");
  const referrer = await env.DB.prepare(`SELECT c.id,c.membership_code AS membershipCode,c.full_name AS fullName,c.mobile,
      rc.referral_code AS referralCode,c.active,COALESCE(u.status,'ACTIVE') AS accountStatus
    FROM caregiver_referral_codes rc
    JOIN caregivers c ON c.id=rc.caregiver_id
    LEFT JOIN users u ON u.caregiver_id=c.id
    WHERE rc.referral_code=? AND c.active=1
      AND (u.id IS NULL OR upper(u.status) IN ('ACTIVE','APPROVED'))
    LIMIT 1`).bind(referralCode).first<{
      id: string;
      membershipCode: string;
      fullName: string;
      mobile: string | null;
      referralCode: string;
      active: number;
      accountStatus: string;
    }>();
  if (!referrer) throw new Error("invalid_referral_code");
  if (normalizeMobile(referrer.mobile) === registeringMobile) throw new Error("self_referral_not_allowed");
  return referrer;
}

async function publicRegisterCaregiverV2(request: Request, env: Env) {
  await ensureReferralRewardsSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات ثبت‌نام معتبر نیست.");

  const fullName = str(body.fullName || body.name);
  const mobile = normalizeMobile(str(body.mobile));
  const nationalId = str(body.nationalId).replace(/\D/g, "") || null;
  const username = str(body.email || body.username).toLowerCase();
  const password = str(body.password);
  const referralCode = str(body.referralCode || body.referrerCode).replace(/\D/g, "");

  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (!mobile || !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return fail("ایمیل ورود معتبر نیست.");
  if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  if (referralCode && !/^\d{6}$/.test(referralCode)) return fail("کد معرف باید دقیقاً ۶ رقم باشد.", 400, "invalid_referral_code_format");

  const duplicate = await env.DB.prepare(`SELECT id FROM users WHERE mobile=? OR lower(username)=?
    UNION ALL SELECT id FROM caregivers WHERE national_id=? AND ? IS NOT NULL LIMIT 1`)
    .bind(mobile, username, nationalId, nationalId).first();
  if (duplicate) return fail("برای این شماره، ایمیل یا کد ملی قبلاً ثبت‌نام شده است.", 409, "duplicate_registration");

  let referrer: Awaited<ReturnType<typeof resolveReferrerByCode>> = null;
  try {
    referrer = await resolveReferrerByCode(env, referralCode, mobile);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_referral_code";
    if (code === "self_referral_not_allowed") {
      return fail("استفاده از کد معرف متعلق به شماره همراه خودتان مجاز نیست.", 409, code);
    }
    return fail("کد معرف معتبر نیست یا حساب معرف فعال نیست.", 409, "invalid_referral_code");
  }

  const caregiverId = `CP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const userId = randomId("usr_");
  const timestamp = nowIso();
  const skills = str(body.skills).split(/[,،]/).map((item) => item.trim()).filter(Boolean);
  const statements = [
    env.DB.prepare(`INSERT INTO caregivers(
      id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,
      cooperation_status,active,birth_date,primary_type,skills_json,work_history,
      recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?, 'SELF_REGISTERED','NEW',1,?,?,?)`).bind(
      caregiverId,
      `SELF-${userId}`,
      caregiverId,
      nationalId,
      fullName,
      mobile,
      str(body.city) || null,
      str(body.address) || null,
      str(body.serviceGroup) || "PENDING_APPROVAL",
      str(body.birthDate) || null,
      str(body.serviceGroup) || null,
      JSON.stringify(skills),
      str(body.bio) || null,
      timestamp,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(`INSERT INTO users(
      id,caregiver_id,full_name,mobile,username,password_hash,role,status,
      permissions_json,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'CAREGIVER','PENDING','[]',?,?)`).bind(
      userId,
      caregiverId,
      fullName,
      mobile,
      username,
      await hashPassword(password),
      timestamp,
      timestamp,
    ),
  ];

  let referralCaseId: string | null = null;
  if (referrer) {
    referralCaseId = randomId("ref_");
    statements.push(env.DB.prepare(`INSERT INTO caregiver_referral_cases(
      id,referrer_caregiver_id,referred_caregiver_id,referral_code,
      registration_reward_toman,contract_reward_toman,status,
      referrer_confirmation_status,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'PENDING_REGISTRATION_REVIEW','PENDING',?,?)`).bind(
      referralCaseId,
      referrer.id,
      caregiverId,
      referrer.referralCode,
      REGISTRATION_REWARD_TOMAN,
      CONTRACT_REWARD_TOMAN,
      timestamp,
      timestamp,
    ));
  }

  await env.DB.batch(statements);
  const ownReferralCode = await ensureReferralCode(env, caregiverId);
  await audit(request, env, null, "SELF_REGISTER", "caregiver", caregiverId, {
    fullName,
    mobile,
    username,
    referralCaseId,
    referralCode: referrer?.referralCode || null,
  });
  if (referralCaseId && referrer) {
    await audit(request, env, null, "CREATE_REFERRAL_CASE_WAITING_REFERRER", "caregiver_referral_case", referralCaseId, {
      referrerCaregiverId: referrer.id,
      referredCaregiverId: caregiverId,
      referralCode: referrer.referralCode,
      registrationRewardToman: REGISTRATION_REWARD_TOMAN,
      contractRewardToman: CONTRACT_REWARD_TOMAN,
    });
  }

  return json({
    data: {
      requestCode: userId,
      caregiverId,
      membershipCode: caregiverId,
      referralCode: ownReferralCode,
      status: "PENDING",
      referral: referralCaseId ? {
        caseId: referralCaseId,
        status: "WAITING_REFERRER_CONFIRMATION",
        referralCode: referrer?.referralCode,
      } : null,
    },
  }, 201);
}

function effectiveReferralStatus(row: JsonRecord) {
  const confirmation = String(row.referrerConfirmationStatus || "APPROVED").toUpperCase();
  if (confirmation === "PENDING") return "WAITING_REFERRER_CONFIRMATION";
  if (confirmation === "REJECTED") return "REFERRER_REJECTED";
  return String(row.status || "");
}

async function caregiverReferralSummaryV2(env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  }
  await ensureReferralRewardsSchema(env);
  const caregiver = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName
    FROM caregivers WHERE id=? LIMIT 1`).bind(actor.caregiverId).first<JsonRecord>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const referralCode = await ensureReferralCode(env, actor.caregiverId);

  const cases = await env.DB.prepare(`SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,
      c.membership_code AS referredMembershipCode,c.full_name AS referredName,
      r.status,r.referrer_confirmation_status AS referrerConfirmationStatus,
      r.referrer_confirmed_at AS referrerConfirmedAt,r.referrer_rejected_at AS referrerRejectedAt,
      r.referrer_decision_note AS referrerDecisionNote,
      r.registration_reward_toman AS registrationRewardToman,
      r.contract_reward_toman AS contractRewardToman,
      r.registration_reward_transaction_id AS registrationRewardTransactionId,
      r.contract_reward_transaction_id AS contractRewardTransactionId,
      r.registration_reviewed_at AS registrationReviewedAt,
      r.contract_reviewed_at AS contractReviewedAt,
      r.registration_decision_note AS registrationDecisionNote,
      r.contract_decision_note AS contractDecisionNote,
      r.contract_check_last_at AS contractCheckLastAt,
      r.contract_check_note AS contractCheckNote,
      r.created_at AS createdAt,r.updated_at AS updatedAt
    FROM caregiver_referral_cases r
    JOIN caregivers c ON c.id=r.referred_caregiver_id
    WHERE r.referrer_caregiver_id=?
    ORDER BY r.created_at DESC LIMIT 300`).bind(actor.caregiverId).all<JsonRecord>();
  const rows = (cases.results || []).map((row) => ({ ...row, effectiveStatus: effectiveReferralStatus(row) }));

  let confirmedRewardToman = 0;
  let pendingRewardToman = 0;
  let completedReferrals = 0;
  let awaitingMyConfirmation = 0;
  for (const item of rows) {
    if (item.registrationRewardTransactionId) confirmedRewardToman += REGISTRATION_REWARD_TOMAN;
    if (item.contractRewardTransactionId) {
      confirmedRewardToman += CONTRACT_REWARD_TOMAN;
      completedReferrals += 1;
    }
    if (item.effectiveStatus === "WAITING_REFERRER_CONFIRMATION") {
      awaitingMyConfirmation += 1;
      pendingRewardToman += REGISTRATION_REWARD_TOMAN;
    } else if (item.effectiveStatus === "PENDING_REGISTRATION_REVIEW") {
      pendingRewardToman += REGISTRATION_REWARD_TOMAN;
    } else if (item.effectiveStatus === "WAITING_CONTRACT") {
      pendingRewardToman += CONTRACT_REWARD_TOMAN;
    }
  }

  const milestones = await env.DB.prepare(`SELECT milestone_number AS milestoneNumber,reward_toman AS rewardToman,
      wallet_transaction_id AS walletTransactionId,awarded_at AS awardedAt
    FROM caregiver_referral_milestones WHERE caregiver_id=? ORDER BY milestone_number DESC`)
    .bind(actor.caregiverId).all<JsonRecord>();
  const milestoneRows = milestones.results || [];
  const milestoneRewardToman = milestoneRows.reduce((sum, row) => sum + Number(row.rewardToman || 0), 0);
  confirmedRewardToman += milestoneRewardToman;

  const progressInCycle = completedReferrals % MILESTONE_SIZE;
  const nextMilestoneTarget = (Math.floor(completedReferrals / MILESTONE_SIZE) + 1) * MILESTONE_SIZE;
  const remainingToMilestone = MILESTONE_SIZE - progressInCycle;

  return json({
    data: {
      caregiver: { ...caregiver, referralCode },
      summary: {
        totalReferrals: rows.length,
        completedReferrals,
        confirmedRewardToman,
        pendingRewardToman,
        awaitingMyConfirmation,
        milestoneRewardToman,
        milestoneRewardsCount: milestoneRows.length,
        progressInCycle,
        remainingToMilestone,
        nextMilestoneTarget,
        milestoneSize: MILESTONE_SIZE,
        nextMilestoneRewardToman: MILESTONE_REWARD_TOMAN,
      },
      cases: rows,
      milestones: milestoneRows,
      policy: {
        registrationRewardToman: REGISTRATION_REWARD_TOMAN,
        contractRewardToman: CONTRACT_REWARD_TOMAN,
        milestoneSize: MILESTONE_SIZE,
        milestoneRewardToman: MILESTONE_REWARD_TOMAN,
      },
    },
  });
}

async function caregiverReferralDecision(request: Request, env: Env, actor: AuthUser, id: string) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  }
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تصمیم معتبر نیست.");
  const action = upper(body.action);
  if (!['CONFIRM','REJECT'].includes(action)) return fail("اقدام انتخاب‌شده معتبر نیست.");
  const note = str(body.note) || null;
  const current = await env.DB.prepare(`SELECT id,referrer_caregiver_id AS referrerCaregiverId,
      referred_caregiver_id AS referredCaregiverId,status,
      referrer_confirmation_status AS referrerConfirmationStatus
    FROM caregiver_referral_cases WHERE id=? LIMIT 1`).bind(id).first<ReferralCaseRow>();
  if (!current || current.referrerCaregiverId !== actor.caregiverId) {
    return fail("درخواست معرفی برای حساب شما پیدا نشد.", 404, "referral_case_not_found");
  }
  if (current.referrerConfirmationStatus !== "PENDING") {
    return fail("تصمیم شما برای این معرفی قبلاً ثبت شده است.", 409, "referrer_already_decided");
  }
  const timestamp = nowIso();
  if (action === "CONFIRM") {
    await env.DB.prepare(`UPDATE caregiver_referral_cases SET
      referrer_confirmation_status='APPROVED',referrer_confirmed_at=?,referrer_rejected_at=NULL,
      referrer_decision_note=?,updated_at=? WHERE id=? AND referrer_caregiver_id=?
      AND referrer_confirmation_status='PENDING'`).bind(timestamp, note, timestamp, id, actor.caregiverId).run();
    await audit(request, env, actor, "CONFIRM_REFERRAL_OWNERSHIP", "caregiver_referral_case", id, {
      referredCaregiverId: current.referredCaregiverId,
    });
    return json({ data: { id, referrerConfirmationStatus: "APPROVED", status: "PENDING_REGISTRATION_REVIEW" } });
  }

  await env.DB.prepare(`UPDATE caregiver_referral_cases SET
    referrer_confirmation_status='REJECTED',referrer_rejected_at=?,referrer_decision_note=?,
    status='REGISTRATION_REJECTED',updated_at=? WHERE id=? AND referrer_caregiver_id=?
    AND referrer_confirmation_status='PENDING'`).bind(timestamp, note, timestamp, id, actor.caregiverId).run();
  await audit(request, env, actor, "REJECT_REFERRAL_OWNERSHIP", "caregiver_referral_case", id, {
    referredCaregiverId: current.referredCaregiverId,
    note,
  });
  return json({ data: { id, referrerConfirmationStatus: "REJECTED", status: "REFERRER_REJECTED" } });
}

async function referralConfirmation(env: Env, id: string) {
  return env.DB.prepare(`SELECT referrer_caregiver_id AS referrerCaregiverId,
      referrer_confirmation_status AS referrerConfirmationStatus
    FROM caregiver_referral_cases WHERE id=? LIMIT 1`).bind(id).first<{
      referrerCaregiverId: string;
      referrerConfirmationStatus: ReferrerConfirmation;
    }>();
}

async function awardEligibleMilestones(request: Request, env: Env, actor: AuthUser, caregiverId: string) {
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS completedCount
    FROM caregiver_referral_cases
    WHERE referrer_caregiver_id=? AND status='COMPLETED'
      AND contract_reward_transaction_id IS NOT NULL
      AND referrer_confirmation_status='APPROVED'`).bind(caregiverId).first<{ completedCount: number }>();
  const completedCount = Number(countRow?.completedCount || 0);
  const highestMilestone = Math.floor(completedCount / MILESTONE_SIZE) * MILESTONE_SIZE;
  if (highestMilestone < MILESTONE_SIZE) return [];

  const awarded: number[] = [];
  for (let milestone = MILESTONE_SIZE; milestone <= highestMilestone; milestone += MILESTONE_SIZE) {
    const exists = await env.DB.prepare(`SELECT milestone_number AS milestoneNumber
      FROM caregiver_referral_milestones WHERE caregiver_id=? AND milestone_number=? LIMIT 1`)
      .bind(caregiverId, milestone).first();
    if (exists) continue;
    const transactionId = randomId("wtx_");
    const timestamp = nowIso();
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
          id,caregiver_id,direction,transaction_type,amount_toman,title,description,
          reference_type,reference_id,created_by_user_id,created_at
        ) VALUES(?,?,'CREDIT','REFERRAL_MILESTONE_REWARD',?,?,?,'REFERRAL_MILESTONE',?,?,?)`).bind(
          transactionId,
          caregiverId,
          MILESTONE_REWARD_TOMAN,
          `پاداش تکمیل ${milestone} معرفی موفق قراردادی`,
          `اعتبار ویژه هر ${MILESTONE_SIZE} معرفی موفق و تأییدشده`,
          `${caregiverId}:${milestone}`,
          actor.id,
          timestamp,
        ),
        env.DB.prepare(`INSERT INTO caregiver_referral_milestones(
          caregiver_id,milestone_number,reward_toman,wallet_transaction_id,approved_by_user_id,awarded_at
        ) VALUES(?,?,?,?,?,?)`).bind(
          caregiverId,
          milestone,
          MILESTONE_REWARD_TOMAN,
          transactionId,
          actor.id,
          timestamp,
        ),
      ]);
      awarded.push(milestone);
      await audit(request, env, actor, "AWARD_REFERRAL_MILESTONE", "caregiver", caregiverId, {
        milestone,
        completedCount,
        amountToman: MILESTONE_REWARD_TOMAN,
        transactionId,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "database_error";
      if (!/UNIQUE|unique/i.test(detail)) throw error;
    }
  }
  return awarded;
}

async function staffReferralDashboardV2(request: Request, env: Env) {
  const response = await routeReferralRewardsV1(request, env);
  if (!response || !response.ok) return response;
  const payload = await response.clone().json().catch(() => null) as { data?: JsonRecord } | null;
  if (!payload?.data) return response;
  const data = payload.data;
  const cases = Array.isArray(data.cases) ? data.cases as JsonRecord[] : [];
  if (!cases.length) return response;
  const pending = await env.DB.prepare(`SELECT id FROM caregiver_referral_cases
    WHERE referrer_confirmation_status<>'APPROVED'`).all<{ id: string }>();
  const hiddenIds = new Set((pending.results || []).map((row) => row.id));
  data.cases = cases.filter((row) => !hiddenIds.has(String(row.id || "")));
  data.pendingReferrerConfirmations = hiddenIds.size;
  return securityHeaders(json({ data }));
}

async function staffReferralDecisionV2(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await requireAccess(env, actor, STAFF_FINANCE_MODULE, "update");
  if (denied) return denied;
  const current = await referralConfirmation(env, id);
  if (!current) return fail("پرونده معرفی پیدا نشد.", 404, "referral_case_not_found");
  if (current.referrerConfirmationStatus !== "APPROVED") {
    return fail("ابتدا مراقب معرف باید استفاده از کد معرف خود را تأیید کند.", 409, "referrer_confirmation_required");
  }

  const body = await readBody(request.clone());
  const action = upper(body?.action);
  const response = await routeReferralRewardsV1(request, env);
  if (!response || !response.ok || action !== "APPROVE_CONTRACT") return response;
  await awardEligibleMilestones(request, env, actor, current.referrerCaregiverId);
  return response;
}

export async function routeReferralRewardsV2(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/public/caregivers/register" && method === "POST") {
    return securityHeaders(await publicRegisterCaregiverV2(request, env));
  }

  if (path === "/api/caregiver/platform/referrals" && method === "GET") {
    const actor = await getUser(request, env);
    if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
    return securityHeaders(await caregiverReferralSummaryV2(env, actor));
  }

  const caregiverMatch = path.match(/^\/api\/caregiver\/platform\/referrals\/([^/]+)$/);
  if (caregiverMatch && method === "PATCH") {
    const actor = await getUser(request, env);
    if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
    return securityHeaders(await caregiverReferralDecision(request, env, actor, decodeURIComponent(caregiverMatch[1])));
  }

  if (path === "/api/staff/financial-credits/referrals" && method === "GET") {
    return staffReferralDashboardV2(request, env);
  }

  const staffMatch = path.match(/^\/api\/staff\/financial-credits\/referrals\/([^/]+)$/);
  if (staffMatch && method === "PATCH") {
    const actor = await getUser(request, env);
    if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
    return securityHeaders(await staffReferralDecisionV2(request, env, actor, decodeURIComponent(staffMatch[1])));
  }

  return routeReferralRewardsV1(request, env);
}
