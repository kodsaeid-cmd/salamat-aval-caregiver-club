import {requireAccess} from "./access-control";
import {contractPointsSummary,ensureJobAdsSchema,routeJobAds as routeJobAdsV1} from "./job-ads-v1";
import {ensureJobApplicationLifecycleSchema,lifecycleUpdateStatement} from "./job-application-lifecycle-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const CONTRACT_TYPES=new Set(["ELDERLY","CHILD","PATIENT","HOUSEKEEPING"]);
const SHIFT_TYPES=new Set(["DAY","NIGHT","LIVE_IN","TEMPORARY"]);
const APPLICATION_STATUSES=new Set(["PENDING_CONSULTANT","TRIAL_DISPATCH","REJECTED","IN_CONTRACT"]);

type ConditionRule={label:string;normal:number;temporary:number};
const RULES:Record<string,Record<string,ConditionRule>>={
 ELDERLY:{
  HEALTHY:{label:"سالم",normal:80,temporary:3},
  WALKER:{label:"واکری",normal:90,temporary:4},
  DIAPER:{label:"پوشکی",normal:130,temporary:8},
  BEDPAN:{label:"لگنی",normal:150,temporary:10},
  GAVAGE:{label:"گاواژ",normal:160,temporary:11},
  PARKINSON:{label:"پارکینسون",normal:170,temporary:12},
  ALZHEIMER:{label:"آلزایمر",normal:200,temporary:15},
 },
 CHILD:{
  MOTHER_ASSISTANT:{label:"مادریار",normal:120,temporary:7},
  CHILD_CARE:{label:"کودکیار",normal:140,temporary:9},
 },
 HOUSEKEEPING:{
  HOUSEHOLD:{label:"امور منزل",normal:110,temporary:6},
 },
};

const int=(value:unknown)=>Math.trunc(Number(value||0));
const isTrue=(value:unknown)=>value===true||String(value||"").toLowerCase()==="true"||String(value||"")==="1";
const isAdmin=(actor:AuthUser)=>actor.role.toUpperCase()==="ADMIN";
const cleanText=(value:unknown)=>str(value);

function automaticPoints(contractType:string,condition:string,shiftType:string,durationDays:number){
 const rule=RULES[contractType]?.[condition];
 if(!rule)return null;
 const temporary=shiftType==="TEMPORARY",basisDays=temporary?10:180,baseValue=temporary?rule.temporary:rule.normal;
 const points=Math.max(1,Math.round(baseValue*durationDays/basisDays));
 return {points,basisDays,baseValue,label:rule.label};
}

function validateBaseBody(body:any){
 const customerFullName=cleanText(body?.customerFullName),city=cleanText(body?.city),region=cleanText(body?.region),salesConsultantUserId=cleanText(body?.salesConsultantUserId),contractType=cleanText(body?.contractType).toUpperCase(),shiftType=cleanText(body?.shiftType).toUpperCase(),recipientCondition=cleanText(body?.recipientCondition).toUpperCase(),caregiverSalaryRial=Math.max(0,int(body?.caregiverSalaryRial)),durationDays=Math.max(0,int(body?.durationDays)),description=cleanText(body?.description);
 if(!customerFullName)return {error:"نام و نام خانوادگی مشترک الزامی است."};
 if(!city)return {error:"شهر آگهی الزامی است."};
 if(!region)return {error:"منطقه آگهی الزامی است."};
 if(!salesConsultantUserId)return {error:"مشاور پرونده را انتخاب کنید."};
 if(!CONTRACT_TYPES.has(contractType))return {error:"نوع قرارداد معتبر نیست."};
 if(!SHIFT_TYPES.has(shiftType))return {error:"شیفت خدمت معتبر نیست."};
 if(caregiverSalaryRial<=0)return {error:"حقوق ماهانه مراقب را به ریال وارد کنید."};
 if(durationDays<=0)return {error:"مدت قرارداد باید حداقل یک روز باشد."};
 if(description.length>3000)return {error:"شرح آگهی نمی‌تواند بیشتر از ۳۰۰۰ کاراکتر باشد."};
 if(contractType!=="PATIENT"&&!RULES[contractType]?.[recipientCondition])return {error:"شرایط خدمت‌گیرنده را متناسب با نوع قرارداد انتخاب کنید."};
 return {customerFullName,city,region,salesConsultantUserId,contractType,shiftType,recipientCondition,caregiverSalaryRial,durationDays,description};
}

function resolvePoints(actor:AuthUser,body:any,parsed:any){
 const automatic=automaticPoints(parsed.contractType,parsed.recipientCondition,parsed.shiftType,parsed.durationDays),special=isTrue(body?.specialPointsEnabled);
 if(special&&!isAdmin(actor))return {error:"ثبت امتیاز ویژه فقط در اختیار مدیر سامانه است.",status:403};
 if(!automatic&&!special)return {error:parsed.contractType==="PATIENT"?"برای قرارداد بیمار هنوز مبنای امتیاز خودکار تعریف نشده است؛ فقط مدیر سامانه می‌تواند امتیاز ویژه ثبت کند.":"مبنای امتیاز این آگهی معتبر نیست.",status:400};
 const specialPoints=int(body?.specialContractPoints);
 if(special&&(specialPoints<=0||specialPoints>100000))return {error:"امتیاز ویژه باید یک عدد صحیح مثبت باشد.",status:400};
 return {
  rewardPoints:special?specialPoints:Number(automatic?.points||0),
  autoContractPoints:automatic?.points??null,
  pointsMode:special?"SPECIAL":"AUTO",
  pointsBasisDays:automatic?.basisDays??null,
  pointsBaseValue:automatic?.baseValue??null,
  recipientConditionLabel:automatic?.label||"بیمار / امتیاز ویژه",
 };
}

async function consultantExists(env:Env,id:string){return env.DB.prepare("SELECT id FROM users WHERE id=? AND role='SALES_CONSULTANT' AND status='ACTIVE' LIMIT 1").bind(id).first<{id:string}>()}

async function createAd(request:Request,env:Env,actor:AuthUser){
 const denied=await requireAccess(env,actor,"staff.job_ads","create");if(denied)return denied;
 const body=await readBody(request),parsed=validateBaseBody(body);if("error" in parsed)return fail(String(parsed.error));
 const points=resolvePoints(actor,body,parsed);if("error" in points)return fail(String(points.error),Number(points.status||400),Number(points.status||400)===403?"forbidden":"job_ad_points_invalid");
 if(!await consultantExists(env,parsed.salesConsultantUserId))return fail("مشاور فروش انتخاب‌شده فعال نیست.",400,"consultant_invalid");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&parsed.salesConsultantUserId!==actor.id)return fail("مشاور فروش فقط می‌تواند آگهی خود را ایجاد کند.",403,"forbidden");
 const id=randomId("ad_"),ts=nowIso();
 await env.DB.prepare(`INSERT INTO care_job_ads(id,customer_full_name,city,region,sales_consultant_user_id,contract_type,shift_type,caregiver_salary_rial,duration_days,contract_points,description,status,created_by_user_id,created_at,updated_at,recipient_condition,auto_contract_points,reward_points,points_mode,points_basis_days,points_base_value) VALUES(?,?,?,?,?,?,?,?,?,20,?,'DRAFT',?,?,?,?,?,?,?,?,?)`).bind(id,parsed.customerFullName,parsed.city,parsed.region,parsed.salesConsultantUserId,parsed.contractType,parsed.shiftType,parsed.caregiverSalaryRial,parsed.durationDays,parsed.description,actor.id,ts,ts,parsed.recipientCondition||null,points.autoContractPoints,points.rewardPoints,points.pointsMode,points.pointsBasisDays,points.pointsBaseValue).run();
 await audit(request,env,actor,"CREATE_JOB_AD","care_job_ad",id,{...parsed,...points,specialOverride:points.pointsMode==="SPECIAL"});
 return json({data:{id,status:"DRAFT",contractPoints:points.rewardPoints,autoContractPoints:points.autoContractPoints,pointsMode:points.pointsMode}} ,201);
}

async function updateAd(request:Request,env:Env,actor:AuthUser,id:string){
 const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
 const current=await env.DB.prepare("SELECT sales_consultant_user_id AS consultantId,status FROM care_job_ads WHERE id=? LIMIT 1").bind(id).first<any>();
 if(!current)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&current.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(current.status!=="DRAFT")return fail("فقط آگهی در حال بررسی قابل ویرایش است.",409,"job_ad_locked");
 const body=await readBody(request),parsed=validateBaseBody(body);if("error" in parsed)return fail(String(parsed.error));
 const points=resolvePoints(actor,body,parsed);if("error" in points)return fail(String(points.error),Number(points.status||400),Number(points.status||400)===403?"forbidden":"job_ad_points_invalid");
 if(!await consultantExists(env,parsed.salesConsultantUserId))return fail("مشاور فروش انتخاب‌شده فعال نیست.",400,"consultant_invalid");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&parsed.salesConsultantUserId!==actor.id)return fail("مشاور فروش فقط می‌تواند آگهی خود را نگه دارد.",403,"forbidden");
 await env.DB.prepare(`UPDATE care_job_ads SET customer_full_name=?,city=?,region=?,sales_consultant_user_id=?,contract_type=?,shift_type=?,caregiver_salary_rial=?,duration_days=?,description=?,recipient_condition=?,auto_contract_points=?,reward_points=?,points_mode=?,points_basis_days=?,points_base_value=?,updated_at=? WHERE id=?`).bind(parsed.customerFullName,parsed.city,parsed.region,parsed.salesConsultantUserId,parsed.contractType,parsed.shiftType,parsed.caregiverSalaryRial,parsed.durationDays,parsed.description,parsed.recipientCondition||null,points.autoContractPoints,points.rewardPoints,points.pointsMode,points.pointsBasisDays,points.pointsBaseValue,nowIso(),id).run();
 await audit(request,env,actor,"UPDATE_JOB_AD","care_job_ad",id,{...parsed,...points,specialOverride:points.pointsMode==="SPECIAL"});
 return json({ok:true,data:{contractPoints:points.rewardPoints,autoContractPoints:points.autoContractPoints,pointsMode:points.pointsMode}});
}

async function updateApplication(request:Request,env:Env,actor:AuthUser,adId:string,applicationId:string){
 const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
 await ensureJobApplicationLifecycleSchema(env);
 const body=await readBody(request),next=cleanText(body?.status).toUpperCase();if(!APPLICATION_STATUSES.has(next))return fail("وضعیت درخواست معتبر نیست.");
 const row=await env.DB.prepare(`SELECT ap.id,ap.caregiver_id AS caregiverId,ap.ad_id AS adId,COALESCE(a.reward_points,a.contract_points) AS contractPoints,a.sales_consultant_user_id AS consultantId,a.status AS adStatus FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? AND ap.ad_id=? LIMIT 1`).bind(applicationId,adId).first<any>();
 if(!row)return fail("درخواست پیدا نشد.",404,"application_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&row.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(row.adStatus==="CLOSED"&&next!=="IN_CONTRACT")return fail("این آگهی منقضی شده و وضعیت متقاضیان آن دیگر قابل تغییر نیست.",409,"job_ad_expired");
 const ts=nowIso(),statements=[lifecycleUpdateStatement(env,applicationId,next,ts)];
 if(next==="IN_CONTRACT"){
  statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_contract_point_ledger(id,caregiver_id,ad_id,application_id,points,awarded_by_user_id,awarded_at) VALUES(?,?,?,?,?,?,?)`).bind(randomId("pt_"),row.caregiverId,row.adId,applicationId,Number(row.contractPoints||0),actor.id,ts));
  statements.push(env.DB.prepare("UPDATE care_job_ads SET status='CLOSED',updated_at=? WHERE id=?").bind(ts,adId));
 }
 await env.DB.batch(statements);await audit(request,env,actor,"UPDATE_JOB_APPLICATION_STATUS","care_job_application",applicationId,{adId,status:next,points:next==="IN_CONTRACT"?row.contractPoints:0,adExpired:next==="IN_CONTRACT"});
 return json({data:{status:next,adStatus:next==="IN_CONTRACT"?"CLOSED":row.adStatus,points:await contractPointsSummary(env,row.caregiverId)}});
}

async function metadata(env:Env,ids:string[]){
 if(!ids.length)return new Map<string,any>();
 const unique=[...new Set(ids)].slice(0,250),marks=unique.map(()=>"?").join(","),rows=await env.DB.prepare(`SELECT id,recipient_condition AS recipientCondition,auto_contract_points AS autoContractPoints,reward_points AS rewardPoints,points_mode AS pointsMode,points_basis_days AS pointsBasisDays,points_base_value AS pointsBaseValue FROM care_job_ads WHERE id IN (${marks})`).bind(...unique).all<any>();
 return new Map((rows.results||[]).map((row:any)=>[String(row.id),row]));
}

function conditionLabel(contractType:string,condition:string){return RULES[String(contractType||"").toUpperCase()]?.[String(condition||"").toUpperCase()]?.label||""}
function mergeAd(ad:any,meta:any){if(!ad||!meta)return ad;const reward=meta.rewardPoints==null?Number(ad.contractPoints||0):Number(meta.rewardPoints);return {...ad,contractPoints:reward,recipientCondition:meta.recipientCondition||null,recipientConditionLabel:conditionLabel(ad.contractType,meta.recipientCondition),autoContractPoints:meta.autoContractPoints==null?null:Number(meta.autoContractPoints),pointsMode:meta.pointsMode||"LEGACY",pointsBasisDays:meta.pointsBasisDays==null?null:Number(meta.pointsBasisDays),pointsBaseValue:meta.pointsBaseValue==null?null:Number(meta.pointsBaseValue)}}

async function enrichGetResponse(response:Response,env:Env){
 if(!response.ok)return response;const contentType=response.headers.get("content-type")||"";if(!contentType.includes("application/json"))return response;
 const payload:any=await response.json().catch(()=>null);if(!payload?.data)return response;
 const ids:string[]=[];if(Array.isArray(payload.data.ads))for(const ad of payload.data.ads)if(ad?.id)ids.push(String(ad.id));if(payload.data.ad?.id)ids.push(String(payload.data.ad.id));
 if(!ids.length)return json(payload,response.status);
 const meta=await metadata(env,ids);if(Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.map((ad:any)=>mergeAd(ad,meta.get(String(ad.id))));if(payload.data.ad?.id)payload.data.ad=mergeAd(payload.data.ad,meta.get(String(payload.data.ad.id)));
 return json(payload,response.status);
}

export async function routeJobAds(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(!url.pathname.startsWith("/api/staff/job-ads")&&!url.pathname.startsWith("/api/caregiver/job-ads")&&url.pathname!=="/api/caregiver/contract-points")return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));await ensureJobAdsSchema(env);
 if(url.pathname==="/api/staff/job-ads"&&method==="POST")return createAd(request,env,actor);
 let m=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);if(m&&method==="PATCH")return updateApplication(request,env,actor,decodeURIComponent(m[1]),decodeURIComponent(m[2]));
 m=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)$/);if(m&&method==="PATCH")return updateAd(request,env,actor,decodeURIComponent(m[1]));
 const delegated=await routeJobAdsV1(request,env);if(!delegated)return null;
 if(method==="GET"&&(url.pathname.startsWith("/api/staff/job-ads")||url.pathname.startsWith("/api/caregiver/job-ads")))return enrichGetResponse(delegated,env);
 return delegated;
}