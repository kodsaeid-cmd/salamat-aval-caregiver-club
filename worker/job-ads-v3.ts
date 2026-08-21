import {routeJobAds as routeJobAdsV2} from "./job-ads-v2";
import {ensureJobAdsSchema} from "./job-ads-v1";
import {awardReferralContractBonusOnFirstInContract} from "./referral-rewards-v4";
import {type Env,getUser,readBody} from "./lib";

let heavyWeightSchemaReady:Promise<void>|undefined;

async function ensureHeavyWeightSchema(env:Env){
 if(!heavyWeightSchemaReady)heavyWeightSchemaReady=(async()=>{
  await ensureJobAdsSchema(env);
  const columns=await env.DB.prepare("PRAGMA table_info(care_job_ads)").all<{name:string}>();
  if((columns.results||[]).some(row=>String(row.name||"")==="heavy_weight"))return;
  try{await env.DB.prepare("ALTER TABLE care_job_ads ADD COLUMN heavy_weight INTEGER NOT NULL DEFAULT 0").run()}
  catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!/duplicate column name:\s*heavy_weight/i.test(message))throw error;
  }
 })().catch(error=>{heavyWeightSchemaReady=undefined;throw error});
 return heavyWeightSchemaReady;
}

export async function routeJobAdsV3(request:Request,env:Env):Promise<Response|null>{
 await ensureHeavyWeightSchema(env);
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