import app from "./index-desktop-react-v1";
import {routeReferralRewardsV4} from "./referral-rewards-v4";
import {routeJobAdsV3} from "./job-ads-v3";
import {routeCaregiverFinancialProfileReferralFixV1} from "./caregiver-financial-referral-fix-v1";
import {type Env} from "./lib";

type WorkerLifecycleContext={waitUntil(promise:Promise<unknown>):void};

export default {
 async fetch(request:Request,env:Env,ctx:WorkerLifecycleContext){
  const referral=await routeReferralRewardsV4(request,env);if(referral)return referral;
  const financial=await routeCaregiverFinancialProfileReferralFixV1(request,env);if(financial)return financial;
  const jobs=await routeJobAdsV3(request,env);if(jobs)return jobs;
  return app.fetch(request,env,ctx as any);
 },
 async scheduled(controller:any,env:Env,ctx:WorkerLifecycleContext){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx as any)}
};
