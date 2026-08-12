import {requireAccess} from "./access-control";
import {ensureContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {ensureJobApplicationLifecycleSchema,lifecycleUpdateStatement} from "./job-application-lifecycle-v1";
import {accrueContractPointsForStaffExit,ensureLegacyActiveContractForAd,reconcileLegacyOpenContracts} from "./legacy-contract-compat-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,str} from "./lib";

const DAY_MS=86_400_000;
const POINT_SCALE=100;

type ContractTarget={
 id?:string|null;caregiverId:string;adId:string;applicationId:string;consultantId?:string|null;
 startedAt?:string;scheduledEndAt?:string;durationDays?:number;totalPointsUnits?:number;earnedPointsUnits?:number;
 lastReconciledDay?:number;status?:string;pointsModel?:string;
};

const plusDays=(iso:string,days:number)=>new Date(Date.parse(iso)+Math.max(1,days)*DAY_MS).toISOString();
const pointsToUnits=(value:unknown)=>Math.max(0,Math.round(Number(value||0)*POINT_SCALE));

async function allowed(env:Env,user:AuthUser){
 const [contracts,jobs]=await Promise.all([
  requireAccess(env,user,"staff.contracts","update"),
  requireAccess(env,user,"staff.job_ads","update"),
 ]);
 return !contracts||!jobs?null:jobs;
}

async function activeForAd(env:Env,adId:string){
 return env.DB.prepare(`SELECT jc.id,jc.caregiver_id AS caregiverId,jc.ad_id AS adId,jc.application_id AS applicationId,
  jc.started_at AS startedAt,jc.scheduled_end_at AS scheduledEndAt,jc.duration_days AS durationDays,
  jc.total_points_units AS totalPointsUnits,jc.earned_points_units AS earnedPointsUnits,jc.last_reconciled_day AS lastReconciledDay,
  jc.status,jc.points_model AS pointsModel,a.sales_consultant_user_id AS consultantId
  FROM caregiver_job_contracts jc JOIN care_job_ads a ON a.id=jc.ad_id
  WHERE jc.ad_id=? AND jc.status='ACTIVE' ORDER BY jc.created_at DESC LIMIT 1`).bind(adId).first<ContractTarget>();
}

async function activeForCaregiver(env:Env,caregiverId:string){
 return env.DB.prepare("SELECT id,ad_id AS adId,application_id AS applicationId FROM caregiver_job_contracts WHERE caregiver_id=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1").bind(caregiverId).first<any>();
}

async function safeAudit(request:Request,env:Env,user:AuthUser,action:string,resourceType:string,resourceId:string,metadata:any){
 try{await audit(request,env,user,action,resourceType,resourceId,metadata)}catch(error){console.error("production_contract_repair_audit_failed",{action,resourceType,resourceId,error:error instanceof Error?error.message:String(error)})}
}

async function startOrRepairContract(request:Request,env:Env,user:AuthUser,adId:string,applicationId:string){
 const denied=await requireAccess(env,user,"staff.job_ads","update");if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
 const row=await env.DB.prepare(`SELECT ap.id,ap.caregiver_id AS caregiverId,COALESCE(ap.lifecycle_status,ap.status) AS applicationStatus,
  ap.ad_id AS adId,a.status AS adStatus,a.sales_consultant_user_id AS consultantId,a.duration_days AS durationDays,
  COALESCE(a.reward_points,a.contract_points,0) AS contractPoints
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? AND ap.ad_id=? LIMIT 1`).bind(applicationId,adId).first<any>();
 if(!row)return fail("اپلای پیدا نشد.",404,"application_not_found");
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&row.consultantId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 const existing=await env.DB.prepare("SELECT id,status FROM caregiver_job_contracts WHERE application_id=? LIMIT 1").bind(applicationId).first<any>();
 if(existing?.status==="ACTIVE"){
  let caseId:string|null=null;try{caseId=await reconcileContractCaseByApplication(env,applicationId)}catch(error){console.error("production_existing_contract_case_reconcile_failed",{adId,applicationId,error:error instanceof Error?error.message:String(error)})}
  return json({data:{status:"IN_CONTRACT",adStatus:"CLOSED",jobContractId:existing.id,contractCaseId:caseId,contractRowGuaranteed:true,repaired:false}});
 }
 if(existing)return fail("این اپلای قبلاً یک قرارداد پایان‌یافته دارد و برای قرارداد مجدد باید اپلای جدید ایجاد شود.",409,"application_contract_history_conflict");
 const other=await activeForCaregiver(env,row.caregiverId);
 if(other&&other.applicationId!==applicationId)return fail("این مراقب هم‌اکنون در یک قرارداد فعال است و نمی‌تواند وارد قرارداد دوم شود.",409,"caregiver_already_in_contract");
 const lifecycle=String(row.applicationStatus||"").toUpperCase();
 if(!["PENDING_CONSULTANT","TRIAL_DISPATCH","IN_CONTRACT"].includes(lifecycle))return fail("وضعیت فعلی متقاضی اجازه ورود به قرارداد را نمی‌دهد.",409,"application_not_contractable");
 if(row.adStatus==="CLOSED"&&lifecycle!=="IN_CONTRACT")return fail("این آگهی بسته شده است.",409,"job_ad_expired");
 const ts=nowIso(),duration=Math.max(1,Math.trunc(Number(row.durationDays||1))),contractId=randomId("jct_"),totalUnits=pointsToUnits(row.contractPoints);
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregiver_job_contracts(id,caregiver_id,ad_id,application_id,started_at,scheduled_end_at,duration_days,total_points_units,earned_points_units,last_reconciled_day,status,points_model,started_by_user_id,welcome_seen_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,0,0,'ACTIVE','DAILY_V1',?,NULL,?,?)`).bind(contractId,row.caregiverId,adId,applicationId,ts,plusDays(ts,duration),duration,totalUnits,user.id,ts,ts),
   lifecycleUpdateStatement(env,applicationId,"IN_CONTRACT",ts),
   env.DB.prepare("UPDATE care_job_ads SET status='CLOSED',updated_at=? WHERE id=?").bind(ts,adId),
  ]);
 }catch(error:any){
  console.error("production_contract_start_storage_failed",{adId,applicationId,caregiverId:row.caregiverId,error:error instanceof Error?error.message:String(error)});
  const raced=await env.DB.prepare("SELECT id,status FROM caregiver_job_contracts WHERE application_id=? LIMIT 1").bind(applicationId).first<any>();
  if(!raced?.id)return fail("ایجاد سطر قرارداد در پایگاه داده انجام نشد.",500,"contract_row_persistence_failed");
 }
 let caseId:string|null=null;
 try{caseId=await reconcileContractCaseByApplication(env,applicationId)}catch(error){console.error("production_contract_case_reconcile_failed",{adId,applicationId,error:error instanceof Error?error.message:String(error)})}
 await safeAudit(request,env,user,"START_JOB_CONTRACT","caregiver_job_contract",contractId,{adId,applicationId,caregiverId:row.caregiverId,durationDays:duration,totalPoints:Number(row.contractPoints||0),productionRepairV1:true,contractCaseId:caseId});
 return json({data:{status:"IN_CONTRACT",adStatus:"CLOSED",jobContractId:contractId,contractCaseId:caseId,contractRowGuaranteed:true,repaired:lifecycle==="IN_CONTRACT"}});
}

async function exitContract(request:Request,env:Env,user:AuthUser,adId:string){
 const denied=await allowed(env,user);if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
 const body=await readBody(request),mode=str(body?.reopenMode??body?.mode).toUpperCase(),reason=str(body?.reasonText).slice(0,500);
 if(!["PUBLISH","EDIT"].includes(mode))return fail("یکی از دو گزینه انتشار مجدد یا ویرایش آگهی را انتخاب کنید.",400,"reopen_mode_required");
 let target=await activeForAd(env,adId);
 if(!target){
  target=await env.DB.prepare(`SELECT NULL AS id,ap.caregiver_id AS caregiverId,ap.ad_id AS adId,ap.id AS applicationId,a.sales_consultant_user_id AS consultantId
   FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
   WHERE ap.ad_id=? AND COALESCE(ap.lifecycle_status,ap.status)='IN_CONTRACT' ORDER BY ap.updated_at DESC LIMIT 1`).bind(adId).first<ContractTarget>();
 }
 if(!target)return fail("برای این آگهی قرارداد یا متقاضی «در قرارداد» پیدا نشد.",404,"active_contract_not_found");
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&target.consultantId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(target.id){try{target=await accrueContractPointsForStaffExit(env,target as any) as ContractTarget}catch(error){console.error("production_contract_exit_accrual_failed",{adId,contractId:target.id,error:error instanceof Error?error.message:String(error)})}}
 const ts=nowIso(),adStatus=mode==="PUBLISH"?"PUBLISHED":"DRAFT";
 const statements:any[]=[];
 if(target.id)statements.push(env.DB.prepare("UPDATE caregiver_job_contracts SET status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code='STAFF_REMOVAL',end_reason_text=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(ts,user.id,reason||null,ts,target.id));
 statements.push(lifecycleUpdateStatement(env,target.applicationId,"WITHDRAWN",ts));
 statements.push(env.DB.prepare("UPDATE care_job_ads SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN ? ELSE published_at END,updated_at=? WHERE id=?").bind(adStatus,adStatus,ts,ts,adId));
 try{await env.DB.batch(statements)}catch(error){console.error("production_contract_exit_storage_failed",{adId,contractId:target.id||null,applicationId:target.applicationId,error:error instanceof Error?error.message:String(error)});return fail("خلع خدمت‌دهنده در پایگاه داده تکمیل نشد.",500,"contract_exit_persistence_failed")}
 try{
  await ensureContractLifecycleV2(env);
  if(target.id)await reconcileContractCaseByApplication(env,target.applicationId);
  await env.DB.batch([
   env.DB.prepare("UPDATE contract_cases_v2 SET status='ENDED_EARLY',renewal_state='INACTIVE',updated_at=? WHERE job_ad_id=? AND status='ACTIVE'").bind(ts,adId),
   env.DB.prepare("UPDATE contract_service_providers_v2 SET status='REMOVED',ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id IN (SELECT id FROM contract_cases_v2 WHERE job_ad_id=?) AND caregiver_id=? AND status='ACTIVE'").bind(ts,ts,adId,target.caregiverId),
  ]);
 }catch(error){console.error("production_contract_exit_case_sync_failed",{adId,contractId:target.id||null,error:error instanceof Error?error.message:String(error)})}
 await safeAudit(request,env,user,"REMOVE_CONTRACT_PROVIDER",target.id?"caregiver_job_contract":"care_job_application",target.id||target.applicationId,{adId,applicationId:target.applicationId,caregiverId:target.caregiverId,reopenMode:mode,adStatus,reason,futurePointsStopped:true,productionRepairV1:true});
 return json({data:{status:"ENDED_EARLY",applicationStatus:"WITHDRAWN",adId,adStatus,reopenMode:mode,reopened:mode==="PUBLISH",editRequired:mode==="EDIT",futurePointsStopped:true,caregiverVisibilityRemoved:true,productionRepairV1:true}});
}

async function repairLegacyForAd(env:Env,adId:string){
 await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
 const row=await ensureLegacyActiveContractForAd(env,adId);if(row)await reconcileContractCaseByApplication(env,row.applicationId);
}

export async function prepareProductionContractRowsV1(request:Request,env:Env){
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 if(method!=="GET")return null;
 const user=await getUser(request,env);if(!user||user.role.toUpperCase()==="CAREGIVER")return null;
 if(path==="/api/staff/contracts-v2"){
  const denied=await requireAccess(env,user,"staff.contracts","view");if(denied)return null;
  await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
  try{await reconcileLegacyOpenContracts(env)}catch(error){console.error("production_contract_list_legacy_reconcile_failed",error instanceof Error?error.message:String(error))}
  return null;
 }
 const detail=path.match(/^\/api\/staff\/job-ads\/([^/]+)$/);
 if(detail){
  const denied=await requireAccess(env,user,"staff.job_ads","view");if(denied)return null;
  try{await repairLegacyForAd(env,decodeURIComponent(detail[1]))}catch(error){console.error("production_job_ad_legacy_contract_repair_failed",{adId:decodeURIComponent(detail[1]),error:error instanceof Error?error.message:String(error)})}
 }
 return null;
}

export async function routeProductionContractRepairV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 let m=path.match(/^\/api\/staff\/job-ads\/([^/]+)\/contract-exit$/);
 if(m&&method==="POST"){
  const user=await getUser(request,env);if(!user)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
  return exitContract(request,env,user,decodeURIComponent(m[1]));
 }
 m=path.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
 if(m&&method==="PATCH"){
  const body=await request.clone().json().catch(()=>null);if(String(body?.status||"").toUpperCase()!=="IN_CONTRACT")return null;
  const user=await getUser(request,env);if(!user)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
  return startOrRepairContract(request,env,user,decodeURIComponent(m[1]),decodeURIComponent(m[2]));
 }
 return null;
}
