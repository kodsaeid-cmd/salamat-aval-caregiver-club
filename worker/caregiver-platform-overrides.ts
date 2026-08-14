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
const upper=(value:unknown)=>str(value).toUpperCase();
const amount=(value:unknown)=>Math.max(0,Math.trunc(Number(value||0)));

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

async function compatibleWalletSummary(env:Env,caregiverId:string){
 const totals=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE -amount_toman END),0) AS balanceToman FROM caregiver_wallet_transactions WHERE caregiver_id=?`).bind(caregiverId).first<{balanceToman:number}>();
 const pending=await env.DB.prepare(`SELECT COALESCE(SUM(s.amount_toman),0) AS pendingToman,
   COALESCE(SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM caregiver_wallet_transactions w WHERE w.reference_type='SETTLEMENT_REQUEST' AND w.reference_id=s.id AND w.direction='DEBIT') THEN s.amount_toman ELSE 0 END),0) AS unheldPendingToman
   FROM caregiver_settlement_requests s WHERE s.caregiver_id=? AND s.status IN ('REQUESTED','APPROVED')`).bind(caregiverId).first<{pendingToman:number;unheldPendingToman:number}>();
 const balanceToman=Number(totals?.balanceToman||0),pendingSettlementToman=Number(pending?.pendingToman||0),unheldPendingToman=Number(pending?.unheldPendingToman||0);
 return {balanceToman,pendingSettlementToman,availableToman:Math.max(0,balanceToman-unheldPendingToman)};
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
  if (response.ok && payload.data?.credit) payload.data.credit = correctCreditData({ credit: payload.data.credit }).credit;
  if(response.ok&&actor.caregiverId&&payload.data?.wallet)payload.data.wallet=await compatibleWalletSummary(env,actor.caregiverId);
  return securityHeaders(json(payload, response.status));
}

async function correctedWallet(request: Request, env: Env) {
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await caregiverWallet(request, env, actor);
  const payload = await responsePayload(response);
  if (response.ok && payload.data?.benefits) payload.data.benefits = correctCreditData(payload.data.benefits);
  if(response.ok&&actor.caregiverId)payload.data.summary=await compatibleWalletSummary(env,actor.caregiverId);
  return securityHeaders(json(payload, response.status));
}

function normalizeIban(value:unknown){return str(value).replace(/\s+/g,"").toUpperCase()}

async function createSettlementHeld(request:Request,env:Env,actor:AuthUser){
 const caregiverId=actor.role.toUpperCase()==="CAREGIVER"?actor.caregiverId:null;if(!caregiverId)return fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only");
 await ensureCaregiverPlatformSchema(env);const body=await readBody(request.clone());if(!body)return fail("اطلاعات درخواست تسویه معتبر نیست.");
 const requested=amount(body.amountToman),accountHolderName=str(body.accountHolderName),iban=normalizeIban(body.iban)||null,accountNumber=str(body.accountNumber).replace(/\s+/g,"")||null;
 if(!requested)return fail("مبلغ تسویه باید بیشتر از صفر باشد.");if(!accountHolderName)return fail("نام صاحب حساب الزامی است.");if(!iban&&!accountNumber)return fail("شماره شبا یا شماره حساب الزامی است.");if(iban&&!/^IR\d{24}$/.test(iban))return fail("شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.");
 const summary=await compatibleWalletSummary(env,caregiverId);if(requested>summary.availableToman)return fail("مبلغ درخواستی از مانده قابل تسویه بیشتر است.",409,"insufficient_wallet_balance");
 const ts=nowIso(),id=randomId("set_"),transactionId=randomId("wtx_");
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO caregiver_settlement_requests(id,caregiver_id,amount_toman,account_holder_name,iban,account_number,bank_name,note,status,requested_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'REQUESTED',?,?,?)`).bind(id,caregiverId,requested,accountHolderName,iban,accountNumber,str(body.bankName)||null,str(body.note)||null,actor.id,ts,ts),
  env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'DEBIT','SETTLEMENT_HOLD',?,'کسر وجه درخواست تسویه',?,'SETTLEMENT_REQUEST',?,?,?)`).bind(transactionId,caregiverId,requested,str(body.note)||"رزرو و کسر فوری مبلغ درخواست تسویه",id,actor.id,ts)
 ]);
 await audit(request,env,actor,"CREATE_SETTLEMENT_REQUEST","settlement_request",id,{caregiverId,amountToman:requested,walletDebited:true,walletTransactionId:transactionId,iban:iban?`${iban.slice(0,6)}…${iban.slice(-4)}`:null});
 return json({data:{id,status:"REQUESTED",amountToman:requested,createdAt:ts,walletDebited:true,walletTransactionId:transactionId}},201);
}

async function decideSettlementHeld(request:Request,env:Env,actor:AuthUser,id:string){
 const denied=await requireAccess(env,actor,"staff.financial_credits","update");if(denied)return denied;await ensureCaregiverPlatformSchema(env);const body=await readBody(request.clone());if(!body)return fail("اطلاعات تصمیم معتبر نیست.");
 const decision=upper(body.status||body.decision);if(!["APPROVED","REJECTED","PAID"].includes(decision))return fail("وضعیت تصمیم معتبر نیست.");
 const row=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,amount_toman AS amountToman,status FROM caregiver_settlement_requests WHERE id=? LIMIT 1`).bind(id).first<{id:string;caregiverId:string;amountToman:number;status:string}>();if(!row)return fail("درخواست تسویه پیدا نشد.",404,"settlement_not_found");
 const current=upper(row.status);if(decision==="APPROVED"&&current!=="REQUESTED")return fail("فقط درخواست جدید قابل تأیید است.",409);if(decision==="REJECTED"&&!["REQUESTED","APPROVED"].includes(current))return fail("این درخواست قابل رد نیست.",409);if(decision==="PAID"&&current!=="APPROVED")return fail("ابتدا درخواست باید تأیید شود.",409);
 const debit=await env.DB.prepare(`SELECT id FROM caregiver_wallet_transactions WHERE reference_type='SETTLEMENT_REQUEST' AND reference_id=? AND direction='DEBIT' LIMIT 1`).bind(id).first<{id:string}>(),credit=await env.DB.prepare(`SELECT id FROM caregiver_wallet_transactions WHERE reference_type='SETTLEMENT_REQUEST' AND reference_id=? AND direction='CREDIT' LIMIT 1`).bind(id).first<{id:string}>(),ts=nowIso(),statements:any[]=[];
 if(decision==="APPROVED")statements.push(env.DB.prepare(`UPDATE caregiver_settlement_requests SET status='APPROVED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,str(body.decisionNote)||null,ts,id));
 if(decision==="REJECTED"){
  if(debit&&!credit)statements.push(env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT','SETTLEMENT_RELEASE',?,'بازگشت وجه درخواست تسویه',?,'SETTLEMENT_REQUEST',?,?,?)`).bind(randomId("wtx_"),row.caregiverId,row.amountToman,str(body.decisionNote)||"بازگشت وجه به علت رد درخواست تسویه",id,actor.id,ts));
  statements.push(env.DB.prepare(`UPDATE caregiver_settlement_requests SET status='REJECTED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,str(body.decisionNote)||null,ts,id));
 }
 if(decision==="PAID"){
  const tracking=str(body.paymentTrackingNumber);if(!tracking)return fail("شماره پیگیری پرداخت الزامی است.");
  if(!debit){const summary=await compatibleWalletSummary(env,row.caregiverId);if(row.amountToman>summary.balanceToman)return fail("مانده کیف پول برای ثبت پرداخت کافی نیست.",409,"insufficient_wallet_balance");statements.push(env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'DEBIT','SETTLEMENT',?,'تسویه کیف پول',?,'SETTLEMENT_REQUEST',?,?,?)`).bind(randomId("wtx_"),row.caregiverId,row.amountToman,str(body.decisionNote)||null,id,actor.id,ts))}
  statements.push(env.DB.prepare(`UPDATE caregiver_settlement_requests SET status='PAID',paid_by_user_id=?,paid_at=?,payment_tracking_number=?,decision_note=COALESCE(?,decision_note),updated_at=? WHERE id=?`).bind(actor.id,ts,tracking,str(body.decisionNote)||null,ts,id));
 }
 await env.DB.batch(statements);await audit(request,env,actor,`SETTLEMENT_${decision}`,"settlement_request",id,{caregiverId:row.caregiverId,amountToman:row.amountToman,walletHeld:Boolean(debit),walletReleased:decision==="REJECTED"&&Boolean(debit&&!credit),paymentTrackingNumber:decision==="PAID"?str(body.paymentTrackingNumber):null});
 return json({data:{id,status:decision,updatedAt:ts}});
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
  if (!caregiverId || !amountToman || !referralCaseId) return securityHeaders(fail("مراقب، مبلغ و شناسه پرونده معرفی‌شده الزامی است."));
  const caregiver = await env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first<{ id: string }>();
  if (!caregiver) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  const id = randomId("wtx_");
  const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(
      id,caregiver_id,direction,transaction_type,amount_toman,title,description,
      reference_type,reference_id,created_by_user_id,created_at
    ) VALUES(?,?,'CREDIT','REFERRAL_REWARD',?,?,?,'REFERRAL_CASE',?,?,?)`).bind(
      id, caregiverId, amountToman, title, str(body.description) || null, referralCaseId, actor.id, timestamp,
    ).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "database_error";
    if (/UNIQUE|unique/i.test(detail)) return securityHeaders(fail("برای این پرونده معرفی‌شده قبلاً پاداش ثبت شده است.", 409, "duplicate_referral_reward"));
    throw error;
  }
  await audit(request, env, actor, "GRANT_REFERRAL_REWARD", "wallet_transaction", id, {caregiverId,amountToman,referralCaseId});
  return securityHeaders(json({ data: { id, caregiverId, amountToman, createdAt: timestamp } }, 201));
}

export async function routeCaregiverPlatformOverrides(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (url.pathname === "/api/benefits/summary" && method === "GET") return correctedBenefits(request, env);
  if (url.pathname === "/api/caregiver/platform/dashboard" && method === "GET") return correctedDashboard(request, env);
  if (url.pathname === "/api/caregiver/platform/wallet" && method === "GET") return correctedWallet(request, env);
  if(url.pathname==="/api/caregiver/platform/settlements"&&method==="POST"){
   const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await createSettlementHeld(request,env,actor));
  }
  const settlementMatch=url.pathname.match(/^\/api\/staff\/financial-credits\/settlements\/([^/]+)$/);if(settlementMatch&&method==="PATCH"){
   const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await decideSettlementHeld(request,env,actor,decodeURIComponent(settlementMatch[1])));
  }
  if (url.pathname === "/api/staff/financial-credits/rewards" && method === "POST") return grantReward(request, env);
  return null;
}
