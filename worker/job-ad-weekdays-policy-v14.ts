import {requireAccess} from "./access-control";
import {routeJobAdCaregiverVisibilityV1} from "./job-ad-caregiver-unity-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,str} from "./lib";
import {applyJobAdWeekdayScore,DEFAULT_JOB_AD_WEEKDAYS,jobAdWeekdayScoreFactor,jobAdWeekdaysOrDefault,normalizeJobAdWeekdays,serializeJobAdWeekdays} from "../shared/job-ad-weekday-policy-v1";

const CONTRACT_TYPES=new Set(["ELDERLY","CHILD","PATIENT","HOUSEKEEPING"]);
const SHIFT_TYPES=new Set(["DAY","NIGHT","LIVE_IN","TEMPORARY"]);
type Rule={label:string;normal:number;temporary:number};
const RULES:Record<string,Record<string,Rule>>={
 ELDERLY:{HEALTHY:{label:"سالم",normal:80,temporary:3},WALKER:{label:"واکری",normal:90,temporary:4},DIAPER:{label:"پوشکی",normal:130,temporary:8},BEDPAN:{label:"لگنی",normal:150,temporary:10},GAVAGE:{label:"گاواژ",normal:160,temporary:11},PARKINSON:{label:"پارکینسون",normal:170,temporary:12},ALZHEIMER:{label:"آلزایمر",normal:200,temporary:15}},
 CHILD:{MOTHER_ASSISTANT:{label:"مادریار",normal:120,temporary:7},CHILD_CARE:{label:"کودکیار",normal:140,temporary:9}},
 PATIENT:{PATIENT:{label:"بیمار",normal:130,temporary:130}},
 HOUSEKEEPING:{HOUSEHOLD:{label:"امور منزل",normal:110,temporary:6}},
};

const integer=(value:unknown)=>Math.trunc(Number(value||0));
const truthy=(value:unknown)=>value===true||String(value||"").toLowerCase()==="true"||String(value||"")==="1";
const isAdmin=(actor:AuthUser)=>actor.role.toUpperCase()==="ADMIN";
const hasOwn=(value:any,key:string)=>Boolean(value&&Object.prototype.hasOwnProperty.call(value,key));

function automaticPoints(contractType:string,condition:string,shiftType:string,durationDays:number,workWeekdays:string[]){
 const rule=RULES[contractType]?.[condition];if(!rule||durationDays<=0)return null;
 const patient=contractType==="PATIENT",temporary=!patient&&shiftType==="TEMPORARY";
 const basisDays=patient?180:(temporary?10:180),baseValue=patient?130:(temporary?rule.temporary:rule.normal);
 const unadjustedPoints=Math.max(1,Math.round(baseValue*durationDays/basisDays));
 const weekdayFactor=jobAdWeekdayScoreFactor(workWeekdays),points=applyJobAdWeekdayScore(unadjustedPoints,workWeekdays);
 return {points,unadjustedPoints,weekdayFactor,basisDays,baseValue,label:rule.label};
}

function parsedBody(body:any,fallbackWeekdays:unknown=DEFAULT_JOB_AD_WEEKDAYS){
 const contractType=str(body?.contractType).toUpperCase(),shiftType=str(body?.shiftType).toUpperCase();
 const recipientCondition=contractType==="PATIENT"?"PATIENT":str(body?.recipientCondition).toUpperCase();
 const requestedWeekdays=hasOwn(body,"workWeekdays")?normalizeJobAdWeekdays(body.workWeekdays):jobAdWeekdaysOrDefault(fallbackWeekdays);
 const out={customerFullName:str(body?.customerFullName),city:str(body?.city),region:str(body?.region),salesConsultantUserId:str(body?.salesConsultantUserId),contractType,shiftType,recipientCondition,caregiverSalaryRial:Math.max(0,integer(body?.caregiverSalaryRial)),durationDays:Math.max(0,integer(body?.durationDays)),description:str(body?.description),workWeekdays:requestedWeekdays};
 if(!out.customerFullName)return {error:"نام و نام خانوادگی مشترک الزامی است."};
 if(!out.city)return {error:"شهر آگهی الزامی است."};
 if(!out.region)return {error:"منطقه آگهی الزامی است."};
 if(!out.salesConsultantUserId)return {error:"مشاور پرونده را انتخاب کنید."};
 if(!CONTRACT_TYPES.has(out.contractType))return {error:"نوع قرارداد معتبر نیست."};
 if(!SHIFT_TYPES.has(out.shiftType))return {error:"شیفت خدمت معتبر نیست."};
 if(!RULES[out.contractType]?.[out.recipientCondition])return {error:"شرایط خدمت‌گیرنده را متناسب با نوع قرارداد انتخاب کنید."};
 if(out.caregiverSalaryRial<=0)return {error:"حقوق ماهانه مراقب را به ریال وارد کنید."};
 if(out.durationDays<=0)return {error:"مدت قرارداد باید حداقل یک روز باشد."};
 if(out.description.length>3000)return {error:"شرح آگهی نمی‌تواند بیشتر از ۳۰۰۰ کاراکتر باشد."};
 if(!out.workWeekdays.length)return {error:"حداقل یک روز کاری هفته را انتخاب کنید."};
 return out;
}

function resolvePoints(actor:AuthUser,body:any,parsed:any){
 const automatic=automaticPoints(parsed.contractType,parsed.recipientCondition,parsed.shiftType,parsed.durationDays,parsed.workWeekdays);if(!automatic)return {error:"مبنای امتیاز این آگهی معتبر نیست.",status:400};
 const special=truthy(body?.specialPointsEnabled);if(special&&!isAdmin(actor))return {error:"ثبت امتیاز ویژه فقط در اختیار مدیر سامانه است.",status:403};
 const specialPoints=integer(body?.specialContractPoints);if(special&&(specialPoints<=0||specialPoints>100000))return {error:"امتیاز ویژه باید یک عدد صحیح مثبت باشد.",status:400};
 return {rewardPoints:special?specialPoints:automatic.points,autoContractPoints:automatic.points,unadjustedAutoPoints:automatic.unadjustedPoints,pointsMode:special?"SPECIAL":"AUTO",pointsBasisDays:automatic.basisDays,pointsBaseValue:automatic.baseValue,weekdayScoreFactor:automatic.weekdayFactor,recipientConditionLabel:automatic.label};
}

async function consultantExists(env:Env,id:string){return env.DB.prepare("SELECT id FROM users WHERE id=? AND role='SALES_CONSULTANT' AND status='ACTIVE' LIMIT 1").bind(id).first<{id:string}>()}
async function activeContractForAd(env:Env,adId:string){return env.DB.prepare("SELECT id FROM caregiver_job_contracts WHERE ad_id=? AND status='ACTIVE' LIMIT 1").bind(adId).first<{id:string}>()}

async function createAd(request:Request,env:Env,actor:AuthUser){
 const denied=await requireAccess(env,actor,"staff.job_ads","create");if(denied)return denied;
 const body=await readBody(request),parsed:any=parsedBody(body);if("error" in parsed)return fail(String(parsed.error));
 const points:any=resolvePoints(actor,body,parsed);if("error" in points)return fail(String(points.error),Number(points.status||400),Number(points.status||400)===403?"forbidden":"job_ad_points_invalid");
 if(!await consultantExists(env,parsed.salesConsultantUserId))return fail("مشاور فروش انتخاب‌شده فعال نیست.",400,"consultant_invalid");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&parsed.salesConsultantUserId!==actor.id)return fail("مشاور فروش فقط می‌تواند آگهی خود را ایجاد کند.",403,"forbidden");
 const id=randomId("ad_"),ts=nowIso(),weekdaysJson=serializeJobAdWeekdays(parsed.workWeekdays);
 await env.DB.prepare(`INSERT INTO care_job_ads(id,customer_full_name,city,region,sales_consultant_user_id,contract_type,shift_type,caregiver_salary_rial,duration_days,contract_points,description,status,created_by_user_id,created_at,updated_at,recipient_condition,auto_contract_points,reward_points,points_mode,points_basis_days,points_base_value,deleted_at,deleted_by_user_id,work_weekdays_json,weekday_score_factor) VALUES(?,?,?,?,?,?,?,?,?,20,?,'DRAFT',?,?,?,?,?,?,?,?,?,NULL,NULL,?,?)`).bind(id,parsed.customerFullName,parsed.city,parsed.region,parsed.salesConsultantUserId,parsed.contractType,parsed.shiftType,parsed.caregiverSalaryRial,parsed.durationDays,parsed.description,actor.id,ts,ts,parsed.recipientCondition,points.autoContractPoints,points.rewardPoints,points.pointsMode,points.pointsBasisDays,points.pointsBaseValue,weekdaysJson,points.weekdayScoreFactor).run();
 await audit(request,env,actor,"CREATE_JOB_AD","care_job_ad",id,{...parsed,...points,workWeekdays:parsed.workWeekdays,mutationPolicy:"v14-weekdays"});
 return json({data:{id,status:"DRAFT",contractPoints:points.rewardPoints,autoContractPoints:points.autoContractPoints,unadjustedAutoPoints:points.unadjustedAutoPoints,pointsMode:points.pointsMode,recipientCondition:parsed.recipientCondition,recipientConditionLabel:points.recipientConditionLabel,pointsBasisDays:points.pointsBasisDays,pointsBaseValue:points.pointsBaseValue,workWeekdays:parsed.workWeekdays,weekdayScoreFactor:points.weekdayScoreFactor}},201,{"x-salamat-job-ad-mutation":"14.0.0"});
}

async function updateAd(request:Request,env:Env,actor:AuthUser,adId:string){
 const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
 const current=await env.DB.prepare("SELECT id,sales_consultant_user_id AS consultantId,status,work_weekdays_json AS workWeekdaysJson FROM care_job_ads WHERE id=? AND deleted_at IS NULL LIMIT 1").bind(adId).first<any>();
 if(!current)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&current.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(await activeContractForAd(env,adId))return fail("این آگهی قرارداد فعال دارد. ابتدا مراقب را از قرارداد خارج کنید.",409,"active_contract_blocks_edit");
 const body=await readBody(request),parsed:any=parsedBody(body,current.workWeekdaysJson);if("error" in parsed)return fail(String(parsed.error));
 const points:any=resolvePoints(actor,body,parsed);if("error" in points)return fail(String(points.error),Number(points.status||400),Number(points.status||400)===403?"forbidden":"job_ad_points_invalid");
 if(!await consultantExists(env,parsed.salesConsultantUserId))return fail("مشاور فروش انتخاب‌شده فعال نیست.",400,"consultant_invalid");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&parsed.salesConsultantUserId!==actor.id)return fail("مشاور فروش فقط می‌تواند آگهی خود را نگه دارد.",403,"forbidden");
 const nextStatus=current.status==="PUBLISHED"?"PUBLISHED":"DRAFT",ts=nowIso(),weekdaysJson=serializeJobAdWeekdays(parsed.workWeekdays);
 await env.DB.prepare(`UPDATE care_job_ads SET customer_full_name=?,city=?,region=?,sales_consultant_user_id=?,contract_type=?,shift_type=?,caregiver_salary_rial=?,duration_days=?,description=?,recipient_condition=?,auto_contract_points=?,reward_points=?,points_mode=?,points_basis_days=?,points_base_value=?,work_weekdays_json=?,weekday_score_factor=?,status=?,updated_at=? WHERE id=? AND deleted_at IS NULL`).bind(parsed.customerFullName,parsed.city,parsed.region,parsed.salesConsultantUserId,parsed.contractType,parsed.shiftType,parsed.caregiverSalaryRial,parsed.durationDays,parsed.description,parsed.recipientCondition,points.autoContractPoints,points.rewardPoints,points.pointsMode,points.pointsBasisDays,points.pointsBaseValue,weekdaysJson,points.weekdayScoreFactor,nextStatus,ts,adId).run();
 await audit(request,env,actor,"UPDATE_JOB_AD","care_job_ad",adId,{...parsed,...points,workWeekdays:parsed.workWeekdays,status:nextStatus,mutationPolicy:"v14-weekdays"});
 return json({data:{id:adId,status:nextStatus,contractPoints:points.rewardPoints,autoContractPoints:points.autoContractPoints,unadjustedAutoPoints:points.unadjustedAutoPoints,pointsMode:points.pointsMode,recipientCondition:parsed.recipientCondition,recipientConditionLabel:points.recipientConditionLabel,pointsBasisDays:points.pointsBasisDays,pointsBaseValue:points.pointsBaseValue,workWeekdays:parsed.workWeekdays,weekdayScoreFactor:points.weekdayScoreFactor}},200,{"x-salamat-job-ad-mutation":"14.0.0"});
}

async function detailWithWeekdays(request:Request,env:Env,adId:string){
 const response=await routeJobAdCaregiverVisibilityV1(request,env);if(!response||!response.ok)return response;
 const row=await env.DB.prepare("SELECT work_weekdays_json AS workWeekdaysJson,weekday_score_factor AS weekdayScoreFactor FROM care_job_ads WHERE id=? AND deleted_at IS NULL LIMIT 1").bind(adId).first<any>();
 if(!row)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data?.ad)return response;
 payload.data.ad={...payload.data.ad,workWeekdays:jobAdWeekdaysOrDefault(row.workWeekdaysJson),weekdayScoreFactor:Number(row.weekdayScoreFactor||1)};
 return json(payload,response.status,{"x-salamat-job-ad-weekdays":"1.0.0"});
}

export async function routeJobAdWeekdaysPolicyV14(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname,exactList=path==="/api/staff/job-ads",detail=path.match(/^\/api\/staff\/job-ads\/([^/]+)$/);
 if(exactList&&method==="POST"){
  const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");return createAd(request,env,actor);
 }
 if(detail&&method==="PATCH"){
  const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");return updateAd(request,env,actor,decodeURIComponent(detail[1]));
 }
 if(detail&&method==="GET")return detailWithWeekdays(request,env,decodeURIComponent(detail[1]));
 return null;
}
