import {routeCaregiverFinancialProfileV4} from "./caregiver-financial-profile-v4";
import {buildReferralSummaryDataV4} from "./referral-rewards-v4";
import {applyPointBenefitsToFinancialPayload} from "./point-benefits-v1";
import {buildCaregiverRetentionRewardsSummary} from "./retention-rewards-v1";
import {type Env,getUser} from "./lib";

export async function routeCaregiverFinancialProfileReferralFixV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const own=url.pathname==="/api/caregiver/platform/financial-profile";
 const staff=url.pathname.match(/^\/api\/staff\/financial-credits\/caregivers\/([^/]+)\/profile$/);
 if(method!=="GET"&&!own&&!staff)return null;
 if(method!=="GET"||(!own&&!staff))return null;
 const base=await routeCaregiverFinancialProfileV4(request,env);
 if(!base||!base.ok)return base;
 const payload:any=await base.clone().json().catch(()=>null);
 if(!payload?.data)return base;
 let caregiverId=staff?decodeURIComponent(staff[1]):"";
 if(own){const actor=await getUser(request,env);caregiverId=String(actor?.caregiverId||"")}
 if(!caregiverId)return base;
 try{payload.data.referrals=await buildReferralSummaryDataV4(env,caregiverId)}catch{}
 try{await applyPointBenefitsToFinancialPayload(env,payload,caregiverId)}catch(error){console.error("loan_policy_profile_rewrite_failed",{caregiverId,error:error instanceof Error?error.message:String(error)})}
 try{payload.data.retentionRewards=await buildCaregiverRetentionRewardsSummary(env,caregiverId)}catch(error){console.error("retention_rewards_profile_build_failed",{caregiverId,error:error instanceof Error?error.message:String(error)})}
 const headers=new Headers(base.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-loan-policy","4.0.0");headers.set("x-salamat-retention-rewards","1.0.0");return new Response(JSON.stringify(payload),{status:base.status,statusText:base.statusText,headers});
}
