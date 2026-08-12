import {requireAccess} from "./access-control";
import {reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {contractProgressPointsSummary} from "./contract-progress-engine-v1";
import {prepareContractForStaffExit} from "./legacy-contract-compat-v1";
import {type Env,audit,fail,getUser,json,nowIso,readBody,str} from "./lib";

async function allowed(env:Env,user:any){const contractDenied=await requireAccess(env,user,"staff.contracts","update");if(!contractDenied)return null;const jobsDenied=await requireAccess(env,user,"staff.job_ads","update");return jobsDenied||contractDenied}

export async function routeStaffContractReopenV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/contract-exit$/);if(!match||method!=="POST")return null;
 const user=await getUser(request,env);if(!user)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");const denied=await allowed(env,user);if(denied)return denied;
 const adId=decodeURIComponent(match[1]);
 let prepared:any=null;
 try{prepared=await prepareContractForStaffExit(env,adId)}catch(error){console.error("staff_contract_exit_legacy_prepare_failed",{adId,error:error instanceof Error?error.message:String(error)})}
 const active=prepared||await env.DB.prepare(`SELECT jc.id,jc.caregiver_id AS caregiverId,jc.application_id AS applicationId,jc.earned_points_units AS earnedPointsUnits,a.sales_consultant_user_id AS consultantId FROM caregiver_job_contracts jc JOIN care_job_ads a ON a.id=jc.ad_id WHERE jc.ad_id=? AND jc.status='ACTIVE' ORDER BY jc.started_at DESC LIMIT 1`).bind(adId).first<any>();
 if(!active)return fail("برای این آگهی قرارداد فعال پیدا نشد. اگر این قرارداد قدیمی است، وضعیت متقاضی باید «در قرارداد» باشد تا به‌صورت خودکار بازیابی شود.",404,"active_contract_not_found");
 const consultant=active.consultantId!=null?active:await env.DB.prepare("SELECT sales_consultant_user_id AS consultantId FROM care_job_ads WHERE id=? LIMIT 1").bind(adId).first<any>();
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&consultant?.consultantId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 const body=await readBody(request),mode=str(body?.reopenMode).toUpperCase(),reason=str(body?.reasonText).slice(0,500);if(!["PUBLISH","EDIT"].includes(mode))return fail("یکی از دو گزینه انتشار مجدد یا ویرایش آگهی را انتخاب کنید.",400,"reopen_mode_required");
 const ts=nowIso(),adStatus=mode==="PUBLISH"?"PUBLISHED":"DRAFT";
 // Core state changes are intentionally independent from lifecycle-v2 bookkeeping. A legacy
 // lifecycle row can never turn a valid remove/reopen action into an HTTP 500.
 await env.DB.batch([
  env.DB.prepare("UPDATE caregiver_job_contracts SET status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code='STAFF_REMOVAL',end_reason_text=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(ts,user.id,reason||null,ts,active.id),
  env.DB.prepare("UPDATE care_job_applications SET status='WITHDRAWN',updated_at=? WHERE id=?").bind(ts,active.applicationId),
  env.DB.prepare("UPDATE care_job_ads SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=? WHERE id=?").bind(adStatus,adStatus,ts,ts,adId),
 ]);
 try{
  await reconcileContractCaseByApplication(env,active.applicationId);
  await env.DB.batch([
   env.DB.prepare("UPDATE contract_cases_v2 SET status='ENDED_EARLY',renewal_state='INACTIVE',updated_at=? WHERE job_contract_id=?").bind(ts,active.id),
   env.DB.prepare("UPDATE contract_service_providers_v2 SET status='REMOVED',ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id IN (SELECT id FROM contract_cases_v2 WHERE job_contract_id=?) AND caregiver_id=? AND status='ACTIVE'").bind(ts,ts,active.id,active.caregiverId),
  ]);
 }catch(error){console.error("staff_contract_exit_lifecycle_sync_failed",{adId,contractId:active.id,applicationId:active.applicationId,error:error instanceof Error?error.message:String(error)})}
 try{await audit(request,env,user,"REMOVE_CONTRACT_PROVIDER","caregiver_job_contract",active.id,{adId,caregiverId:active.caregiverId,applicationId:active.applicationId,reopenMode:mode,adStatus,reason,earnedPointsUnits:Number(active.earnedPointsUnits||0),futurePointsStopped:true,legacyCompatible:true})}catch(error){console.error("staff_contract_exit_audit_failed",{adId,contractId:active.id,error:error instanceof Error?error.message:String(error)})}
 const points=await contractProgressPointsSummary(env,active.caregiverId).catch(()=>null);
 return json({data:{status:"ENDED_EARLY",adId,adStatus,reopenMode:mode,reopened:mode==="PUBLISH",editRequired:mode==="EDIT",points,legacyCompatible:true}});
}
