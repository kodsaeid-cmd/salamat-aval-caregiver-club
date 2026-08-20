import {type Env,json,str} from "./lib";

export const AUTOMATIC_SMS_READINESS_VERSION="1.0.0";
const enabled=(value:unknown)=>["1","true","yes","on"].includes(str(value).toLowerCase());
const configured=(value:unknown)=>Boolean(str(value));

export async function routeAutomaticSmsReadinessV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=="/api/system/sms-readiness"||request.method.toUpperCase()!=="GET")return null;
 const values=env as Env&Record<string,unknown>;
 const apiKey=configured(values.SMSIR_API_KEY),provider=str(values.SMS_PROVIDER||(apiKey?"SMSIR":values.SMS_GATEWAY_URL?"WEBHOOK":"")).toUpperCase();
 const activationTemplate=configured(values.SMSIR_ACTIVATION_TEMPLATE_ID)||configured(values.SMSIR_NOTIFICATION_TEMPLATE_ID);
 const jobBankTemplate=configured(values.SMSIR_JOB_BANK_TEMPLATE_ID);
 const jobStatusTemplate=configured(values.SMSIR_JOB_STATUS_TEMPLATE_ID);
 const genericChannel=provider==="SMSIR"?apiKey&&(configured(values.SMSIR_NOTIFICATION_TEMPLATE_ID)||configured(values.SMSIR_LINE_NUMBER)):provider==="WEBHOOK"&&configured(values.SMS_GATEWAY_URL);
 const data={
  version:AUTOMATIC_SMS_READINESS_VERSION,
  provider:provider||"UNCONFIGURED",
  apiKeyConfigured:provider!=="SMSIR"||apiKey,
  notificationsEnabled:enabled(values.SMS_NOTIFICATIONS_ENABLED),
  genericNotificationChannelConfigured:genericChannel,
  activationSmsReady:provider==="SMSIR"&&apiKey&&activationTemplate,
  jobBankReminderSmsReady:provider==="SMSIR"&&apiKey&&jobBankTemplate&&Boolean(values.JOB_BANK_SMS_QUEUE),
  jobApplicationStatusSmsReady:provider==="SMSIR"&&apiKey&&jobStatusTemplate,
  otpProviderConfigured:provider==="SMSIR"&&apiKey&&configured(values.SMSIR_OTP_TEMPLATE_ID),
 };
 return json({data},200,{"cache-control":"no-store","x-salamat-automatic-sms-readiness":AUTOMATIC_SMS_READINESS_VERSION});
}
