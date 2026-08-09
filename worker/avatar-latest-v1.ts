import { ensureProfileImageSchema } from "./profile-images";
import { type Env, fail, getUser, hasRole, securityHeaders, str } from "./lib";

const STAFF_ROLES=["ADMIN","RECRUITER","HR","SUPPORT","EVALUATOR","EDUCATION","OPERATIONS"];

export async function routeLatestProfileAvatar(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(request.method.toUpperCase()!=="GET")return null;
 const caregiverMatch=url.pathname.match(/^\/api\/profile-images\/caregiver\/([^/]+)\/latest$/);const userMatch=url.pathname.match(/^\/api\/profile-images\/user\/([^/]+)\/latest$/);if(!caregiverMatch&&!userMatch)return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 await ensureProfileImageSchema(env);
 let row:{id:string}|null=null;
 if(caregiverMatch){const caregiverId=decodeURIComponent(caregiverMatch[1]);if(actor.caregiverId!==caregiverId&&!hasRole(actor,STAFF_ROLES))return securityHeaders(fail("دسترسی کافی ندارید.",403,"forbidden"));row=await env.DB.prepare("SELECT id FROM profile_images WHERE caregiver_id=? ORDER BY updated_at DESC LIMIT 1").bind(caregiverId).first<{id:string}>()||null}
 else {const userId=decodeURIComponent(userMatch![1]);if(actor.id!==userId&&!hasRole(actor,STAFF_ROLES))return securityHeaders(fail("دسترسی کافی ندارید.",403,"forbidden"));row=await env.DB.prepare("SELECT id FROM profile_images WHERE user_id=? ORDER BY updated_at DESC LIMIT 1").bind(userId).first<{id:string}>()||null}
 if(!row?.id)return securityHeaders(fail("تصویر پروفایل پیدا نشد.",404,"profile_image_not_found"));
 const target=new URL(request.url);target.pathname=`/api/profile-images/${encodeURIComponent(str(row.id))}`;target.search="";return Response.redirect(target.toString(),302);
}
