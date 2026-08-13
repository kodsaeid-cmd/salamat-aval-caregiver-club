import {requireAccess} from "./access-control";
import {buildReferralMilestoneBenefitsSummary,buildStaffReferralMilestoneData} from "./referral-milestone-benefits-v1";
import {type Env,fail,getUser,json,securityHeaders} from "./lib";

export async function routeReferralMilestoneReadV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();if(method!=="GET")return null;
 if(url.pathname==="/api/caregiver/platform/referral-milestone-summary"){
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));if(String(actor.role||"").toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only"));
  return securityHeaders(json({data:await buildReferralMilestoneBenefitsSummary(env,actor.caregiverId)}));
 }
 if(url.pathname==="/api/staff/financial-credits/referrals/milestones"){
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));const denied=await requireAccess(env,actor,"staff.financial_credits","view");if(denied)return securityHeaders(denied);
  return securityHeaders(json({data:await buildStaffReferralMilestoneData(env)}));
 }
 return null;
}
