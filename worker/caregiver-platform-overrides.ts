import { requireAccess } from "./access-control";
import { getFinancialBenefits } from "./benefits";
import {
  caregiverDashboard,
  caregiverWallet,
  ensureCaregiverPlatformSchema,
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

const CONTINUOUS_TARGET_DAYS = 730;
const CUMULATIVE_TARGET_DAYS = 1_200;
const DAY_MS = 86_400_000;
const percent = (value: number, target: number) => Math.min(100, Math.round((value / target) * 1_000) / 10);

type JsonRecord = Record<string, any>;

function correctCreditData(data: JsonRecord) {
  const credit = data.credit || {};
  const continuous = credit.continuous || {};
  const cumulative = credit.cumulative || {};
  const continuousDays = Math.max(0, Math.trunc(Number(continuous.longestDays || 0)));
  const currentContinuousDays = Math.max(0, Math.trunc(Number(continuous.currentDays || 0)));
  const cumulativeDays = Math.max(0, Math.trunc(Number(cumulative.days || 0)));
  const eligibleContinuous = continuousDays >= CONTINUOUS_TARGET_DAYS;
  const eligibleCumulative = cumulativeDays >= CUMULATIVE_TARGET_DAYS;
  const eligible = eligibleContinuous || eligibleCumulative;
  const remainingContinuous = Math.max(0, CONTINUOUS_TARGET_DAYS - continuousDays);
  const remainingCurrentContinuous = Math.max(0, CONTINUOUS_TARGET_DAYS - currentContinuousDays);
  const remainingCumulative = Math.max(0, CUMULATIVE_TARGET_DAYS - cumulativeDays);
  const active = Boolean(continuous.active);
  const remainingActiveDays = eligible ? 0 : active
    ? Math.min(remainingCurrentContinuous, remainingCumulative)
    : Math.min(remainingContinuous, remainingCumulative);
  data.rules = {
    ...(data.rules || {}),
    continuousTargetMonths: 24,
    cumulativeTargetMonths: 40,
  };
  credit.eligible = eligible;
  credit.eligibleBy = eligibleContinuous ? "CONTINUOUS" : eligibleCumulative ? "CUMULATIVE" : null;
  credit.status = eligible
    ? "ELIGIBLE"
    : active
      ? "IN_PROGRESS"
      : Number((data.contracts || []).length)
        ? "PAUSED"
        : "NO_CONTRACTS";
  credit.progressPercent = Math.max(
    percent(continuousDays, CONTINUOUS_TARGET_DAYS),
    percent(cumulativeDays, CUMULATIVE_TARGET_DAYS),
  );
  credit.remainingActiveDays = remainingActiveDays;
  credit.projectedEligibilityDate = eligible
    ? new Date().toISOString().slice(0, 10)
    : active
      ? new Date(Date.now() + Math.max(0, remainingActiveDays - 1) * DAY_MS).toISOString().slice(0, 10)
      : null;
  credit.continuous = {
    ...continuous,
    targetDays: CONTINUOUS_TARGET_DAYS,
    progressPercent: percent(continuousDays, CONTINUOUS_TARGET_DAYS),
    remainingDays: remainingContinuous,
  };
  credit.cumulative = {
    ...cumulative,
    targetDays: CUMULATIVE_TARGET_DAYS,
    progressPercent: percent(cumulativeDays, CUMULATIVE_TARGET_DAYS),
    remainingDays: remainingCumulative,
  };
  data.credit = credit;
  return data;
}

async function responsePayload(response: Response) {
  return await response.json().catch(() => ({})) as JsonRecord;
}

async function correctedBenefits(request: Request, env: Env, actor?: AuthUser) {
  const currentActor = actor || await getUser(request, env);
  if (!currentActor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await getFinancialBenefits(request, env, currentActor);
  const payload = await responsePayload(response);
  if (!response.ok) return securityHeaders(json(payload, response.status));
  payload.data = correctCreditData(payload.data || {});
  return securityHeaders(json(payload, response.status));
}

async function correctedDashboard(request: Request, env: Env) {
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await caregiverDashboard(request, env, actor);
  const payload = await responsePayload(response);
  if (response.ok && payload.data?.credit) {
    payload.data.credit = correctCreditData({ credit: payload.data.credit }).credit;
  }
  return securityHeaders(json(payload, response.status));
}

async function correctedWallet(request: Request, env: Env) {
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await caregiverWallet(request, env, actor);
  const payload = await responsePayload(response);
  if (response.ok && payload.data?.benefits) {
    payload.data.benefits = correctCreditData(payload.data.benefits);
  }
  return securityHeaders(json(payload, response.status));
}

async function grantReward(request: Request, env: Env) {
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

export async function routeCaregiverPlatformOverrides(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (url.pathname === "/api/benefits/summary" && method === "GET") return correctedBenefits(request, env);
  if (url.pathname === "/api/caregiver/platform/dashboard" && method === "GET") return correctedDashboard(request, env);
  if (url.pathname === "/api/caregiver/platform/wallet" && method === "GET") return correctedWallet(request, env);
  if (url.pathname === "/api/staff/financial-credits/rewards" && method === "POST") return grantReward(request, env);
  return null;
}
