import {CAREGIVER_ACTIVATION_SMS_MAX_ATTEMPTS,processPendingCaregiverActivationSmsV1,retryCaregiverActivationSmsEventV1} from "./caregiver-activation-sms-v1";
import {processPendingConsultantJobApplicationSmsV1,retryConsultantJobApplicationSmsV1,ensureConsultantJobApplicationSmsSchema} from "./consultant-job-application-sms-v1";
import {getJobBankReminderAutomationStateV1,setJobBankReminderAutomationEnabledV1} from "./job-bank-reminder-sms-v1";
import {processPendingJobApplicationStatusSmsV1} from "./job-application-status-sms-v1";
import {ensureSmsDeliverySchema} from "./sms-delivery-v1";
import {type Env,fail,getUser,json,nowIso,readBody,str} from "./lib";

export const SMS_CONTROL_CENTER_VERSION="1.3.0";
const PROVIDER_TIMEOUT_MS=6_000;
let schemaReady:Promise<void>|undefined;

type SmsEnv=Env&Record<string,unknown>&{SMSIR_API_KEY?:string;SMSIR_LINE_NUMBER?:string};
type DeliveryCandidate={id:string;providerMessageId:string};

const safeError=(value:unknown)=>str(value instanceof Error?value.message:value).slice(0,700)||"sms_delivery_report_failed";
const configured=(value:unknown)=>Boolean(str(value));

export async function ensureSmsControlCenterSchema(env:SmsEnv){
 if(!schemaReady)schemaReady=(async()=>{
  await ensureSmsDeliverySchema(env as any);
  await ensureConsultantJobApplicationSmsSchema(env);
  await env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS sms_provider_delivery_reports (
    delivery_log_id TEXT PRIMARY KEY,provider_message_id TEXT NOT NULL,provider_state_code INTEGER,provider_state_text TEXT,
    provider_delivery_at TEXT,provider_send_at TEXT,provider_cost REAL,provider_line_number TEXT,last_checked_at TEXT NOT NULL,
    last_check_error TEXT,provider_status_json TEXT,
    FOREIGN KEY(delivery_log_id) REFERENCES sms_delivery_log(id) ON DELETE CASCADE)`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_message ON sms_provider_delivery_reports(provider_message_id)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_checked ON sms_provider_delivery_reports(last_checked_at DESC)"),
  ]);
 })().catch(error=>{schemaReady=undefined;throw error});
 return schemaReady;
}

function providerDate(value:unknown){
 if(value==null||value==="")return null;
 const numeric=Number(value);
 if(Number.isFinite(numeric)&&numeric>0){
  const ms=numeric<10_000_000_000?numeric*1000:numeric;
  const date=new Date(ms);if(Number.isFinite(date.getTime()))return date.toISOString();
 }
 const parsed=Date.parse(String(value));
 return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}

async function smsIrMessageReport(env:SmsEnv,messageId:string){
 if(!env.SMSIR_API_KEY)throw new Error("smsir_api_key_not_configured");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);
 try{
  const response=await fetch(`https://api.sms.ir/v1/send/${encodeURIComponent(messageId)}`,{
   headers:{accept:"application/json","x-api-key":env.SMSIR_API_KEY},signal:controller.signal,
  });
  const raw=await response.text();let body:any={};
  try{body=raw?JSON.parse(raw):{}}catch{body={raw:raw.slice(0,500)}}
  if(!response.ok||Number(body?.status||1)===0)throw new Error(`sms_provider_${response.status}:${str(body?.message||body?.raw||"unknown_error")}`);
  const data=body?.data&&typeof body.data==="object"?body.data:body;
  return{
   stateRaw:data?.deliveryState??null,
   deliveryAt:providerDate(data?.deliveryDateTime),
   sendAt:providerDate(data?.sendDateTime),
   cost:Number.isFinite(Number(data?.cost))?Number(data.cost):null,
   lineNumber:str(data?.lineNumber)||null,
  };
 }finally{clearTimeout(timer)}
}

async function saveProviderReport(env:SmsEnv,row:DeliveryCandidate,result:any,error?:unknown){
 const checkedAt=nowIso();
 if(error){
  await env.DB.prepare(`INSERT INTO sms_provider_delivery_reports(
    delivery_log_id,provider_message_id,last_checked_at,last_check_error
   ) VALUES(?,?,?,?) ON CONFLICT(delivery_log_id) DO UPDATE SET
    provider_message_id=excluded.provider_message_id,last_checked_at=excluded.last_checked_at,last_check_error=excluded.last_check_error`)
   .bind(row.id,row.providerMessageId,checkedAt,safeError(error)).run();
  return;
 }
 const raw=result?.stateRaw,stateNumber=Number(raw),stateCode=raw!==null&&raw!==""&&Number.isFinite(stateNumber)?Math.trunc(stateNumber):null;
 const stateText=raw==null?null:String(raw).slice(0,80);
 const snapshot=JSON.stringify({deliveryState:raw,deliveryDateTime:result?.deliveryAt||null,sendDateTime:result?.sendAt||null,cost:result?.cost??null,lineNumber:result?.lineNumber||null});
 await env.DB.prepare(`INSERT INTO sms_provider_delivery_reports(
   delivery_log_id,provider_message_id,provider_state_code,provider_state_text,provider_delivery_at,provider_send_at,
   provider_cost,provider_line_number,last_checked_at,last_check_error,provider_status_json
  ) VALUES(?,?,?,?,?,?,?,?,?,NULL,?) ON CONFLICT(delivery_log_id) DO UPDATE SET
   provider_message_id=excluded.provider_message_id,provider_state_code=excluded.provider_state_code,
   provider_state_text=excluded.provider_state_text,provider_delivery_at=excluded.provider_delivery_at,
   provider_send_at=excluded.provider_send_at,provider_cost=excluded.provider_cost,provider_line_number=excluded.provider_line_number,
   last_checked_at=excluded.last_checked_at,last_check_error=NULL,provider_status_json=excluded.provider_status_json`)
  .bind(row.id,row.providerMessageId,stateCode,stateText,result?.deliveryAt||null,result?.sendAt||null,result?.cost??null,result?.lineNumber||null,checkedAt,snapshot).run();
}

export async function refreshSmsIrDeliveryReportsV1(env:SmsEnv,limit=12){
 await ensureSmsControlCenterSchema(env);
 if(!env.SMSIR_API_KEY)return{checked:0,updated:0,failed:0,configured:false,version:SMS_CONTROL_CENTER_VERSION};
 const bounded=Math.max(1,Math.min(30,Math.trunc(limit)||12));
 const cutoff=new Date(Date.now()-5*60_000).toISOString(),since=new Date(Date.now()-14*86_400_000).toISOString();
 const rows=await env.DB.prepare(`SELECT l.id,l.provider_message_id AS providerMessageId
  FROM sms_delivery_log l LEFT JOIN sms_provider_delivery_reports r ON r.delivery_log_id=l.id
  WHERE UPPER(l.provider)='SMSIR' AND l.status='SENT' AND l.provider_message_id IS NOT NULL AND l.provider_message_id<>''
   AND l.created_at>=? AND r.provider_delivery_at IS NULL AND (r.last_checked_at IS NULL OR r.last_checked_at<=?)
  ORDER BY l.created_at DESC LIMIT ?`).bind(since,cutoff,bounded).all<DeliveryCandidate>();
 let updated=0,failed=0;
 await Promise.all((rows.results||[]).map(async row=>{
  try{const result=await smsIrMessageReport(env,row.providerMessageId);await saveProviderReport(env,row,result);updated++}
  catch(error){failed++;await saveProviderReport(env,row,null,error).catch(()=>undefined)}
 }));
 return{checked:(rows.results||[]).length,updated,failed,configured:true,version:SMS_CONTROL_CENTER_VERSION};
}

async function adminOnly(request:Request,env:SmsEnv){
 const actor=await getUser(request,env);
 if(!actor)return{actor:null,response:fail("ابتدا وارد حساب شوید.",401,"unauthorized")};
 if(actor.role.toUpperCase()!=="ADMIN")return{actor,response:fail("مرکز پیامک فقط برای مدیر سامانه در دسترس است.",403,"admin_only")};
 return{actor,response:null};
}

function automaticQueueState(row:any){
 const status=String(row?.status||"").toUpperCase();
 if(status!=="FAILED")return status;
 const attemptCount=Number(row?.attemptCount||0);
 const hasRetry=Boolean(row?.nextAttemptAt);
 if(hasRetry&&(String(row?.queueType||"").toUpperCase()!=="ACTIVATION"||attemptCount<CAREGIVER_ACTIVATION_SMS_MAX_ATTEMPTS))return "RETRYING";
 return "FINAL_FAILED";
}

async function automaticQueues(env:SmsEnv){
 const [activation,reminder,status]=await Promise.all([
  env.DB.prepare(`SELECT e.id,'ACTIVATION' AS queueType,e.status,e.attempt_count AS attemptCount,e.provider_message_id AS providerMessageId,
    e.last_error AS lastError,e.next_attempt_at AS nextAttemptAt,e.created_at AS createdAt,e.sent_at AS sentAt,
    c.full_name AS recipientName,c.mobile AS recipientMobile,NULL AS contextLabel
   FROM caregiver_activation_sms_events e LEFT JOIN caregivers c ON c.id=e.caregiver_id
   ORDER BY e.created_at DESC LIMIT 80`).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare(`SELECT e.id,'JOB_BANK_REMINDER' AS queueType,e.status,e.attempt_count AS attemptCount,e.provider_message_id AS providerMessageId,
    e.last_error AS lastError,NULL AS nextAttemptAt,e.created_at AS createdAt,e.sent_at AS sentAt,
    c.full_name AS recipientName,c.mobile AS recipientMobile,('اسلات '||e.slot_key||' • '||e.eligible_ad_count||' آگهی') AS contextLabel
   FROM caregiver_job_bank_sms_events e LEFT JOIN caregivers c ON c.id=e.caregiver_id
   ORDER BY e.created_at DESC LIMIT 80`).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare(`SELECT e.id,'JOB_STATUS' AS queueType,e.status,e.attempt_count AS attemptCount,e.provider_message_id AS providerMessageId,
    e.last_error AS lastError,e.next_attempt_at AS nextAttemptAt,e.created_at AS createdAt,e.sent_at AS sentAt,
    c.full_name AS recipientName,c.mobile AS recipientMobile,(e.previous_status||' → '||e.new_status) AS contextLabel
   FROM caregiver_job_status_sms_events e LEFT JOIN caregivers c ON c.id=e.caregiver_id
   ORDER BY e.created_at DESC LIMIT 80`).all<any>().catch(()=>({results:[]} as any)),
 ]);
 return [...(activation.results||[]),...(reminder.results||[]),...(status.results||[])]
  .map((row:any)=>({...row,queueState:automaticQueueState(row)}))
  .sort((a:any,b:any)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,180);
}

async function dashboardData(request:Request,env:SmsEnv){
 await ensureSmsControlCenterSchema(env);
 const url=new URL(request.url),limit=Math.max(20,Math.min(300,Number(url.searchParams.get("limit")||200)||200));
 const since=new Date(Date.now()-24*60*60_000).toISOString();
 const [summary,outboxSummary,activationSummary,logs,outbox,queues,jobBankReminderControl]=await Promise.all([
  env.DB.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) AS accepted,
    SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN status='DEBUG' THEN 1 ELSE 0 END) AS debug
   FROM sms_delivery_log WHERE created_at>=?`).bind(since).first<any>(),
  env.DB.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS retrying,
    SUM(CASE WHEN status='PROCESSING' THEN 1 ELSE 0 END) AS processing,
    SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled
   FROM consultant_job_application_sms_outbox`).first<any>(),
  env.DB.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) AS sent,
    SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status='FAILED' AND next_attempt_at IS NOT NULL AND attempt_count<? THEN 1 ELSE 0 END) AS retrying,
    SUM(CASE WHEN status='FAILED' AND (next_attempt_at IS NULL OR attempt_count>=?) THEN 1 ELSE 0 END) AS finalFailed,
    SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled
   FROM caregiver_activation_sms_events WHERE created_at>=?`)
   .bind(CAREGIVER_ACTIVATION_SMS_MAX_ATTEMPTS,CAREGIVER_ACTIVATION_SMS_MAX_ATTEMPTS,since).first<any>().catch(()=>null),
  env.DB.prepare(`SELECT l.id,l.message_kind AS messageKind,l.provider,l.status AS sendStatus,l.provider_message_id AS providerMessageId,
    l.error_code AS errorCode,l.created_at AS createdAt,l.recipient_user_id AS recipientUserId,l.caregiver_id AS caregiverId,
    COALESCE(ru.full_name,CASE WHEN l.recipient_user_id IS NULL THEN c.full_name END) AS recipientName,
    COALESCE(ru.mobile,CASE WHEN l.recipient_user_id IS NULL THEN c.mobile END) AS recipientMobile,
    COALESCE(ru.role,CASE WHEN l.recipient_user_id IS NULL AND c.id IS NOT NULL THEN 'CAREGIVER' END) AS recipientRole,
    c.full_name AS sourceCaregiverName,c.mobile AS sourceCaregiverMobile,
    r.provider_state_code AS providerStateCode,r.provider_state_text AS providerStateText,
    r.provider_delivery_at AS providerDeliveryAt,r.provider_send_at AS providerSendAt,r.provider_cost AS providerCost,
    r.provider_line_number AS providerLineNumber,r.last_checked_at AS lastCheckedAt,r.last_check_error AS lastCheckError
   FROM sms_delivery_log l
   LEFT JOIN users ru ON ru.id=l.recipient_user_id
   LEFT JOIN caregivers c ON c.id=l.caregiver_id
   LEFT JOIN sms_provider_delivery_reports r ON r.delivery_log_id=l.id
   ORDER BY l.created_at DESC LIMIT ?`).bind(limit).all<any>(),
  env.DB.prepare(`SELECT o.id,o.application_id AS applicationId,o.ad_id AS adId,o.status,o.attempt_count AS attemptCount,
    o.provider_message_id AS providerMessageId,o.next_attempt_at AS nextAttemptAt,o.last_error AS lastError,
    o.created_at AS createdAt,o.sent_at AS sentAt,o.updated_at AS updatedAt,
    c.full_name AS caregiverName,c.mobile AS caregiverMobile,u.full_name AS consultantName,u.mobile AS consultantMobile,
    a.contract_type AS contractType,a.shift_type AS shiftType,a.city,a.region
   FROM consultant_job_application_sms_outbox o
   JOIN caregivers c ON c.id=o.caregiver_id JOIN users u ON u.id=o.consultant_user_id JOIN care_job_ads a ON a.id=o.ad_id
   ORDER BY o.created_at DESC LIMIT 120`).all<any>(),
  automaticQueues(env),
  getJobBankReminderAutomationStateV1(env),
 ]);
 const [reportCount,deliveryTimeCount]=await Promise.all([
  env.DB.prepare("SELECT COUNT(*) AS count FROM sms_provider_delivery_reports WHERE last_checked_at>=?").bind(since).first<any>(),
  env.DB.prepare("SELECT COUNT(*) AS count FROM sms_provider_delivery_reports WHERE provider_delivery_at IS NOT NULL AND last_checked_at>=?").bind(since).first<any>(),
 ]);
 const queuePending=queues.filter((x:any)=>["PENDING","QUEUED","PROCESSING","RETRYING"].includes(String(x.queueState||x.status||"").toUpperCase())).length;
 const queueRetrying=queues.filter((x:any)=>String(x.queueState||"").toUpperCase()==="RETRYING").length;
 const queueFinalFailed=queues.filter((x:any)=>String(x.queueState||"").toUpperCase()==="FINAL_FAILED").length;
 return{
  version:SMS_CONTROL_CENTER_VERSION,generatedAt:nowIso(),windowHours:24,
  summary:{
   total:Number(summary?.total||0),accepted:Number(summary?.accepted||0),failed:Number(summary?.failed||0),failedAttempts:Number(summary?.failed||0),debug:Number(summary?.debug||0),
   providerReports:Number(reportCount?.count||0),withDeliveryTime:Number(deliveryTimeCount?.count||0),pending:Number(outboxSummary?.pending||0),retrying:Number(outboxSummary?.retrying||0),processing:Number(outboxSummary?.processing||0),cancelled:Number(outboxSummary?.cancelled||0),
   automaticQueuePending:queuePending,automaticQueueRetrying:queueRetrying,automaticQueueFinalFailed:queueFinalFailed,
   activationEvents:{total:Number(activationSummary?.total||0),sent:Number(activationSummary?.sent||0),pending:Number(activationSummary?.pending||0),retrying:Number(activationSummary?.retrying||0),finalFailed:Number(activationSummary?.finalFailed||0),cancelled:Number(activationSummary?.cancelled||0),maxAttempts:CAREGIVER_ACTIVATION_SMS_MAX_ATTEMPTS},
  },
  config:{provider:"SMSIR",apiKeyConfigured:configured(env.SMSIR_API_KEY),lineConfigured:configured(env.SMSIR_LINE_NUMBER),consultantTemplateConfigured:configured(env.SMSIR_JOB_APPLICATION_CONSULTANT_TEMPLATE_ID),genericTemplateConfigured:configured(env.SMSIR_NOTIFICATION_TEMPLATE_ID)},
  automationControls:{jobBankReminder:jobBankReminderControl},
  logs:logs.results||[],outbox:outbox.results||[],automaticQueues:queues,
 };
}

export async function routeSmsControlCenterV1(request:Request,env:SmsEnv):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 if(!path.startsWith("/api/admin/sms-center"))return null;
 const auth=await adminOnly(request,env);if(auth.response)return auth.response;
 if(path==="/api/admin/sms-center"&&method==="GET")return json({data:await dashboardData(request,env)},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 if(path==="/api/admin/sms-center/automation/JOB_BANK_REMINDER"&&method==="POST"){
  const body=await readBody(request);
  if(typeof body?.enabled!=="boolean")return fail("وضعیت اتوماسیون معتبر نیست.",400,"invalid_sms_automation_state");
  const result=await setJobBankReminderAutomationEnabledV1(env,body.enabled,auth.actor?.id||null);
  return json({data:result},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 }
 if(path==="/api/admin/sms-center/refresh-delivery"&&method==="POST"){
  const result=await refreshSmsIrDeliveryReportsV1(env,24);return json({data:result},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 }
 if(path==="/api/admin/sms-center/flush"&&method==="POST"){
  const [consultant,status,activation]=await Promise.all([processPendingConsultantJobApplicationSmsV1(env,25),processPendingJobApplicationStatusSmsV1(env,25),processPendingCaregiverActivationSmsV1(env,25)]);
  return json({data:{consultant,status,activation}},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 }
 const activationRetry=path.match(/^\/api\/admin\/sms-center\/automatic\/ACTIVATION\/([^/]+)\/retry$/i);
 if(activationRetry&&method==="POST"){
  const id=decodeURIComponent(activationRetry[1]);
  if(!await retryCaregiverActivationSmsEventV1(env,id))return fail("این پیامک فعال‌سازی برای ارسال مجدد آماده نیست.",409,"activation_sms_retry_unavailable");
  const result=await processPendingCaregiverActivationSmsV1(env,5);
  return json({data:result},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 }
 const retry=path.match(/^\/api\/admin\/sms-center\/outbox\/([^/]+)\/retry$/);
 if(retry&&method==="POST"){
  const id=decodeURIComponent(retry[1]);
  if(!await retryConsultantJobApplicationSmsV1(env,id))return fail("این پیامک برای ارسال مجدد آماده نیست.",409,"sms_retry_unavailable");
  const result=await processPendingConsultantJobApplicationSmsV1(env,5);
  return json({data:result},200,{"x-salamat-sms-control-center":SMS_CONTROL_CENTER_VERSION});
 }
 return fail("مسیر مرکز پیامک پیدا نشد.",404,"sms_center_route_not_found");
}
