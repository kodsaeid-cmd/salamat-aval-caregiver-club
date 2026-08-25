import {ensureSmsDeliverySchema} from "./sms-delivery-v1";
import {sendSmsIrTemplateV1} from "./sms-ir-template-v1";
import {type Env,nowIso,str} from "./lib";

export const CONSULTANT_JOB_APPLICATION_SMS_VERSION="1.1.0";
const MAX_ATTEMPTS=12;
const KIND="JOB_APPLICATION_TO_CONSULTANT";
let schemaReady:Promise<void>|undefined;

type SmsEnv=Env&Record<string,unknown>&{
 SMSIR_API_KEY?:string;
 SMSIR_JOB_APPLICATION_CONSULTANT_TEMPLATE_ID?:string;
 SMSIR_JOB_APPLICATION_CONSULTANT_NAME_PARAMETER?:string;
 SMSIR_JOB_APPLICATION_CONSULTANT_MOBILE_PARAMETER?:string;
 SMSIR_JOB_APPLICATION_CONSULTANT_JOB_PARAMETER?:string;
};

type OutboxRow={id:string;applicationId:string;adId:string;caregiverId:string;consultantUserId:string;attemptCount:number};
type ContextRow={
 caregiverName:string;caregiverMobile:string;consultantName:string;consultantMobile:string;
 contractType:string;shiftType:string;city:string;region:string;customerFullName:string;
};

const contractFa:Record<string,string>={ELDERLY:"سالمند",CHILD:"کودک",PATIENT:"بیمار",HOUSEKEEPING:"خدماتی"};
const shiftFa:Record<string,string>={DAY:"روزانه",NIGHT:"شبانه",LIVE_IN:"شبانه‌روزی",TEMPORARY:"مقطعی"};
const mobile=(value:unknown)=>{
 const digits=str(value).replace(/\D/g,"");
 if(digits.startsWith("0098"))return`0${digits.slice(4)}`;
 if(digits.startsWith("98"))return`0${digits.slice(2)}`;
 if(digits.length===10&&digits.startsWith("9"))return`0${digits}`;
 return digits;
};
const safeError=(value:unknown)=>str(value instanceof Error?value.message:value).slice(0,700)||"consultant_job_application_sms_failed";
const param=(value:unknown,max=25)=>Array.from(str(value)).slice(0,max).join("");
const nextRetry=(attempt:number)=>new Date(Date.now()+(attempt<3?5:attempt<6?15:30)*60_000).toISOString();
const nonRetryableProviderError=(value:unknown)=>{
 const error=safeError(value);
 return /smsir_template_not_configured|smsir_template_parameters_missing|sms_provider_(400|401|403|404):/i.test(error);
};

export function consultantJobApplicationSmsConfigV1(env:SmsEnv){
 const templateId=str(env.SMSIR_JOB_APPLICATION_CONSULTANT_TEMPLATE_ID);
 const caregiverParameter=str(env.SMSIR_JOB_APPLICATION_CONSULTANT_NAME_PARAMETER)||"CAREGIVER";
 const mobileParameter=str(env.SMSIR_JOB_APPLICATION_CONSULTANT_MOBILE_PARAMETER)||"MOBILE";
 const jobParameter=str(env.SMSIR_JOB_APPLICATION_CONSULTANT_JOB_PARAMETER)||"JOB";
 const ready=Boolean(str(env.SMSIR_API_KEY))&&/^\d+$/.test(templateId)&&Number(templateId)>0&&Boolean(caregiverParameter&&mobileParameter&&jobParameter);
 return{ready,templateConfigured:/^\d+$/.test(templateId)&&Number(templateId)>0,templateIdConfigured:Boolean(templateId),parameters:{caregiver:caregiverParameter,mobile:mobileParameter,job:jobParameter}};
}

export async function ensureConsultantJobApplicationSmsSchema(env:SmsEnv){
 if(!schemaReady)schemaReady=(async()=>{
  await ensureSmsDeliverySchema(env as any);
  await env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS consultant_job_application_sms_outbox (
    id TEXT PRIMARY KEY,application_id TEXT NOT NULL UNIQUE,ad_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,
    consultant_user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,delivery_log_id TEXT,provider_message_id TEXT,next_attempt_at TEXT,
    processing_at TEXT,sent_at TEXT,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(application_id) REFERENCES care_job_applications(id) ON DELETE CASCADE,
    FOREIGN KEY(ad_id) REFERENCES care_job_ads(id) ON DELETE CASCADE,
    FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
    FOREIGN KEY(consultant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(delivery_log_id) REFERENCES sms_delivery_log(id) ON DELETE SET NULL)`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_consultant_job_sms_pending ON consultant_job_application_sms_outbox(status,next_attempt_at,created_at)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_consultant_job_sms_consultant ON consultant_job_application_sms_outbox(consultant_user_id,created_at DESC)"),
  ]);
 })().catch(error=>{schemaReady=undefined;throw error});
 return schemaReady;
}

export async function enqueueConsultantJobApplicationSmsV1(env:SmsEnv,applicationId:string){
 await ensureConsultantJobApplicationSmsSchema(env);
 const row=await env.DB.prepare(`SELECT ap.id AS applicationId,ap.ad_id AS adId,ap.caregiver_id AS caregiverId,
   a.sales_consultant_user_id AS consultantUserId
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? LIMIT 1`)
  .bind(applicationId).first<{applicationId:string;adId:string;caregiverId:string;consultantUserId:string}>();
 if(!row?.applicationId||!row.consultantUserId)return{queued:false,error:"consultant_sms_context_missing"};
 const ts=nowIso(),id=`cjsms_${crypto.randomUUID().replaceAll("-","")}`;
 await env.DB.prepare(`INSERT OR IGNORE INTO consultant_job_application_sms_outbox(
   id,application_id,ad_id,caregiver_id,consultant_user_id,status,attempt_count,created_at,updated_at
  ) VALUES(?,?,?,?,?,'PENDING',0,?,?)`).bind(id,row.applicationId,row.adId,row.caregiverId,row.consultantUserId,ts,ts).run();
 return{queued:true};
}

async function context(env:SmsEnv,event:OutboxRow){
 return env.DB.prepare(`SELECT c.full_name AS caregiverName,c.mobile AS caregiverMobile,
   u.full_name AS consultantName,u.mobile AS consultantMobile,
   a.contract_type AS contractType,a.shift_type AS shiftType,a.city,a.region,a.customer_full_name AS customerFullName
  FROM care_job_applications ap
  JOIN caregivers c ON c.id=ap.caregiver_id
  JOIN care_job_ads a ON a.id=ap.ad_id
  JOIN users u ON u.id=a.sales_consultant_user_id
  WHERE ap.id=? AND ap.ad_id=? AND ap.caregiver_id=? AND u.id=? LIMIT 1`)
  .bind(event.applicationId,event.adId,event.caregiverId,event.consultantUserId).first<ContextRow>();
}

function jobLabel(row:ContextRow){
 const type=contractFa[str(row.contractType).toUpperCase()]||"مراقبت";
 const shift=shiftFa[str(row.shiftType).toUpperCase()]||"";
 const place=[str(row.city),str(row.region)].filter(Boolean).join("/");
 return [type,shift,place].filter(Boolean).join(" • ");
}

async function claim(env:SmsEnv,event:OutboxRow){
 const ts=nowIso();
 const result:any=await env.DB.prepare(`UPDATE consultant_job_application_sms_outbox SET
   status='PROCESSING',attempt_count=attempt_count+1,processing_at=?,last_error=NULL,next_attempt_at=NULL,updated_at=?
  WHERE id=? AND status IN ('PENDING','FAILED')`).bind(ts,ts,event.id).run();
 return Number(result?.meta?.changes||0)>0;
}

async function mark(env:SmsEnv,event:OutboxRow,status:"SENT"|"FAILED"|"CANCELLED",input:{messageId?:string|null;deliveryLogId?:string|null;error?:string|null;retry?:boolean}={}){
 const ts=nowIso(),attempt=Number(event.attemptCount||0)+1;
 await env.DB.prepare(`UPDATE consultant_job_application_sms_outbox SET status=?,delivery_log_id=?,provider_message_id=?,
   last_error=?,next_attempt_at=?,sent_at=CASE WHEN ?='SENT' THEN ? ELSE sent_at END,processing_at=NULL,updated_at=? WHERE id=?`)
  .bind(status,input.deliveryLogId||null,input.messageId||null,input.error||null,input.retry?nextRetry(attempt):null,status,ts,ts,event.id).run();
}

async function dispatch(env:SmsEnv,event:OutboxRow){
 const row=await context(env,event);
 if(!row){await mark(env,event,"CANCELLED",{error:"consultant_sms_context_missing"});return{cancelled:1,sent:0,failed:0}}
 const consultantMobile=mobile(row.consultantMobile),caregiverMobile=mobile(row.caregiverMobile)||str(row.caregiverMobile);
 if(!/^09\d{9}$/.test(consultantMobile)){await mark(env,event,"CANCELLED",{error:"consultant_mobile_invalid"});return{cancelled:1,sent:0,failed:0}}
 if(!await claim(env,event))return{skipped:1,sent:0,failed:0,cancelled:0};
 const config=consultantJobApplicationSmsConfigV1(env);
 if(!config.ready){
  await mark(env,event,"CANCELLED",{error:"consultant_sms_template_not_configured"});
  return{cancelled:1,sent:0,failed:0};
 }
 const result=await sendSmsIrTemplateV1(env,{
  recipientUserId:event.consultantUserId,
  caregiverId:event.caregiverId,
  mobile:consultantMobile,
  kind:KIND,
  templateId:str(env.SMSIR_JOB_APPLICATION_CONSULTANT_TEMPLATE_ID),
  parameters:[
   {name:config.parameters.caregiver,value:param(row.caregiverName)},
   {name:config.parameters.mobile,value:param(caregiverMobile)},
   {name:config.parameters.job,value:param(jobLabel(row))},
  ],
 });
 if(result.ok){await mark(env,event,"SENT",{messageId:result.messageId||null,deliveryLogId:result.deliveryLogId||null});return{sent:1,failed:0,cancelled:0}}
 const attempt=Number(event.attemptCount||0)+1,retry=attempt<MAX_ATTEMPTS&&!nonRetryableProviderError(result.error);
 await mark(env,event,retry?"FAILED":"CANCELLED",{deliveryLogId:result.deliveryLogId||null,error:safeError(result.error),retry});
 return{sent:0,failed:retry?1:0,cancelled:retry?0:1};
}

export async function processPendingConsultantJobApplicationSmsV1(env:SmsEnv,limit=10){
 await ensureConsultantJobApplicationSmsSchema(env);
 const now=nowIso(),bounded=Math.max(1,Math.min(50,Math.trunc(limit)||10));
 const result=await env.DB.prepare(`SELECT id,application_id AS applicationId,ad_id AS adId,caregiver_id AS caregiverId,
   consultant_user_id AS consultantUserId,attempt_count AS attemptCount
  FROM consultant_job_application_sms_outbox
  WHERE status IN ('PENDING','FAILED') AND attempt_count<? AND (next_attempt_at IS NULL OR next_attempt_at<=?)
  ORDER BY created_at ASC LIMIT ?`).bind(MAX_ATTEMPTS,now,bounded).all<OutboxRow>();
 let sent=0,failed=0,cancelled=0,skipped=0;
 for(const event of result.results||[]){
  try{const current=await dispatch(env,event);sent+=current.sent||0;failed+=current.failed||0;cancelled+=current.cancelled||0;skipped+=current.skipped||0}
  catch(error){
   const retry=Number(event.attemptCount||0)+1<MAX_ATTEMPTS&&!nonRetryableProviderError(error);
   if(retry)failed++;else cancelled++;
   await mark(env,event,retry?"FAILED":"CANCELLED",{error:safeError(error),retry}).catch(()=>undefined);
  }
 }
 return{processed:(result.results||[]).length,sent,failed,cancelled,skipped,version:CONSULTANT_JOB_APPLICATION_SMS_VERSION};
}

export async function retryConsultantJobApplicationSmsV1(env:SmsEnv,id:string){
 await ensureConsultantJobApplicationSmsSchema(env);
 if(!consultantJobApplicationSmsConfigV1(env).ready)return false;
 const ts=nowIso();
 const result:any=await env.DB.prepare(`UPDATE consultant_job_application_sms_outbox SET
  status='PENDING',next_attempt_at=NULL,last_error=NULL,processing_at=NULL,updated_at=?
  WHERE id=? AND status IN ('FAILED','CANCELLED')`).bind(ts,id).run();
 return Number(result?.meta?.changes||0)>0;
}
