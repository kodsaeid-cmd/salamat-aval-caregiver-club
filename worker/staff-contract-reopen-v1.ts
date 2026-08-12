import {requireAccess} from "./access-control";
import {reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {contractProgressPointsSummary} from "./contract-progress-engine-v1";
import {accrueContractPointsForStaffExit,prepareContractForStaffExit} from "./legacy-contract-compat-v1";
import {type Env,audit,fail,getUser,json,nowIso,readBody,str} from "./lib";

type ExitTarget={
 id?:string|null;caregiverId:string;adId:string;applicationId:string;consultantId?:string|null;earnedPointsUnits?:number;
 startedAt?:string;scheduledEndAt?:string;durationDays?:number;totalPointsUnits?:number;lastReconciledDay?:number;status?:string;pointsModel?:string;
 legacyApplicationOnly?:boolean;
};

async function allowed(env:Env,user:any){
 const [contractDenied,jobsDenied]=await Promise.all([
  requireAccess(env,user,"staff.contracts","update"),
  requireAccess(env,user,"staff.job_ads","update"),
 ]);
 if(!contractDenied||!jobsDenied)return null;
 return contractDenied;
}

async function modernActiveByAd(env:Env,adId:string){
 return env.DB.prepare(`SELECT jc.id,jc.caregiver_id AS caregiverId,jc.ad_id AS adId,jc.application_id AS applicationId,
  jc.started_at AS startedAt,jc.scheduled_end_at AS scheduledEndAt,jc.duration_days AS durationDays,
  jc.total_points_units AS totalPointsUnits,jc.earned_points_units AS earnedPointsUnits,jc.last_reconciled_day AS lastReconciledDay,
  jc.status,jc.points_model AS pointsModel,a.sales_consultant_user_id AS consultantId
  FROM caregiver_job_contracts jc JOIN care_job_ads a ON a.id=jc.ad_id
  WHERE jc.ad_id=? AND jc.status='ACTIVE' ORDER BY jc.started_at DESC LIMIT 1`).bind(adId).first<ExitTarget>();
}

async function legacyApplicationByAd(env:Env,adId:string){
 return env.DB.prepare(`SELECT NULL AS id,ap.caregiver_id AS caregiverId,ap.ad_id AS adId,ap.id AS applicationId,
  a.sales_consultant_user_id AS consultantId,0 AS earnedPointsUnits,1 AS legacyApplicationOnly
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
  WHERE ap.ad_id=? AND ap.status='IN_CONTRACT' ORDER BY ap.updated_at DESC LIMIT 1`).bind(adId).first<ExitTarget>();
}

export async function routeStaffContractReopenV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/contract-exit$/);if(!match||method!=="POST")return null;
 const user=await getUser(request,env);if(!user)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");const denied=await allowed(env,user);if(denied)return denied;
 const adId=decodeURIComponent(match[1]);
 let active:ExitTarget|null=null;
 try{active=await prepareContractForStaffExit(env,adId) as ExitTarget|null}catch(error){console.error("staff_contract_exit_legacy_prepare_failed",{adId,error:error instanceof Error?error.message:String(error)})}
 if(!active){
  const modern=await modernActiveByAd(env,adId);
  if(modern){
   try{active=await accrueContractPointsForStaffExit(env,modern as any) as ExitTarget}catch(error){active=modern;console.error("staff_contract_exit_accrual_failed_but_exit_continues",{adId,contractId:modern.id,error:error instanceof Error?error.message:String(error)})}
  }
 }
 const target=active||await legacyApplicationByAd(env,adId);
 if(!target)return fail("برای این آگهی قرارداد یا متقاضی «در قرارداد» پیدا نشد.",404,"active_contract_not_found");
 const consultant=target.consultantId!=null?target:await env.DB.prepare("SELECT sales_consultant_user_id AS consultantId FROM care_job_ads WHERE id=? LIMIT 1").bind(adId).first<any>();
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&consultant?.consultantId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 const body=await readBody(request),mode=str(body?.reopenMode).toUpperCase(),reason=str(body?.reasonText).slice(0,500);if(!["PUBLISH","EDIT"].includes(mode))return fail("یکی از دو گزینه انتشار مجدد یا ویرایش آگهی را انتخاب کنید.",400,"reopen_mode_required");
 const ts=nowIso(),adStatus=mode==="PUBLISH"?"PUBLISHED":"DRAFT",core:any[]=[];
 if(target.id)core.push(env.DB.prepare("UPDATE caregiver_job_contracts SET status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code='STAFF_REMOVAL',end_reason_text=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(ts,user.id,reason||null,ts,target.id));
 core.push(env.DB.prepare("UPDATE care_job_applications SET status='WITHDRAWN',updated_at=? WHERE id=?").bind(ts,target.applicationId));
 core.push(env.DB.prepare("UPDATE care_job_ads SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN ? ELSE published_at END,updated_at=? WHERE id=?").bind(adStatus,adStatus,ts,ts,adId));
 await env.DB.batch(core);
 try{
  if(target.id)await reconcileContractCaseByApplication(env,target.applicationId);
  await env.DB.batch([
   env.DB.prepare("UPDATE contract_cases_v2 SET status='ENDED_EARLY',renewal_state='INACTIVE',updated_at=? WHERE job_ad_id=? AND status='ACTIVE'").bind(ts,adId),
   env.DB.prepare("UPDATE contract_service_providers_v2 SET status='REMOVED',ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id IN (SELECT id FROM contract_cases_v2 WHERE job_ad_id=?) AND caregiver_id=? AND status='ACTIVE'").bind(ts,ts,adId,target.caregiverId),
  ]);
 }catch(error){console.error("staff_contract_exit_lifecycle_sync_failed",{adId,contractId:target.id||null,applicationId:target.applicationId,error:error instanceof Error?error.message:String(error)})}
 try{await audit(request,env,user,"REMOVE_CONTRACT_PROVIDER",target.id?"caregiver_job_contract":"care_job_application",target.id||target.applicationId,{adId,caregiverId:target.caregiverId,applicationId:target.applicationId,reopenMode:mode,adStatus,reason,earnedPointsUnits:Number(target.earnedPointsUnits||0),futurePointsStopped:true,legacyCompatible:true,legacyApplicationOnly:Boolean(target.legacyApplicationOnly)})}catch(error){console.error("staff_contract_exit_audit_failed",{adId,contractId:target.id||null,error:error instanceof Error?error.message:String(error)})}
 const points=await contractProgressPointsSummary(env,target.caregiverId).catch(()=>null);
 return json({data:{status:"ENDED_EARLY",adId,adStatus,reopenMode:mode,reopened:mode==="PUBLISH",editRequired:mode==="EDIT",points,legacyCompatible:true,legacyApplicationOnly:Boolean(target.legacyApplicationOnly),futurePointsStopped:true,caregiverVisibilityRemoved:true}});
}
