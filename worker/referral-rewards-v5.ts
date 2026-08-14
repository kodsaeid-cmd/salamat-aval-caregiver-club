import {awardReferralContractBonusOnFirstInContract,routeReferralRewardsV4} from "./referral-rewards-v4";
import {routeReferralMilestoneBenefitsV2} from "./referral-milestone-benefits-v2";
import {routeReferralMilestoneReadV1} from "./referral-milestone-read-v1";
import {routeReferralMilestoneRequestV2} from "./referral-milestone-request-v2";
import {routeCaregiverRequestCenterV1} from "./caregiver-request-center-v1";
import {type Env,getUser,readBody} from "./lib";

export async function routeReferralRewardsV5(request:Request,env:Env):Promise<Response|null>{
 const requestCenter=await routeCaregiverRequestCenterV1(request,env);if(requestCenter)return requestCenter;
 const read=await routeReferralMilestoneReadV1(request,env);if(read)return read;
 const requestV2=await routeReferralMilestoneRequestV2(request,env);if(requestV2)return requestV2;
 const extra=await routeReferralMilestoneBenefitsV2(request,env);if(extra)return extra;
 const url=new URL(request.url),method=request.method.toUpperCase();
 const staffMatch=url.pathname.match(/^\/api\/staff\/financial-credits\/referrals\/([^/]+)$/);
 if(!staffMatch||method!=="PATCH")return routeReferralRewardsV4(request,env);
 const body=await readBody(request.clone()),action=String(body?.action||"").toUpperCase();
 const response=await routeReferralRewardsV4(request,env);
 if(!response||!response.ok||action!=="APPROVE_REGISTRATION")return response;
 const actor=await getUser(request,env);if(!actor)return response;
 const caseId=decodeURIComponent(staffMatch[1]);
 const row=await env.DB.prepare("SELECT referred_caregiver_id AS caregiverId FROM caregiver_referral_cases WHERE id=? LIMIT 1").bind(caseId).first<{caregiverId:string}>();
 if(row?.caregiverId){
  try{await awardReferralContractBonusOnFirstInContract(request,env,actor,row.caregiverId)}catch(error){console.error("referral_contract_bonus_post_stage1_reconciliation_required",{caseId,caregiverId:row.caregiverId,error:error instanceof Error?error.message:String(error)})}
 }
 return response;
}
