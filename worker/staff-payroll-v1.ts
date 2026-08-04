import { requireAccess } from "./access-control";
import {
  ensureCaregiverPlatformSchema,
  staffFinancialDashboard,
} from "./caregiver-platform-v1";
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

const MODULE_KEY = "staff.payroll";
const digits = (value: string) => value
  .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
  .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
const normalize = (value: unknown) => digits(str(value))
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim();
const amount = (value: unknown) => Math.max(0, Math.trunc(Number(value || 0)));
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

type JsonRow = Record<string, unknown>;

async function actorFor(request: Request, env: Env, action: "view" | "create" | "update") {
  const actor = await getUser(request, env);
  if (!actor) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  const denied = await requireAccess(env, actor, MODULE_KEY, action);
  return denied ? { response: securityHeaders(denied) } : { actor };
}

async function financeOnlyDashboard(request: Request, env: Env) {
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await staffFinancialDashboard(request, env, actor);
  if (!response.ok) return securityHeaders(response);
  const payload = await response.json() as Record<string, any>;
  if (payload?.data && typeof payload.data === "object") {
    delete payload.data.payroll;
    if (payload.data.summary && typeof payload.data.summary === "object") {
      delete payload.data.summary.payrollIssued;
    }
  }
  return securityHeaders(json(payload));
}

async function listPayroll(request: Request, env: Env) {
  const auth = await actorFor(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const url = new URL(request.url);
  const query = normalize(url.searchParams.get("q"));
  const status = normalize(url.searchParams.get("status")).toUpperCase();
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get("pageSize") || "40", 10) || 40));
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (query) {
    const like = `%${query}%`;
    clauses.push(`(replace(replace(c.full_name,'ي','ی'),'ك','ک') LIKE ? OR c.membership_code LIKE ?
      OR p.period_key LIKE ? OR ct.contract_number LIKE ? OR ct.family_name LIKE ?)`);
    bindings.push(like, like, like, like, like);
  }
  if (["DRAFT", "ISSUED", "PAID", "VOID"].includes(status)) {
    clauses.push("p.status=?");
    bindings.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const [summary, count, rows] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status='ISSUED' THEN 1 ELSE 0 END),0) AS issued,
      COALESCE(SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END),0) AS paid,
      COALESCE(SUM(CASE WHEN status='ISSUED' THEN net_toman ELSE 0 END),0) AS pendingToman,
      COALESCE(SUM(CASE WHEN status='PAID' THEN net_toman ELSE 0 END),0) AS paidToman
      FROM caregiver_payroll_slips WHERE status<>'VOID'`).first<JsonRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM caregiver_payroll_slips p
      JOIN caregivers c ON c.id=p.caregiver_id LEFT JOIN contracts ct ON ct.id=p.contract_id ${where}`)
      .bind(...bindings).first<{ total: number }>(),
    env.DB.prepare(`SELECT p.id,p.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,p.contract_id AS contractId,ct.contract_number AS contractNumber,
      ct.family_name AS familyName,p.period_key AS periodKey,p.period_title AS periodTitle,
      p.scheduled_hours AS scheduledHours,p.logged_hours AS loggedHours,p.overtime_hours AS overtimeHours,
      p.absent_hours AS absentHours,p.hourly_rate_toman AS hourlyRateToman,p.gross_toman AS grossToman,
      p.benefits_toman AS benefitsToman,p.deductions_toman AS deductionsToman,p.net_toman AS netToman,
      p.status,p.note,p.issued_at AS issuedAt,p.paid_at AS paidAt,
      p.payment_tracking_number AS paymentTrackingNumber
      FROM caregiver_payroll_slips p JOIN caregivers c ON c.id=p.caregiver_id
      LEFT JOIN contracts ct ON ct.id=p.contract_id ${where}
      ORDER BY p.issued_at DESC LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all<JsonRow>(),
  ]);
  return securityHeaders(json({
    data: {
      summary: summary || {},
      slips: rows.results || [],
      pagination: { page, pageSize, total: Number(count?.total || 0), pages: Math.max(1, Math.ceil(Number(count?.total || 0) / pageSize)) },
      filters: { query, status },
    },
  }));
}

async function searchCaregivers(request: Request, env: Env) {
  const auth = await actorFor(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const query = normalize(new URL(request.url).searchParams.get("q"));
  const like = `%${query}%`;
  const rows = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,
    mobile,national_id AS nationalId,cooperation_status AS fileStatus FROM caregivers
    WHERE (cooperation_status IS NULL OR cooperation_status<>'حذف‌شده')
    AND (?='' OR replace(replace(full_name,'ي','ی'),'ك','ک') LIKE ? OR membership_code LIKE ?
      OR mobile LIKE ? OR national_id LIKE ?)
    ORDER BY full_name LIMIT 50`).bind(query, like, like, like, like).all<JsonRow>();
  return securityHeaders(json({ data: { caregivers: rows.results || [], query } }));
}

async function caregiverContext(request: Request, env: Env, caregiverId: string) {
  const auth = await actorFor(request, env, "view");
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const caregiver = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,
    mobile FROM caregivers WHERE id=? LIMIT 1`).bind(caregiverId).first<JsonRow>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  const contracts = await env.DB.prepare(`SELECT id,contract_number AS contractNumber,family_name AS familyName,
    service_type AS serviceType,status,monthly_hours AS scheduledHours,logged_hours AS loggedHours,
    overtime_hours AS overtimeHours,absent_hours AS absentHours,payment_rate AS hourlyRateToman,
    payment_type AS paymentType,starts_at AS startsAt,ends_at AS endsAt FROM contracts
    WHERE caregiver_id=? ORDER BY CASE upper(status) WHEN 'ACTIVE' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
    starts_at DESC,created_at DESC`).bind(caregiverId).all<JsonRow>();
  return securityHeaders(json({ data: { caregiver, contracts: contracts.results || [] } }));
}

async function issuePayroll(request: Request, env: Env, actor: AuthUser) {
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات فیش حقوقی معتبر نیست."));
  const caregiverId = str(body.caregiverId);
  const contractId = str(body.contractId);
  const periodKey = normalize(body.periodKey);
  const periodTitle = str(body.periodTitle) || periodKey;
  if (!caregiverId || !contractId || !/^\d{4}-\d{2}$/.test(periodKey)) {
    return securityHeaders(fail("مراقب، قرارداد و دوره حقوق به شکل YYYY-MM الزامی است."));
  }
  const contract = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_number AS contractNumber,
    monthly_hours AS scheduledHours,logged_hours AS loggedHours,overtime_hours AS overtimeHours,
    absent_hours AS absentHours,payment_rate AS hourlyRateToman FROM contracts
    WHERE id=? AND caregiver_id=? LIMIT 1`).bind(contractId, caregiverId).first<JsonRow>();
  if (!contract) return securityHeaders(fail("قرارداد انتخاب‌شده متعلق به این مراقب نیست.", 404, "contract_not_found"));
  const scheduledHours = body.scheduledHours === undefined ? numeric(contract.scheduledHours) : numeric(body.scheduledHours);
  const loggedHours = body.loggedHours === undefined ? numeric(contract.loggedHours) : numeric(body.loggedHours);
  const overtimeHours = body.overtimeHours === undefined ? numeric(contract.overtimeHours) : numeric(body.overtimeHours);
  const absentHours = body.absentHours === undefined ? numeric(contract.absentHours) : numeric(body.absentHours);
  const hourlyRateToman = body.hourlyRateToman === undefined ? amount(contract.hourlyRateToman) : amount(body.hourlyRateToman);
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
      id, caregiverId, contractId, periodKey, periodTitle, scheduledHours, loggedHours, overtimeHours,
      absentHours, hourlyRateToman, grossToman, benefitsToman, deductionsToman, netToman,
      str(body.note) || null, actor.id, timestamp, timestamp, timestamp,
    ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) return securityHeaders(fail("برای این قرارداد و دوره قبلاً فیش صادر شده است.", 409, "payroll_exists"));
    throw error;
  }
  await audit(request, env, actor, "ISSUE_PAYROLL", "payroll_slip", id, {
    caregiverId, contractId, periodKey, scheduledHours, loggedHours, overtimeHours,
    absentHours, hourlyRateToman, grossToman, benefitsToman, deductionsToman, netToman,
  });
  return securityHeaders(json({ data: { id, caregiverId, contractId, periodKey, netToman, status: "ISSUED", issuedAt: timestamp } }, 201));
}

async function markPaid(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  const tracking = str(body?.paymentTrackingNumber);
  if (!tracking) return securityHeaders(fail("شماره پیگیری پرداخت الزامی است."));
  const row = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,status,net_toman AS netToman
    FROM caregiver_payroll_slips WHERE id=? LIMIT 1`).bind(id)
    .first<{ id: string; caregiverId: string; status: string; netToman: number }>();
  if (!row) return securityHeaders(fail("فیش حقوقی پیدا نشد.", 404, "payroll_not_found"));
  if (String(row.status).toUpperCase() !== "ISSUED") {
    return securityHeaders(fail("فقط فیش صادرشده قابل ثبت به‌عنوان پرداخت‌شده است.", 409));
  }
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_payroll_slips SET status='PAID',paid_by_user_id=?,paid_at=?,
    payment_tracking_number=?,updated_at=? WHERE id=?`).bind(actor.id, timestamp, tracking, timestamp, id).run();
  await audit(request, env, actor, "MARK_PAYROLL_PAID", "payroll_slip", id, {
    caregiverId: row.caregiverId, netToman: row.netToman, paymentTrackingNumber: tracking,
  });
  return securityHeaders(json({ data: { id, status: "PAID", paidAt: timestamp, paymentTrackingNumber: tracking } }));
}

export async function routeStaffPayrollV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname === "/api/staff/financial-credits" && method === "GET") {
    return financeOnlyDashboard(request, env);
  }
  if (url.pathname.startsWith("/api/staff/financial-credits/payroll")) {
    return securityHeaders(fail(
      "مسیر قدیمی حقوق از اعتبارات مالی حذف شده است؛ از ماژول مستقل حقوق و پرداخت استفاده کنید.",
      410,
      "legacy_finance_payroll_removed",
    ));
  }

  if (!url.pathname.startsWith("/api/staff/payroll")) return null;
  if (url.pathname === "/api/staff/payroll" && method === "GET") return listPayroll(request, env);
  if (url.pathname === "/api/staff/payroll/caregivers" && method === "GET") return searchCaregivers(request, env);
  const caregiverMatch = url.pathname.match(/^\/api\/staff\/payroll\/caregivers\/([^/]+)$/);
  if (caregiverMatch && method === "GET") return caregiverContext(request, env, decodeURIComponent(caregiverMatch[1]));
  if (url.pathname === "/api/staff/payroll" && method === "POST") {
    const auth = await actorFor(request, env, "create");
    if (auth.response) return auth.response;
    return issuePayroll(request, env, auth.actor!);
  }
  const payMatch = url.pathname.match(/^\/api\/staff\/payroll\/([^/]+)\/pay$/);
  if (payMatch && method === "PATCH") {
    const auth = await actorFor(request, env, "update");
    if (auth.response) return auth.response;
    return markPaid(request, env, auth.actor!, decodeURIComponent(payMatch[1]));
  }
  return securityHeaders(fail("مسیر حقوق و پرداخت پیدا نشد.", 404, "not_found"));
}
