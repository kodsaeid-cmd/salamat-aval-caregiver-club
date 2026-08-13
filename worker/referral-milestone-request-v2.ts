import {buildReferralMilestoneBenefitsSummary} from "./referral-milestone-benefits-v1";
import {type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const KEYS=new Set(["NETWORK_10","CONTRACT_7"]);
const amountFor=(key:string)=>key==="NETWORK_10"?3_000_000:key==="CONTRACT_7"?8_000_000:0;

export async function routeReferralMilestoneRequestV2(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(request.method.toUpperCase()!=="POST"||url.pathname!=="/api/caregiver/platform/referral-milestone-requests")return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));if(String(actor.role||"").toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only"));
 const body=await readBody(request.clone());if(!body)return securityHeaders(fail("اطلاعات درخواست معتبر نیست."));const key=str(body.milestoneKey).toUpperCase();if(!KEYS.has(key))return securityHeaders(fail("پله معرفی انتخاب‌شده معتبر نیست."));
 const summary=await buildReferralMilestoneBenefitsSummary(env,actor.caregiverId),tier=key==="NETWORK_10"?summary.network10:summary.contract7;if(!tier.eligible)return securityHeaders(fail("شرایط این پله معرفی هنوز کامل نشده است.",409,"referral_milestone_not_eligible"));if(!summary.cohort.id)return securityHeaders(fail("گروه مبنای معرفی هنوز تثبیت نشده است.",409,"referral_cohort_not_ready"));if(tier.request)return securityHeaders(fail("برای این پله قبلاً درخواست ثبت شده است.",409,"referral_milestone_request_exists"));
 const id=randomId("rfrq_"),eventId=randomId("rfev_"),ts=nowIso(),snapshot={policyVersion:summary.policyVersion,milestoneKey:key,amountToman:amountFor(key),cohort:summary.cohort,network10:{current:summary.network10.current,target:summary.network10.target,totalQualified:summary.network10.totalQualified},contract7:{current:summary.contract7.current,target:summary.contract7.target}};
 await env.DB.batch([
  env.DB.prepare("INSERT INTO caregiver_referral_milestone_requests(id,caregiver_id,cohort_id,milestone_key,eligibility_snapshot_json,status,requested_by_user_id,requested_at,created_at,updated_at) VALUES(?,?,?,?,?,'REQUESTED',?,?,?,?)").bind(id,actor.caregiverId,summary.cohort.id,key,JSON.stringify(snapshot),actor.id,ts,ts,ts),
  env.DB.prepare("INSERT INTO caregiver_referral_milestone_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,'REQUESTED',NULL,'REQUESTED',?,?,?)").bind(eventId,id,actor.id,JSON.stringify(snapshot),ts)
 ]);
 await audit(request,env,actor,"CREATE_REFERRAL_MILESTONE_REQUEST","caregiver_referral_milestone_request",id,{milestoneKey:key,snapshot});
 return securityHeaders(json({data:{id,status:"REQUESTED",milestoneKey:key}},201));
}
