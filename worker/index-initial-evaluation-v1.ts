import app from "./index-desktop-react-v1";
import {routeInitialCaregiverEvaluationV1} from "./initial-caregiver-evaluation-v1";

type WorkerLifecycleContext={waitUntil(promise:Promise<unknown>):void};
type WorkerScheduledController={scheduledTime:number;cron:string;noRetry?():void};

export default{
 async fetch(request:Request,env:any,ctx:WorkerLifecycleContext){
  const initialEvaluationResponse=await routeInitialCaregiverEvaluationV1(request,env);
  if(initialEvaluationResponse)return initialEvaluationResponse;
  return app.fetch(request,env,ctx);
 },
 async scheduled(controller:WorkerScheduledController,env:any,ctx:WorkerLifecycleContext){
  if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
 }
};
