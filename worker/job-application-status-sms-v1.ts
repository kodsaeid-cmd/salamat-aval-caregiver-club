import {sendSmsIrTemplateV1} from "./sms-ir-template-v1";
import {type Env,nowIso,str} from "./lib";

export const JOB_APPLICATION_STATUS_SMS_VERSION="1.0.0";
const MAX_ATTEMPTS=12;
const RETRY_DELAY_MS=30*60*1000;
const STALE_AFTER_MS=24*60*60*1000;

type EventRow={id:string;applicationId:string;caregiverId:string;adId:string;previousStatus:string;newStatus:string;transitionAt:string;attemptCount:number};

type RecipientRow={userId:string|null;mobile:string;currentStatus:string;contractType:string;shiftType:string;city:string;region:string};

const contractFa:Record<string,string>={ELDERLY:"سالمند",CHILD:"کودک",PATIENT:"بیمار",HOUSEKEEPING:"خدماتی"};
const shiftFa:Record<string,string>={DAY:"روزانه",NIGHT:"شبانه",LIVE_IN:"شبانه‌روزی",TEMPORARY:"مقطعی"};
const statusFa:Record<string,string>={PENDING_CONSULTANT:"در انتظار بررسی مشاور",TRIAL_DISPATCH:"اعزام آزمایشی",REJECTED:"درخواست رد شده",IN_CONTRACT:"در قرارداد",WITHDRAWN:"خارج شده از قرارداد",COMPLETED:"قرارداد تکمیل شده"};
const envValue=(env:Env,key:string)=>str((env as Env&Record<string,unknown>)[key]);
const templateId=(env:Env)=>envValue(env,"SMSIR_JOB_STATUS_TEMPLATE_ID");
const jobParameter=(env:Env)=>envValue(env,"SMSIR_JOB_STATUS_JOB_PARAMETER")||"JOB";
const statusParameter=(env:Env)=>envValue(env,"SMSIR_JOB_STATUS_STATUS_PARAMETER")||"STATUS";
const safeError=(value:unknown)=>str(value instanceof Error?value.message:value).slice(0,600)||"job_status_sms_failed";
const nextRetry=()=>new Date(Date.now()+RETRY_DELAY_MS).toISOString();
const validMobile=(value:string)=>/^09\d{9}$/.test(value.replace(/\D/g,""));

function jobLabel(row:RecipientRow){
 const contract=contractFa[str(row.contractType).toUpperCase()]||"مراقبت";
 const shift=shiftFa[str(row.shiftType).toUpperCase()]||"";
 const place=[str(row.city),str(row.region)].filter(Boolean).join("/");
 return [contract,shift,place].filter(Boolean).join(" • ").slice(0,120);
}

async function recipient(env:Env,event:EventRow){
 return env.DB.prepare(`SELECT
   (SELECT u.id FROM users u WHERE u.caregiver_id=ap.caregiver_id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' ORDER BY CASE WHEN upper(u.status) IN ('ACTIVE','APPROVED') THEN 0 ELSE 1 END,u.created_at DESC LIMIT 1) AS userId,
   c.mobile,
   UPPER(COALESCE(NULLIF(ap.lifecycle_status,''),ap.status,'')) AS currentStatus,
   a.contract_type AS contractType,a.shift_type AS shiftType,a.city,a.region
  FROM care_job_applications ap
  JOIN caregivers c ON c.id=ap.caregiver_id
  JOIN care_job_ads a ON a.id=ap.ad_id
  WHERE ap.id=? AND ap.caregiver_id=? AND ap.ad_id=? LIMIT 1`).bind(event.applicationId,event.caregiverId,event.adId).first<RecipientRow>();
}

async function mark(env:Env,eventId:string,status:"PROCESSING"|"SENT"|"FAILED"|"CANCELLED",input:{messageId?:string|null;error?:string|null;retry?:boolean}={}){
 const ts=nowIso();
 await env.DB.prepare(`UPDATE caregiver_job_status_sms_events SET
   status=?,attempt_count=attempt_count+CASE WHEN ?='PROCESSING' THEN 1 ELSE 0 END,
   provider_message_id=?,last_error=?,next_attempt_at=?,processing_at=CASE WHEN ?='PROCESSING' THEN ? ELSE processing_at END,
   sent_at=CASE WHEN ?='SENT' THEN ? ELSE sent_at END,updated_at=? WHERE id=?`).bind(
    status,status,input.messageId||null,input.error||null,input.retry?nextRetry():null,status,ts,status,ts,ts,eventId,
   ).run();
}

async function dispatch(env:Env,event:EventRow){
 const row=await recipient(env,event);
 if(!row){await mark(env,event.id,"CANCELLED",{error:"job_application_missing"});return{sent:0,cancelled:1}}
 if(str(row.currentStatus).toUpperCase()!==str(event.newStatus).toUpperCase()){await mark(env,event.id,"CANCELLED",{error:"status_advanced_before_sms"});return{sent:0,cancelled:1}}
 if(Date.now()-Date.parse(event.transitionAt)>STALE_AFTER_MS){await mark(env,event.id,"CANCELLED",{error:"job_status_sms_stale"});return{sent:0,cancelled:1}}
 const mobile=str(row.mobile).replace(/\D/g,"");
 if(!validMobile(mobile)){await mark(env,event.id,"CANCELLED",{error:"caregiver_mobile_invalid"});return{sent:0,cancelled:1}}
 const label=statusFa[str(event.newStatus).toUpperCase()]||str(event.newStatus);
 if(!label){await mark(env,event.id,"CANCELLED",{error:"status_label_missing"});return{sent:0,cancelled:1}}
 await mark(env,event.id,"PROCESSING");
 const result=await sendSmsIrTemplateV1(env as any,{
  recipientUserId:row.userId||null,caregiverId:event.caregiverId,mobile,templateId:templateId(env),kind:"JOB_APPLICATION_STATUS_CHANGED",
  parameters:[{name:jobParameter(env),value:jobLabel(row)},{name:statusParameter(env),value:label}],
 });
 if(result.ok){await mark(env,event.id,"SENT",{messageId:result.messageId||null});return{sent:1,failed:0}}
 await mark(env,event.id,"FAILED",{error:safeError(result.error),retry:true});return{sent:0,failed:1};
}

export async function processPendingJobApplicationStatusSmsV1(env:Env,limit=20){
 if(!templateId(env))return{processed:0,sent:0,failed:0,cancelled:0,templateConfigured:false,version:JOB_APPLICATION_STATUS_SMS_VERSION};
 const bounded=Math.max(1,Math.min(50,Math.trunc(limit)||20)),now=nowIso();
 let rows:EventRow[]=[];
 try{
  const result=await env.DB.prepare(`SELECT id,application_id AS applicationId,caregiver_id AS caregiverId,ad_id AS adId,previous_status AS previousStatus,new_status AS newStatus,transition_at AS transitionAt,attempt_count AS attemptCount
    FROM caregiver_job_status_sms_events
    WHERE status IN ('PENDING','FAILED') AND attempt_count<? AND (next_attempt_at IS NULL OR next_attempt_at<=?)
    ORDER BY transition_at ASC,created_at ASC LIMIT ?`).bind(MAX_ATTEMPTS,now,bounded).all<EventRow>();
  rows=result.results||[];
 }catch(error){return{processed:0,sent:0,failed:0,cancelled:0,unavailable:true,error:safeError(error),version:JOB_APPLICATION_STATUS_SMS_VERSION}}
 let sent=0,failed=0,cancelled=0;
 for(const event of rows){
  try{const result=await dispatch(env,event);sent+=Number(result.sent||0);failed+=Number((result as any).failed||0);cancelled+=Number((result as any).cancelled||0)}
  catch(error){failed++;await mark(env,event.id,"FAILED",{error:safeError(error),retry:true}).catch(()=>undefined)}
 }
 return{processed:rows.length,sent,failed,cancelled,templateConfigured:true,version:JOB_APPLICATION_STATUS_SMS_VERSION};
}
