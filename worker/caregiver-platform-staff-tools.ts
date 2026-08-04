import { requireAccess } from "./access-control";
import { ensureCaregiverPlatformSchema } from "./caregiver-platform-v1";
import { type Env, fail, getUser, json, securityHeaders, str } from "./lib";

const MODULE = "staff.financial_credits";
const digits = (value: string) => value
  .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
  .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
const normalize = (value: unknown) => digits(str(value))
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim();

async function actorFor(request: Request, env: Env) {
  const actor = await getUser(request, env);
  if (!actor) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  const denied = await requireAccess(env, actor, MODULE, "view");
  return denied ? { response: securityHeaders(denied) } : { actor };
}

async function searchCaregivers(request: Request, env: Env) {
  const auth = await actorFor(request, env);
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const url = new URL(request.url);
  const query = normalize(url.searchParams.get("q"));
  const like = `%${query}%`;
  const rows = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,
    mobile,national_id AS nationalId,cooperation_status AS fileStatus,professional_level AS professionalLevel
    FROM caregivers WHERE (cooperation_status IS NULL OR cooperation_status<>'حذف‌شده')
    AND (?='' OR replace(replace(full_name,'ي','ی'),'ك','ک') LIKE ? OR membership_code LIKE ?
      OR mobile LIKE ? OR national_id LIKE ?)
    ORDER BY full_name LIMIT 50`).bind(query, like, like, like, like).all<Record<string, unknown>>();
  return securityHeaders(json({ data: { caregivers: rows.results || [], query } }));
}

async function caregiverFinancialContext(request: Request, env: Env, caregiverId: string) {
  const auth = await actorFor(request, env);
  if (auth.response) return auth.response;
  await ensureCaregiverPlatformSchema(env);
  const caregiver = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,
    mobile,professional_level AS professionalLevel FROM caregivers WHERE id=? LIMIT 1`)
    .bind(caregiverId).first<Record<string, unknown>>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  const [contracts, wallet] = await Promise.all([
    env.DB.prepare(`SELECT id,contract_number AS contractNumber,family_name AS familyName,service_type AS serviceType,
      status,starts_at AS startsAt,ends_at AS endsAt,monthly_hours AS scheduledHours,
      logged_hours AS loggedHours,overtime_hours AS overtimeHours,absent_hours AS absentHours,
      payment_rate AS paymentRate,payment_type AS paymentType FROM contracts WHERE caregiver_id=?
      ORDER BY CASE upper(status) WHEN 'ACTIVE' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,starts_at DESC`)
      .bind(caregiverId).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE -amount_toman END),0) AS balanceToman
      FROM caregiver_wallet_transactions WHERE caregiver_id=?`).bind(caregiverId).first<Record<string, unknown>>(),
  ]);
  return securityHeaders(json({ data: { caregiver, contracts: contracts.results || [], wallet: wallet || { balanceToman: 0 } } }));
}

export async function routeCaregiverPlatformStaffTools(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (url.pathname === "/api/staff/financial-credits/caregivers" && method === "GET") {
    return searchCaregivers(request, env);
  }
  const match = url.pathname.match(/^\/api\/staff\/financial-credits\/caregivers\/([^/]+)$/);
  if (match && method === "GET") return caregiverFinancialContext(request, env, decodeURIComponent(match[1]));
  return null;
}
