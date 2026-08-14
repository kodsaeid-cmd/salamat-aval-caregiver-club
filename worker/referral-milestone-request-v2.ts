import {buildReferralMilestoneBenefitsSummaryV2} from "./referral-milestone-benefits-v2";
import {type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const KEYS=new Set(["NETWORK_10","CONTRACT_7"]);
const amountFor=(key:string)=>key==="NETWORK_10"?3_000_000:key==="CONTRACT_7"?8_000_000:0;
const targetFor=(key:string)=>key==="NETWORK_10"?10:key==="CONTRACT_7"?7:0;

export async function routeReferralMilestoneRequestV2(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(request.method.toUpperCase()!=="POST"||url.pathname!=="/api/caregiver/platform/referral-milestone-requests")return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));if(String(actor.role||"").toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only"));
 const body=await readBody(request.clone());if(!body)return securityHeaders(fail("اطلاعات درخواست معتبر نیست."));const key=str(body.milestoneKey).toUpperCase();if(!KEYS.has(key))return securityHeaders(fail("پله معرفی انتخاب‌شده معتبر نیست."));
 const summary=await buildReferralMilestoneBenefitsSummaryV2(env,actor.caregiverId),tier=key==="NETWORK_10"?summary.network10:summary.contract7;if(!tier.eligible)return securityHeaders(fail("شرایط دوره بعدی این وام معرفی هنوز کامل نشده است.",409,"referral_milestone_not_eligible"));
 const cycleNumber=Math.max(1,Number(tier.nextCycleNumber||1)),target=targetFor(key),totalQualified=Number(tier.totalQualified||0),requiredQualified=cycleNumber*target;
 if(totalQualified<requiredQualified)return securityHeaders(fail("حد نصاب این دوره هنوز کامل نشده است.",409,"referral_cycle_not_eligible"));
 const existing=await env.DB.prepare(`SELECT id,status FROM caregiver_referral_recurring_loan_requests WHERE caregiver_id=? AND milestone_key=? AND cycle_number=? LIMIT 1`).bind(actor.caregiverId,key,cycleNumber).first<{id:string;status:string}>();
 if(existing)return securityHeaders(fail("برای این دوره قبلاً درخواست ثبت شده است.",409,"referral_cycle_request_exists"));
 const id=randomId("rfrq_"),eventId=randomId("rfev_"),ts=nowIso(),snapshot={policyVersion:summary.policyVersion,mode:summary.mode,milestoneKey:key,cycleNumber,target,amountToman:amountFor(key),requiredQualified,totalQualified,totals:summary.totals,network10:{current:summary.network10.current,target:summary.network10.target,submittedCycles:summary.network10.submittedCycles,nextCycleNumber:summary.network10.nextCycleNumber},contract7:{current:summary.contract7.current,target:summary.contract7.target,submittedCycles:summary.contract7.submittedCycles,nextCycleNumber:summary.contract7.nextCycleNumber}};
 await env.DB.batch([
  env.DB.prepare("INSERT INTO caregiver_referral_recurring_loan_requests(id,caregiver_id,milestone_key,cycle_number,target_count,qualified_count_at_request,eligibility_snapshot_json,status,requested_by_user_id,requested_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'REQUESTED',?,?,?,?)").bind(id,actor.caregiverId,key,cycleNumber,target,totalQualified,JSON.stringify(snapshot),actor.id,ts,ts,ts),
  env.DB.prepare("INSERT INTO caregiver_referral_recurring_loan_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,'REQUESTED',NULL,'REQUESTED',?,?,?)").bind(eventId,id,actor.id,JSON.stringify(snapshot),ts)
 ]);
 await audit(request,env,actor,"CREATE_REFERRAL_MILESTONE_REQUEST","caregiver_referral_recurring_loan_request",id,{milestoneKey:key,cycleNumber,snapshot});
 return securityHeaders(json({data:{id,status:"REQUESTED",milestoneKey:key,cycleNumber}},201));
}
