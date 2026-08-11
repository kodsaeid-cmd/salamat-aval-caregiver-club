import {requireAccess} from "./access-control";
import {ensureCaregiverPlatformSchema} from "./caregiver-platform-v1";
import {caregiverLoanPolicy,LOAN_TIER_RULES,type LoanTierKey} from "./point-benefits-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const MODULE="staff.financial_credits";
const OPEN_STATUSES=new Set(["REQUESTED","UNDER_REVIEW","APPROVED"]);
const TIER_KEYS=new Set<string>(LOAN_TIER_RULES.map(rule=>rule.key));

type CreditRow={id:string;caregiverId:string;requestedAmountToman:number;eligibilityPath:string;eligibilitySnapshotJson:string;status:string};
const upper=(value:unknown)=>str(value).toUpperCase();

function eligibilityMessage(tier:any){
 const points=tier?.requirements?.points,evaluation=tier?.requirements?.evaluation;
 if(!points?.passed&&evaluation?.passed)return `برای این پله هنوز ${Math.max(0,Number(points?.target||0)-Number(points?.current||0)).toLocaleString("fa-IR")} امتیاز قرارداد کم است.`;
 if(points?.passed&&!evaluation?.passed)return evaluation?.current==null?"برای درخواست وام باید حداقل یک ارزیابی نهایی داشته باشید و میانگین شاخص‌های آن حداقل ۶۰ باشد.":`میانگین شاخص‌های آخرین ارزیابی نهایی ${Number(evaluation.current).toLocaleString("fa-IR")} است و باید حداقل ۶۰ باشد.`;
 return `برای این پله هم امتیاز قرارداد و هم میانگین شاخص‌های ارزیابی باید به حد نصاب برسند.`;
}

async function createRequest(request:Request,env:Env,actor:AuthUser){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only");
 await ensureCaregiverPlatformSchema(env);
 const body=await readBody(request)||{};
 const policy=await caregiverLoanPolicy(env,actor.caregiverId);
 const requestedKey=str(body.benefitKey||body.tierKey) as LoanTierKey;
 const tier=requestedKey?policy.tiers.find(item=>item.key===requestedKey):[...policy.tiers].reverse().find(item=>item.eligible);
 if(!tier||!TIER_KEYS.has(String(tier.key)))return fail("پله وام معتبر نیست. فقط پله‌های ۱۰، ۲۵، ۵۰ و ۷۰ میلیون تومانی فعال هستند.",400,"invalid_loan_tier");
 if(!tier.eligible)return fail(eligibilityMessage(tier),409,"loan_not_eligible");
 const open=await env.DB.prepare(`SELECT id,status FROM caregiver_credit_requests WHERE caregiver_id=? AND status IN ('REQUESTED','UNDER_REVIEW','APPROVED') LIMIT 1`).bind(actor.caregiverId).first<{id:string;status:string}>();
 if(open)return fail("برای شما یک درخواست وام باز وجود دارد.",409,"credit_request_exists");
 const id=randomId("crq_"),timestamp=nowIso();
 const snapshot={profileVersion:"LOAN_POLICY_V3",benefitKey:tier.key,benefitType:"LOAN",benefitTitle:tier.title,amountToman:tier.amountToman,eligibleAtRequest:true,eligibilityModel:policy.eligibilityModel,currentPoints:policy.totalPoints,targetPoints:tier.targetPoints,evaluationAverageScore:policy.evaluation.averageScore,evaluationThreshold:policy.minimumEvaluationScore,pointsPassed:tier.requirements.points.passed,evaluationPassed:tier.requirements.evaluation.passed,evaluationSource:"caregiver_evaluation_periods:latest_FINAL.final_score",calculatedAt:timestamp};
 await env.DB.prepare(`INSERT INTO caregiver_credit_requests(id,caregiver_id,requested_amount_toman,eligibility_path,continuous_days,cumulative_days,eligibility_snapshot_json,note,status,requested_by_user_id,created_at,updated_at)
 VALUES(?,?,?,?,0,0,?,?,'REQUESTED',?,?,?)`).bind(id,actor.caregiverId,tier.amountToman,tier.key,JSON.stringify(snapshot),str(body.note)||null,actor.id,timestamp,timestamp).run();
 await audit(request,env,actor,"CREATE_POINT_EVALUATION_LOAN_REQUEST","credit_request",id,snapshot);
 return json({data:{id,status:"REQUESTED",...snapshot,createdAt:timestamp}},201);
}

function validTransition(current:string,next:string){
 return (next==="UNDER_REVIEW"&&current==="REQUESTED")
  ||(next==="APPROVED"&&["REQUESTED","UNDER_REVIEW"].includes(current))
  ||(next==="REJECTED"&&["REQUESTED","UNDER_REVIEW"].includes(current))
  ||(next==="CANCELLED"&&OPEN_STATUSES.has(current));
}

async function decideRequest(request:Request,env:Env,actor:AuthUser,id:string,row:CreditRow){
 const denied=await requireAccess(env,actor,MODULE,"update");if(denied)return denied;
 const body=await readBody(request),decision=upper(body?.status||body?.decision),reason=str(body?.reason||body?.decisionNote||body?.note).trim();
 if(!["UNDER_REVIEW","APPROVED","REJECTED","CANCELLED"].includes(decision))return fail("وضعیت تصمیم معتبر نیست.");
 if(reason.length<3)return fail("ثبت دلیل تصمیم الزامی است.",400,"reason_required");
 const current=upper(row.status);if(!validTransition(current,decision))return fail("تغییر وضعیت درخواست وام مجاز نیست.",409,"invalid_transition");
 let verified:any=null;
 if(decision==="APPROVED"){
  if(!TIER_KEYS.has(row.eligibilityPath))return fail("این درخواست مربوط به منطق قدیمی تسهیلات است و با سیاست جدید قابل تأیید نیست. مراقب باید درخواست جدید ثبت کند.",409,"loan_policy_retired");
  const policy=await caregiverLoanPolicy(env,row.caregiverId),tier=policy.tiers.find(item=>item.key===row.eligibilityPath);
  if(!tier||Number(row.requestedAmountToman)!==Number(tier.amountToman))return fail("پله و مبلغ درخواست با سیاست جاری وام همخوان نیست.",409,"loan_tier_mismatch");
  if(!tier.eligible)return fail(`در زمان تأیید مدیر، شرایط وام احراز نیست. ${eligibilityMessage(tier)}`,409,"loan_not_eligible");
  verified={benefitKey:tier.key,amountToman:tier.amountToman,currentPoints:policy.totalPoints,targetPoints:tier.targetPoints,evaluationAverageScore:policy.evaluation.averageScore,evaluationThreshold:policy.minimumEvaluationScore,pointsPassed:true,evaluationPassed:true,eligibilityModel:policy.eligibilityModel,verifiedAt:nowIso()};
 }
 const timestamp=nowIso();
 await env.DB.prepare(`UPDATE caregiver_credit_requests SET status=?,reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(decision,actor.id,timestamp,reason,timestamp,id).run();
 await audit(request,env,actor,`LOAN_REQUEST_${decision}`,"credit_request",id,{caregiverId:row.caregiverId,previousStatus:current,reason,eligibility:verified,policyVersion:"3.0.0"});
 return json({data:{id,status:decision,reason,eligibility:verified,updatedAt:timestamp}});
}

export async function routeLoanCreditPolicyV2(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
 if(path==="/api/caregiver/platform/credit-requests"&&method==="POST"){
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
  return securityHeaders(await createRequest(request,env,actor));
 }
 const match=path.match(/^\/api\/staff\/financial-credits\/credit-requests\/([^/]+)$/);
 if(match&&method==="PATCH"){
  await ensureCaregiverPlatformSchema(env);
  const id=decodeURIComponent(match[1]);
  const row=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,requested_amount_toman AS requestedAmountToman,eligibility_path AS eligibilityPath,eligibility_snapshot_json AS eligibilitySnapshotJson,status FROM caregiver_credit_requests WHERE id=? LIMIT 1`).bind(id).first<CreditRow>();
  if(!row)return securityHeaders(fail("درخواست وام پیدا نشد.",404,"credit_request_not_found"));
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
  return securityHeaders(await decideRequest(request,env,actor,id,row));
 }
 return null;
}
