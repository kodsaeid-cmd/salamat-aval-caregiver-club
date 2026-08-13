import {type Env,audit,fail,getUser,hashPassword,json,nowIso,readBody,securityHeaders,str} from "./lib";

const USERNAME_RE=/^[a-z0-9._-]+$/;

export async function routeCaregiverProfileCredentialsV2(request:Request,env:Env):Promise<Response>{
 const actor=await getUser(request,env);
 if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return securityHeaders(fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only"));
 const body=await readBody(request);if(!body)return securityHeaders(fail("اطلاعات معتبر نیست."));
 const username=str(body.username).toLowerCase(),newPassword=str(body.newPassword),repeatPassword=str(body.repeatPassword||body.confirmPassword);
 if(username.length<4||username.length>48||!USERNAME_RE.test(username))return securityHeaders(fail("نام کاربری باید ۴ تا ۴۸ کاراکتر و فقط شامل حروف انگلیسی کوچک، عدد، نقطه، خط تیره یا زیرخط باشد.",400,"invalid_username"));
 if(newPassword.length<8||!/[A-Za-z]/.test(newPassword)||!/\d/.test(newPassword))return securityHeaders(fail("رمز عبور باید حداقل ۸ کاراکتر و شامل حداقل یک حرف و یک عدد باشد.",400,"weak_password"));
 if(newPassword!==repeatPassword)return securityHeaders(fail("رمز عبور و تکرار آن یکسان نیستند.",400,"password_mismatch"));
 const duplicate=await env.DB.prepare("SELECT id FROM users WHERE lower(COALESCE(username,''))=? AND id<>? AND upper(status)<>'DELETED' LIMIT 1").bind(username,actor.id).first<{id:string}>();
 if(duplicate)return securityHeaders(fail("این نام کاربری قبلاً انتخاب شده است.",409,"username_taken"));
 const ts=nowIso();
 try{await env.DB.prepare("UPDATE users SET username=?,password_hash=?,updated_at=? WHERE id=? AND caregiver_id=?").bind(username,await hashPassword(newPassword),ts,actor.id,actor.caregiverId).run()}catch{return securityHeaders(fail("ذخیره نام کاربری انجام نشد؛ نام کاربری دیگری انتخاب کنید.",409,"username_taken"))}
 await audit(request,env,actor,"CAREGIVER_CREDENTIALS_UPDATED_V2","user",actor.id,{caregiverId:actor.caregiverId,username,passwordChanged:true});
 return securityHeaders(json({data:{username,updatedAt:ts,passwordChanged:true}}));
}
