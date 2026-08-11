import {routeCaregiverFinancialProfileV4} from "./caregiver-financial-profile-v4";
import {buildReferralSummaryDataV4} from "./referral-rewards-v4";
import {type Env,getUser,json} from "./lib";

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
 try{payload.data.referrals=await buildReferralSummaryDataV4(env,caregiverId)}catch{return base}
 const headers=new Headers(base.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");return new Response(JSON.stringify(payload),{status:base.status,statusText:base.statusText,headers});
}
