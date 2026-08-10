import app from "./index-stability";
import { updateRolePermissions, type AccessAction } from "./access-control";
import { updateAccountV2, deleteAccountV2 } from "./account-management-v2";
import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { invalidateRecruiterDirectoryCache } from "./recruiter-directory";
import {
  individualAccessMe,
  individualGetUserPermissions,
  individualRequireAccess,
  individualUpdateUserPermissions,
  isProtectedRootAccount,
} from "./individual-access-v2";
import { type AuthUser,type Env,fail,getUser,securityHeaders } from "./lib";

type Requirement = { module: string; action: AccessAction };
function actionFor(method: string): AccessAction { if(method==="GET"||method==="HEAD")return"view";if(method==="POST")return"create";if(method==="DELETE")return"delete";return"update"; }

function requirement(pathname: string, method: string): Requirement | null {
  if(pathname==="/api/users"){if(method==="GET")return{module:"staff.users",action:"view"};if(method==="POST")return{module:"staff.users",action:"create"}}
  if(/^\/api\/users\/[^/]+$/.test(pathname)){if(method==="PATCH")return{module:"staff.users",action:"update"};if(method==="DELETE")return{module:"staff.users",action:"delete"}}
  if(pathname==="/api/caregiver-accounts"&&method==="POST")return{module:"staff.users",action:"create"};
  if(["/api/admin/directory","/api/admin/caregivers-page","/api/admin/caregiver-record"].includes(pathname))return{module:"staff.caregivers",action:"view"};
  if(pathname==="/api/admin/caregiver-profile")return{module:"staff.caregivers",action:method==="GET"?"view":"update"};
  if(pathname==="/api/caregivers"){if(method==="GET")return{module:"staff.caregivers",action:"view"};if(method==="POST")return{module:"staff.caregivers",action:"create"}}
  if(/^\/api\/caregivers\/[^/]+$/.test(pathname)){if(method==="PATCH")return{module:"staff.caregivers",action:"update"};if(method==="DELETE")return{module:"staff.caregivers",action:"delete"}}
  if(pathname==="/api/profile-images"&&method==="POST")return{module:"staff.caregivers",action:"update"};
  if(/^\/api\/evaluations(?:\/|$)/.test(pathname)||/^\/api\/admin\/(?:evaluations|caregiver-scorecard)(?:\/|$)/.test(pathname))return{module:"staff.evaluations",action:actionFor(method)};
  if(/^\/api\/training(?:\/|$)/.test(pathname)||/^\/api\/files(?:\/|$)/.test(pathname))return{module:"staff.training",action:actionFor(method)};
  if(/^\/api\/calendar(?:\/|$)/.test(pathname)||/^\/api\/contracts(?:\/|$)/.test(pathname)||/^\/api\/staff\/contracts(?:\/|$)/.test(pathname))return{module:"staff.contracts",action:actionFor(method)};
  if(/^\/api\/staff\/job-ads(?:\/|$)/.test(pathname)){
    if(/\/(?:publish|close)$/.test(pathname)||/\/applications\/[^/]+$/.test(pathname))return{module:"staff.job_ads",action:"update"};
    return{module:"staff.job_ads",action:actionFor(method)};
  }
  if(/^\/api\/staff\/financial-credits(?:\/|$)/.test(pathname))return{module:"staff.financial_credits",action:actionFor(method)};
  if(/^\/api\/staff\/payroll(?:\/|$)/.test(pathname))return{module:"staff.payroll",action:actionFor(method)};
  if(/^\/api\/(?:payroll)(?:\/|$)/.test(pathname))return{module:"staff.payroll",action:actionFor(method)};
  if(/^\/api\/(?:financial|benefits)(?:\/|$)/.test(pathname))return{module:"staff.financial_credits",action:actionFor(method)};
  if(/^\/api\/(?:support|tickets|security-reports)(?:\/|$)/.test(pathname))return{module:"staff.support",action:actionFor(method)};
  if(/^\/api\/(?:reports|admin\/reports)(?:\/|$)/.test(pathname))return{module:"staff.reports",action:actionFor(method)};
  if(/^\/api\/(?:settings|organization-settings|audit|audit-logs)(?:\/|$)/.test(pathname)||/^\/api\/staff\/(?:system-settings|audit-logs)(?:\/|$)/.test(pathname))return{module:"staff.settings",action:actionFor(method)};
  return null;
}

function invalidateAccountConsumers(){invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();invalidateRecruiterDirectoryCache()}
async function actorOrUnauthorized(request:Request,env:Env){return await getUser(request,env)||null}
async function handleAccountMutation(request:Request,env:Env,actor:AuthUser,pathname:string,method:string){const match=pathname.match(/^\/api\/users\/([^/]+)$/);if(!match||!["PATCH","DELETE"].includes(method))return null;const action:AccessAction=method==="DELETE"?"delete":"update";const denied=await individualRequireAccess(env,actor,"staff.users",action);if(denied)return denied;const userId=decodeURIComponent(match[1]);const response=method==="DELETE"?await deleteAccountV2(request,env,actor,userId):await updateAccountV2(request,env,actor,userId);if(response.ok)invalidateAccountConsumers();return response}
async function handleAccessRoute(request:Request,env:Env,actor:AuthUser,pathname:string,method:string){
  if(pathname==="/api/admin/access/config"&&method==="GET"){const denied=await individualRequireAccess(env,actor,"staff.users","view");return denied||app.fetch(request,env)}
  const userMatch=pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
  if(userMatch&&method==="GET")return individualGetUserPermissions(env,actor,decodeURIComponent(userMatch[1]));
  if(userMatch&&method==="PUT"){const userId=decodeURIComponent(userMatch[1]);const response=await individualUpdateUserPermissions(request,env,actor,userId);if(response.ok)invalidateAccountConsumers();return response}
  const roleMatch=pathname.match(/^\/api\/admin\/access\/roles\/([^/]+)$/);
  if(roleMatch&&method==="PUT"){if(!isProtectedRootAccount(actor))return fail("الگوی پیش‌فرض نقش‌ها فقط توسط مدیر اصلی سامانه قابل تغییر است.",403,"root_admin_required");return updateRolePermissions(request,env,actor,decodeURIComponent(roleMatch[1]))}
  return null;
}

async function injectStrictModuleGuard(response:Response){const contentType=response.headers.get("content-type")||"";if(!contentType.includes("text/html"))return response;let html=await response.text();const tag='<script src="./staff-permission-guard.js?v=1.1.0"></script>';if(!html.includes("staff-permission-guard.js")){const staffRuntime=/<script[^>]+src=["'][^"']*staff-platform-runtime\.js[^"']*["'][^>]*>\s*<\/script>/i;if(staffRuntime.test(html))html=html.replace(staffRuntime,`$&${tag}`);else html=html.replace("</head>",`${tag}</head>`)}else html=html.replace(/staff-permission-guard\.js\?v=[^"']+/g,"staff-permission-guard.js?v=1.1.0");const headers=new Headers(response.headers);headers.set("cache-control","no-store");headers.delete("content-length");return new Response(html,{status:response.status,statusText:response.statusText,headers})}

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url),pathname=url.pathname,method=request.method.toUpperCase();
  if(pathname==="/api/access/me"&&method==="GET"){const actor=await actorOrUnauthorized(request,env);return securityHeaders(actor?await individualAccessMe(env,actor):fail("ابتدا وارد حساب شوید.",401,"unauthorized"))}
  const accessRoute=pathname==="/api/admin/access/config"||/^\/api\/admin\/access\/(?:users|roles)\/[^/]+$/.test(pathname);
  const userMutation=/^\/api\/users\/[^/]+$/.test(pathname)&&["PATCH","DELETE"].includes(method);
  if(accessRoute||userMutation){const actor=await actorOrUnauthorized(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));const response=accessRoute?await handleAccessRoute(request,env,actor,pathname,method):await handleAccountMutation(request,env,actor,pathname,method);return securityHeaders(response||fail("مسیر حساب یا دسترسی پیدا نشد.",404,"not_found"))}
  const needed=pathname.startsWith("/api/")?requirement(pathname,method):null;
  if(needed){const actor=await actorOrUnauthorized(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));if(actor.role.toUpperCase()!=="CAREGIVER"){const denied=await individualRequireAccess(env,actor,needed.module,needed.action);if(denied)return securityHeaders(denied)}}
  const response=await app.fetch(request,env);return pathname.startsWith("/api/")?response:injectStrictModuleGuard(response);
}}
