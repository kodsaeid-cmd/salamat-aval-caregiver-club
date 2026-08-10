import app from "./index-caregiver-onboarding-v2";
import { individualEffectivePermissions } from "./individual-access-v2";
import { type AuthUser,type Env,fail,getUser,json,normalizeRole,securityHeaders } from "./lib";

type WorkerContext={waitUntil(promise:Promise<unknown>):void};
const PREFIX="profile:";

export default {
  async fetch(request:Request,env:Env,ctx:WorkerContext){
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
    return app.fetch(request,env,ctx);
  },
  async scheduled(controller:any,env:Env,ctx:WorkerContext){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
