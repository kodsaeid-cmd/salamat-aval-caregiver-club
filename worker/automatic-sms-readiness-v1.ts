import {consultantJobApplicationSmsConfigV1} from "./consultant-job-application-sms-v1";
import {type Env,json,str} from "./lib";

export const AUTOMATIC_SMS_READINESS_VERSION="1.1.0";
const enabled=(value:unknown)=>["1","true","yes","on"].includes(str(value).toLowerCase());
const configured=(value:unknown)=>Boolean(str(value));
const digits=(value:unknown)=>str(value).replace(/\D/g,"");

async function smsIrGet(values:Record<string,unknown>,path:string){
 const apiKey=str(values.SMSIR_API_KEY);if(!apiKey)return{ok:false,data:null};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch(`https://api.sms.ir/v1/${path}`,{headers:{accept:"application/json","x-api-key":apiKey},signal:controller.signal});
  const raw=await response.text();let body:any=null;try{body=raw?JSON.parse(raw):null}catch{body=null}
  if(!response.ok||Number(body?.status||1)===0)return{ok:false,data:null};
  return{ok:true,data:body?.data??body};
 }catch{return{ok:false,data:null}}finally{clearTimeout(timer)}
}
function firstFiniteNumber(value:unknown):number|null{
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"&&value.trim()!==""&&Number.isFinite(Number(value)))return Number(value);
 if(Array.isArray(value)){for(const item of value){const found=firstFiniteNumber(item);if(found!==null)return found}return null}
 if(value&&typeof value==="object"){for(const [key,item] of Object.entries(value as Record<string,unknown>)){if(/credit|balance|amount/i.test(key)){const found=firstFiniteNumber(item);if(found!==null)return found}}for(const item of Object.values(value as Record<string,unknown>)){const found=firstFiniteNumber(item);if(found!==null)return found}}
 return null;
}
function containsLine(value:unknown,target:string):boolean{
 if(!target)return false;if(typeof value==="string"||typeof value==="number")return digits(value)===target;
 if(Array.isArray(value))return value.some(item=>containsLine(item,target));
 if(value&&typeof value==="object")return Object.values(value as Record<string,unknown>).some(item=>containsLine(item,target));
 return false;
}

export async function routeAutomaticSmsReadinessV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=="/api/system/sms-readiness"||request.method.toUpperCase()!=="GET")return null;
 const values=env as Env&Record<string,unknown>;
 const apiKey=configured(values.SMSIR_API_KEY),provider=str(values.SMS_PROVIDER||(apiKey?"SMSIR":values.SMS_GATEWAY_URL?"WEBHOOK":"")).toUpperCase();
 const activationTemplate=configured(values.SMSIR_ACTIVATION_TEMPLATE_ID)||configured(values.SMSIR_NOTIFICATION_TEMPLATE_ID);
 const jobBankTemplate=configured(values.SMSIR_JOB_BANK_TEMPLATE_ID);
 const jobStatusTemplate=configured(values.SMSIR_JOB_STATUS_TEMPLATE_ID);
 const consultantConfig=consultantJobApplicationSmsConfigV1(values as any);
 const consultantParametersConfigured=Boolean(consultantConfig.parameters.caregiver&&consultantConfig.parameters.mobile&&consultantConfig.parameters.job);
 const notificationTemplate=configured(values.SMSIR_NOTIFICATION_TEMPLATE_ID),serviceLine=digits(values.SMSIR_LINE_NUMBER);
 const genericChannel=provider==="SMSIR"?apiKey&&(notificationTemplate||Boolean(serviceLine)):provider==="WEBHOOK"&&configured(values.SMS_GATEWAY_URL);
 const [creditCheck,lineCheck]=provider==="SMSIR"&&apiKey?await Promise.all([smsIrGet(values,"credit"),smsIrGet(values,"line")]):[{ok:false,data:null},{ok:false,data:null}];
 const credit=creditCheck.ok?firstFiniteNumber(creditCheck.data):null;
 const creditAvailable=creditCheck.ok&&credit!==null?credit>0:null;
 const serviceLineAvailable=serviceLine?lineCheck.ok?containsLine(lineCheck.data,serviceLine):null:null;
 const data={
  version:AUTOMATIC_SMS_READINESS_VERSION,
  checkedAt:new Date().toISOString(),
  provider:provider||"UNCONFIGURED",
  apiKeyConfigured:provider!=="SMSIR"||apiKey,
  providerReachable:provider==="SMSIR"?creditCheck.ok||lineCheck.ok:null,
  creditCheckOk:provider==="SMSIR"?creditCheck.ok:null,
  creditAvailable,
  serviceLineConfigured:Boolean(serviceLine),
  serviceLineCheckOk:serviceLine?lineCheck.ok:null,
  serviceLineAvailable,
  notificationsEnabled:enabled(values.SMS_NOTIFICATIONS_ENABLED),
  genericNotificationTemplateConfigured:notificationTemplate,
  genericNotificationChannelConfigured:genericChannel,
  genericBulkFallbackReady:provider==="SMSIR"&&apiKey&&Boolean(serviceLine)&&serviceLineAvailable===true&&creditAvailable!==false,
  activationSmsReady:provider==="SMSIR"&&apiKey&&activationTemplate&&creditAvailable!==false,
  jobBankReminderSmsReady:provider==="SMSIR"&&apiKey&&jobBankTemplate&&Boolean(values.JOB_BANK_SMS_QUEUE)&&creditAvailable!==false,
  jobApplicationStatusSmsReady:provider==="SMSIR"&&apiKey&&jobStatusTemplate&&creditAvailable!==false,
  consultantJobApplicationTemplateConfigured:consultantConfig.templateConfigured,
  consultantJobApplicationParametersConfigured:consultantParametersConfigured,
  consultantJobApplicationSmsReady:provider==="SMSIR"&&consultantConfig.ready&&creditAvailable!==false,
  otpProviderConfigured:provider==="SMSIR"&&apiKey&&configured(values.SMSIR_OTP_TEMPLATE_ID),
 };
 return json({data},200,{"cache-control":"no-store","x-salamat-automatic-sms-readiness":AUTOMATIC_SMS_READINESS_VERSION});
}
