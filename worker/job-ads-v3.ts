import {routeJobAds as routeJobAdsV2} from "./job-ads-v2";
import {awardReferralContractBonusOnFirstInContract} from "./referral-rewards-v4";
import {type Env,getUser,readBody} from "./lib";

export async function routeJobAdsV3(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
 if(!match||method!=="PATCH")return routeJobAdsV2(request,env);
 const body=await readBody(request.clone());
 const next=String(body?.status||"").toUpperCase();
 const response=await routeJobAdsV2(request,env);
 if(!response||!response.ok||next!=="IN_CONTRACT")return response;
 const actor=await getUser(request,env);
 if(!actor)return response;
 const adId=decodeURIComponent(match[1]),applicationId=decodeURIComponent(match[2]);
 const application=await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM care_job_applications WHERE id=? AND ad_id=? LIMIT 1").bind(applicationId,adId).first<{caregiverId:string}>();
 if(application?.caregiverId){
  try{await awardReferralContractBonusOnFirstInContract(request,env,actor,application.caregiverId,applicationId,adId)}
  catch(error){console.error("referral_contract_bonus_reconciliation_required",{applicationId,adId,caregiverId:application.caregiverId,error:error instanceof Error?error.message:String(error)})}
 }
 return response;
}
