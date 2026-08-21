import {routeJobAds as routeJobAdsV2} from "./job-ads-v2";
import {contractPointsSummary,ensureJobAdsSchema} from "./job-ads-v1";
import {awardReferralContractBonusOnFirstInContract} from "./referral-rewards-v4";
import {type Env,fail,getUser,json,readBody} from "./lib";

let heavyWeightSchemaReady:Promise<void>|undefined;

const CONDITION_LABELS:Record<string,string>={
 "ELDERLY:HEALTHY":"سالم",
 "ELDERLY:WALKER":"واکری",
 "ELDERLY:DIAPER":"پوشکی",
 "ELDERLY:BEDPAN":"لگنی",
 "ELDERLY:GAVAGE":"گاواژ",
 "ELDERLY:PARKINSON":"پارکینسون",
 "ELDERLY:ALZHEIMER":"آلزایمر",
 "CHILD:MOTHER_ASSISTANT":"مادریار",
 "CHILD:CHILD_CARE":"کودکیار",
 "HOUSEKEEPING:HOUSEHOLD":"امور منزل",
};

function conditionLabel(contractType:unknown,condition:unknown){
 const key=`${String(contractType||"").toUpperCase()}:${String(condition||"").toUpperCase()}`;
 return CONDITION_LABELS[key]||((String(contractType||"").toUpperCase()==="PATIENT")?"بیمار":"");
}

async function ensureHeavyWeightSchema(env:Env){
 if(!heavyWeightSchemaReady)heavyWeightSchemaReady=(async()=>{
  await ensureJobAdsSchema(env);
  const columns=await env.DB.prepare("PRAGMA table_info(care_job_ads)").all<{name:string}>();
  if((columns.results||[]).some(row=>String(row.name||"")==="heavy_weight"))return;
  try{await env.DB.prepare("ALTER TABLE care_job_ads ADD COLUMN heavy_weight INTEGER NOT NULL DEFAULT 0").run()}
  catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!/duplicate column name:\s*heavy_weight/i.test(message))throw error;
  }
 })().catch(error=>{heavyWeightSchemaReady=undefined;throw error});
 return heavyWeightSchemaReady;
}

function normalizeCaregiverAd(ad:any){
 const myApplication=ad.myApplicationId?{
  id:String(ad.myApplicationId),
  status:String(ad.myApplicationStatus||""),
  appliedAt:ad.myApplicationAppliedAt||null,
 }:null;
 const {myApplicationId,myApplicationStatus,myApplicationAppliedAt,...base}=ad;
 return {
  ...base,
  contractPoints:Number(base.contractPoints||0),
  autoContractPoints:base.autoContractPoints==null?null:Number(base.autoContractPoints),
  pointsBasisDays:base.pointsBasisDays==null?null:Number(base.pointsBasisDays),
  pointsBaseValue:base.pointsBaseValue==null?null:Number(base.pointsBaseValue),
  recipientConditionLabel:conditionLabel(base.contractType,base.recipientCondition),
  heavyWeight:Number(base.heavyWeight||0)===1,
  applicationCount:Number(base.applicationCount||0),
  myApplication,
 };
}

async function caregiverListV3(request:Request,env:Env){
 const actor=await getUser(request,env);
 if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const url=new URL(request.url),q=String(url.searchParams.get("q")||"").trim(),like=`%${q}%`;
 const rows=await env.DB.prepare(`SELECT
  a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,
  u.full_name AS salesConsultantName,a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,
  a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
  COALESCE(a.reward_points,a.contract_points) AS contractPoints,a.description,a.status,
  a.published_at AS publishedAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
  a.recipient_condition AS recipientCondition,a.auto_contract_points AS autoContractPoints,
  a.points_mode AS pointsMode,a.points_basis_days AS pointsBasisDays,a.points_base_value AS pointsBaseValue,
  a.heavy_weight AS heavyWeight,
  (SELECT COUNT(*) FROM care_job_applications cnt WHERE cnt.ad_id=a.id) AS applicationCount,
  mine.id AS myApplicationId,mine.status AS myApplicationStatus,mine.applied_at AS myApplicationAppliedAt
  FROM care_job_ads a
  LEFT JOIN users u ON u.id=a.sales_consultant_user_id
  LEFT JOIN care_job_applications mine ON mine.ad_id=a.id AND mine.caregiver_id=?
  WHERE a.status='PUBLISHED' AND a.deleted_at IS NULL
    AND (?='' OR a.customer_full_name LIKE ? OR a.description LIKE ? OR u.full_name LIKE ? OR a.city LIKE ? OR a.region LIKE ?)
  ORDER BY a.published_at DESC,a.created_at DESC
  LIMIT 150`).bind(actor.caregiverId,q,like,like,like,like,like).all<any>();
 const ads=(rows.results||[]).map(normalizeCaregiverAd);
 return json({data:{ads,points:await contractPointsSummary(env,actor.caregiverId)}});
}

async function caregiverDetailV3(request:Request,env:Env,id:string){
 const actor=await getUser(request,env);
 if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const ad=await env.DB.prepare(`SELECT
  a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,
  u.full_name AS salesConsultantName,a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,
  a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
  COALESCE(a.reward_points,a.contract_points) AS contractPoints,a.description,a.status,
  a.published_at AS publishedAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
  a.recipient_condition AS recipientCondition,a.auto_contract_points AS autoContractPoints,
  a.points_mode AS pointsMode,a.points_basis_days AS pointsBasisDays,a.points_base_value AS pointsBaseValue,
  a.heavy_weight AS heavyWeight
  FROM care_job_ads a LEFT JOIN users u ON u.id=a.sales_consultant_user_id
  WHERE a.id=? AND a.status='PUBLISHED' AND a.deleted_at IS NULL LIMIT 1`).bind(id).first<any>();
 if(!ad)return fail("آگهی فعال پیدا نشد.",404,"job_ad_not_found");
 const myApplication=await env.DB.prepare("SELECT id,status,applied_at AS appliedAt FROM care_job_applications WHERE ad_id=? AND caregiver_id=? LIMIT 1").bind(id,actor.caregiverId).first<any>();
 const normalized={
  ...ad,
  contractPoints:Number(ad.contractPoints||0),
  autoContractPoints:ad.autoContractPoints==null?null:Number(ad.autoContractPoints),
  pointsBasisDays:ad.pointsBasisDays==null?null:Number(ad.pointsBasisDays),
  pointsBaseValue:ad.pointsBaseValue==null?null:Number(ad.pointsBaseValue),
  recipientConditionLabel:conditionLabel(ad.contractType,ad.recipientCondition),
  heavyWeight:Number(ad.heavyWeight||0)===1,
 };
 return json({data:{ad:normalized,myApplication:myApplication||null,points:await contractPointsSummary(env,actor.caregiverId)}});
}

export async function routeJobAdsV3(request:Request,env:Env):Promise<Response|null>{
 await ensureHeavyWeightSchema(env);
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname==="/api/caregiver/job-ads"&&method==="GET")return caregiverListV3(request,env);
 const caregiverDetailMatch=url.pathname.match(/^\/api\/caregiver\/job-ads\/([^/]+)$/);
 if(caregiverDetailMatch&&method==="GET")return caregiverDetailV3(request,env,decodeURIComponent(caregiverDetailMatch[1]));
 const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
 if(!match||method!=="PATCH")return routeJobAdsV2(request,env);
 const body=await readBody(request.clone());
 const next=String(body?.status||"").toUpperCase();
 const response=await routeJobAdsV2(request,env);
 if(!response||!response.ok||next!=="IN_CONTRACT")return response;
 const actor=await getUser(request,env);
 if(!actor)return response;
 const adId=decodeURIComponent(match[1]),applicationId=decodeURIComponent(match[2]);
 const application=await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM care_job_applications WHERE id=? AND ad_id=? LIMIT 1").bind(applicationId,adId).first<{caregiverId:string}>();
 if(application?.caregiverId){
  try{await awardReferralContractBonusOnFirstInContract(request,env,actor,application.caregiverId,applicationId,adId)}
  catch(error){console.error("referral_contract_bonus_reconciliation_required",{applicationId,adId,caregiverId:application.caregiverId,error:error instanceof Error?error.message:String(error)})}
 }
 return response;
}