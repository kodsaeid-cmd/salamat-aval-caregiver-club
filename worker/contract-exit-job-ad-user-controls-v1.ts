import {requireAccess} from "./access-control";
import {deleteAccountV2} from "./account-management-v2";
import {ensureContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {contractProgressPointsSummary,ensureContractProgressSchema,reconcileAllActiveContracts} from "./contract-progress-engine-v1";
import {ensureJobApplicationLifecycleSchema,lifecycleUpdateStatement} from "./job-application-lifecycle-v1";
import {routeJobAdCaregiverVisibilityV1} from "./job-ad-caregiver-unity-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,str} from "./lib";

const CONTRACT_TYPES=new Set(["ELDERLY","CHILD","PATIENT","HOUSEKEEPING"]);
const SHIFT_TYPES=new Set(["DAY","NIGHT","LIVE_IN","TEMPORARY"]);
const WITHDRAW_REASONS=new Set(["PERSONAL","HEALTH","FAMILY","CASE_MISMATCH","PAYMENT","SHIFT","DISTANCE","OTHER"]);
const WITHDRAW_REASON_ALIASES:Record<string,string>={CONDITIONS:"CASE_MISMATCH",SALARY:"PAYMENT",COMMUTE:"DISTANCE",MISMATCH:"CASE_MISMATCH"};
const SELF_WITHDRAW_REASON_SQL="'PERSONAL','HEALTH','FAMILY','CASE_MISMATCH','PAYMENT','SHIFT','DISTANCE','OTHER'";
const points=(units:unknown)=>Math.round(Number(units||0))/100;
const normalizeWithdrawReason=(value:unknown)=>{const code=str(value).toUpperCase();return WITHDRAW_REASON_ALIASES[code]||code};

async function actor(request:Request,env:Env){const user=await getUser(request,env);return user||null}
async function activeContractForAd(env:Env,adId:string){return env.DB.prepare("SELECT id FROM caregiver_job_contracts WHERE ad_id=? AND status='ACTIVE' LIMIT 1").bind(adId).first<{id:string}>()}
async function selfWithdrawnAdIds(env:Env,caregiverId:string){
 const rows=await env.DB.prepare(`SELECT DISTINCT ad_id AS adId FROM caregiver_job_contracts WHERE caregiver_id=? AND status='ENDED_EARLY' AND end_reason_code IN (${SELF_WITHDRAW_REASON_SQL})`).bind(caregiverId).all<{adId:string}>();
 return new Set((rows.results||[]).map(row=>String(row.adId)));
}

async function finishContract(request:Request,env:Env,user:AuthUser,contract:any,reasonCode:string,reasonText:string,adStatus:"PUBLISHED"|"DRAFT",providerStatus:string){
 await reconcileAllActiveContracts(env);
 const fresh=await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,earned_points_units AS earnedPointsUnits,status FROM caregiver_job_contracts WHERE id=? LIMIT 1").bind(contract.id).first<any>();
 if(!fresh||fresh.status!=="ACTIVE")return fail("قرارداد فعال پیدا نشد.",404,"active_contract_not_found");
 await ensureJobApplicationLifecycleSchema(env);
 await ensureContractLifecycleV2(env);
 await reconcileContractCaseByApplication(env,fresh.applicationId).catch(()=>null);
 const ts=nowIso();
 try{
  await env.DB.batch([
   env.DB.prepare("UPDATE caregiver_job_contracts SET status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code=?,end_reason_text=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(ts,user.id,reasonCode,reasonText||null,ts,fresh.id),
   lifecycleUpdateStatement(env,fresh.applicationId,"WITHDRAWN",ts),
   env.DB.prepare("UPDATE care_job_ads SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=? WHERE id=?").bind(adStatus,adStatus,ts,ts,fresh.adId),
  ]);
 }catch(error){
  console.error("caregiver_contract_withdraw_storage_failed",{contractId:fresh.id,applicationId:fresh.applicationId,adId:fresh.adId,error:error instanceof Error?error.message:String(error)});
  return fail("ثبت انصراف قرارداد در پایگاه داده تکمیل نشد.",500,"caregiver_contract_withdraw_persistence_failed");
 }
 try{
  await env.DB.batch([
   env.DB.prepare("UPDATE contract_cases_v2 SET status='ENDED_EARLY',renewal_state='INACTIVE',updated_at=? WHERE job_contract_id=?").bind(ts,fresh.id),
   env.DB.prepare("UPDATE contract_service_providers_v2 SET status=?,ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id IN (SELECT id FROM contract_cases_v2 WHERE job_contract_id=?) AND caregiver_id=? AND status='ACTIVE'").bind(providerStatus,ts,ts,fresh.id,fresh.caregiverId),
  ]);
 }catch(error){console.error("caregiver_contract_withdraw_case_sync_failed",{contractId:fresh.id,applicationId:fresh.applicationId,adId:fresh.adId,error:error instanceof Error?error.message:String(error)})}
 try{await audit(request,env,user,"END_JOB_CONTRACT_EARLY","caregiver_job_contract",fresh.id,{adId:fresh.adId,applicationId:fresh.applicationId,caregiverId:fresh.caregiverId,reasonCode,reasonText,adStatus,earnedPoints:points(fresh.earnedPointsUnits),futurePointsStopped:true})}catch(error){console.error("caregiver_contract_withdraw_audit_failed",{contractId:fresh.id,error:error instanceof Error?error.message:String(error)})}
 let summary:any=null;try{summary=await contractProgressPointsSummary(env,fresh.caregiverId)}catch(error){console.error("caregiver_contract_withdraw_points_summary_failed",{contractId:fresh.id,caregiverId:fresh.caregiverId,error:error instanceof Error?error.message:String(error)})}
 return json({data:{status:"ENDED_EARLY",adId:fresh.adId,adStatus,earnedPoints:points(fresh.earnedPointsUnits),futurePointsStopped:true,bankUnlocked:true,points:summary}});
}

async function caregiverWithdraw(request:Request,env:Env,user:AuthUser,contractId:string){
 if(user.role.toUpperCase()!=="CAREGIVER"||!user.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const body=await readBody(request),confirmed=body?.confirmed===true,reasonCode=normalizeWithdrawReason(body?.reasonCode),reasonText=str(body?.reasonText).slice(0,500);
 if(!confirmed)return fail("برای انصراف قطعی، تأیید نهایی الزامی است.",400,"withdraw_confirmation_required");
 if(!WITHDRAW_REASONS.has(reasonCode))return fail("علت انصراف را انتخاب کنید.",400,"withdraw_reason_required");
 await ensureContractProgressSchema(env);
 const contract=await env.DB.prepare("SELECT id FROM caregiver_job_contracts WHERE id=? AND caregiver_id=? AND status='ACTIVE' LIMIT 1").bind(contractId,user.caregiverId).first<any>();
 if(!contract)return fail("قرارداد فعال پیدا نشد.",404,"active_contract_not_found");
 return finishContract(request,env,user,contract,reasonCode,reasonText,"DRAFT","WITHDRAWN");
}

async function staffRemoveProvider(request:Request,env:Env,user:AuthUser,caseId:string){
 const denied=await requireAccess(env,user,"staff.contracts","update");if(denied)return denied;
 await ensureContractLifecycleV2(env);await reconcileAllActiveContracts(env);
 const row=await env.DB.prepare(`SELECT c.id,c.job_contract_id AS jobContractId,c.job_ad_id AS adId,c.primary_caregiver_id AS caregiverId,jc.application_id AS applicationId,jc.status AS jobStatus FROM contract_cases_v2 c LEFT JOIN caregiver_job_contracts jc ON jc.id=c.job_contract_id WHERE c.id=? LIMIT 1`).bind(caseId).first<any>();
 if(!row)return fail("قرارداد پیدا نشد.",404,"contract_not_found");
 if(row.jobStatus!=="ACTIVE")return fail("این قرارداد خدمت‌دهنده فعال ندارد.",409,"contract_not_active");
 const body=await readBody(request),mode=str(body?.reopenMode).toUpperCase(),reason=str(body?.reasonText).slice(0,500);
 if(!["PUBLISH","EDIT"].includes(mode))return fail("مشخص کنید آگهی مستقیم منتشر شود یا برای ویرایش بازگردد.",400,"reopen_mode_required");
 const response=await finishContract(request,env,user,{id:row.jobContractId},"STAFF_REMOVAL",reason,mode==="PUBLISH"?"PUBLISHED":"DRAFT","REMOVED");
 if(!response.ok)return response;
 const payload:any=await response.json().catch(()=>({}));payload.data={...(payload.data||{}),contractCaseId:caseId,reopenMode:mode,editRequired:mode==="EDIT",reopened:mode==="PUBLISH"};return json(payload,response.status);
}

function editPayload(body:any,current:any){
 const value=(key:string,fallback:any)=>body?.[key]===undefined?fallback:body[key];
 const customerFullName=str(value("customerFullName",current.customerFullName)),city=str(value("city",current.city)),region=str(value("region",current.region)),salesConsultantUserId=str(value("salesConsultantUserId",current.salesConsultantUserId)),contractType=str(value("contractType",current.contractType)).toUpperCase(),shiftType=str(value("shiftType",current.shiftType)).toUpperCase(),caregiverSalaryRial=Math.trunc(Number(value("caregiverSalaryRial",current.caregiverSalaryRial)||0)),durationDays=Math.trunc(Number(value("durationDays",current.durationDays)||0)),description=str(value("description",current.description)).slice(0,3000);
 if(!customerFullName||!city||!region||!salesConsultantUserId)return{error:"نام مشترک، شهر، منطقه و مشاور پرونده الزامی است."};
 if(!CONTRACT_TYPES.has(contractType)||!SHIFT_TYPES.has(shiftType))return{error:"نوع قرارداد یا شیفت معتبر نیست."};
 if(caregiverSalaryRial<=0||durationDays<=0)return{error:"حقوق و مدت قرارداد باید بیشتر از صفر باشد."};
 return{customerFullName,city,region,salesConsultantUserId,contractType,shiftType,caregiverSalaryRial,durationDays,description};
}

async function editAd(request:Request,env:Env,user:AuthUser,adId:string){
 const denied=await requireAccess(env,user,"staff.job_ads","update");if(denied)return denied;
 const current=await env.DB.prepare(`SELECT id,customer_full_name AS customerFullName,city,region,sales_consultant_user_id AS salesConsultantUserId,contract_type AS contractType,shift_type AS shiftType,caregiver_salary_rial AS caregiverSalaryRial,duration_days AS durationDays,description,status FROM care_job_ads WHERE id=? AND status<>'DELETED' LIMIT 1`).bind(adId).first<any>();
 if(!current)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&current.salesConsultantUserId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(await activeContractForAd(env,adId))return fail("این آگهی قرارداد فعال دارد. ابتدا مراقب را از قرارداد خارج کنید.",409,"active_contract_blocks_edit");
 const parsed:any=editPayload(await readBody(request),current);if("error" in parsed)return fail(String(parsed.error||"اطلاعات آگهی معتبر نیست."));
 const consultant=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('SALES_CONSULTANT','SALES_SUPERVISOR','ADMIN') AND status IN ('ACTIVE','APPROVED') LIMIT 1").bind(String(parsed.salesConsultantUserId)).first();if(!consultant)return fail("مشاور پرونده معتبر نیست.",400,"consultant_invalid");
 const ts=nowIso(),nextStatus=current.status==="PUBLISHED"?"PUBLISHED":"DRAFT";
 await env.DB.prepare(`UPDATE care_job_ads SET customer_full_name=?,city=?,region=?,sales_consultant_user_id=?,contract_type=?,shift_type=?,caregiver_salary_rial=?,duration_days=?,description=?,status=?,updated_at=? WHERE id=?`).bind(parsed.customerFullName,parsed.city,parsed.region,parsed.salesConsultantUserId,parsed.contractType,parsed.shiftType,parsed.caregiverSalaryRial,parsed.durationDays,parsed.description,nextStatus,ts,adId).run();
 await audit(request,env,user,"UPDATE_JOB_AD","care_job_ad",adId,{...parsed,status:nextStatus});return json({data:{id:adId,status:nextStatus}});
}

async function deleteAd(request:Request,env:Env,user:AuthUser,adId:string){
 const denied=await requireAccess(env,user,"staff.job_ads","delete");if(denied)return denied;
 const row=await env.DB.prepare("SELECT id,sales_consultant_user_id AS consultantId,status FROM care_job_ads WHERE id=? AND status<>'DELETED' LIMIT 1").bind(adId).first<any>();if(!row)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(user.role.toUpperCase()==="SALES_CONSULTANT"&&row.consultantId!==user.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(await activeContractForAd(env,adId))return fail("آگهی دارای قرارداد فعال قابل حذف نیست. ابتدا خدمت‌دهنده را از قرارداد خارج کنید.",409,"active_contract_blocks_delete");
 const ts=nowIso();await env.DB.prepare("UPDATE care_job_ads SET status='DELETED',updated_at=? WHERE id=?").bind(ts,adId).run();await audit(request,env,user,"DELETE_JOB_AD","care_job_ad",adId,{mode:"auditable_soft_delete",previousStatus:row.status});return json({data:{id:adId,deleted:true}});
}

async function caregiverReapply(request:Request,env:Env,user:AuthUser,adId:string){
 if(user.role.toUpperCase()!=="CAREGIVER"||!user.caregiverId)return null;
 const excluded=await selfWithdrawnAdIds(env,user.caregiverId);
 if(excluded.has(adId))return fail("شما قبلاً از قرارداد این آگهی انصراف داده‌اید و این آگهی برای شما دوباره قابل مشاهده یا درخواست نیست.",410,"job_ad_withdrawn_by_caregiver");
 await ensureJobApplicationLifecycleSchema(env);
 const existing=await env.DB.prepare("SELECT id,COALESCE(lifecycle_status,status) AS status FROM care_job_applications WHERE ad_id=? AND caregiver_id=? LIMIT 1").bind(adId,user.caregiverId).first<any>();
 if(!existing||existing.status!=="WITHDRAWN")return null;
 const ad=await env.DB.prepare("SELECT status FROM care_job_ads WHERE id=? LIMIT 1").bind(adId).first<any>();if(ad?.status!=="PUBLISHED")return fail("این آگهی فعال نیست و امکان اپلای ندارد.",409,"job_ad_unavailable");
 if(await env.DB.prepare("SELECT id FROM caregiver_job_contracts WHERE caregiver_id=? AND status='ACTIVE' LIMIT 1").bind(user.caregiverId).first())return fail("شما هم‌اکنون در یک قرارداد فعال هستید.",409,"job_bank_locked_by_active_contract");
 const ts=nowIso();await env.DB.batch([lifecycleUpdateStatement(env,existing.id,"PENDING_CONSULTANT",ts),env.DB.prepare("UPDATE care_job_applications SET applied_at=? WHERE id=?").bind(ts,existing.id)]);await audit(request,env,user,"REAPPLY_JOB_AD","care_job_ad",adId,{applicationId:existing.id,previousStatus:"WITHDRAWN"});return json({data:{application:{id:existing.id,status:"PENDING_CONSULTANT",appliedAt:ts},reapplied:true}});
}

async function deleteUserAndProfile(request:Request,env:Env,user:AuthUser,userId:string){
 const denied=await requireAccess(env,user,"staff.users","delete");if(denied)return denied;
 const target=await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,role,status FROM users WHERE id=? LIMIT 1").bind(userId).first<any>();if(!target||String(target.status).toUpperCase()==="DELETED")return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
 if(target.caregiverId&&await env.DB.prepare("SELECT id FROM caregiver_job_contracts WHERE caregiver_id=? AND status='ACTIVE' LIMIT 1").bind(target.caregiverId).first())return fail("مراقب قرارداد فعال دارد. ابتدا او را از قرارداد خارج کنید.",409,"active_contract_blocks_user_delete");
 const deleted=await deleteAccountV2(request,env,user,userId);if(!deleted.ok||!target.caregiverId)return deleted;
 const ts=nowIso(),tomb=randomId("deleted_");await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='DELETED',cooperation_status='حذف‌شده',mobile='deleted-' || id || '-' || ?,national_id=NULL,membership_code='DELETED-' || id || '-' || ?,updated_at=? WHERE id=?`).bind(tomb,tomb,ts,target.caregiverId).run();await audit(request,env,user,"DELETE","caregiver",target.caregiverId,{accountId:userId,mode:"auditable_soft_delete_with_account"});return json({data:{id:userId,caregiverId:target.caregiverId,deleted:true,profileDeleted:true}});
}

async function filteredStaffRead(request:Request,env:Env){
 const response=await routeJobAdCaregiverVisibilityV1(request,env);if(!response||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 if(Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.filter((x:any)=>String(x?.status||"").toUpperCase()!=="DELETED");
 if(payload.data.ad&&String(payload.data.ad.status||"").toUpperCase()==="DELETED")return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 return json(payload,response.status);
}

async function filteredCaregiverRead(request:Request,env:Env,user:AuthUser,adId?:string){
 if(user.role.toUpperCase()!=="CAREGIVER"||!user.caregiverId)return null;
 const response=await routeJobAdCaregiverVisibilityV1(request,env);if(!response||!response.ok)return response;
 const excluded=await selfWithdrawnAdIds(env,user.caregiverId),payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 if(adId&&excluded.has(adId))return fail("این آگهی پس از انصراف شما از قرارداد، برای حساب شما بسته شده است.",410,"job_ad_withdrawn_by_caregiver");
 if(Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.filter((x:any)=>!excluded.has(String(x?.id||"")));
 if(payload.data.ad?.id&&excluded.has(String(payload.data.ad.id)))return fail("این آگهی پس از انصراف شما از قرارداد، برای حساب شما بسته شده است.",410,"job_ad_withdrawn_by_caregiver");
 return json(payload,response.status);
}

export async function routeContractExitJobAdUserControlsV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
 const user=await actor(request,env);if(!user)return null;
 let m=path.match(/^\/api\/caregiver\/contracts\/([^/]+)\/withdraw$/);if(m&&method==="POST")return caregiverWithdraw(request,env,user,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/staff\/contracts-v2\/([^/]+)\/remove-provider$/);if(m&&method==="POST")return staffRemoveProvider(request,env,user,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/staff\/job-ads\/([^/]+)$/);if(m&&method==="PATCH")return editAd(request,env,user,decodeURIComponent(m[1]));if(m&&method==="DELETE")return deleteAd(request,env,user,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/caregiver\/job-ads\/([^/]+)\/apply$/);if(m&&method==="POST")return caregiverReapply(request,env,user,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/caregiver\/job-ads\/([^/]+)$/);if(m&&method==="GET")return filteredCaregiverRead(request,env,user,decodeURIComponent(m[1]));
 if(path==="/api/caregiver/job-ads"&&method==="GET")return filteredCaregiverRead(request,env,user);
 m=path.match(/^\/api\/users\/([^/]+)$/);if(m&&method==="DELETE")return deleteUserAndProfile(request,env,user,decodeURIComponent(m[1]));
 if(method==="GET"&&(path==="/api/staff/job-ads"||/^\/api\/staff\/job-ads\/[^/]+$/.test(path)))return filteredStaffRead(request,env);
 return null;
}
