import app from "./index-desktop-react-v1";
import {routeJobAdMutationPolicyV13} from "./job-ad-mutation-policy-v13";
import {routeStaffJobAdListFiltersV14} from "./staff-job-ad-list-filters-v14";

type WorkerLifecycleContext={waitUntil(promise:Promise<unknown>):void};
type WorkerScheduledController={scheduledTime:number;cron:string;noRetry?():void};

export default {
 async fetch(request:Request,env:any,ctx:WorkerLifecycleContext){
  const mutation=await routeJobAdMutationPolicyV13(request,env);if(mutation)return mutation;
  const list=await routeStaffJobAdListFiltersV14(request,env);if(list)return list;
  return app.fetch(request,env,ctx);
 },
 async scheduled(controller:WorkerScheduledController,env:any,ctx:WorkerLifecycleContext){
  if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
 }
};
