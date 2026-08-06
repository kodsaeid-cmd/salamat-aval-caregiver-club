import { requireAccess } from "./access-control";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
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
const STAFF_FINANCE_MODULE = "staff.financial_credits";
const REFERRAL_STATUSES = [
  "PENDING_REGISTRATION_REVIEW",
  "WAITING_CONTRACT",
  "COMPLETED",
  "REGISTRATION_REJECTED",
  "CONTRACT_REJECTED",
] as const;
const REFERRAL_ACTIONS = [
  "APPROVE_REGISTRATION",
  "HOLD_CONTRACT",
  "APPROVE_CONTRACT",
  "REJECT_REGISTRATION",
  "REJECT_CONTRACT",
  "REOPEN_CONTRACT",
] as const;

type JsonRecord = Record<string, unknown>;
type ReferralStatus = typeof REFERRAL_STATUSES[number];
type ReferralAction = typeof REFERRAL_ACTIONS[number];
type ReferralSummary = {
  totalReferrals: number;
  completedReferrals: number;
  confirmedRewardToman: number;
  pendingRewardToman: number;
};

type ReferralRow = {
  id: string;
  referrerCaregiverId: string;
  referredCaregiverId: string;
  status: ReferralStatus;
  registrationRewardTransactionId: string | null;
  contractRewardTransactionId: string | null;
};

let referralSchemaReady: Promise<void> | undefined;

function upper(value: unknown) {
  return str(value).toUpperCase();
}

function isIsoMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function referralStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_REGISTRATION_REVIEW: "در انتظار تأیید پاداش ثبت‌نام",
    WAITING_CONTRACT: "در انتظار بررسی ورود به قرارداد",
    COMPLETED: "پاداش کامل ۵۰۰ هزار تومانی",
    REGISTRATION_REJECTED: "پاداش ثبت‌نام رد شده",
    CONTRACT_REJECTED: "پاداش مرحله قرارداد رد شده",
  };
  return labels[status] || status;
}

export async function ensureReferralRewardsSchema(env: Env) {
  if (!referralSchemaReady) {
    referralSchemaReady = (async () => {
      await ensureSchema(env);
      const statements = [
        `CREATE TABLE IF NOT EXISTS caregiver_wallet_transactions (
          id TEXT PRIMARY KEY,
          caregiver_id TEXT NOT NULL,
          direction TEXT NOT NULL CHECK(direction IN ('CREDIT','DEBIT')),
          transaction_type TEXT NOT NULL,
          amount_toman INTEGER NOT NULL CHECK(amount_toman > 0),
          title TEXT NOT NULL,
          description TEXT,
          reference_type TEXT,
          reference_id TEXT,
          created_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_reference_unique
          ON caregiver_wallet_transactions(reference_type,reference_id,direction)
          WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL`,
        `CREATE TABLE IF NOT EXISTS caregiver_referral_cases (
          id TEXT PRIMARY KEY,
          referrer_caregiver_id TEXT NOT NULL,
          referred_caregiver_id TEXT NOT NULL UNIQUE,
          referral_code TEXT NOT NULL,
          registration_reward_toman INTEGER NOT NULL DEFAULT 200000,
          contract_reward_toman INTEGER NOT NULL DEFAULT 300000,
          status TEXT NOT NULL DEFAULT 'PENDING_REGISTRATION_REVIEW',
          registration_reward_transaction_id TEXT UNIQUE,
          contract_reward_transaction_id TEXT UNIQUE,
          registration_reviewed_by_user_id TEXT,
          registration_reviewed_at TEXT,
          registration_decision_note TEXT,
          contract_reviewed_by_user_id TEXT,
          contract_reviewed_at TEXT,
          contract_decision_note TEXT,
          contract_check_last_at TEXT,
          contract_check_note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(referrer_caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(referred_caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(registration_reward_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
          FOREIGN KEY(contract_reward_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
          FOREIGN KEY(registration_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY(contract_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_referral_status_created
          ON caregiver_referral_cases(status,created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_referral_referrer_created
          ON caregiver_referral_cases(referrer_caregiver_id,created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_referral_referred
          ON caregiver_referral_cases(referred_caregiver_id)`,
      ];
      await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
    })().catch((error) => {
      referralSchemaReady = undefined;
      throw error;
    });
  }
  return referralSchemaReady;
}

async function resolveReferrer(env: Env, referralCode: string, registeringMobile: string) {
  if (!referralCode) return null;
  const referrer = await env.DB.prepare(`SELECT c.id,c.membership_code AS membershipCode,c.full_name AS fullName,c.mobile,
      c.active,COALESCE(u.status,'ACTIVE') AS accountStatus
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id
    WHERE upper(c.membership_code)=? AND c.active=1
      AND (u.id IS NULL OR upper(u.status) IN ('ACTIVE','APPROVED'))
    LIMIT 1`).bind(referralCode).first<{
      id: string;
      membershipCode: string;
      fullName: string;
      mobile: string | null;
      active: number;
      accountStatus: string;
    }>();
  if (!referrer) throw new Error("invalid_referral_code");
  if (normalizeMobile(referrer.mobile) === registeringMobile) throw new Error("self_referral_not_allowed");
  return referrer;
}

async function publicRegisterCaregiver(request: Request, env: Env) {
  await ensureReferralRewardsSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات ثبت‌نام معتبر نیست.");

  const fullName = str(body.fullName || body.name);
  const mobile = normalizeMobile(str(body.mobile));
  const nationalId = str(body.nationalId).replace(/\D/g, "") || null;
  const username = str(body.email || body.username).toLowerCase();
  const password = str(body.password);
  const referralCode = upper(body.referralCode || body.referrerCode);

  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (!mobile || !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return fail("ایمیل ورود معتبر نیست.");
  if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");

  const duplicate = await env.DB.prepare(`SELECT id FROM users WHERE mobile=? OR lower(username)=?
    UNION ALL SELECT id FROM caregivers WHERE national_id=? AND ? IS NOT NULL LIMIT 1`)
    .bind(mobile, username, nationalId, nationalId).first();
  if (duplicate) return fail("برای این شماره، ایمیل یا کد ملی قبلاً ثبت‌نام شده است.", 409, "duplicate_registration");

  let referrer: Awaited<ReturnType<typeof resolveReferrer>> = null;
  try {
    referrer = await resolveReferrer(env, referralCode, mobile);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_referral_code";
    if (code === "self_referral_not_allowed") {
      return fail("استفاده از کد معرف متعلق به شماره همراه خودتان مجاز نیست.", 409, code);
    }
    return fail("کد معرف معتبر نیست یا حساب معرف فعال نشده است.", 409, "invalid_referral_code");
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
      registration_reward_toman,contract_reward_toman,status,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'PENDING_REGISTRATION_REVIEW',?,?)`).bind(
      referralCaseId,
      referrer.id,
      caregiverId,
      referrer.membershipCode,
      REGISTRATION_REWARD_TOMAN,
      CONTRACT_REWARD_TOMAN,
      timestamp,
      timestamp,
    ));
  }

  await env.DB.batch(statements);
  await audit(request, env, null, "SELF_REGISTER", "caregiver", caregiverId, {
    fullName,
    mobile,
    username,
    referralCaseId,
    referralCode: referrer?.membershipCode || null,
  });
  if (referralCaseId && referrer) {
    await audit(request, env, null, "CREATE_REFERRAL_CASE", "caregiver_referral_case", referralCaseId, {
      referrerCaregiverId: referrer.id,
      referredCaregiverId: caregiverId,
      registrationRewardToman: REGISTRATION_REWARD_TOMAN,
      contractRewardToman: CONTRACT_REWARD_TOMAN,
    });
  }

  return json({
    data: {
      requestCode: userId,
      caregiverId,
      membershipCode: caregiverId,
      status: "PENDING",
      referral: referralCaseId ? {
        caseId: referralCaseId,
        status: "PENDING_REGISTRATION_REVIEW",
        referralCode: referrer?.membershipCode,
      } : null,
    },
  }, 201);
}

async function caregiverReferralSummary(env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  }
  await ensureReferralRewardsSchema(env);
  const caregiver = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName
    FROM caregivers WHERE id=? LIMIT 1`).bind(actor.caregiverId).first<JsonRecord>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  const cases = await env.DB.prepare(`SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,
      c.membership_code AS referredMembershipCode,c.full_name AS referredName,
      r.status,r.registration_reward_toman AS registrationRewardToman,
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
    ORDER BY r.created_at DESC LIMIT 200`).bind(actor.caregiverId).all<JsonRecord>();

  const rows = cases.results || [];
  const summary = rows.reduce<ReferralSummary>((result, item) => {
    const status = String(item.status || "");
    result.totalReferrals += 1;
    if (item.registrationRewardTransactionId) result.confirmedRewardToman += REGISTRATION_REWARD_TOMAN;
    if (item.contractRewardTransactionId) {
      result.confirmedRewardToman += CONTRACT_REWARD_TOMAN;
      result.completedReferrals += 1;
    }
    if (status === "PENDING_REGISTRATION_REVIEW") result.pendingRewardToman += REGISTRATION_REWARD_TOMAN;
    if (status === "WAITING_CONTRACT") result.pendingRewardToman += CONTRACT_REWARD_TOMAN;
    return result;
  }, { totalReferrals: 0, completedReferrals: 0, confirmedRewardToman: 0, pendingRewardToman: 0 });

  return json({ data: { caregiver, summary, cases: rows } });
}

async function staffFinanceDenied(env: Env, actor: AuthUser, action: "view" | "create" | "update") {
  return requireAccess(env, actor, STAFF_FINANCE_MODULE, action);
}

function referralListSql(where: string) {
  return `SELECT r.id,r.referrer_caregiver_id AS referrerCaregiverId,
      ref.membership_code AS referrerMembershipCode,ref.full_name AS referrerName,ref.mobile AS referrerMobile,
      r.referred_caregiver_id AS referredCaregiverId,
      referred.membership_code AS referredMembershipCode,referred.full_name AS referredName,
      referred.mobile AS referredMobile,COALESCE(ru.status,'ACTIVE') AS referredAccountStatus,
      r.referral_code AS referralCode,r.status,
      r.registration_reward_toman AS registrationRewardToman,
      r.contract_reward_toman AS contractRewardToman,
      r.registration_reward_transaction_id AS registrationRewardTransactionId,
      r.contract_reward_transaction_id AS contractRewardTransactionId,
      stage1.created_at AS registrationPaymentAt,stage2.created_at AS contractPaymentAt,
      r.registration_reviewed_at AS registrationReviewedAt,
      r.contract_reviewed_at AS contractReviewedAt,
      r.registration_decision_note AS registrationDecisionNote,
      r.contract_decision_note AS contractDecisionNote,
      r.contract_check_last_at AS contractCheckLastAt,
      r.contract_check_note AS contractCheckNote,
      r.created_at AS createdAt,r.updated_at AS updatedAt
    FROM caregiver_referral_cases r
    JOIN caregivers ref ON ref.id=r.referrer_caregiver_id
    JOIN caregivers referred ON referred.id=r.referred_caregiver_id
    LEFT JOIN users ru ON ru.caregiver_id=referred.id
    LEFT JOIN caregiver_wallet_transactions stage1 ON stage1.id=r.registration_reward_transaction_id
    LEFT JOIN caregiver_wallet_transactions stage2 ON stage2.id=r.contract_reward_transaction_id
    ${where}
    ORDER BY CASE r.status
      WHEN 'PENDING_REGISTRATION_REVIEW' THEN 0
      WHEN 'WAITING_CONTRACT' THEN 1
      WHEN 'CONTRACT_REJECTED' THEN 2
      WHEN 'COMPLETED' THEN 3
      ELSE 4 END,r.updated_at DESC
    LIMIT 500`;
}

async function staffReferralDashboard(request: Request, env: Env, actor: AuthUser) {
  const denied = await staffFinanceDenied(env, actor, "view");
  if (denied) return denied;
  await ensureReferralRewardsSchema(env);
  const url = new URL(request.url);
  const requestedStatus = upper(url.searchParams.get("status"));
  const status = REFERRAL_STATUSES.includes(requestedStatus as ReferralStatus) ? requestedStatus : "";
  const monthParam = str(url.searchParams.get("month"));
  const month = isIsoMonth(monthParam) ? monthParam : "";
  const q = str(url.searchParams.get("q"));

  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (status) {
    conditions.push("r.status=?");
    bindings.push(status);
  }
  if (month) {
    conditions.push(`(substr(r.created_at,1,7)=? OR substr(stage1.created_at,1,7)=? OR substr(stage2.created_at,1,7)=?)`);
    bindings.push(month, month, month);
  }
  if (q) {
    conditions.push(`(ref.full_name LIKE ? OR ref.membership_code LIKE ? OR referred.full_name LIKE ? OR referred.membership_code LIKE ? OR ref.mobile LIKE ? OR referred.mobile LIKE ?)`);
    const pattern = `%${q}%`;
    bindings.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const cases = await env.DB.prepare(referralListSql(where)).bind(...bindings).all<JsonRecord>();

  const reportMonth = month || nowIso().slice(0, 7);
  const summary = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM caregiver_referral_cases WHERE substr(created_at,1,7)=?) AS registrationsCreated,
      (SELECT COUNT(DISTINCT referrer_caregiver_id) FROM caregiver_referral_cases WHERE substr(created_at,1,7)=?) AS uniqueReferrers,
      (SELECT COUNT(*) FROM caregiver_wallet_transactions WHERE transaction_type='REFERRAL_REGISTRATION_REWARD' AND substr(created_at,1,7)=?) AS stage1Approved,
      (SELECT COALESCE(SUM(amount_toman),0) FROM caregiver_wallet_transactions WHERE transaction_type='REFERRAL_REGISTRATION_REWARD' AND substr(created_at,1,7)=?) AS stage1AmountToman,
      (SELECT COUNT(*) FROM caregiver_wallet_transactions WHERE transaction_type='REFERRAL_CONTRACT_BONUS' AND substr(created_at,1,7)=?) AS stage2Approved,
      (SELECT COALESCE(SUM(amount_toman),0) FROM caregiver_wallet_transactions WHERE transaction_type='REFERRAL_CONTRACT_BONUS' AND substr(created_at,1,7)=?) AS stage2AmountToman,
      (SELECT COUNT(*) FROM caregiver_referral_cases WHERE status='WAITING_CONTRACT') AS waitingContract,
      (SELECT COUNT(*) FROM caregiver_referral_cases WHERE status='COMPLETED' AND substr(contract_reviewed_at,1,7)=?) AS completedReferrals,
      (SELECT COUNT(*) FROM caregiver_referral_cases WHERE status IN ('REGISTRATION_REJECTED','CONTRACT_REJECTED') AND substr(updated_at,1,7)=?) AS rejectedCases`
    ).bind(reportMonth, reportMonth, reportMonth, reportMonth, reportMonth, reportMonth, reportMonth, reportMonth)
    .first<JsonRecord>();

  const stage1Amount = Number(summary?.stage1AmountToman || 0);
  const stage2Amount = Number(summary?.stage2AmountToman || 0);
  return json({
    data: {
      filters: { status: status || null, month: month || null, q: q || null },
      reportMonth,
      summary: { ...(summary || {}), totalApprovedAmountToman: stage1Amount + stage2Amount },
      cases: cases.results || [],
      policy: {
        registrationRewardToman: REGISTRATION_REWARD_TOMAN,
        contractRewardToman: CONTRACT_REWARD_TOMAN,
        maximumRewardToman: REGISTRATION_REWARD_TOMAN + CONTRACT_REWARD_TOMAN,
      },
    },
  });
}

async function referralCase(env: Env, id: string) {
  return env.DB.prepare(`SELECT id,referrer_caregiver_id AS referrerCaregiverId,
      referred_caregiver_id AS referredCaregiverId,status,
      registration_reward_transaction_id AS registrationRewardTransactionId,
      contract_reward_transaction_id AS contractRewardTransactionId
    FROM caregiver_referral_cases WHERE id=? LIMIT 1`).bind(id).first<ReferralRow>();
}

async function referredAccountReady(env: Env, caregiverId: string) {
  const user = await env.DB.prepare(`SELECT status FROM users WHERE caregiver_id=? LIMIT 1`)
    .bind(caregiverId).first<{ status: string }>();
  return Boolean(user && ["ACTIVE", "APPROVED"].includes(upper(user.status)));
}

async function decideReferralCase(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await staffFinanceDenied(env, actor, "update");
  if (denied) return denied;
  await ensureReferralRewardsSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تصمیم معتبر نیست.");
  const action = upper(body.action) as ReferralAction;
  if (!REFERRAL_ACTIONS.includes(action)) return fail("اقدام انتخاب‌شده معتبر نیست.");
  const note = str(body.note) || null;
  const current = await referralCase(env, id);
  if (!current) return fail("پرونده معرفی پیدا نشد.", 404, "referral_case_not_found");
  const timestamp = nowIso();

  if (action === "APPROVE_REGISTRATION") {
    if (current.status !== "PENDING_REGISTRATION_REVIEW") {
      return fail("این پرونده در مرحله تأیید پاداش ثبت‌نام نیست.", 409, "invalid_referral_state");
    }
    if (!await referredAccountReady(env, current.referredCaregiverId)) {
      return fail("حساب مراقب معرفی‌شده هنوز توسط مدیر فعال نشده است.", 409, "referred_account_not_active");
    }
    const transactionId = randomId("wtx_");
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
          id,caregiver_id,direction,transaction_type,amount_toman,title,description,
          reference_type,reference_id,created_by_user_id,created_at
        ) VALUES(?,?,'CREDIT','REFERRAL_REGISTRATION_REWARD',?,?,?,'REFERRAL_STAGE1',?,?,?)`).bind(
          transactionId,
          current.referrerCaregiverId,
          REGISTRATION_REWARD_TOMAN,
          "پاداش ثبت‌نام مراقب معرفی‌شده",
          note,
          id,
          actor.id,
          timestamp,
        ),
        env.DB.prepare(`UPDATE caregiver_referral_cases SET
          status='WAITING_CONTRACT',registration_reward_transaction_id=?,
          registration_reviewed_by_user_id=?,registration_reviewed_at=?,
          registration_decision_note=?,updated_at=?
          WHERE id=? AND status='PENDING_REGISTRATION_REVIEW'`).bind(
          transactionId,
          actor.id,
          timestamp,
          note,
          timestamp,
          id,
        ),
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "database_error";
      if (/UNIQUE|unique/i.test(detail)) return fail("پاداش مرحله ثبت‌نام قبلاً ثبت شده است.", 409, "duplicate_registration_reward");
      throw error;
    }
    await audit(request, env, actor, "APPROVE_REFERRAL_REGISTRATION_REWARD", "caregiver_referral_case", id, {
      amountToman: REGISTRATION_REWARD_TOMAN,
      transactionId,
      nextStatus: "WAITING_CONTRACT",
      note,
    });
    return json({ data: { id, status: "WAITING_CONTRACT", transactionId, amountToman: REGISTRATION_REWARD_TOMAN } });
  }

  if (action === "HOLD_CONTRACT") {
    if (current.status !== "WAITING_CONTRACT") {
      return fail("این پرونده در صف بررسی قرارداد نیست.", 409, "invalid_referral_state");
    }
    await env.DB.prepare(`UPDATE caregiver_referral_cases SET
      contract_check_last_at=?,contract_check_note=?,updated_at=? WHERE id=?`).bind(
      timestamp,
      note || "هنوز ورود به قرارداد تأیید نشده است.",
      timestamp,
      id,
    ).run();
    await audit(request, env, actor, "HOLD_REFERRAL_CONTRACT_REVIEW", "caregiver_referral_case", id, { note });
    return json({ data: { id, status: "WAITING_CONTRACT", checkedAt: timestamp } });
  }

  if (action === "APPROVE_CONTRACT") {
    if (current.status !== "WAITING_CONTRACT") {
      return fail("ابتدا پرونده باید در صف بررسی قرارداد قرار داشته باشد.", 409, "invalid_referral_state");
    }
    if (!current.registrationRewardTransactionId) {
      return fail("پاداش مرحله ثبت‌نام هنوز تأیید نشده است.", 409, "registration_reward_required");
    }
    const transactionId = randomId("wtx_");
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
          id,caregiver_id,direction,transaction_type,amount_toman,title,description,
          reference_type,reference_id,created_by_user_id,created_at
        ) VALUES(?,?,'CREDIT','REFERRAL_CONTRACT_BONUS',?,?,?,'REFERRAL_STAGE2',?,?,?)`).bind(
          transactionId,
          current.referrerCaregiverId,
          CONTRACT_REWARD_TOMAN,
          "پاداش ورود مراقب معرفی‌شده به قرارداد",
          note,
          id,
          actor.id,
          timestamp,
        ),
        env.DB.prepare(`UPDATE caregiver_referral_cases SET
          status='COMPLETED',contract_reward_transaction_id=?,
          contract_reviewed_by_user_id=?,contract_reviewed_at=?,
          contract_decision_note=?,updated_at=?
          WHERE id=? AND status='WAITING_CONTRACT'`).bind(
          transactionId,
          actor.id,
          timestamp,
          note,
          timestamp,
          id,
        ),
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "database_error";
      if (/UNIQUE|unique/i.test(detail)) return fail("پاداش مرحله قرارداد قبلاً ثبت شده است.", 409, "duplicate_contract_reward");
      throw error;
    }
    await audit(request, env, actor, "APPROVE_REFERRAL_CONTRACT_REWARD", "caregiver_referral_case", id, {
      amountToman: CONTRACT_REWARD_TOMAN,
      transactionId,
      totalRewardToman: REGISTRATION_REWARD_TOMAN + CONTRACT_REWARD_TOMAN,
      note,
    });
    return json({ data: { id, status: "COMPLETED", transactionId, amountToman: CONTRACT_REWARD_TOMAN } });
  }

  if (action === "REJECT_REGISTRATION") {
    if (current.status !== "PENDING_REGISTRATION_REVIEW") {
      return fail("این پرونده در مرحله بررسی ثبت‌نام نیست.", 409, "invalid_referral_state");
    }
    if (!note) return fail("ثبت علت رد مرحله ثبت‌نام الزامی است.");
    await env.DB.prepare(`UPDATE caregiver_referral_cases SET
      status='REGISTRATION_REJECTED',registration_reviewed_by_user_id=?,
      registration_reviewed_at=?,registration_decision_note=?,updated_at=? WHERE id=?`).bind(
      actor.id,
      timestamp,
      note,
      timestamp,
      id,
    ).run();
    await audit(request, env, actor, "REJECT_REFERRAL_REGISTRATION_REWARD", "caregiver_referral_case", id, { note });
    return json({ data: { id, status: "REGISTRATION_REJECTED" } });
  }

  if (action === "REJECT_CONTRACT") {
    if (current.status !== "WAITING_CONTRACT") {
      return fail("این پرونده در صف بررسی قرارداد نیست.", 409, "invalid_referral_state");
    }
    if (!note) return fail("ثبت علت رد مرحله قرارداد الزامی است.");
    await env.DB.prepare(`UPDATE caregiver_referral_cases SET
      status='CONTRACT_REJECTED',contract_reviewed_by_user_id=?,contract_reviewed_at=?,
      contract_decision_note=?,updated_at=? WHERE id=?`).bind(
      actor.id,
      timestamp,
      note,
      timestamp,
      id,
    ).run();
    await audit(request, env, actor, "REJECT_REFERRAL_CONTRACT_REWARD", "caregiver_referral_case", id, { note });
    return json({ data: { id, status: "CONTRACT_REJECTED" } });
  }

  if (current.status !== "CONTRACT_REJECTED") {
    return fail("فقط پرونده ردشده در مرحله قرارداد قابل بازگشایی است.", 409, "invalid_referral_state");
  }
  await env.DB.prepare(`UPDATE caregiver_referral_cases SET
    status='WAITING_CONTRACT',contract_reviewed_by_user_id=NULL,contract_reviewed_at=NULL,
    contract_decision_note=?,updated_at=? WHERE id=?`).bind(
    note || "بازگشایی برای بررسی مجدد ورود به قرارداد",
    timestamp,
    id,
  ).run();
  await audit(request, env, actor, "REOPEN_REFERRAL_CONTRACT_REVIEW", "caregiver_referral_case", id, { note });
  return json({ data: { id, status: "WAITING_CONTRACT" } });
}

async function referralCsvReport(request: Request, env: Env, actor: AuthUser) {
  const denied = await staffFinanceDenied(env, actor, "view");
  if (denied) return denied;
  await ensureReferralRewardsSchema(env);
  const url = new URL(request.url);
  const monthParam = str(url.searchParams.get("month"));
  const month = isIsoMonth(monthParam) ? monthParam : nowIso().slice(0, 7);
  const rows = await env.DB.prepare(referralListSql(`WHERE
    substr(r.created_at,1,7)=? OR substr(stage1.created_at,1,7)=? OR substr(stage2.created_at,1,7)=?`))
    .bind(month, month, month).all<JsonRecord>();

  const headers = [
    "شناسه پرونده",
    "نام معرف",
    "کد معرف",
    "شماره معرف",
    "نام مراقب معرفی‌شده",
    "کد عضویت معرفی‌شده",
    "شماره معرفی‌شده",
    "وضعیت حساب معرفی‌شده",
    "وضعیت پرونده",
    "پاداش مرحله ثبت‌نام",
    "تاریخ پرداخت مرحله ثبت‌نام",
    "پاداش مرحله قرارداد",
    "تاریخ پرداخت مرحله قرارداد",
    "مجموع پاداش قطعی",
    "تاریخ ایجاد پرونده",
    "توضیح تصمیم ثبت‌نام",
    "توضیح تصمیم قرارداد",
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows.results || []) {
    const confirmed = (row.registrationRewardTransactionId ? REGISTRATION_REWARD_TOMAN : 0)
      + (row.contractRewardTransactionId ? CONTRACT_REWARD_TOMAN : 0);
    lines.push([
      row.id,
      row.referrerName,
      row.referrerMembershipCode,
      row.referrerMobile,
      row.referredName,
      row.referredMembershipCode,
      row.referredMobile,
      row.referredAccountStatus,
      referralStatusLabel(String(row.status || "")),
      row.registrationRewardTransactionId ? REGISTRATION_REWARD_TOMAN : 0,
      row.registrationPaymentAt,
      row.contractRewardTransactionId ? CONTRACT_REWARD_TOMAN : 0,
      row.contractPaymentAt,
      confirmed,
      row.createdAt,
      row.registrationDecisionNote,
      row.contractDecisionNote,
    ].map(csvCell).join(","));
  }
  await audit(request, env, actor, "EXPORT_REFERRAL_MONTHLY_REPORT", "caregiver_referral_report", month, {
    month,
    rowCount: rows.results?.length || 0,
  });
  const headersOut = new Headers({
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=referral-rewards-${month}.csv`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(`\uFEFF${lines.join("\r\n")}`, { status: 200, headers: headersOut });
}

export async function routeReferralRewardsV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/public/caregivers/register" && method === "POST") {
    return securityHeaders(await publicRegisterCaregiver(request, env));
  }

  const isReferralPath = path === "/api/caregiver/platform/referrals"
    || path.startsWith("/api/staff/financial-credits/referrals");
  if (!isReferralPath) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));

  let response: Response;
  if (path === "/api/caregiver/platform/referrals" && method === "GET") {
    response = await caregiverReferralSummary(env, actor);
  } else if (path === "/api/staff/financial-credits/referrals" && method === "GET") {
    response = await staffReferralDashboard(request, env, actor);
  } else if (path === "/api/staff/financial-credits/referrals/report.csv" && method === "GET") {
    response = await referralCsvReport(request, env, actor);
  } else {
    const match = path.match(/^\/api\/staff\/financial-credits\/referrals\/([^/]+)$/);
    response = match && method === "PATCH"
      ? await decideReferralCase(request, env, actor, decodeURIComponent(match[1]))
      : fail("مسیر پاداش معرفی پیدا نشد.", 404, "not_found");
  }
  return securityHeaders(response);
}
