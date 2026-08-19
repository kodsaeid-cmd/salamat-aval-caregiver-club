import app from "./index-caregiver-onboarding-v2";
import { individualEffectivePermissions } from "./individual-access-v2";
import { routeUsersAccessUnifiedV2 } from "./users-access-unified-v2";
import { routeInitialCaregiverEvaluationV1 } from "./initial-caregiver-evaluation-v1";
import { processPendingCaregiverWebPushV2,routeCaregiverWebPushV2 } from "./caregiver-web-push-v2";
import { type AuthUser,type Env,fail,getUser,json,normalizeRole,securityHeaders } from "./lib";

type WorkerContext={waitUntil(promise:Promise<unknown>):void};
const PREFIX="profile:";

export default {
  async fetch(request:Request,env:Env,ctx:WorkerContext){
    const pushResponse=await routeCaregiverWebPushV2(request,env);if(pushResponse)return pushResponse;
    const usersResponse=await routeUsersAccessUnifiedV2(request,env);if(usersResponse)return usersResponse;
    const initialEvaluationResponse=await routeInitialCaregiverEvaluationV1(request,env);if(initialEvaluationResponse)return securityHeaders(initialEvaluationResponse);
    const url=new URL(request.url),method=request.method.toUpperCase();
    const match=url.pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
    if(match&&method==="GET"){
      const id=decodeURIComponent(match[1]);
      if(id.startsWith(PREFIX)){
        const actor=await getUser(request,env);
        if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
        if(normalizeRole(actor.role)!=="ADMIN")return securityHeaders(fail("جزئیات ماتریس دسترسی فقط برای مدیر سامانه قابل مشاهده است.",403,"admin_only"));
        const caregiverId=id.slice(PREFIX.length);
        const caregiver=await env.DB.prepare("SELECT full_name AS fullName,mobile FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first<{fullName:string;mobile:string}>();
        if(!caregiver)return securityHeaders(fail("پرونده مراقب پیدا نشد.",404,"caregiver_not_found"));
        const virtual:AuthUser={id,caregiverId,fullName:caregiver.fullName,mobile:caregiver.mobile,username:null,role:"CAREGIVER",status:"PENDING",permissionsJson:"[]"};
        const effective=await individualEffectivePermissions(env,virtual);
        return securityHeaders(json({data:{user:{...virtual,permissionsJson:undefined},effective,overrides:[],policy:{precedence:"USER_THEN_ROLE_THEN_LEGACY",pendingProfile:true}}}));
      }
    }
    const response=await app.fetch(request,env,ctx);
    if(!["GET","HEAD","OPTIONS"].includes(method)&&response.ok){
      ctx.waitUntil(processPendingCaregiverWebPushV2(env,30).catch(error=>console.error("caregiver_web_push_dispatch_failed",error instanceof Error?error.message:String(error))));
    }
    return response;
  },
  async scheduled(controller:any,env:Env,ctx:WorkerContext){
    ctx.waitUntil(processPendingCaregiverWebPushV2(env,100).catch(error=>console.error("caregiver_web_push_scheduled_failed",error instanceof Error?error.message:String(error))));
    if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)
  }
};