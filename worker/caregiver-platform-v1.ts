import { canAccess, requireAccess } from "./access-control";
import { getFinancialBenefits } from "./benefits";
import { caregiverRecord } from "./caregiver-record";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  getUser,
  json,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const LOAN_AMOUNT_TOMAN = 500_000_000;
const CONTINUOUS_TARGET_DAYS = 730;
const CUMULATIVE_TARGET_DAYS = 1_200;
const SETTLEMENT_OPEN_STATUSES = ["REQUESTED", "APPROVED"];
const STAFF_FINANCE_MODULE = "staff.financial_credits";
const STAFF_SUPPORT_MODULE = "staff.support";
let platformSchemaReady: Promise<void> | undefined;

type JsonRecord = Record<string, unknown>;
type WalletSummary = {
  balanceToman: number;
  pendingSettlementToman: number;
  availableToman: number;
};

const upper = (value: unknown) => str(value).toUpperCase();
const amount = (value: unknown) => Math.max(0, Math.trunc(Number(value || 0)));
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(value));
const safeJson = (value: unknown, fallback: JsonRecord = {}) => {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : fallback;
  } catch {
    return fallback;
  }
};

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

export async function ensureCaregiverPlatformSchema(env: Env) {
  if (!platformSchemaReady) {
    platformSchemaReady = (async () => {
      await ensureSchema(env);
      const statements = [
        `CREATE TABLE IF NOT EXISTS caregiver_wallet_transactions (
          id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,direction TEXT NOT NULL,
          transaction_type TEXT NOT NULL,amount_toman INTEGER NOT NULL,title TEXT NOT NULL,
          description TEXT,reference_type TEXT,reference_id TEXT,created_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_reference_unique
          ON caregiver_wallet_transactions(reference_type,reference_id,direction)
          WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_wallet_caregiver_created
          ON caregiver_wallet_transactions(caregiver_id,created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS caregiver_settlement_requests (
          id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,amount_toman INTEGER NOT NULL,
          account_holder_name TEXT NOT NULL,iban TEXT,account_number TEXT,bank_name TEXT,note TEXT,
          status TEXT NOT NULL DEFAULT 'REQUESTED',requested_by_user_id TEXT NOT NULL,
          reviewed_by_user_id TEXT,reviewed_at TEXT,decision_note TEXT,paid_by_user_id TEXT,
          paid_at TEXT,payment_tracking_number TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
          FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY(paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_settlement_status_created
          ON caregiver_settlement_requests(status,created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_settlement_caregiver_created
          ON caregiver_settlement_requests(caregiver_id,created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS caregiver_credit_requests (
          id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,requested_amount_toman INTEGER NOT NULL,
          eligibility_path TEXT NOT NULL,continuous_days INTEGER NOT NULL DEFAULT 0,
          cumulative_days INTEGER NOT NULL DEFAULT 0,eligibility_snapshot_json TEXT NOT NULL,
          note TEXT,status TEXT NOT NULL DEFAULT 'REQUESTED',requested_by_user_id TEXT NOT NULL,
          reviewed_by_user_id TEXT,reviewed_at TEXT,decision_note TEXT,created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_credit_request_status_created
          ON caregiver_credit_requests(status,created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_credit_request_caregiver_created
          ON caregiver_credit_requests(caregiver_id,created_at DESC)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_request_one_open
          ON caregiver_credit_requests(caregiver_id)
          WHERE status IN ('REQUESTED','UNDER_REVIEW','APPROVED')`,
        `CREATE TABLE IF NOT EXISTS caregiver_payroll_slips (
          id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,contract_id TEXT,period_key TEXT NOT NULL,
          period_title TEXT NOT NULL,scheduled_hours REAL NOT NULL DEFAULT 0,
          logged_hours REAL NOT NULL DEFAULT 0,overtime_hours REAL NOT NULL DEFAULT 0,
          absent_hours REAL NOT NULL DEFAULT 0,hourly_rate_toman INTEGER NOT NULL DEFAULT 0,
          gross_toman INTEGER NOT NULL DEFAULT 0,benefits_toman INTEGER NOT NULL DEFAULT 0,
          deductions_toman INTEGER NOT NULL DEFAULT 0,net_toman INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'ISSUED',note TEXT,issued_by_user_id TEXT NOT NULL,
          issued_at TEXT NOT NULL,paid_by_user_id TEXT,paid_at TEXT,payment_tracking_number TEXT,
          created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
          UNIQUE(caregiver_id,contract_id,period_key),
          FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
          FOREIGN KEY(issued_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY(paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_payroll_caregiver_period
          ON caregiver_payroll_slips(caregiver_id,period_key DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_payroll_status_issued
          ON caregiver_payroll_slips(status,issued_at DESC)`,
        `CREATE TABLE IF NOT EXISTS support_threads (
          id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,contract_id TEXT,category TEXT NOT NULL,
          subject TEXT NOT NULL,danger_confirmed INTEGER NOT NULL DEFAULT 0,
          priority TEXT NOT NULL DEFAULT 'NORMAL',status TEXT NOT NULL DEFAULT 'OPEN',
          assigned_user_id TEXT,created_by_user_id TEXT NOT NULL,last_message_at TEXT NOT NULL,
          created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
          FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
          FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
          FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
        )`,
        `CREATE INDEX IF NOT EXISTS idx_support_thread_caregiver_updated
          ON support_threads(caregiver_id,updated_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_support_thread_queue
          ON support_threads(category,status,priority,updated_at DESC)`,
        `CREATE TABLE IF NOT EXISTS support_messages (
          id TEXT PRIMARY KEY,thread_id TEXT NOT NULL,sender_user_id TEXT NOT NULL,
          message_type TEXT NOT NULL,text_content TEXT,stored_file_id TEXT,created_at TEXT NOT NULL,
          FOREIGN KEY(thread_id) REFERENCES support_threads(id) ON DELETE RESTRICT,
          FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY(stored_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT
        )`,
        `CREATE INDEX IF NOT EXISTS idx_support_messages_thread_created
          ON support_messages(thread_id,created_at)`,
        `CREATE TRIGGER IF NOT EXISTS trg_wallet_transaction_no_update_v1
          BEFORE UPDATE ON caregiver_wallet_transactions
          BEGIN SELECT RAISE(ABORT,'wallet_transaction_is_immutable'); END`,
        `CREATE TRIGGER IF NOT EXISTS trg_wallet_transaction_no_delete_v1
          BEFORE DELETE ON caregiver_wallet_transactions
          BEGIN SELECT RAISE(ABORT,'wallet_transaction_is_immutable'); END`,
        `CREATE TRIGGER IF NOT EXISTS trg_support_message_no_update_v1
          BEFORE UPDATE ON support_messages
          BEGIN SELECT RAISE(ABORT,'support_message_is_immutable'); END`,
        `CREATE TRIGGER IF NOT EXISTS trg_support_message_no_delete_v1
          BEFORE DELETE ON support_messages
          BEGIN SELECT RAISE(ABORT,'support_message_is_immutable'); END`,
      ];
      await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
    })().catch((error) => {
      platformSchemaReady = undefined;
      throw error;
    });
  }
  return platformSchemaReady;
}

function caregiverScope(actor: AuthUser) {
  return actor.role.toUpperCase() === "CAREGIVER" ? actor.caregiverId : null;
}

async function walletSummary(env: Env, caregiverId: string): Promise<WalletSummary> {
  const totals = await env.DB.prepare(`SELECT
    COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE -amount_toman END),0) AS balanceToman
    FROM caregiver_wallet_transactions WHERE caregiver_id=?`).bind(caregiverId)
    .first<{ balanceToman: number }>();
  const pending = await env.DB.prepare(`SELECT COALESCE(SUM(amount_toman),0) AS pendingToman
    FROM caregiver_settlement_requests WHERE caregiver_id=? AND status IN ('REQUESTED','APPROVED')`)
    .bind(caregiverId).first<{ pendingToman: number }>();
  const balanceToman = Number(totals?.balanceToman || 0);
  const pendingSettlementToman = Number(pending?.pendingToman || 0);
  return {
    balanceToman,
    pendingSettlementToman,
    availableToman: Math.max(0, balanceToman - pendingSettlementToman),
  };
}

async function benefitsData(request: Request, env: Env, actor: AuthUser) {
  const url = new URL("/api/benefits/summary", request.url);
  const response = await getFinancialBenefits(new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  }), env, actor);
  const payload = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok) throw new Error(str(payload.message) || "محاسبه سابقه اعتباری انجام نشد.");
  return (payload.data || {}) as JsonRecord;
}

async function caregiverIdentity(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,
    city,birth_date AS birthDate,professional_level AS professionalLevel,
    professional_score AS professionalScore,license_status AS licenseStatus
    FROM caregivers WHERE id=? LIMIT 1`).bind(caregiverId).first<JsonRecord>();
}

export async function caregiverDashboard(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  await ensureCaregiverPlatformSchema(env);
  const caregiver = await caregiverIdentity(env, caregiverId);
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const [wallet, activeContract, latestPayroll, latestEvaluation, training, support] = await Promise.all([
    walletSummary(env, caregiverId),
    safeFirst<JsonRecord>(env, `SELECT id,contract_number AS contractNumber,family_name AS familyName,
      service_type AS serviceType,status,starts_at AS startsAt,ends_at AS endsAt,
      monthly_hours AS scheduledHours,logged_hours AS loggedHours,overtime_hours AS overtimeHours,
      absent_hours AS absentHours FROM contracts WHERE caregiver_id=? AND upper(status) IN ('ACTIVE','APPROVED')
      ORDER BY starts_at DESC,created_at DESC LIMIT 1`, [caregiverId]),
    safeFirst<JsonRecord>(env, `SELECT id,period_key AS periodKey,period_title AS periodTitle,
      net_toman AS netToman,status,issued_at AS issuedAt,paid_at AS paidAt
      FROM caregiver_payroll_slips WHERE caregiver_id=? AND status<>'VOID'
      ORDER BY period_key DESC,issued_at DESC LIMIT 1`, [caregiverId]),
    safeFirst<JsonRecord>(env, `SELECT id,title,status,final_score AS finalScore,updated_at AS updatedAt,
      finalized_at AS finalizedAt FROM caregiver_evaluation_periods WHERE caregiver_id=?
      ORDER BY CASE status WHEN 'FINAL' THEN 0 ELSE 1 END,created_at DESC LIMIT 1`, [caregiverId]),
    safeFirst<{ assigned: number; completed: number }>(env, `SELECT COUNT(*) AS assigned,
      COALESCE(SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END),0) AS completed
      FROM enrollments WHERE caregiver_id=?`, [caregiverId]),
    safeFirst<{ openCount: number; urgentCount: number }>(env, `SELECT
      COALESCE(SUM(CASE WHEN status IN ('OPEN','PENDING') THEN 1 ELSE 0 END),0) AS openCount,
      COALESCE(SUM(CASE WHEN category='URGENT_SECURITY' AND status IN ('OPEN','PENDING') THEN 1 ELSE 0 END),0) AS urgentCount
      FROM support_threads WHERE caregiver_id=?`, [caregiverId]),
  ]);
  const benefits = await benefitsData(request, env, actor).catch(() => null);
  await audit(request, env, actor, "READ_CAREGIVER_DASHBOARD", "caregiver", caregiverId);
  return json({
    data: {
      caregiver,
      wallet,
      activeContract,
      latestPayroll,
      latestEvaluation,
      training: training || { assigned: 0, completed: 0 },
      support: support || { openCount: 0, urgentCount: 0 },
      credit: benefits ? benefits.credit : null,
      updatedAt: nowIso(),
      source: "server",
    },
  });
}

export async function caregiverScorecardRecord(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("id", caregiverId);
  return caregiverRecord(new Request(url.toString(), { method: "GET", headers: request.headers }), env, {
    ...actor,
    role: "ADMIN",
  });
}

export async function caregiverWallet(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  await ensureCaregiverPlatformSchema(env);
  const [summary, transactions, settlements, creditRequests] = await Promise.all([
    walletSummary(env, caregiverId),
    safeAll<JsonRecord>(env, `SELECT id,direction,transaction_type AS transactionType,amount_toman AS amountToman,
      title,description,reference_type AS referenceType,reference_id AS referenceId,created_at AS createdAt
      FROM caregiver_wallet_transactions WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 100`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT id,amount_toman AS amountToman,account_holder_name AS accountHolderName,
      iban,account_number AS accountNumber,bank_name AS bankName,note,status,decision_note AS decisionNote,
      reviewed_at AS reviewedAt,paid_at AS paidAt,payment_tracking_number AS paymentTrackingNumber,
      created_at AS createdAt,updated_at AS updatedAt FROM caregiver_settlement_requests
      WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 50`, [caregiverId]),
    safeAll<JsonRecord>(env, `SELECT id,requested_amount_toman AS requestedAmountToman,
      eligibility_path AS eligibilityPath,continuous_days AS continuousDays,cumulative_days AS cumulativeDays,
      note,status,decision_note AS decisionNote,reviewed_at AS reviewedAt,created_at AS createdAt,
      updated_at AS updatedAt FROM caregiver_credit_requests WHERE caregiver_id=?
      ORDER BY created_at DESC LIMIT 20`, [caregiverId]),
  ]);
  const benefits = await benefitsData(request, env, actor).catch(() => null);
  return json({ data: { summary, transactions, settlements, creditRequests, benefits } });
}

function normalizeIban(value: unknown) {
  return str(value).replace(/\s+/g, "").toUpperCase();
}

export async function createSettlementRequest(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات درخواست تسویه معتبر نیست.");
  const requested = amount(body.amountToman);
  const accountHolderName = str(body.accountHolderName);
  const iban = normalizeIban(body.iban) || null;
  const accountNumber = str(body.accountNumber).replace(/\s+/g, "") || null;
  if (!requested) return fail("مبلغ تسویه باید بیشتر از صفر باشد.");
  if (!accountHolderName) return fail("نام صاحب حساب الزامی است.");
  if (!iban && !accountNumber) return fail("شماره شبا یا شماره حساب الزامی است.");
  if (iban && !/^IR\d{24}$/.test(iban)) return fail("شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.");
  const summary = await walletSummary(env, caregiverId);
  if (requested > summary.availableToman) return fail("مبلغ درخواستی از مانده قابل تسویه بیشتر است.", 409, "insufficient_wallet_balance");
  const timestamp = nowIso();
  const id = randomId("set_");
  await env.DB.prepare(`INSERT INTO caregiver_settlement_requests(
    id,caregiver_id,amount_toman,account_holder_name,iban,account_number,bank_name,note,status,
    requested_by_user_id,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,'REQUESTED',?,?,?)`).bind(
      id, caregiverId, requested, accountHolderName, iban, accountNumber,
      str(body.bankName) || null, str(body.note) || null, actor.id, timestamp, timestamp,
    ).run();
  await audit(request, env, actor, "CREATE_SETTLEMENT_REQUEST", "settlement_request", id, {
    caregiverId, amountToman: requested, iban: iban ? `${iban.slice(0, 6)}…${iban.slice(-4)}` : null,
  });
  return json({ data: { id, status: "REQUESTED", amountToman: requested, createdAt: timestamp } }, 201);
}

export async function createCreditRequest(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  await ensureCaregiverPlatformSchema(env);
  const benefits = await benefitsData(request, env, actor);
  const credit = (benefits.credit || {}) as JsonRecord;
  const continuous = (credit.continuous || {}) as JsonRecord;
  const cumulative = (credit.cumulative || {}) as JsonRecord;
  const continuousDays = Math.trunc(numeric(continuous.longestDays));
  const cumulativeDays = Math.trunc(numeric(cumulative.days));
  const eligibleBy = continuousDays >= CONTINUOUS_TARGET_DAYS
    ? "CONTINUOUS"
    : cumulativeDays >= CUMULATIVE_TARGET_DAYS
      ? "CUMULATIVE"
      : null;
  if (!eligibleBy) {
    return fail("هنوز شرط ۲۴ ماه پیوسته یا ۴۰ ماه تجمیعی تکمیل نشده است.", 409, "credit_not_eligible");
  }
  const open = await env.DB.prepare(`SELECT id,status FROM caregiver_credit_requests
    WHERE caregiver_id=? AND status IN ('REQUESTED','UNDER_REVIEW','APPROVED') LIMIT 1`)
    .bind(caregiverId).first<{ id: string; status: string }>();
  if (open) return fail("برای شما یک درخواست اعتبار باز وجود دارد.", 409, "credit_request_exists");
  const body = await readBody(request) || {};
  const timestamp = nowIso();
  const id = randomId("crq_");
  const snapshot = {
    amountToman: LOAN_AMOUNT_TOMAN,
    eligibleBy,
    continuousDays,
    cumulativeDays,
    continuousTargetDays: CONTINUOUS_TARGET_DAYS,
    cumulativeTargetDays: CUMULATIVE_TARGET_DAYS,
    calculatedAt: benefits.calculatedAt || timestamp,
  };
  await env.DB.prepare(`INSERT INTO caregiver_credit_requests(
    id,caregiver_id,requested_amount_toman,eligibility_path,continuous_days,cumulative_days,
    eligibility_snapshot_json,note,status,requested_by_user_id,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,'REQUESTED',?,?,?)`).bind(
      id, caregiverId, LOAN_AMOUNT_TOMAN, eligibleBy, continuousDays, cumulativeDays,
      JSON.stringify(snapshot), str(body.note) || null, actor.id, timestamp, timestamp,
    ).run();
  await audit(request, env, actor, "CREATE_CREDIT_REQUEST", "credit_request", id, snapshot);
  return json({ data: { id, status: "REQUESTED", ...snapshot, createdAt: timestamp } }, 201);
}

export async function caregiverPayroll(env: Env, actor: AuthUser) {
  const caregiverId = caregiverScope(actor);
  if (!caregiverId) return fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only");
  await ensureCaregiverPlatformSchema(env);
  const slips = await safeAll<JsonRecord>(env, `SELECT id,contract_id AS contractId,period_key AS periodKey,
    period_title AS periodTitle,scheduled_hours AS scheduledHours,logged_hours AS loggedHours,
    overtime_hours AS overtimeHours,absent_hours AS absentHours,hourly_rate_toman AS hourlyRateToman,
    gross_toman AS grossToman,benefits_toman AS benefitsToman,deductions_toman AS deductionsToman,
    net_toman AS netToman,status,note,issued_at AS issuedAt,paid_at AS paidAt,
    payment_tracking_number AS paymentTrackingNumber FROM caregiver_payroll_slips
    WHERE caregiver_id=? AND status<>'VOID' ORDER BY period_key DESC,issued_at DESC LIMIT 60`, [caregiverId]);
  return json({ data: { caregiverId, slips, current: slips[0] || null } });
}

async function staffFinanceAllowed(env: Env, actor: AuthUser, action: "view" | "create" | "update" | "delete") {
  return requireAccess(env, actor, STAFF_FINANCE_MODULE, action);
}

export async function staffFinancialDashboard(request: Request, env: Env, actor: AuthUser) {
  const denied = await staffFinanceAllowed(env, actor, "view");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const url = new URL(request.url);
  const status = upper(url.searchParams.get("status"));
  const settlementWhere = status && ["REQUESTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"].includes(status)
    ? "WHERE s.status=?" : "";
  const settlementBindings = settlementWhere ? [status] : [];
  const [summary, settlements, creditRequests, payroll] = await Promise.all([
    safeFirst<JsonRecord>(env, `SELECT
      (SELECT COUNT(*) FROM caregiver_settlement_requests WHERE status='REQUESTED') AS settlementRequested,
      (SELECT COUNT(*) FROM caregiver_credit_requests WHERE status IN ('REQUESTED','UNDER_REVIEW')) AS creditRequested,
      (SELECT COUNT(*) FROM caregiver_payroll_slips WHERE status='ISSUED') AS payrollIssued,
      (SELECT COALESCE(SUM(amount_toman),0) FROM caregiver_wallet_transactions WHERE direction='CREDIT') AS totalCredits`),
    safeAll<JsonRecord>(env, `SELECT s.id,s.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,s.amount_toman AS amountToman,s.account_holder_name AS accountHolderName,
      s.iban,s.account_number AS accountNumber,s.bank_name AS bankName,s.note,s.status,
      s.decision_note AS decisionNote,s.reviewed_at AS reviewedAt,s.paid_at AS paidAt,
      s.payment_tracking_number AS paymentTrackingNumber,s.created_at AS createdAt,s.updated_at AS updatedAt
      FROM caregiver_settlement_requests s JOIN caregivers c ON c.id=s.caregiver_id
      ${settlementWhere} ORDER BY CASE s.status WHEN 'REQUESTED' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,s.created_at DESC LIMIT 150`, settlementBindings),
    safeAll<JsonRecord>(env, `SELECT r.id,r.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,r.requested_amount_toman AS requestedAmountToman,
      r.eligibility_path AS eligibilityPath,r.continuous_days AS continuousDays,
      r.cumulative_days AS cumulativeDays,r.note,r.status,r.decision_note AS decisionNote,
      r.reviewed_at AS reviewedAt,r.created_at AS createdAt,r.updated_at AS updatedAt
      FROM caregiver_credit_requests r JOIN caregivers c ON c.id=r.caregiver_id
      ORDER BY CASE r.status WHEN 'REQUESTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 100`),
    safeAll<JsonRecord>(env, `SELECT p.id,p.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,p.contract_id AS contractId,p.period_key AS periodKey,
      p.period_title AS periodTitle,p.scheduled_hours AS scheduledHours,p.logged_hours AS loggedHours,
      p.overtime_hours AS overtimeHours,p.absent_hours AS absentHours,p.hourly_rate_toman AS hourlyRateToman,
      p.gross_toman AS grossToman,p.benefits_toman AS benefitsToman,p.deductions_toman AS deductionsToman,
      p.net_toman AS netToman,p.status,p.issued_at AS issuedAt,p.paid_at AS paidAt,
      p.payment_tracking_number AS paymentTrackingNumber FROM caregiver_payroll_slips p
      JOIN caregivers c ON c.id=p.caregiver_id ORDER BY p.issued_at DESC LIMIT 120`),
  ]);
  return json({ data: { summary: summary || {}, settlements, creditRequests, payroll } });
}

export async function grantReferralReward(request: Request, env: Env, actor: AuthUser) {
  const denied = await staffFinanceAllowed(env, actor, "create");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات پاداش معتبر نیست.");
  const caregiverId = str(body.caregiverId);
  const rewardAmount = amount(body.amountToman);
  const referralCaseId = str(body.referralCaseId || body.referenceId);
  const title = str(body.title) || "پاداش معرفی پرونده مراقبت";
  if (!caregiverId || !rewardAmount || !referralCaseId) {
    return fail("مراقب، مبلغ و شناسه پرونده معرفی‌شده الزامی است.");
  }
  const caregiver = await caregiverIdentity(env, caregiverId);
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const id = randomId("wtx_");
  const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
      id,caregiver_id,direction,transaction_type,amount_toman,title,description,
      reference_type,reference_id,created_by_user_id,created_at
    ) VALUES(?,?,'CREDIT','REFERRAL_REWARD',?,?,?,?, 'REFERRAL_CASE',?,?,?)`).bind(
        id, caregiverId, rewardAmount, title, str(body.description) || null,
        referralCaseId, actor.id, timestamp,
      ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) return fail("برای این پرونده معرفی‌شده قبلاً پاداش ثبت شده است.", 409, "duplicate_referral_reward");
    throw error;
  }
  await audit(request, env, actor, "GRANT_REFERRAL_REWARD", "wallet_transaction", id, {
    caregiverId, amountToman: rewardAmount, referralCaseId,
  });
  return json({ data: { id, caregiverId, amountToman: rewardAmount, createdAt: timestamp } }, 201);
}

export async function decideSettlement(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await staffFinanceAllowed(env, actor, "update");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تصمیم معتبر نیست.");
  const decision = upper(body.status || body.decision);
  if (!["APPROVED", "REJECTED", "PAID"].includes(decision)) return fail("وضعیت تصمیم معتبر نیست.");
  const row = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,amount_toman AS amountToman,status
    FROM caregiver_settlement_requests WHERE id=? LIMIT 1`).bind(id)
    .first<{ id: string; caregiverId: string; amountToman: number; status: string }>();
  if (!row) return fail("درخواست تسویه پیدا نشد.", 404, "settlement_not_found");
  const current = upper(row.status);
  if (decision === "APPROVED" && current !== "REQUESTED") return fail("فقط درخواست جدید قابل تأیید است.", 409);
  if (decision === "REJECTED" && !["REQUESTED", "APPROVED"].includes(current)) return fail("این درخواست قابل رد نیست.", 409);
  if (decision === "PAID" && current !== "APPROVED") return fail("ابتدا درخواست باید تأیید شود.", 409);
  const timestamp = nowIso();
  if (decision === "PAID") {
    const tracking = str(body.paymentTrackingNumber);
    if (!tracking) return fail("شماره پیگیری پرداخت الزامی است.");
    const summary = await walletSummary(env, row.caregiverId);
    if (row.amountToman > summary.balanceToman) return fail("مانده کیف پول برای ثبت پرداخت کافی نیست.", 409, "insufficient_wallet_balance");
    const transactionId = randomId("wtx_");
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
        id,caregiver_id,direction,transaction_type,amount_toman,title,description,
        reference_type,reference_id,created_by_user_id,created_at
      ) VALUES(?,?,'DEBIT','SETTLEMENT',?,'تسویه کیف پول',?,'SETTLEMENT_REQUEST',?,?,?)`)
        .bind(transactionId, row.caregiverId, row.amountToman, str(body.decisionNote) || null, id, actor.id, timestamp),
      env.DB.prepare(`UPDATE caregiver_settlement_requests SET status='PAID',paid_by_user_id=?,paid_at=?,
        payment_tracking_number=?,decision_note=COALESCE(?,decision_note),updated_at=? WHERE id=?`)
        .bind(actor.id, timestamp, tracking, str(body.decisionNote) || null, timestamp, id),
    ]);
  } else {
    await env.DB.prepare(`UPDATE caregiver_settlement_requests SET status=?,reviewed_by_user_id=?,
      reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(
        decision, actor.id, timestamp, str(body.decisionNote) || null, timestamp, id,
      ).run();
  }
  await audit(request, env, actor, `SETTLEMENT_${decision}`, "settlement_request", id, {
    caregiverId: row.caregiverId, amountToman: row.amountToman,
    paymentTrackingNumber: decision === "PAID" ? str(body.paymentTrackingNumber) : null,
  });
  return json({ data: { id, status: decision, updatedAt: timestamp } });
}

export async function decideCreditRequest(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await staffFinanceAllowed(env, actor, "update");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تصمیم معتبر نیست.");
  const status = upper(body.status || body.decision);
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) return fail("وضعیت تصمیم معتبر نیست.");
  const row = await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,status FROM caregiver_credit_requests WHERE id=? LIMIT 1")
    .bind(id).first<{ id: string; caregiverId: string; status: string }>();
  if (!row) return fail("درخواست اعتبار پیدا نشد.", 404, "credit_request_not_found");
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_credit_requests SET status=?,reviewed_by_user_id=?,reviewed_at=?,
    decision_note=?,updated_at=? WHERE id=?`).bind(
      status, actor.id, timestamp, str(body.decisionNote) || null, timestamp, id,
    ).run();
  await audit(request, env, actor, `CREDIT_REQUEST_${status}`, "credit_request", id, { caregiverId: row.caregiverId });
  return json({ data: { id, status, updatedAt: timestamp } });
}

async function contractForPayroll(env: Env, caregiverId: string, contractId: string | null) {
  if (contractId) {
    return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_number AS contractNumber,
      family_name AS familyName,monthly_hours AS scheduledHours,logged_hours AS loggedHours,
      overtime_hours AS overtimeHours,absent_hours AS absentHours,payment_rate AS paymentRate
      FROM contracts WHERE id=? AND caregiver_id=? LIMIT 1`).bind(contractId, caregiverId).first<JsonRecord>();
  }
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_number AS contractNumber,
    family_name AS familyName,monthly_hours AS scheduledHours,logged_hours AS loggedHours,
    overtime_hours AS overtimeHours,absent_hours AS absentHours,payment_rate AS paymentRate
    FROM contracts WHERE caregiver_id=? AND upper(status) IN ('ACTIVE','APPROVED')
    ORDER BY starts_at DESC,created_at DESC LIMIT 1`).bind(caregiverId).first<JsonRecord>();
}

export async function issuePayroll(request: Request, env: Env, actor: AuthUser) {
  const denied = await staffFinanceAllowed(env, actor, "create");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات فیش حقوقی معتبر نیست.");
  const caregiverId = str(body.caregiverId);
  const periodKey = str(body.periodKey);
  const periodTitle = str(body.periodTitle) || periodKey;
  if (!caregiverId || !/^\d{4}-\d{2}$/.test(periodKey)) return fail("مراقب و دوره حقوق به شکل YYYY-MM الزامی است.");
  const contract = await contractForPayroll(env, caregiverId, str(body.contractId) || null);
  if (!contract) return fail("قرارداد مراقب برای محاسبه حقوق پیدا نشد.", 404, "contract_not_found");
  const scheduledHours = body.scheduledHours === undefined ? numeric(contract.scheduledHours) : numeric(body.scheduledHours);
  const loggedHours = body.loggedHours === undefined ? numeric(contract.loggedHours) : numeric(body.loggedHours);
  const overtimeHours = body.overtimeHours === undefined ? numeric(contract.overtimeHours) : numeric(body.overtimeHours);
  const absentHours = body.absentHours === undefined ? numeric(contract.absentHours) : numeric(body.absentHours);
  const hourlyRateToman = body.hourlyRateToman === undefined ? amount(contract.paymentRate) : amount(body.hourlyRateToman);
  const payableHours = Math.max(0, loggedHours + overtimeHours - absentHours);
  const grossToman = body.grossToman === undefined ? Math.round(payableHours * hourlyRateToman) : amount(body.grossToman);
  const benefitsToman = amount(body.benefitsToman);
  const deductionsToman = amount(body.deductionsToman);
  const netToman = Math.max(0, grossToman + benefitsToman - deductionsToman);
  const timestamp = nowIso();
  const id = randomId("pay_");
  try {
    await env.DB.prepare(`INSERT INTO caregiver_payroll_slips(
      id,caregiver_id,contract_id,period_key,period_title,scheduled_hours,logged_hours,overtime_hours,
      absent_hours,hourly_rate_toman,gross_toman,benefits_toman,deductions_toman,net_toman,status,
      note,issued_by_user_id,issued_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ISSUED',?,?,?,?,?)`).bind(
        id, caregiverId, str(contract.id), periodKey, periodTitle, scheduledHours, loggedHours,
        overtimeHours, absentHours, hourlyRateToman, grossToman, benefitsToman, deductionsToman,
        netToman, str(body.note) || null, actor.id, timestamp, timestamp, timestamp,
      ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) return fail("برای این قرارداد و دوره قبلاً فیش صادر شده است.", 409, "payroll_exists");
    throw error;
  }
  await audit(request, env, actor, "ISSUE_PAYROLL", "payroll_slip", id, {
    caregiverId, contractId: contract.id, periodKey, scheduledHours, loggedHours,
    overtimeHours, absentHours, hourlyRateToman, netToman,
  });
  return json({ data: { id, caregiverId, contractId: contract.id, periodKey, netToman, status: "ISSUED", issuedAt: timestamp } }, 201);
}

export async function markPayrollPaid(request: Request, env: Env, actor: AuthUser, id: string) {
  const denied = await staffFinanceAllowed(env, actor, "update");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  const tracking = str(body?.paymentTrackingNumber);
  if (!tracking) return fail("شماره پیگیری پرداخت الزامی است.");
  const row = await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,status FROM caregiver_payroll_slips WHERE id=? LIMIT 1")
    .bind(id).first<{ id: string; caregiverId: string; status: string }>();
  if (!row) return fail("فیش حقوقی پیدا نشد.", 404, "payroll_not_found");
  if (upper(row.status) !== "ISSUED") return fail("فقط فیش صادرشده قابل ثبت به‌عنوان پرداخت‌شده است.", 409);
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_payroll_slips SET status='PAID',paid_by_user_id=?,paid_at=?,
    payment_tracking_number=?,updated_at=? WHERE id=?`).bind(actor.id, timestamp, tracking, timestamp, id).run();
  await audit(request, env, actor, "MARK_PAYROLL_PAID", "payroll_slip", id, { caregiverId: row.caregiverId, tracking });
  return json({ data: { id, status: "PAID", paidAt: timestamp, paymentTrackingNumber: tracking } });
}

async function supportAllowed(env: Env, actor: AuthUser, action: "view" | "create" | "update") {
  if (actor.role.toUpperCase() === "CAREGIVER") return null;
  return requireAccess(env, actor, STAFF_SUPPORT_MODULE, action);
}

async function supportThread(env: Env, id: string) {
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_id AS contractId,category,
    subject,danger_confirmed AS dangerConfirmed,priority,status,assigned_user_id AS assignedUserId,
    created_by_user_id AS createdByUserId,last_message_at AS lastMessageAt,created_at AS createdAt,
    updated_at AS updatedAt FROM support_threads WHERE id=? LIMIT 1`).bind(id).first<JsonRecord>();
}

function canReadThread(actor: AuthUser, thread: JsonRecord) {
  return actor.role.toUpperCase() !== "CAREGIVER" || actor.caregiverId === str(thread.caregiverId);
}

export async function listSupportThreads(request: Request, env: Env, actor: AuthUser) {
  const denied = await supportAllowed(env, actor, "view");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const caregiverId = caregiverScope(actor);
  const url = new URL(request.url);
  const category = upper(url.searchParams.get("category"));
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (caregiverId) { clauses.push("t.caregiver_id=?"); bindings.push(caregiverId); }
  if (category && ["CASE", "URGENT_SECURITY"].includes(category)) { clauses.push("t.category=?"); bindings.push(category); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const threads = await safeAll<JsonRecord>(env, `SELECT t.id,t.caregiver_id AS caregiverId,
    c.membership_code AS membershipCode,c.full_name AS caregiverName,t.contract_id AS contractId,
    ct.contract_number AS contractNumber,ct.family_name AS familyName,t.category,t.subject,
    t.danger_confirmed AS dangerConfirmed,t.priority,t.status,t.assigned_user_id AS assignedUserId,
    au.full_name AS assignedUserName,t.last_message_at AS lastMessageAt,t.created_at AS createdAt,
    t.updated_at AS updatedAt,(SELECT COUNT(*) FROM support_messages m WHERE m.thread_id=t.id) AS messageCount
    FROM support_threads t JOIN caregivers c ON c.id=t.caregiver_id
    LEFT JOIN contracts ct ON ct.id=t.contract_id LEFT JOIN users au ON au.id=t.assigned_user_id
    ${where} ORDER BY CASE t.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
    CASE t.status WHEN 'OPEN' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,t.updated_at DESC LIMIT 200`, bindings);
  return json({ data: { threads } });
}

export async function createSupportThread(request: Request, env: Env, actor: AuthUser) {
  const denied = await supportAllowed(env, actor, "create");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات پشتیبانی معتبر نیست.");
  const isCaregiver = actor.role.toUpperCase() === "CAREGIVER";
  const caregiverId = isCaregiver ? actor.caregiverId : str(body.caregiverId);
  if (!caregiverId) return fail("پرونده مراقب مشخص نشده است.");
  const category = upper(body.category || "CASE");
  if (!["CASE", "URGENT_SECURITY"].includes(category)) return fail("دسته پشتیبانی معتبر نیست.");
  const dangerConfirmed = Boolean(body.dangerConfirmed);
  if (category === "URGENT_SECURITY" && !dangerConfirmed) {
    return fail("برای مسیر فوری باید وجود خطر را تأیید کنید.", 409, "danger_confirmation_required");
  }
  const contractId = str(body.contractId) || null;
  if (contractId) {
    const contract = await env.DB.prepare("SELECT id FROM contracts WHERE id=? AND caregiver_id=? LIMIT 1")
      .bind(contractId, caregiverId).first<{ id: string }>();
    if (!contract) return fail("قرارداد انتخاب‌شده متعلق به این مراقب نیست.", 409, "contract_scope_mismatch");
  }
  const timestamp = nowIso();
  const id = randomId("sup_");
  const subject = str(body.subject) || (category === "URGENT_SECURITY" ? "درخواست فوری و امنیتی" : "پشتیبانی پرونده");
  const priority = category === "URGENT_SECURITY" ? "CRITICAL" : "NORMAL";
  await env.DB.prepare(`INSERT INTO support_threads(
    id,caregiver_id,contract_id,category,subject,danger_confirmed,priority,status,assigned_user_id,
    created_by_user_id,last_message_at,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,'OPEN',?,?,?,?,?)`).bind(
      id, caregiverId, contractId, category, subject, dangerConfirmed ? 1 : 0, priority,
      str(body.assignedUserId) || null, actor.id, timestamp, timestamp, timestamp,
    ).run();
  const openingText = str(body.message);
  if (openingText) {
    await env.DB.prepare(`INSERT INTO support_messages(
      id,thread_id,sender_user_id,message_type,text_content,created_at
    ) VALUES(?,?,?,'TEXT',?,?)`).bind(randomId("msg_"), id, actor.id, openingText, timestamp).run();
  }
  await audit(request, env, actor, "CREATE_SUPPORT_THREAD", "support_thread", id, {
    caregiverId, category, dangerConfirmed, contractId,
  });
  return json({ data: { id, caregiverId, category, priority, status: "OPEN", createdAt: timestamp } }, 201);
}

export async function listSupportMessages(request: Request, env: Env, actor: AuthUser, threadId: string) {
  const denied = await supportAllowed(env, actor, "view");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const thread = await supportThread(env, threadId);
  if (!thread) return fail("گفت‌وگوی پشتیبانی پیدا نشد.", 404, "support_thread_not_found");
  if (!canReadThread(actor, thread)) return fail("دسترسی به این گفت‌وگو مجاز نیست.", 403, "forbidden");
  const messages = await safeAll<JsonRecord>(env, `SELECT m.id,m.thread_id AS threadId,
    m.sender_user_id AS senderUserId,u.full_name AS senderName,u.role AS senderRole,
    m.message_type AS messageType,m.text_content AS textContent,m.stored_file_id AS storedFileId,
    f.original_name AS originalName,f.content_type AS contentType,f.size_bytes AS sizeBytes,
    m.created_at AS createdAt FROM support_messages m JOIN users u ON u.id=m.sender_user_id
    LEFT JOIN stored_files f ON f.id=m.stored_file_id WHERE m.thread_id=? ORDER BY m.created_at`, [threadId]);
  return json({ data: { thread, messages } });
}

export async function createSupportMessage(request: Request, env: Env, actor: AuthUser, threadId: string) {
  const denied = await supportAllowed(env, actor, "create");
  if (denied) return denied;
  await ensureCaregiverPlatformSchema(env);
  const thread = await supportThread(env, threadId);
  if (!thread) return fail("گفت‌وگوی پشتیبانی پیدا نشد.", 404, "support_thread_not_found");
  if (!canReadThread(actor, thread)) return fail("دسترسی به این گفت‌وگو مجاز نیست.", 403, "forbidden");
  const body = await readBody(request);
  if (!body) return fail("پیام معتبر نیست.");
  const textContent = str(body.text) || null;
  const storedFileId = str(body.storedFileId) || null;
  const messageType = storedFileId ? "VOICE" : "TEXT";
  if (!textContent && !storedFileId) return fail("متن یا فایل صوتی پیام الزامی است.");
  if (storedFileId) {
    const file = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,category,content_type AS contentType,
      uploaded_by_user_id AS uploadedByUserId,deleted_at AS deletedAt FROM stored_files WHERE id=? LIMIT 1`)
      .bind(storedFileId).first<{ id: string; caregiverId: string | null; category: string; contentType: string; uploadedByUserId: string; deletedAt: string | null }>();
    if (!file || file.deletedAt || file.category !== "support" || !file.contentType.startsWith("audio/")) {
      return fail("فایل صوتی معتبر نیست.", 409, "invalid_voice_file");
    }
    if (file.caregiverId !== str(thread.caregiverId)) return fail("فایل صوتی متعلق به این پرونده نیست.", 403, "voice_file_scope_mismatch");
    if (file.uploadedByUserId !== actor.id) return fail("فایل صوتی باید توسط فرستنده فعلی بارگذاری شده باشد.", 403, "voice_file_owner_mismatch");
  }
  const timestamp = nowIso();
  const id = randomId("msg_");
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO support_messages(
      id,thread_id,sender_user_id,message_type,text_content,stored_file_id,created_at
    ) VALUES(?,?,?,?,?,?,?)`).bind(id, threadId, actor.id, messageType, textContent, storedFileId, timestamp),
    env.DB.prepare("UPDATE support_threads SET last_message_at=?,updated_at=?,status=CASE WHEN status='CLOSED' THEN 'OPEN' ELSE status END WHERE id=?")
      .bind(timestamp, timestamp, threadId),
  ]);
  await audit(request, env, actor, "CREATE_SUPPORT_MESSAGE", "support_message", id, {
    threadId, messageType, storedFileId,
  });
  return json({ data: { id, threadId, messageType, textContent, storedFileId, createdAt: timestamp } }, 201);
}

export async function updateSupportThread(request: Request, env: Env, actor: AuthUser, threadId: string) {
  const denied = await supportAllowed(env, actor, "update");
  if (denied) return denied;
  if (actor.role.toUpperCase() === "CAREGIVER") return fail("تغییر وضعیت گفت‌وگو فقط برای پشتیبان مجاز است.", 403, "staff_only");
  await ensureCaregiverPlatformSchema(env);
  const thread = await supportThread(env, threadId);
  if (!thread) return fail("گفت‌وگوی پشتیبانی پیدا نشد.", 404, "support_thread_not_found");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات گفت‌وگو معتبر نیست.");
  const status = upper(body.status || thread.status);
  if (!["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(status)) return fail("وضعیت گفت‌وگو معتبر نیست.");
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE support_threads SET status=?,assigned_user_id=?,updated_at=? WHERE id=?`).bind(
    status, str(body.assignedUserId) || actor.id, timestamp, threadId,
  ).run();
  await audit(request, env, actor, "UPDATE_SUPPORT_THREAD", "support_thread", threadId, { status });
  return json({ data: { id: threadId, status, updatedAt: timestamp } });
}

export async function routeCaregiverPlatform(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  if (!path.startsWith("/api/caregiver/platform/") && !path.startsWith("/api/staff/financial-credits")) return null;
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  let response: Response | null = null;

  if (path === "/api/caregiver/platform/dashboard" && method === "GET") response = await caregiverDashboard(request, env, actor);
  else if (path === "/api/caregiver/platform/scorecard-record" && method === "GET") response = await caregiverScorecardRecord(request, env, actor);
  else if (path === "/api/caregiver/platform/wallet" && method === "GET") response = await caregiverWallet(request, env, actor);
  else if (path === "/api/caregiver/platform/settlements" && method === "POST") response = await createSettlementRequest(request, env, actor);
  else if (path === "/api/caregiver/platform/credit-requests" && method === "POST") response = await createCreditRequest(request, env, actor);
  else if (path === "/api/caregiver/platform/payroll" && method === "GET") response = await caregiverPayroll(env, actor);
  else if (path === "/api/caregiver/platform/support/threads" && method === "GET") response = await listSupportThreads(request, env, actor);
  else if (path === "/api/caregiver/platform/support/threads" && method === "POST") response = await createSupportThread(request, env, actor);
  else {
    const supportMessages = path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)\/messages$/);
    const supportThreadMatch = path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)$/);
    const settlementMatch = path.match(/^\/api\/staff\/financial-credits\/settlements\/([^/]+)$/);
    const creditMatch = path.match(/^\/api\/staff\/financial-credits\/credit-requests\/([^/]+)$/);
    const payrollMatch = path.match(/^\/api\/staff\/financial-credits\/payroll\/([^/]+)$/);
    if (supportMessages && method === "GET") response = await listSupportMessages(request, env, actor, decodeURIComponent(supportMessages[1]));
    else if (supportMessages && method === "POST") response = await createSupportMessage(request, env, actor, decodeURIComponent(supportMessages[1]));
    else if (supportThreadMatch && method === "PATCH") response = await updateSupportThread(request, env, actor, decodeURIComponent(supportThreadMatch[1]));
    else if (path === "/api/staff/financial-credits" && method === "GET") response = await staffFinancialDashboard(request, env, actor);
    else if (path === "/api/staff/financial-credits/rewards" && method === "POST") response = await grantReferralReward(request, env, actor);
    else if (settlementMatch && method === "PATCH") response = await decideSettlement(request, env, actor, decodeURIComponent(settlementMatch[1]));
    else if (creditMatch && method === "PATCH") response = await decideCreditRequest(request, env, actor, decodeURIComponent(creditMatch[1]));
    else if (path === "/api/staff/financial-credits/payroll" && method === "POST") response = await issuePayroll(request, env, actor);
    else if (payrollMatch && method === "PATCH") response = await markPayrollPaid(request, env, actor, decodeURIComponent(payrollMatch[1]));
  }
  return securityHeaders(response || fail("مسیر پنل مراقب پیدا نشد.", 404, "not_found"));
}

export async function supportFileAllowed(env: Env, actor: AuthUser, caregiverId: string | null) {
  if (actor.role.toUpperCase() === "CAREGIVER") return Boolean(actor.caregiverId && actor.caregiverId === caregiverId);
  return canAccess(env, actor, STAFF_SUPPORT_MODULE, "view");
}
