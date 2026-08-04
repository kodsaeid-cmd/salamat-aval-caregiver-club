import { requireAccess } from "./access-control";
import { ensureCaregiverPlatformSchema } from "./caregiver-platform-v1";
import {
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

export async function routeCaregiverPlatformOverrides(request: Request, env: Env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/staff/financial-credits/rewards" || request.method.toUpperCase() !== "POST") return null;
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const denied = await requireAccess(env, actor, "staff.financial_credits", "create");
  if (denied) return securityHeaders(denied);
  await ensureCaregiverPlatformSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات پاداش معتبر نیست."));
  const caregiverId = str(body.caregiverId);
  const amountToman = Math.max(0, Math.trunc(Number(body.amountToman || 0)));
  const referralCaseId = str(body.referralCaseId || body.referenceId);
  const title = str(body.title) || "پاداش معرفی پرونده مراقبت";
  if (!caregiverId || !amountToman || !referralCaseId) {
    return securityHeaders(fail("مراقب، مبلغ و شناسه پرونده معرفی‌شده الزامی است."));
  }
  const caregiver = await env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId).first<{ id: string }>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  const id = randomId("wtx_");
  const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
      id,caregiver_id,direction,transaction_type,amount_toman,title,description,
      reference_type,reference_id,created_by_user_id,created_at
    ) VALUES(?,?,'CREDIT','REFERRAL_REWARD',?,?,?,'REFERRAL_CASE',?,?,?)`).bind(
      id,
      caregiverId,
      amountToman,
      title,
      str(body.description) || null,
      referralCaseId,
      actor.id,
      timestamp,
    ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) {
      return securityHeaders(fail("برای این پرونده معرفی‌شده قبلاً پاداش ثبت شده است.", 409, "duplicate_referral_reward"));
    }
    throw error;
  }
  await audit(request, env, actor, "GRANT_REFERRAL_REWARD", "wallet_transaction", id, {
    caregiverId,
    amountToman,
    referralCaseId,
  });
  return securityHeaders(json({ data: { id, caregiverId, amountToman, createdAt: timestamp } }, 201));
}
