import {invalidateAdminDirectoryCounts} from "./admin-directory-light";
import {invalidateCaregiverDirectoryCache} from "./caregiver-directory-page";
import {individualRequireAccess} from "./individual-access-v2";
import {type AuthUser,type Env,audit,ensureSchema,fail,getUser,hashPassword,json,normalizeMobile,normalizeRole,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const PROFILE_PREFIX="profile:";
type UserRow=AuthUser&{caregiverId?:string|null;createdAt?:string};
type CaregiverRow={id:string;fullName:string;mobile:string;membershipCode:string|null};

function caregiverIdFromSynthetic(value:string){return value.startsWith(PROFILE_PREFIX)?value.slice(PROFILE_PREFIX.length):""}
function exactAdmin(actor:AuthUser|null){return Boolean(actor&&normalizeRole(actor.role)==="ADMIN")}
async function caregiver(env:Env,id:string){return env.DB.prepare(`SELECT id,full_name AS fullName,mobile,membership_code AS membershipCode FROM caregivers WHERE id=? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 1`).bind(id).first<CaregiverRow>()}
async function linkedAccount(env:Env,caregiverId:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson,created_at AS createdAt FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' ORDER BY created_at DESC LIMIT 1`).bind(caregiverId).first<UserRow>()}
async function legacyUnlinkedAccount(env:Env,mobile:string,username:string){if(!mobile&&!username)return null;const rows=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson,created_at AS createdAt FROM users WHERE upper(role)='CAREGIVER' AND upper(status)<>'DELETED' AND (caregiver_id IS NULL OR trim(caregiver_id)='') AND (mobile=? OR (?<>'' AND lower(COALESCE(username,''))=?)) ORDER BY CASE WHEN mobile=? THEN 0 ELSE 1 END,created_at DESC LIMIT 2`).bind(mobile,username,username,mobile).all<UserRow>();const list=rows.results||[];if(list.length>1&&String(list[0].id)!==String(list[1].id))throw new Error("AMBIGUOUS_LEGACY_ACCOUNT");return list[0]||null}

export async function routeSelfRegisteredApprovalV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),match=url.pathname.match(/^\/api\/users\/([^/]+)$/);
 if(!match||method!=="PATCH")return null;
 const synthetic=decodeURIComponent(match[1]),caregiverId=caregiverIdFromSynthetic(synthetic);
 if(!caregiverId)return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 const denied=await individualRequireAccess(env,actor,"staff.users","update");if(denied)return securityHeaders(denied);
 if(!exactAdmin(actor))return securityHeaders(fail("ایجاد یا تغییر اطلاعات ورود مراقب فقط در اختیار مدیر سامانه است.",403,"admin_only_credentials"));
 await ensureSchema(env);
 const body=(await readBody(request.clone()))||{},record=await caregiver(env,caregiverId);if(!record)return securityHeaders(fail("پرونده مراقب پیدا نشد.",404,"caregiver_not_found"));
 const requestedStatus=str(body.status||"ACTIVE").toUpperCase();if(!["ACTIVE","APPROVED","SUSPENDED"].includes(requestedStatus))return securityHeaders(fail("وضعیت حساب معتبر نیست."));
 const normalizedStatus=requestedStatus==="APPROVED"?"ACTIVE":requestedStatus,timestamp=nowIso(),mobile=normalizeMobile(record.mobile);
 let existing=await linkedAccount(env,caregiverId),adoptedLegacy=false;
 const requestedUsername=str(body.username??existing?.username).toLowerCase(),password=str(body.password);
 if(!existing){try{existing=await legacyUnlinkedAccount(env,mobile,requestedUsername);adoptedLegacy=Boolean(existing)}catch(error){if(error instanceof Error&&error.message==="AMBIGUOUS_LEGACY_ACCOUNT")return securityHeaders(fail("برای این مراقب بیش از یک حساب قدیمی بدون اتصال پیدا شد؛ ابتدا حساب‌های تکراری را بررسی کنید.",409,"ambiguous_legacy_account"));throw error}}
 if((normalizedStatus==="ACTIVE")&&!requestedUsername)return securityHeaders(fail("برای تأیید مراقب نام کاربری را وارد کنید."));
 if(!existing&&normalizedStatus==="ACTIVE"&&password.length<8)return securityHeaders(fail("برای ساخت حساب، رمز عبور حداقل ۸ کاراکتری لازم است."));
 if(password&&password.length<8)return securityHeaders(fail("رمز عبور باید حداقل ۸ کاراکتر باشد."));
 const excludeId=existing?.id||"";
 if(requestedUsername){const dup=await env.DB.prepare("SELECT id FROM users WHERE lower(COALESCE(username,''))=? AND upper(status)<>'DELETED' AND id<>? LIMIT 1").bind(requestedUsername,excludeId).first<{id:string}>();if(dup)return securityHeaders(fail("این نام کاربری قبلاً استفاده شده است.",409,"duplicate_username"))}
 if(mobile){const dup=await env.DB.prepare("SELECT id FROM users WHERE mobile=? AND upper(status)<>'DELETED' AND id<>? LIMIT 1").bind(mobile,excludeId).first<{id:string}>();if(dup)return securityHeaders(fail("این شماره همراه به حساب دیگری متصل است.",409,"duplicate_mobile"))}
 if(normalizedStatus==="SUSPENDED"&&!existing){await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SUSPENDED',cooperation_status='CP-04 غیرفعال',updated_at=? WHERE id=?`).bind(timestamp,caregiverId).run();invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();await audit(request,env,actor,"SUSPEND","caregiver",caregiverId,{accountCreated:false});return securityHeaders(json({ok:true,data:{id:null,caregiverId,status:"SUSPENDED",accountCreated:false}}))}
 let accountId=existing?.id||"",accountCreated=false;
 if(existing){const fields=["caregiver_id=?","status=?","username=?","full_name=?","mobile=?","role='CAREGIVER'","updated_at=?"],values:unknown[]=[caregiverId,normalizedStatus,requestedUsername||existing.username,record.fullName,mobile||existing.mobile,timestamp];if(password){fields.push("password_hash=?");values.push(await hashPassword(password))}values.push(existing.id);try{await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...values).run()}catch{return securityHeaders(fail("ذخیره حساب انجام نشد؛ نام کاربری یا شماره همراه با حساب دیگری تداخل دارد.",409,"duplicate_account"))}}
 else{accountId=randomId("usr_");try{await env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER',?,'[]',?,?)`).bind(accountId,caregiverId,record.fullName,mobile||`internal-${accountId}`,requestedUsername,await hashPassword(password),normalizedStatus,timestamp,timestamp).run();accountCreated=true}catch{return securityHeaders(fail("ساخت حساب انجام نشد؛ نام کاربری یا شماره همراه با حساب دیگری تداخل دارد.",409,"duplicate_account"))}}
 if(normalizedStatus==="ACTIVE")await env.DB.prepare(`UPDATE caregivers SET active=1,recruitment_stage='APPROVED',cooperation_status=CASE WHEN cooperation_status IS NULL OR trim(cooperation_status)='' OR cooperation_status LIKE '%در انتظار%' THEN 'CP-01 فعال' ELSE cooperation_status END,updated_at=? WHERE id=?`).bind(timestamp,caregiverId).run();
 else await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SUSPENDED',cooperation_status='CP-04 غیرفعال',updated_at=? WHERE id=?`).bind(timestamp,caregiverId).run();
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();
 const action=accountCreated?"APPROVE_AND_CREATE_ACCOUNT":adoptedLegacy?"APPROVE_AND_LINK_EXISTING_ACCOUNT":"UPDATE_CAREGIVER_CREDENTIALS";
 await audit(request,env,actor,action,"caregiver",caregiverId,{accountId,username:requestedUsername,status:normalizedStatus,accountCreated,adoptedLegacy,passwordChanged:Boolean(password)});
 return securityHeaders(json({ok:true,data:{id:accountId,userId:accountId,caregiverId,fullName:record.fullName,mobile:record.mobile,username:requestedUsername,role:"CAREGIVER",status:normalizedStatus,accountCreated,adoptedLegacy},updatedAt:timestamp}));
}
