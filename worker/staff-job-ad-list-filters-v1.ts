import {requireAccess} from "./access-control";
import {routeJobAdMutationPolicyV13} from "./job-ad-mutation-policy-v13";
import {routeJobAdWeekdaysPolicyV14} from "./job-ad-weekdays-policy-v14";
import {ensureJobApplicationLifecycleSchema,lifecycleUpdateStatement} from "./job-application-lifecycle-v1";
import {type Env,audit,fail,getUser,json,nowIso,readBody,str} from "./lib";

const CONTRACT_TYPES=new Set(["ELDERLY","CHILD","PATIENT","HOUSEKEEPING"]);
const SHIFT_TYPES=new Set(["DAY","NIGHT","LIVE_IN","TEMPORARY"]);
const SORTS=new Set(["newest","oldest","points_desc","points_asc","latest_application"]);
const APPLICANT_RANGES=new Set(["none","1_5","6_10","11_plus"]);
const APPLICANT_STAGES=new Set(["REQUESTED","REFERRED","DISPATCH","CONTRACT"]);
const REFERRED_TO_CONSULTANT="REFERRED_TO_CONSULTANT";
const PAGE_SIZE=20;

async function lifecycleForAd(request:Request,env:Env,adId:string){
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.job_ads","view");if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);
 const ad=await env.DB.prepare("SELECT id,sales_consultant_user_id AS consultantId,deleted_at AS deletedAt FROM care_job_ads WHERE id=? LIMIT 1").bind(adId).first<any>();
 if(!ad||ad.deletedAt)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&ad.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 const rows=await env.DB.prepare("SELECT id,COALESCE(NULLIF(lifecycle_status,''),status) AS status,updated_at AS updatedAt FROM care_job_applications WHERE ad_id=? ORDER BY applied_at DESC").bind(adId).all<any>();
 return json({data:{applications:rows.results||[]}},200,{"cache-control":"no-store","x-salamat-job-application-lifecycle":"referred-v1"});
}

async function markReferredToConsultant(request:Request,env:Env,adId:string,applicationId:string){
 const body=await readBody(request.clone()),next=str(body?.status).toUpperCase();
 if(next!==REFERRED_TO_CONSULTANT)return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);
 const row=await env.DB.prepare(`SELECT ap.id,COALESCE(NULLIF(ap.lifecycle_status,''),ap.status) AS previousStatus,a.status AS adStatus,a.sales_consultant_user_id AS consultantId,a.deleted_at AS deletedAt
   FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? AND ap.ad_id=? LIMIT 1`).bind(applicationId,adId).first<any>();
 if(!row||row.deletedAt)return fail("درخواست پیدا نشد.",404,"application_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&row.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(String(row.adStatus||"").toUpperCase()==="CLOSED")return fail("این آگهی منقضی شده و وضعیت متقاضیان آن دیگر قابل تغییر نیست.",409,"job_ad_expired");
 const ts=nowIso();
 await lifecycleUpdateStatement(env,applicationId,REFERRED_TO_CONSULTANT,ts).run();
 await audit(request,env,actor,"UPDATE_JOB_APPLICATION_STATUS","care_job_application",applicationId,{adId,previousStatus:String(row.previousStatus||""),status:REFERRED_TO_CONSULTANT,stage:"REFERRED_TO_CONSULTANT"});
 return json({data:{status:REFERRED_TO_CONSULTANT,previousStatus:String(row.previousStatus||""),adStatus:row.adStatus}},200,{"cache-control":"no-store","x-salamat-job-application-lifecycle":"referred-v1"});
}

export async function routeStaffJobAdListFiltersV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const lifecycleMatch=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/application-lifecycle$/);
 if(lifecycleMatch&&method==="GET")return lifecycleForAd(request,env,decodeURIComponent(lifecycleMatch[1]));
 const applicationMatch=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
 if(applicationMatch&&method==="PATCH"){
  const referred=await markReferredToConsultant(request,env,decodeURIComponent(applicationMatch[1]),decodeURIComponent(applicationMatch[2]));
  if(referred)return referred;
 }
 const weekdays=await routeJobAdWeekdaysPolicyV14(request,env);if(weekdays)return weekdays;
 const mutation=await routeJobAdMutationPolicyV13(request,env);if(mutation)return mutation;
 if(url.pathname!=="/api/staff/job-ads"||method!=="GET")return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.job_ads","view");if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);
 const p=url.searchParams,q=str(p.get("q")),status=str(p.get("status")).toUpperCase(),contractType=str(p.get("contractType")).toUpperCase(),shiftType=str(p.get("shiftType")).toUpperCase(),requestedConsultantId=str(p.get("consultantId")),sort=str(p.get("sort"))||"newest",applicants=str(p.get("applicants")),applicantStage=str(p.get("applicantStage")).toUpperCase();
 if(contractType&&!CONTRACT_TYPES.has(contractType))return fail("نوع آگهی معتبر نیست.",400,"invalid_contract_type");
 if(shiftType&&!SHIFT_TYPES.has(shiftType))return fail("شیفت آگهی معتبر نیست.",400,"invalid_shift_type");
 if(sort&&!SORTS.has(sort))return fail("ترتیب نمایش آگهی معتبر نیست.",400,"invalid_job_ad_sort");
 if(applicants&&!APPLICANT_RANGES.has(applicants))return fail("فیلتر تعداد متقاضی معتبر نیست.",400,"invalid_applicant_range");
 if(applicantStage&&!APPLICANT_STAGES.has(applicantStage))return fail("وضعیت متقاضی پرونده معتبر نیست.",400,"invalid_applicant_stage");
 const consultantId=actor.role.toUpperCase()==="SALES_CONSULTANT"?actor.id:requestedConsultantId;
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&requestedConsultantId&&requestedConsultantId!==actor.id)return fail("مشاور فروش فقط آگهی‌های خود را می‌بیند.",403,"forbidden");
 const like=`%${q}%`,clauses=["a.deleted_at IS NULL","(?='' OR a.customer_full_name LIKE ? OR u.full_name LIKE ? OR a.description LIKE ? OR a.city LIKE ? OR a.region LIKE ?)"];
 const binds:any[]=[q,like,like,like,like,like];
 if(status==="CONTRACT")clauses.push("jc.id IS NOT NULL");else if(status){clauses.push("a.status=?");binds.push(status)}
 if(contractType){clauses.push("a.contract_type=?");binds.push(contractType)}
 if(shiftType){clauses.push("a.shift_type=?");binds.push(shiftType)}
 if(consultantId){clauses.push("a.sales_consultant_user_id=?");binds.push(consultantId)}
 const applicantCountExpr="(SELECT COUNT(*) FROM care_job_applications apf WHERE apf.ad_id=a.id)";
 if(applicants==="none")clauses.push(`${applicantCountExpr}=0`);
 else if(applicants==="1_5")clauses.push(`${applicantCountExpr} BETWEEN 1 AND 5`);
 else if(applicants==="6_10")clauses.push(`${applicantCountExpr} BETWEEN 6 AND 10`);
 else if(applicants==="11_plus")clauses.push(`${applicantCountExpr}>=11`);
 const contractStageExpr="(jc.id IS NOT NULL OR EXISTS (SELECT 1 FROM care_job_applications apsc WHERE apsc.ad_id=a.id AND COALESCE(apsc.lifecycle_status,apsc.status)='IN_CONTRACT'))";
 const dispatchStageExpr="EXISTS (SELECT 1 FROM care_job_applications apsd WHERE apsd.ad_id=a.id AND COALESCE(apsd.lifecycle_status,apsd.status)='TRIAL_DISPATCH')";
 const referredStageExpr=`EXISTS (SELECT 1 FROM care_job_applications apsf WHERE apsf.ad_id=a.id AND COALESCE(apsf.lifecycle_status,apsf.status)='${REFERRED_TO_CONSULTANT}')`;
 const requestedStageExpr="EXISTS (SELECT 1 FROM care_job_applications apsr WHERE apsr.ad_id=a.id AND COALESCE(apsr.lifecycle_status,apsr.status)='PENDING_CONSULTANT')";
 if(applicantStage==="CONTRACT")clauses.push(contractStageExpr);
 else if(applicantStage==="DISPATCH"){clauses.push(`NOT ${contractStageExpr}`);clauses.push(dispatchStageExpr)}
 else if(applicantStage==="REFERRED")clauses.push(referredStageExpr);
 else if(applicantStage==="REQUESTED"){clauses.push(`NOT ${contractStageExpr}`);clauses.push(`NOT ${dispatchStageExpr}`);clauses.push(`NOT ${referredStageExpr}`);clauses.push(requestedStageExpr)}
 const publicationDate="COALESCE(a.published_at,a.created_at)";
 const order=({
  newest:`${publicationDate} DESC,a.id DESC`,
  oldest:`${publicationDate} ASC,a.id ASC`,
  points_desc:"COALESCE(a.reward_points,a.contract_points,0) DESC,a.created_at DESC,a.id DESC",
  points_asc:"COALESCE(a.reward_points,a.contract_points,0) ASC,a.created_at DESC,a.id DESC",
  latest_application:`CASE WHEN latest_app.latest_application_at IS NULL THEN 1 ELSE 0 END ASC,latest_app.latest_application_at DESC,${publicationDate} DESC,a.id DESC`,
 } as Record<string,string>)[sort]||`${publicationDate} DESC,a.id DESC`;
 const fromSql=`
  FROM care_job_ads a
  JOIN users u ON u.id=a.sales_consultant_user_id
  LEFT JOIN caregiver_job_contracts jc ON jc.id=(SELECT j2.id FROM caregiver_job_contracts j2 WHERE j2.ad_id=a.id AND j2.status='ACTIVE' ORDER BY j2.started_at DESC,j2.created_at DESC LIMIT 1)
  LEFT JOIN (SELECT ad_id,MAX(applied_at) AS latest_application_at FROM care_job_applications GROUP BY ad_id) latest_app ON latest_app.ad_id=a.id
  WHERE ${clauses.join(" AND ")}`;
 const totalRow=await env.DB.prepare(`SELECT COUNT(*) AS total ${fromSql}`).bind(...binds).first<{total:number}>();
 const total=Number(totalRow?.total||0),totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE)),requestedPage=Math.max(1,Math.trunc(Number(p.get("page")||1)||1)),page=Math.min(requestedPage,totalPages),offset=(page-1)*PAGE_SIZE;
 const rows=await env.DB.prepare(`
  SELECT a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,u.full_name AS salesConsultantName,
   a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
   COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,a.description,a.status,a.published_at AS publishedAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
   a.recipient_condition AS recipientCondition,a.auto_contract_points AS autoContractPoints,a.points_mode AS pointsMode,a.points_basis_days AS pointsBasisDays,a.points_base_value AS pointsBaseValue,
   a.required_caregiver_gender AS caregiverGender,a.caregiver_display_priority AS caregiverDisplayPriority,a.work_weekdays_json AS workWeekdaysJson,a.weekday_score_factor AS weekdayScoreFactor,
   (SELECT COUNT(*) FROM care_job_applications ap WHERE ap.ad_id=a.id) AS applicationCount,latest_app.latest_application_at AS latestApplicationAt,
   CASE WHEN ${contractStageExpr} THEN 'CONTRACT' WHEN ${dispatchStageExpr} THEN 'DISPATCH' WHEN ${referredStageExpr} THEN 'REFERRED' WHEN ${requestedStageExpr} THEN 'REQUESTED' ELSE NULL END AS applicantStage,
   jc.id AS activeContractId,jc.application_id AS contractApplicationId,jc.caregiver_id AS contractCaregiverId,jc.started_at AS contractStartedAt,jc.scheduled_end_at AS contractEndsAt
  ${fromSql}
  ORDER BY ${order}
  LIMIT ? OFFSET ?`).bind(...binds,PAGE_SIZE,offset).all<any>();
 const ads=(rows.results||[]).map((ad:any)=>({...ad,caregiverGender:String(ad.caregiverGender||"").toUpperCase()||null,caregiverDisplayPriority:Math.max(1,Math.min(100,Number(ad.caregiverDisplayPriority||50))),workWeekdays:(()=>{try{const parsed=JSON.parse(String(ad.workWeekdaysJson||"[]"));return Array.isArray(parsed)&&parsed.length?parsed:["SAT","SUN","MON","TUE","WED","THU"]}catch{return ["SAT","SUN","MON","TUE","WED","THU"]}})(),weekdayScoreFactor:Number(ad.weekdayScoreFactor||1),applicantStage:String(ad.applicantStage||"").toUpperCase()||null,hasActiveContract:Boolean(ad.activeContractId),lifecycleStatus:ad.activeContractId?"CONTRACT":null,recipientConditionLabel:String(ad.contractType||"").toUpperCase()==="PATIENT"?"بیمار":undefined}));
 return json({data:{ads,pagination:{page,pageSize:PAGE_SIZE,total,totalPages,hasNext:page<totalPages,hasPrevious:page>1},filters:{sort,applicants:applicants||null,applicantStage:applicantStage||null,contractType:contractType||null,shiftType:shiftType||null,consultantId:consultantId||null}}},200,{"x-salamat-job-ad-list-source":"staff-filter-v13-tombstone","x-salamat-job-ad-list-features":"v21-referred-consultant-stage"});
}
