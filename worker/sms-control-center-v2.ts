import {updateJobBankReminderSettingsV1} from "./job-bank-reminder-sms-v1";
import {routeSmsControlCenterV1} from "./sms-control-center-v1";
import {type Env,fail,getUser,json,readBody} from "./lib";

export const SMS_CONTROL_CENTER_V2_VERSION="2.0.0";

type SmsEnv=Env&Record<string,unknown>;

async function adminOnly(request:Request,env:SmsEnv){
 const actor=await getUser(request,env);
 if(!actor)return{actor:null,response:fail("ابتدا وارد حساب شوید.",401,"unauthorized")};
 if(actor.role.toUpperCase()!=="ADMIN")return{actor,response:fail("مرکز پیامک فقط برای مدیر سامانه در دسترس است.",403,"admin_only")};
 return{actor,response:null};
}

export async function routeSmsControlCenterV2(request:Request,env:SmsEnv):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 if(path==="/api/admin/sms-center/automation/JOB_BANK_REMINDER/settings"&&method==="POST"){
  const auth=await adminOnly(request,env);if(auth.response)return auth.response;
  const body=await readBody(request);
  if(!Array.isArray(body?.scheduleTimes))return fail("حداقل یک ساعت معتبر برای یادآوری انتخاب کنید.",400,"invalid_reminder_schedule");
  try{
   const result=await updateJobBankReminderSettingsV1(env,{scheduleTimes:body.scheduleTimes,countOverride:body.countOverride},auth.actor?.id||null);
   return json({data:result},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_V2_VERSION});
  }catch(error){
   const code=error instanceof Error?error.message:String(error);
   if(code==="invalid_reminder_time")return fail("فرمت ساعت یادآوری معتبر نیست.",400,"invalid_reminder_time");
   if(code==="invalid_reminder_schedule_count")return fail("بین یک تا سه ساعت یادآوری انتخاب کنید.",400,"invalid_reminder_schedule_count");
   if(code==="invalid_count_override")return fail("عدد دستی آگهی باید بین ۱ تا ۹۹۹۹ باشد.",400,"invalid_count_override");
   throw error;
  }
 }
 return routeSmsControlCenterV1(request,env);
}
