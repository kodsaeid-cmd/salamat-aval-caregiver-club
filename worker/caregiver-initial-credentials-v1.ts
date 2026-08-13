import {invalidateAdminDirectoryCounts} from "./admin-directory-light";
import {invalidateCaregiverDirectoryCache} from "./caregiver-directory-page";
import {individualEffectivePermissions} from "./individual-access-v2";
import {
  type AuthUser,type Env,audit,createSession,ensureSchema,fail,getUser,hashPassword,json,
  normalizeMobile,normalizeRole,nowIso,randomId,readBody,securityHeaders,sessionCookie,str,verifyPassword,
} from "./lib";

const PENDING_MESSAGE="حساب شما در انتظار تأیید مدیرسامانه است و پس از تأیید مدیر سامانه می‌توانید به حساب خود وارد شوید.";
const UI_RUNTIME_PATH="/caregiver-account-ui-v1.js";
const PROFILE_PREFIX="profile:";

type LoginUser=AuthUser&{passwordHash:string|null;lastLoginAt:string|null};
type CaregiverCredentialRow={id:string;fullName:string;mobile:string;nationalId:string|null;membershipCode:string|null;recruitmentStage:string|null;active:number|null};

type ApprovalTarget={caregiver:CaregiverCredentialRow;account:LoginUser|null};

function cleanNationalId(value:unknown){return str(value).replace(/\D/g,"")}
function validNationalId(value:string){return /^\d{10}$/.test(value)}
function validMobile(value:string){return /^09\d{9}$/.test(value)}
function caregiverStatus(row:CaregiverCredentialRow){return Number(row.active||0)===1||String(row.recruitmentStage||"").toUpperCase()==="APPROVED"?"ACTIVE":"PENDING"}

async function fullUsersAuthority(env:Env,actor:AuthUser){
 if(normalizeRole(actor.role)==="ADMIN")return true;
 const module=(await individualEffectivePermissions(env,actor)).find(item=>item.key==="staff.users");
 return Boolean(module&&["view","create","update","delete"].every(action=>Boolean(module.actions[action as keyof typeof module.actions])));
}

async function caregiverById(env:Env,id:string){return env.DB.prepare(`SELECT id,full_name AS fullName,mobile,national_id AS nationalId,membership_code AS membershipCode,recruitment_stage AS recruitmentStage,active FROM caregivers WHERE id=? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 1`).bind(id).first<CaregiverCredentialRow>()}
async function caregiverByMobile(env:Env,mobile:string){return env.DB.prepare(`SELECT id,full_name AS fullName,mobile,national_id AS nationalId,membership_code AS membershipCode,recruitment_stage AS recruitmentStage,active FROM caregivers WHERE mobile=? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 2`).bind(mobile).all<CaregiverCredentialRow>()}
async function caregiverAccount(env:Env,caregiverId:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,password_hash AS passwordHash,role,status,permissions_json AS permissionsJson,last_login_at AS lastLoginAt FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' ORDER BY created_at DESC LIMIT 1`).bind(caregiverId).first<LoginUser>()}
async function loginUser(env:Env,identifier:string,mobile:string|null){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,password_hash AS passwordHash,role,status,permissions_json AS permissionsJson,last_login_at AS lastLoginAt FROM users WHERE lower(COALESCE(username,''))=? OR mobile=? LIMIT 1`).bind(identifier,mobile||identifier).first<LoginUser>()}

async function registerPendingCaregiver(request:Request,env:Env){
 await ensureSchema(env);
 const body=await readBody(request);if(!body)return securityHeaders(fail("اطلاعات ثبت‌نام معتبر نیست."));
 const fullName=str(body.fullName||body.name),mobile=normalizeMobile(str(body.mobile))||"",nationalId=cleanNationalId(body.nationalId);
 if(fullName.length<3)return securityHeaders(fail("نام و نام خانوادگی را کامل وارد کنید."));
 if(!validMobile(mobile))return securityHeaders(fail("شماره همراه معتبر نیست."));
 if(!validNationalId(nationalId))return securityHeaders(fail("برای ساخت اطلاعات ورود اولیه، کد ملی ۱۰ رقمی الزامی است."));
 const duplicate=await env.DB.prepare(`SELECT id FROM caregivers WHERE mobile=? OR national_id=? UNION ALL SELECT id FROM users WHERE (mobile=? OR lower(COALESCE(username,''))=?) AND upper(status)<>'DELETED' LIMIT 1`).bind(mobile,nationalId,mobile,mobile.toLowerCase()).first<{id:string}>();
 if(duplicate)return securityHeaders(fail("برای این شماره همراه یا کد ملی قبلاً پرونده ثبت شده است.",409,"duplicate_registration"));
 const caregiverId=`CP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`,userId=randomId("usr_"),timestamp=nowIso();
 const skills=str(body.skills).split(/[,،]/).map(item=>item.trim()).filter(Boolean),passwordHash=await hashPassword(nationalId);
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,birth_date,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,?, 'SELF_REGISTERED','NEW',1,?,?,?)`).bind(caregiverId,`SELF-PROFILE-${userId}`,caregiverId,nationalId,fullName,mobile,str(body.city)||null,str(body.address)||null,"در انتظار تأیید مدیر",str(body.birthDate)||null,str(body.serviceGroup)||null,JSON.stringify(skills),str(body.bio)||null,timestamp,timestamp,timestamp),
   env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER','PENDING','[]',?,?)`).bind(userId,caregiverId,fullName,mobile,mobile,passwordHash,timestamp,timestamp),
  ]);
 }catch{return securityHeaders(fail("ثبت پرونده انجام نشد؛ شماره همراه، کد ملی یا حساب ورود تکراری است.",409,"duplicate_registration"))}
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();
 await audit(request,env,null,"SELF_REGISTER_PENDING_ACCOUNT","caregiver",caregiverId,{fullName,mobile,userId,username:mobile,status:"PENDING",accountCreated:true});
 return securityHeaders(json({data:{requestCode:userId,userId,caregiverId,membershipCode:caregiverId,username:mobile,status:"PENDING",accountCreated:true}},201));
}

async function bootstrapLegacyCaregiver(env:Env,mobile:string,password:string){
 if(!validMobile(mobile)||!validNationalId(cleanNationalId(password)))return null;
 const rows=(await caregiverByMobile(env,mobile)).results||[];if(rows.length!==1)return null;
 const caregiver=rows[0],nationalId=cleanNationalId(caregiver.nationalId);if(!nationalId||nationalId!==cleanNationalId(password))return null;
 const existing=await caregiverAccount(env,caregiver.id);if(existing){
  if(existing.passwordHash)return existing;
  const username=str(existing.username)||mobile,timestamp=nowIso();
  try{await env.DB.prepare("UPDATE users SET username=?,mobile=?,password_hash=?,updated_at=? WHERE id=?").bind(username,mobile,await hashPassword(nationalId),timestamp,existing.id).run()}catch{return null}
  return loginUser(env,username.toLowerCase(),mobile);
 }
 const id=randomId("usr_"),timestamp=nowIso(),status=caregiverStatus(caregiver);
 try{await env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER',?,'[]',?,?)`).bind(id,caregiver.id,caregiver.fullName,mobile,mobile,await hashPassword(nationalId),status,timestamp,timestamp).run()}catch{return null}
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();
 return loginUser(env,mobile.toLowerCase(),mobile);
}

async function caregiverLogin(request:Request,env:Env){
 await ensureSchema(env);const body=await readBody(request);if(!body)return securityHeaders(fail("اطلاعات ورود معتبر نیست."));
 const identifier=str(body.identifier).toLowerCase(),password=str(body.password),mobile=normalizeMobile(identifier);
 let user=await loginUser(env,identifier,mobile);
 if(user&&normalizeRole(user.role)==="CAREGIVER"&&!user.passwordHash&&user.caregiverId&&mobile){
  const caregiver=await caregiverById(env,user.caregiverId);const nationalId=cleanNationalId(caregiver?.nationalId);
  if(caregiver&&validNationalId(nationalId)&&cleanNationalId(password)===nationalId){await env.DB.prepare("UPDATE users SET username=COALESCE(NULLIF(username,''),?),mobile=?,password_hash=?,updated_at=? WHERE id=?").bind(mobile,mobile,await hashPassword(nationalId),nowIso(),user.id).run();user=await loginUser(env,identifier,mobile)}
 }
 if(!user&&mobile)user=await bootstrapLegacyCaregiver(env,mobile,password);
 if(!user||!await verifyPassword(password,user.passwordHash))return securityHeaders(fail("نام کاربری یا رمز عبور صحیح نیست.",401,"invalid_credentials"));
 const status=String(user.status||"").toUpperCase();
 if(!["ACTIVE","APPROVED"].includes(status)){
  if(normalizeRole(user.role)==="CAREGIVER"&&status==="PENDING")return securityHeaders(fail(PENDING_MESSAGE,403,"account_pending_approval"));
  return securityHeaders(fail("حساب شما فعال نیست.",403,"account_inactive"));
 }
 const firstCaregiverLogin=normalizeRole(user.role)==="CAREGIVER"&&!user.lastLoginAt;
 const session=await createSession(request,env,user.id),timestamp=nowIso();
 await env.DB.prepare("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?").bind(timestamp,timestamp,user.id).run();
 await audit(request,env,user,"LOGIN","session",null);
 if(firstCaregiverLogin)await audit(request,env,user,"FIRST_CAREGIVER_LOGIN","user",user.id,{caregiverId:user.caregiverId,route:"profile"});
 const data={id:user.id,caregiverId:user.caregiverId,fullName:user.fullName,mobile:user.mobile,username:user.username,role:user.role,status:user.status,permissions:JSON.parse(user.permissionsJson||"[]")};
 return securityHeaders(json({data,expiresAt:session.expiresAt},200,{"set-cookie":sessionCookie(session.token)}));
}

async function resolveApprovalTarget(env:Env,requestedId:string):Promise<ApprovalTarget|null>{
 const caregiverId=requestedId.startsWith(PROFILE_PREFIX)?requestedId.slice(PROFILE_PREFIX.length):"";
 if(caregiverId){const caregiver=await caregiverById(env,caregiverId);return caregiver?{caregiver,account:await caregiverAccount(env,caregiverId)}:null}
 const account=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,password_hash AS passwordHash,role,status,permissions_json AS permissionsJson,last_login_at AS lastLoginAt FROM users WHERE id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' LIMIT 1`).bind(requestedId).first<LoginUser>();
 if(!account?.caregiverId)return null;const caregiver=await caregiverById(env,account.caregiverId);if(!caregiver)return null;
 if(String(caregiver.recruitmentStage||"").toUpperCase()!=="SELF_REGISTERED"&&String(account.status||"").toUpperCase()!=="PENDING")return null;
 return{caregiver,account};
}

async function approvePendingCaregiver(request:Request,env:Env,requestedId:string,target:ApprovalTarget){
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 if(!await fullUsersAuthority(env,actor))return securityHeaders(fail("تأیید مراقب نیازمند دسترسی کامل ماژول کاربران و دسترسی‌ها است.",403,"full_users_access_required"));
 const body=await readBody(request);if(!body)return securityHeaders(fail("اطلاعات معتبر نیست."));
 const action=str(body.approvalAction).toUpperCase(),rawStatus=str(body.status||target.account?.status||"ACTIVE").toUpperCase(),requestedStatus=action==="APPROVE_SELF_REGISTRATION"?"ACTIVE":rawStatus,normalizedStatus=requestedStatus==="APPROVED"?"ACTIVE":requestedStatus;
 if(!["ACTIVE","PENDING","SUSPENDED"].includes(normalizedStatus))return securityHeaders(fail("وضعیت حساب معتبر نیست."));
 const caregiver=target.caregiver,mobile=normalizeMobile(caregiver.mobile)||"",nationalId=cleanNationalId(caregiver.nationalId),timestamp=nowIso();
 if(!validMobile(mobile))return securityHeaders(fail("شماره همراه مراقب برای ساخت نام کاربری معتبر نیست.",409,"caregiver_mobile_missing"));
 if(normalizedStatus==="ACTIVE"&&!target.account?.passwordHash&&!validNationalId(nationalId))return securityHeaders(fail("برای فعال‌سازی حساب، کد ملی ۱۰ رقمی مراقب باید در پرونده ثبت شده باشد.",409,"caregiver_national_id_missing"));
 let account=target.account,accountCreated=false;
 if(!account&&normalizedStatus!=="SUSPENDED"){
  const id=randomId("usr_");try{await env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER',?,'[]',?,?)`).bind(id,caregiver.id,caregiver.fullName,mobile,mobile,await hashPassword(nationalId),normalizedStatus,timestamp,timestamp).run();accountCreated=true;account=await caregiverAccount(env,caregiver.id)}catch{return securityHeaders(fail("ساخت حساب انجام نشد؛ شماره همراه یا نام کاربری با حساب دیگری تداخل دارد.",409,"duplicate_account"))}
 }else if(account){
  const username=str(account.username)||mobile,fields=["status=?","username=?","full_name=?","mobile=?","updated_at=?"],values:unknown[]=[normalizedStatus,username,caregiver.fullName,mobile,timestamp];
  if(!account.passwordHash&&validNationalId(nationalId)){fields.push("password_hash=?");values.push(await hashPassword(nationalId))}values.push(account.id);
  try{await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...values).run()}catch{return securityHeaders(fail("ذخیره حساب انجام نشد؛ شماره همراه یا نام کاربری با حساب دیگری تداخل دارد.",409,"duplicate_account"))}
 }
 if(normalizedStatus==="ACTIVE")await env.DB.prepare(`UPDATE caregivers SET active=1,recruitment_stage='APPROVED',cooperation_status='CP-01 فعال',updated_at=? WHERE id=?`).bind(timestamp,caregiver.id).run();
 else if(normalizedStatus==="SUSPENDED")await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SUSPENDED',cooperation_status='CP-04 غیرفعال',updated_at=? WHERE id=?`).bind(timestamp,caregiver.id).run();
 else await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SELF_REGISTERED',cooperation_status='در انتظار تأیید مدیر',updated_at=? WHERE id=?`).bind(timestamp,caregiver.id).run();
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();const fresh=await caregiverAccount(env,caregiver.id);
 await audit(request,env,actor,normalizedStatus==="ACTIVE"?"APPROVE_SELF_REGISTERED_ACCOUNT":"UPDATE_SELF_REGISTERED_ACCOUNT","caregiver",caregiver.id,{accountId:fresh?.id||null,username:fresh?.username||mobile,status:normalizedStatus,accountCreated,approvedByFullUsersAuthority:true});
 return securityHeaders(json({ok:true,data:{id:fresh?.id||null,userId:fresh?.id||null,caregiverId:caregiver.id,fullName:caregiver.fullName,mobile,username:fresh?.username||mobile,role:"CAREGIVER",status:normalizedStatus,accountCreated,approved:normalizedStatus==="ACTIVE"},updatedAt:timestamp}));
}

async function delegatedCaregiverAccessSave(request:Request,env:Env,userId:string){
 const actor=await getUser(request,env);if(!actor||normalizeRole(actor.role)==="ADMIN")return null;if(!await fullUsersAuthority(env,actor))return null;
 const target=await env.DB.prepare("SELECT id,role,status FROM users WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(userId).first<{id:string;role:string;status:string}>();
 if(!target||normalizeRole(target.role)!=="CAREGIVER")return null;
 const body=await readBody(request);if(body?.role&&normalizeRole(body.role)!=="CAREGIVER")return securityHeaders(fail("کاربر دارای اختیار واگذارشده نمی‌تواند نقش مراقب را به نقش سازمانی تغییر دهد.",403,"delegated_role_change_forbidden"));
 await audit(request,env,actor,"DELEGATED_CAREGIVER_ACCESS_SAVE","user",userId,{scope:"staff.users",allTicks:true,role:"CAREGIVER"});
 return securityHeaders(json({ok:true,userId,role:"CAREGIVER",delegated:true,updatedAt:nowIso()}));
}

const UI_RUNTIME=`(()=>{if(window.__salamatCaregiverAccountUiV1)return;window.__salamatCaregiverAccountUiV1=true;const pendingText=${JSON.stringify(PENDING_MESSAGE)};const css='.cau-hint{margin:10px 2px 0;padding:10px 12px;border:1px solid #cce8d8;border-radius:14px;background:#f3fbf6;color:#315d48;font-size:12px;line-height:1.9;text-align:center}.cau-account{margin-top:16px;padding:16px;border:1px solid #d8eadf;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(28,86,55,.06)}.cau-account h3{margin:0 0 5px;color:#164f34}.cau-account p{margin:0 0 14px;color:#718278;font-size:12px;line-height:1.8}.cau-account label{display:block;margin:10px 0}.cau-account label span{display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#365645}.cau-account input{width:100%;box-sizing:border-box;border:1px solid #d5e4db;border-radius:13px;padding:12px;font:inherit;background:#fbfdfc}.cau-pending{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:22px;background:rgba(239,248,243,.96);backdrop-filter:blur(10px);direction:rtl}.cau-pending-card{width:min(420px,100%);background:#fff;border:1px solid #d5eadf;border-radius:28px;padding:28px 22px;text-align:center;box-shadow:0 24px 70px rgba(18,74,44,.14)}.cau-pending-icon{width:74px;height:74px;margin:0 auto 16px;border-radius:22px;display:grid;place-items:center;background:#eaf7ef;color:#087443;font-size:34px}.cau-pending h2{margin:0 0 10px;color:#154d34}.cau-pending p{margin:0;color:#61766a;line-height:2}.cau-pending button{margin-top:20px;width:100%;border:0;border-radius:14px;padding:13px;background:#087443;color:#fff;font:700 14px inherit;cursor:pointer}';const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);function showPending(){if(document.querySelector('.cau-pending'))return;const wrap=document.createElement('div');wrap.className='cau-pending';wrap.innerHTML='<div class="cau-pending-card"><div class="cau-pending-icon">⌛</div><h2>حساب شما در انتظار تأیید است</h2><p>'+pendingText+'</p><button type="button">بازگشت به صفحه ورود</button></div>';wrap.querySelector('button').onclick=()=>wrap.remove();document.body.appendChild(wrap)}const nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){const response=await nativeFetch(input,init);try{const url=typeof input==='string'?input:(input&&input.url)||'';if(url.includes('/api/auth/login')&&response.status===403){const data=await response.clone().json().catch(()=>null);if(data&&data.error==='account_pending_approval')setTimeout(showPending,0)}}catch{}return response};async function enhance(){for(const el of document.querySelectorAll('button,a,[role="button"]')){const t=(el.textContent||'').replace(/\s+/g,' ').trim();if(/ورود\s*با\s*(پیامک|کد\s*پیامک|رمز\s*یکبار)/.test(t))el.style.display='none';if(t.includes('عضویت در شبکه مراقبین سلامت اول')&&!el.parentElement?.querySelector('.cau-hint')){const hint=document.createElement('div');hint.className='cau-hint';hint.textContent='اگر اولین بار وارد باشگاه می‌شوید، نام کاربری شما شماره موبایل شما و کلمه عبور کد ملی شماست.';el.insertAdjacentElement('afterend',hint)}}const full=document.querySelector('input[name="fullName"]');const mobile=document.querySelector('input[name="mobile"]');const form=full&&mobile?full.closest('form'):null;if(form&&!form.querySelector('.cau-account')){const box=document.createElement('section');box.className='cau-account';box.innerHTML='<h3>اطلاعات حساب کاربری</h3><p>نام کاربری و رمز ورود باشگاه را از این بخش تغییر دهید. رمز جدید حداقل ۸ کاراکتر باشد.</p><label><span>نام کاربری</span><input name="username" autocomplete="username" required></label><label><span>رمز عبور جدید</span><input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="حداقل ۸ کاراکتر"></label><label><span>تکرار رمز عبور جدید</span><input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" placeholder="تکرار رمز جدید"></label>';const submit=form.querySelector('button[type="submit"]');submit?submit.parentElement?.insertBefore(box,submit.parentElement.firstChild):form.appendChild(box);if(!form.dataset.cauValidated){form.dataset.cauValidated='1';form.addEventListener('submit',ev=>{const p=form.querySelector('input[name="password"]')?.value||'';const c=form.querySelector('input[name="passwordConfirm"]')?.value||'';if((p&&p.length<8)||p!==c){ev.preventDefault();ev.stopImmediatePropagation();alert(p!==c?'رمز عبور جدید و تکرار آن یکسان نیست.':'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.')}},true)}nativeFetch('/api/caregiver/platform/profile',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(p=>{const input=form.querySelector('input[name="username"]');if(input&&!input.value)input.value=p?.data?.username||''}).catch(()=>{})}}new MutationObserver(()=>enhance()).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance()})();`;

export async function routeCaregiverInitialCredentialsV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname===UI_RUNTIME_PATH&&method==="GET")return new Response(UI_RUNTIME,{headers:{"content-type":"application/javascript; charset=utf-8","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}});
 if(url.pathname==="/api/public/caregivers/register"&&method==="POST")return registerPendingCaregiver(request,env);
 if(url.pathname==="/api/auth/login"&&method==="POST")return caregiverLogin(request,env);
 const userMatch=url.pathname.match(/^\/api\/users\/([^/]+)$/);if(userMatch&&method==="PATCH"){await ensureSchema(env);const id=decodeURIComponent(userMatch[1]),target=await resolveApprovalTarget(env,id);if(target)return approvePendingCaregiver(request,env,id,target)}
 const accessMatch=url.pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);if(accessMatch&&method==="PUT")return delegatedCaregiverAccessSave(request,env,decodeURIComponent(accessMatch[1]));
 return null;
}

export async function decorateCaregiverWelcomeNotificationV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url);if(url.pathname!=="/api/caregiver/notifications"||request.method.toUpperCase()!=="GET"||!response.ok)return response;
 const actor=await getUser(request,env);if(!actor||normalizeRole(actor.role)!=="CAREGIVER"||!actor.caregiverId)return response;
 const event=await env.DB.prepare(`SELECT created_at AS createdAt FROM audit_logs WHERE actor_user_id=? AND action='FIRST_CAREGIVER_LOGIN' ORDER BY created_at ASC LIMIT 1`).bind(actor.id).first<{createdAt:string}>();if(!event?.createdAt)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data||!Array.isArray(payload.data.items)||payload.data.items.some((item:any)=>item?.kind==="WELCOME_ACCOUNT"))return response;
 const read=await env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='profile' LIMIT 1").bind(actor.caregiverId).first<{lastSeenAt:string}>().catch(()=>null);const unread=String(event.createdAt)>String(read?.lastSeenAt||"2026-08-09T18:40:00.000Z");
 payload.data.items.unshift({id:`welcome-account:${actor.id}`,moduleKey:"profile",kind:"WELCOME_ACCOUNT",title:"به باشگاه مراقبین سلامت اول خوش آمدید",body:"مراقب عزیز به باشگاه مراقبین خوش آمدید، بهتر است از بخش پروفایل کاربری نام کاربری و رمز عبور خود را عوض کنید.",createdAt:event.createdAt,route:"profile",unread});
 if(unread){payload.data.unreadByModule=payload.data.unreadByModule||{};payload.data.unreadByModule.profile=Number(payload.data.unreadByModule.profile||0)+1;payload.data.unreadTotal=Number(payload.data.unreadTotal||0)+1}
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","no-store");return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
