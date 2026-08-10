import { ensureAccessControlSchema, requireAccess } from "./access-control";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  hashPassword,
  json,
  normalizeMobile,
  normalizeRole,
  normalizeStatus,
  nowIso,
  readBody,
  str,
} from "./lib";

type AccountRow = { id:string;caregiverId:string|null;fullName:string;mobile:string;username:string|null;role:string;status:string };
function normalizedIdentifier(value: unknown) { return str(value).toLowerCase(); }
async function accountRow(env: Env,userId: string) {
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status FROM users WHERE id=? LIMIT 1`).bind(userId).first<AccountRow>();
}
function publicAccount(row: AccountRow) {
  return {id:row.id,caregiverId:row.caregiverId,fullName:row.fullName,mobile:/^(internal|legacy|crm-login|deleted)-/i.test(row.mobile||"")?"":row.mobile,username:row.username,role:normalizeRole(row.role),status:row.status};
}

export async function updateAccountV2(request: Request,env: Env,actor: AuthUser,userId: string) {
  await ensureSchema(env);
  const denied=await requireAccess(env,actor,"staff.users","update");
  if(denied)return denied;
  const current=await accountRow(env,userId);
  if(!current||current.status.toUpperCase()==="DELETED")return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
  const body=await readBody(request);if(!body)return fail("اطلاعات معتبر نیست.");
  const actorIsAdmin=normalizeRole(actor.role)==="ADMIN";

  const fields:string[]=[];const values:unknown[]=[];const add=(column:string,value:unknown)=>{fields.push(`${column}=?`);values.push(value)};
  if(body.fullName!==undefined||body.name!==undefined){const fullName=str(body.fullName||body.name);if(!fullName)return fail("نام و نام خانوادگی نمی‌تواند خالی باشد.");add("full_name",fullName)}
  if(body.username!==undefined||body.email!==undefined){const username=normalizedIdentifier(body.username??body.email);if(!username)return fail("نام کاربری یا ایمیل نمی‌تواند خالی باشد.");add("username",username)}
  if(body.mobile!==undefined){const mobile=normalizeMobile(str(body.mobile))||`internal-${userId}`;add("mobile",mobile)}
  if(body.status!==undefined)add("status",normalizeStatus(body.status,current.status));
  if(body.role!==undefined){
    const role=normalizeRole(body.role);
    if(!actorIsAdmin&&role!==normalizeRole(current.role))return fail("تغییر نقش سازمانی فقط در اختیار مدیر سامانه است.",403,"admin_role_required");
    add("role",role);
  }
  if(body.password!==undefined&&str(body.password)){const password=str(body.password);if(password.length<8)return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");add("password_hash",await hashPassword(password))}
  if(!fields.length)return fail("تغییری ارسال نشده است.");
  add("updated_at",nowIso());values.push(userId);
  try{const result=await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=? AND upper(status)<>'DELETED'`).bind(...values).run();if(!Number(result.meta.changes||0))return fail("حساب کاربری پیدا نشد.",404,"user_not_found")}catch{return fail("نام کاربری، ایمیل یا شماره همراه تکراری است.",409,"duplicate_user")}
  const updated=await accountRow(env,userId);await audit(request,env,actor,"UPDATE","user",userId,{fullName:updated?.fullName,username:updated?.username,mobile:updated?.mobile,role:updated?.role,status:updated?.status});
  return json({status:"ok",data:updated?publicAccount(updated):{id:userId}});
}

export async function deleteAccountV2(request: Request,env: Env,actor: AuthUser,userId: string) {
  await ensureSchema(env);await ensureAccessControlSchema(env);
  const denied=await requireAccess(env,actor,"staff.users","delete");if(denied)return denied;
  if(actor.id===userId)return fail("حساب جاری قابل حذف نیست.",409,"cannot_delete_current_user");
  const target=await accountRow(env,userId);if(!target||target.status.toUpperCase()==="DELETED")return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
  const actorIsAdmin=normalizeRole(actor.role)==="ADMIN";
  if(normalizeRole(target.role)==="ADMIN"&&!actorIsAdmin)return fail("حساب مدیر سامانه فقط توسط مدیر سامانه قابل تغییر است.",403,"admin_role_required");
  if(normalizeRole(target.role)==="ADMIN"){
    const remaining=await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE upper(role)='ADMIN' AND upper(status) IN ('ACTIVE','APPROVED') AND id<>?`).bind(userId).first<{total:number}>();
    if(Number(remaining?.total||0)<1)return fail("آخرین حساب مدیر سامانه قابل حذف نیست.",409,"last_admin");
  }
  const timestamp=nowIso(),tombstoneUsername=`deleted-${userId.toLowerCase()}@removed.local`,tombstoneMobile=`deleted-${userId.toLowerCase()}`;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
    env.DB.prepare("DELETE FROM user_module_permissions WHERE user_id=?").bind(userId),
    env.DB.prepare(`UPDATE users SET status='DELETED',username=?,mobile=?,permissions_json='[]',updated_at=? WHERE id=?`).bind(tombstoneUsername,tombstoneMobile,timestamp,userId),
  ]);
  await audit(request,env,actor,"DELETE","user",userId,{mode:"safe_soft_delete",previousUsername:target.username,previousMobile:target.mobile,caregiverId:target.caregiverId});
  return json({status:"ok",data:{id:userId,deleted:true}});
}
