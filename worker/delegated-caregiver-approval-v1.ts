import {invalidateAdminDirectoryCounts} from "./admin-directory-light";
import {invalidateCaregiverDirectoryCache} from "./caregiver-directory-page";
import {individualEffectivePermissions} from "./individual-access-v2";
import {type AuthUser,type Env,audit,fail,getUser,json,normalizeRole,nowIso,readBody,securityHeaders,str} from "./lib";

async function hasFullUsersAccess(env:Env,actor:AuthUser){
 if(normalizeRole(actor.role)==="ADMIN")return true;
 const module=(await individualEffectivePermissions(env,actor)).find(item=>item.key==="staff.users");
 return Boolean(module&&["view","create","update","delete"].every(action=>Boolean(module.actions[action as keyof typeof module.actions])));
}

export async function routeDelegatedCaregiverApprovalV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),match=url.pathname.match(/^\/api\/users\/([^/]+)$/);
 if(!match||method!=="PATCH")return null;
 const body=await readBody(request.clone());
 if(str(body?.approvalAction).toUpperCase()!=="APPROVE_SELF_REGISTRATION")return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 if(normalizeRole(actor.role)==="ADMIN")return null;
 if(!await hasFullUsersAccess(env,actor))return securityHeaders(fail("فعال‌سازی ثبت‌نام مراقب نیازمند هر چهار اختیار مشاهده، ثبت، تغییر و حذف در ماژول کاربران و دسترسی‌ها است.",403,"full_users_access_required"));
 const userId=decodeURIComponent(match[1]);
 const row=await env.DB.prepare(`SELECT u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,u.password_hash AS passwordHash,u.status,u.role,c.recruitment_stage AS recruitmentStage
  FROM users u JOIN caregivers c ON c.id=u.caregiver_id WHERE u.id=? AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' LIMIT 1`).bind(userId).first<any>();
 if(!row||String(row.recruitmentStage||"").toUpperCase()!=="SELF_REGISTERED")return null;
 if(String(row.status||"").toUpperCase()!=="PENDING")return securityHeaders(fail("این حساب دیگر در وضعیت انتظار تأیید نیست.",409,"account_not_pending"));
 if(!str(row.username)||!str(row.passwordHash))return securityHeaders(fail("اطلاعات ورود اولیه مراقب کامل نیست؛ تکمیل اطلاعات ورود فقط توسط مدیرسامانه انجام می‌شود.",409,"pending_credentials_incomplete"));
 const requestedUsername=str(body?.username);if(requestedUsername&&requestedUsername.toLowerCase()!==str(row.username).toLowerCase())return securityHeaders(fail("کاربر دارای اختیار تفویض‌شده فقط مجاز به فعال‌سازی حساب در انتظار است و نمی‌تواند نام کاربری مراقب را تغییر دهد.",403,"delegated_approval_credentials_locked"));
 if(str(body?.password))return securityHeaders(fail("کاربر دارای اختیار تفویض‌شده هنگام تأیید حساب مجاز به تغییر رمز عبور مراقب نیست.",403,"delegated_approval_credentials_locked"));
 const ts=nowIso();
 await env.DB.batch([
  env.DB.prepare("UPDATE users SET status='ACTIVE',updated_at=? WHERE id=? AND upper(status)='PENDING'").bind(ts,userId),
  env.DB.prepare("UPDATE caregivers SET active=1,recruitment_stage='APPROVED',cooperation_status='CP-01 فعال',updated_at=? WHERE id=?").bind(ts,row.caregiverId),
 ]);
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();
 await audit(request,env,actor,"APPROVE_SELF_REGISTERED_ACCOUNT_DELEGATED","caregiver",row.caregiverId,{accountId:userId,fullUsersAccess:true,credentialsChanged:false});
 return securityHeaders(json({ok:true,data:{id:userId,userId,caregiverId:row.caregiverId,fullName:row.fullName,mobile:row.mobile,username:row.username,role:"CAREGIVER",status:"ACTIVE",approved:true,delegatedApproval:true},updatedAt:ts}));
}
