import {MODULE_DEFINITIONS,ROLE_DEFINITIONS,ensureAccessControlSchema} from "./access-control";
import {individualEffectivePermissions} from "./individual-access-v2";
import {type AuthUser,type Env,audit,fail,getUser,json,normalizeRole,nowIso,readBody,securityHeaders,str} from "./lib";

const ACTIONS=["view","create","update","delete"] as const;
async function fullUsers(env:Env,actor:AuthUser){const module=(await individualEffectivePermissions(env,actor)).find(x=>x.key==="staff.users");return Boolean(module&&ACTIONS.every(action=>Boolean(module.actions[action])))}
async function target(env:Env,id:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson FROM users WHERE id=? AND upper(status)<>'DELETED' LIMIT 1`).bind(id).first<AuthUser>()}
async function overrides(env:Env,id:string){const r=await env.DB.prepare(`SELECT module_key AS moduleKey,can_view AS canView,can_create AS canCreate,can_update AS canUpdate,can_delete AS canDelete FROM user_module_permissions WHERE user_id=?`).bind(id).all<any>();return r.results||[]}
function permission(value:any){if(!value||typeof value!=="object")return null;const moduleKey=str(value.moduleKey||value.key);if(!MODULE_DEFINITIONS.some(x=>x.key===moduleKey))return null;const b=(a:any,c:any)=>a===undefined&&c===undefined?null:Boolean(a??c);return{moduleKey,canView:b(value.view,value.canView),canCreate:b(value.create,value.canCreate),canUpdate:b(value.update,value.canUpdate),canDelete:b(value.delete,value.canDelete)}}

export async function routeDelegatedUsersAccessV1(request:Request,env:Env):Promise<Response|null>{
 const actor=await getUser(request,env);if(!actor||normalizeRole(actor.role)==="ADMIN")return null;
 const url=new URL(request.url),method=request.method.toUpperCase();
 const isConfig=url.pathname==="/api/admin/access/config"&&method==="GET";
 const match=url.pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
 if(!isConfig&&!match)return null;
 if(!await fullUsers(env,actor))return securityHeaders(fail("این عملیات نیازمند هر چهار اختیار ماژول کاربران و دسترسی‌ها است.",403,"full_users_access_required"));
 await ensureAccessControlSchema(env);
 if(isConfig){const r=await env.DB.prepare(`SELECT role,module_key AS moduleKey,can_view AS canView,can_create AS canCreate,can_update AS canUpdate,can_delete AS canDelete FROM role_module_permissions ORDER BY role,module_key`).all<any>();return securityHeaders(json({data:{roles:ROLE_DEFINITIONS,modules:MODULE_DEFINITIONS,rolePermissions:r.results||[],delegated:true}}))}
 const id=decodeURIComponent(match![1]),account=await target(env,id);if(!account)return securityHeaders(fail("حساب کاربری پیدا نشد.",404,"user_not_found"));
 if(normalizeRole(account.role)!=="CAREGIVER")return securityHeaders(fail("اختیار تفویض‌شده در این مسیر فقط برای حساب مراقب قابل استفاده است.",403,"delegated_caregiver_only"));
 if(method==="GET"){const [effective,userOverrides]=await Promise.all([individualEffectivePermissions(env,account),overrides(env,id)]);return securityHeaders(json({data:{user:{id:account.id,caregiverId:account.caregiverId,fullName:account.fullName,mobile:account.mobile,username:account.username,role:"CAREGIVER",status:account.status},effective,overrides:userOverrides,policy:{delegated:true,caregiverOnly:true}}}))}
 if(method!=="PUT")return null;
 const body=await readBody(request);if(!body)return securityHeaders(fail("اطلاعات دسترسی معتبر نیست."));if(body.role!==undefined&&normalizeRole(body.role)!=="CAREGIVER")return securityHeaders(fail("کاربر دارای اختیار تفویض‌شده نمی‌تواند نقش حساب مراقب را تغییر دهد.",403,"delegated_role_locked"));
 const permissions=Array.isArray(body.permissions)?body.permissions.map(permission).filter(Boolean):[],ts=nowIso(),statements:D1PreparedStatement[]=[env.DB.prepare("DELETE FROM user_module_permissions WHERE user_id=?").bind(id)];
 for(const p of permissions as any[])statements.push(env.DB.prepare(`INSERT INTO user_module_permissions(user_id,module_key,can_view,can_create,can_update,can_delete,updated_by_user_id,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,p.moduleKey,p.canView===null?null:p.canView?1:0,p.canCreate===null?null:p.canCreate?1:0,p.canUpdate===null?null:p.canUpdate?1:0,p.canDelete===null?null:p.canDelete?1:0,actor.id,ts));
 await env.DB.batch(statements);await audit(request,env,actor,"UPDATE_CAREGIVER_PERMISSIONS_DELEGATED","user",id,{permissions,caregiverOnly:true});return securityHeaders(json({ok:true,userId:id,role:"CAREGIVER",updatedAt:ts,delegated:true}));
}
