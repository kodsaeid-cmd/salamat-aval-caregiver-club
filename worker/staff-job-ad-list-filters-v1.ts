import {requireAccess} from "./access-control";
import {routeJobAdMutationPolicyV13} from "./job-ad-mutation-policy-v13";
import {routeJobAdWeekdaysPolicyV14} from "./job-ad-weekdays-policy-v14";
import {type Env,fail,getUser,json,str} from "./lib";

const CONTRACT_TYPES=new Set(["ELDERLY","CHILD","PATIENT","HOUSEKEEPING"]);
const SHIFT_TYPES=new Set(["DAY","NIGHT","LIVE_IN","TEMPORARY"]);
const SORTS=new Set(["newest","oldest","points_desc","points_asc"]);
const APPLICANT_RANGES=new Set(["none","1_5","6_10","11_plus"]);

export async function routeStaffJobAdListFiltersV1(request:Request,env:Env):Promise<Response|null>{
 const weekdays=await routeJobAdWeekdaysPolicyV14(request,env);if(weekdays)return weekdays;
 const mutation=await routeJobAdMutationPolicyV13(request,env);if(mutation)return mutation;
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname!=="/api/staff/job-ads"||method!=="GET")return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.job_ads","view");if(denied)return denied;
 const p=url.searchParams,q=str(p.get("q")),status=str(p.get("status")).toUpperCase(),contractType=str(p.get("contractType")).toUpperCase(),shiftType=str(p.get("shiftType")).toUpperCase(),requestedConsultantId=str(p.get("consultantId")),sort=str(p.get("sort"))||"newest",applicants=str(p.get("applicants"));
 if(contractType&&!CONTRACT_TYPES.has(contractType))return fail("نوع آگهی معتبر نیست.",400,"invalid_contract_type");
 if(shiftType&&!SHIFT_TYPES.has(shiftType))return fail("شیفت آگهی معتبر نیست.",400,"invalid_shift_type");
 if(sort&&!SORTS.has(sort))return fail("ترتیب نمایش آگهی معتبر نیست.",400,"invalid_job_ad_sort");
 if(applicants&&!APPLICANT_RANGES.has(applicants))return fail("فیلتر تعداد متقاضی معتبر نیست.",400,"invalid_applicant_range");
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
 const publicationDate="COALESCE(a.published_at,a.created_at)";
 const order=({newest:`${publicationDate} DESC,a.id DESC`,oldest:`${publicationDate} ASC,a.id ASC`,points_desc:"COALESCE(a.reward_points,a.contract_points,0) DESC,a.created_at DESC,a.id DESC",points_asc:"COALESCE(a.reward_points,a.contract_points,0) ASC,a.created_at DESC,a.id DESC"} as Record<string,string>)[sort]||`${publicationDate} DESC,a.id DESC`;
 const rows=await env.DB.prepare(`
  SELECT a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,u.full_name AS salesConsultantName,
   a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
   COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,a.description,a.status,a.published_at AS publishedAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
   a.recipient_condition AS recipientCondition,a.auto_contract_points AS autoContractPoints,a.points_mode AS pointsMode,a.points_basis_days AS pointsBasisDays,a.points_base_value AS pointsBaseValue,
   a.work_weekdays_json AS workWeekdaysJson,a.weekday_score_factor AS weekdayScoreFactor,
   (SELECT COUNT(*) FROM care_job_applications ap WHERE ap.ad_id=a.id) AS applicationCount,
   jc.id AS activeContractId,jc.application_id AS contractApplicationId,jc.caregiver_id AS contractCaregiverId,jc.started_at AS contractStartedAt,jc.scheduled_end_at AS contractEndsAt
  FROM care_job_ads a
  JOIN users u ON u.id=a.sales_consultant_user_id
  LEFT JOIN caregiver_job_contracts jc ON jc.id=(SELECT j2.id FROM caregiver_job_contracts j2 WHERE j2.ad_id=a.id AND j2.status='ACTIVE' ORDER BY j2.started_at DESC,j2.created_at DESC LIMIT 1)
  WHERE ${clauses.join(" AND ")}
  ORDER BY ${order}
  LIMIT 500`).bind(...binds).all<any>();
 const ads=(rows.results||[]).map((ad:any)=>({...ad,workWeekdays:(()=>{try{const parsed=JSON.parse(String(ad.workWeekdaysJson||"[]"));return Array.isArray(parsed)&&parsed.length?parsed:["SAT","SUN","MON","TUE","WED","THU"]}catch{return ["SAT","SUN","MON","TUE","WED","THU"]}})(),weekdayScoreFactor:Number(ad.weekdayScoreFactor||1),hasActiveContract:Boolean(ad.activeContractId),lifecycleStatus:ad.activeContractId?"CONTRACT":null,recipientConditionLabel:String(ad.contractType||"").toUpperCase()==="PATIENT"?"بیمار":undefined}));
 return json({data:{ads,filters:{sort,applicants:applicants||null,contractType:contractType||null,shiftType:shiftType||null,consultantId:consultantId||null}}},200,{"x-salamat-job-ad-list-source":"staff-filter-v14-applicant-date"});
}
