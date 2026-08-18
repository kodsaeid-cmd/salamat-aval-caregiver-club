import {requireAccess} from "./access-control";
import {ensureJobAdsSchema} from "./job-ads-v1";
import {routeJobAdsV3} from "./job-ads-v3";
import {awardReferralContractBonusOnFirstInContract} from "./referral-rewards-v4";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,str} from "./lib";

const DAY_MS=86_400_000;
const POINT_SCALE=100;
const WITHDRAW_REASONS=new Set(["PERSONAL","CONDITIONS","SALARY","COMMUTE","MISMATCH","OTHER"]);
const STAFF_APPLICATION_STATUSES=new Set(["PENDING_CONSULTANT","TRIAL_DISPATCH","REJECTED","IN_CONTRACT"]);
let schemaReady:Promise<void>|undefined;

type ContractRow={
 id:string;caregiverId:string;adId:string;applicationId:string;startedAt:string;scheduledEndAt:string;durationDays:number;
 totalPointsUnits:number;earnedPointsUnits:number;lastReconciledDay:number;status:string;pointsModel:string;welcomeSeenAt:string|null;
 startedByUserId?:string|null;endedAt?:string|null;endReasonCode?:string|null;endReasonText?:string|null;
};

const round2=(value:number)=>Math.round(value*100)/100;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const unitsToPoints=(value:unknown)=>round2(Number(value||0)/POINT_SCALE);
const pointsToUnits=(value:unknown)=>Math.max(0,Math.round(Number(value||0)*POINT_SCALE));
const plusDays=(iso:string,days:number)=>new Date(Date.parse(iso)+Math.max(1,days)*DAY_MS).toISOString();

export async function ensureContractProgressSchema(env:Env){
 if(!schemaReady)schemaReady=(async()=>{
  await ensureJobAdsSchema(env);
  await env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_job_contracts(
    id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,ad_id TEXT NOT NULL,application_id TEXT NOT NULL UNIQUE,
    started_at TEXT NOT NULL,scheduled_end_at TEXT NOT NULL,duration_days INTEGER NOT NULL,
    total_points_units INTEGER NOT NULL,earned_points_units INTEGER NOT NULL DEFAULT 0,last_reconciled_day INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',points_model TEXT NOT NULL DEFAULT 'DAILY_V1',started_by_user_id TEXT,
    ended_at TEXT,ended_by_user_id TEXT,end_reason_code TEXT,end_reason_text TEXT,welcome_seen_at TEXT,
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
    FOREIGN KEY(ad_id) REFERENCES care_job_ads(id),FOREIGN KEY(application_id) REFERENCES care_job_applications(id),
    FOREIGN KEY(started_by_user_id) REFERENCES users(id),FOREIGN KEY(ended_by_user_id) REFERENCES users(id))`),
   env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_caregiver_one_active_job_contract ON caregiver_job_contracts(caregiver_id) WHERE status='ACTIVE'"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_job_contracts_status_end ON caregiver_job_contracts(status,scheduled_end_at)"),
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_contract_point_daily_ledger(
    id TEXT PRIMARY KEY,contract_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,ad_id TEXT NOT NULL,application_id TEXT NOT NULL,
    service_day INTEGER NOT NULL,points_units INTEGER NOT NULL,earned_at TEXT NOT NULL,UNIQUE(contract_id,service_day),
    FOREIGN KEY(contract_id) REFERENCES caregiver_job_contracts(id) ON DELETE CASCADE,
    FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
    FOREIGN KEY(ad_id) REFERENCES care_job_ads(id),FOREIGN KEY(application_id) REFERENCES care_job_applications(id))`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_daily_contract_points_caregiver ON caregiver_contract_point_daily_ledger(caregiver_id,earned_at DESC)"),
   env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_daily_contract_points_no_update BEFORE UPDATE ON caregiver_contract_point_daily_ledger BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: daily contract point ledger entries are immutable'); END`),
   env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_daily_contract_points_no_delete BEFORE DELETE ON caregiver_contract_point_daily_ledger BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: daily contract point ledger entries cannot be deleted'); END`),
  ]);
 })().catch(error=>{schemaReady=undefined;throw error});
 return schemaReady;
}

function contractSelect(){return `SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,started_at AS startedAt,
 scheduled_end_at AS scheduledEndAt,duration_days AS durationDays,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits,
 last_reconciled_day AS lastReconciledDay,status,points_model AS pointsModel,welcome_seen_at AS welcomeSeenAt,
 started_by_user_id AS startedByUserId,ended_at AS endedAt,end_reason_code AS endReasonCode,end_reason_text AS endReasonText
 FROM caregiver_job_contracts`}

async function activeContractRow(env:Env,caregiverId:string){
 return env.DB.prepare(`${contractSelect()} WHERE caregiver_id=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`).bind(caregiverId).first<ContractRow>();
}

async function bootstrapLegacyContract(env:Env,caregiverId:string){
 const existing=await activeContractRow(env,caregiverId);if(existing)return existing;
 const app=await env.DB.prepare(`SELECT ap.id AS applicationId,ap.ad_id AS adId,ap.updated_at AS startedAt,a.duration_days AS durationDays,
  COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,
  (SELECT l.points FROM caregiver_contract_point_ledger l WHERE l.application_id=ap.id LIMIT 1) AS legacyPoints
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
  WHERE ap.caregiver_id=? AND ap.status='IN_CONTRACT' ORDER BY ap.updated_at DESC LIMIT 1`).bind(caregiverId).first<any>();
 if(!app)return null;
 const ts=nowIso(),startedAt=String(app.startedAt||ts),durationDays=Math.max(1,Number(app.durationDays||1));
 const totalUnits=pointsToUnits(app.contractPoints),legacyAwarded=app.legacyPoints!=null;
 const id=randomId("jct_");
 try{
  await env.DB.prepare(`INSERT INTO caregiver_job_contracts(id,caregiver_id,ad_id,application_id,started_at,scheduled_end_at,duration_days,
   total_points_units,earned_points_units,last_reconciled_day,status,points_model,welcome_seen_at,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,0,'ACTIVE',?,?,?,?)`).bind(id,caregiverId,app.adId,app.applicationId,startedAt,plusDays(startedAt,durationDays),durationDays,
    totalUnits,legacyAwarded?pointsToUnits(app.legacyPoints):0,legacyAwarded?"LEGACY_PREPAID":"DAILY_V1",legacyAwarded?ts:null,ts,ts).run();
 }catch{
  return activeContractRow(env,caregiverId);
 }
 return activeContractRow(env,caregiverId);
}

async function findActiveContract(env:Env,caregiverId:string,bootstrap=true){
 await ensureContractProgressSchema(env);
 return await activeContractRow(env,caregiverId)||(bootstrap?bootstrapLegacyContract(env,caregiverId):null);
}

function elapsedDays(row:ContractRow,at=Date.now()){
 const started=Date.parse(row.startedAt);if(!Number.isFinite(started))return 0;
 return clamp(Math.floor(Math.max(0,at-started)/DAY_MS),0,Math.max(1,Number(row.durationDays||1)));
}

function dayTargetUnits(row:ContractRow,day:number){
 const duration=Math.max(1,Number(row.durationDays||1)),safeDay=clamp(Math.trunc(day),0,duration),total=Math.max(0,Number(row.totalPointsUnits||0));
 return safeDay>=duration?total:Math.floor(total*safeDay/duration);
}

async function reconcileRow(env:Env,row:ContractRow,at=Date.now()):Promise<ContractRow>{
 if(row.status!=="ACTIVE")return row;
 const duration=Math.max(1,Number(row.durationDays||1)),completed=elapsedDays(row,at),ts=new Date(at).toISOString();
 if(row.pointsModel==="LEGACY_PREPAID"){
  const complete=completed>=duration;
  if(complete){
   await env.DB.batch([
    env.DB.prepare("UPDATE caregiver_job_contracts SET status='COMPLETED',last_reconciled_day=?,ended_at=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(duration,ts,ts,row.id),
    env.DB.prepare("UPDATE care_job_applications SET status='COMPLETED',updated_at=? WHERE id=? AND status='IN_CONTRACT'").bind(ts,row.applicationId),
   ]);
  }else if(completed>Number(row.lastReconciledDay||0))await env.DB.prepare("UPDATE caregiver_job_contracts SET last_reconciled_day=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(completed,ts,row.id).run();
  return (await env.DB.prepare(`${contractSelect()} WHERE id=? LIMIT 1`).bind(row.id).first<ContractRow>())||row;
 }
 const from=Math.max(1,Number(row.lastReconciledDay||0)+1),statements:any[]=[];
 for(let day=from;day<=completed;day++){
  const delta=Math.max(0,dayTargetUnits(row,day)-dayTargetUnits(row,day-1));
  statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_contract_point_daily_ledger(id,contract_id,caregiver_id,ad_id,application_id,service_day,points_units,earned_at)
   VALUES(?,?,?,?,?,?,?,?)`).bind(randomId("dpt_"),row.id,row.caregiverId,row.adId,row.applicationId,day,delta,ts));
 }
 if(statements.length)await env.DB.batch(statements);
 const sum=await env.DB.prepare("SELECT COALESCE(SUM(points_units),0) AS units FROM caregiver_contract_point_daily_ledger WHERE contract_id=?").bind(row.id).first<{units:number}>();
 const earned=Math.min(Number(row.totalPointsUnits||0),Number(sum?.units||0)),complete=completed>=duration;
 if(complete){
  await env.DB.batch([
   env.DB.prepare("UPDATE caregiver_job_contracts SET earned_points_units=?,last_reconciled_day=?,status='COMPLETED',ended_at=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(Number(row.totalPointsUnits||earned),duration,ts,ts,row.id),
   env.DB.prepare("UPDATE care_job_applications SET status='COMPLETED',updated_at=? WHERE id=? AND status='IN_CONTRACT'").bind(ts,row.applicationId),
  ]);
 }else await env.DB.prepare("UPDATE caregiver_job_contracts SET earned_points_units=?,last_reconciled_day=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(earned,completed,ts,row.id).run();
 return (await env.DB.prepare(`${contractSelect()} WHERE id=? LIMIT 1`).bind(row.id).first<ContractRow>())||{...row,earnedPointsUnits:earned,lastReconciledDay:completed};
}

async function adForContract(env:Env,row:ContractRow){
 return env.DB.prepare(`SELECT a.id,a.customer_full_name AS customerFullName,a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,
  a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,
  a.description,a.recipient_condition AS recipientCondition,a.points_mode AS pointsMode,u.full_name AS salesConsultantName
  FROM care_job_ads a LEFT JOIN users u ON u.id=a.sales_consultant_user_id WHERE a.id=? LIMIT 1`).bind(row.adId).first<any>();
}

function conditionLabel(contractType:unknown,condition:unknown){
 const key=`${String(contractType||"").toUpperCase()}:${String(condition||"").toUpperCase()}`;
 return ({"ELDERLY:HEALTHY":"سالم","ELDERLY:WALKER":"واکری","ELDERLY:DIAPER":"پوشکی","ELDERLY:BEDPAN":"لگنی","ELDERLY:GAVAGE":"گاواژ","ELDERLY:PARKINSON":"پارکینسون","ELDERLY:ALZHEIMER":"آلزایمر","CHILD:MOTHER_ASSISTANT":"مادریار","CHILD:CHILD_CARE":"کودکیار","HOUSEKEEPING:HOUSEHOLD":"امور منزل"} as Record<string,string>)[key]||"";
}

async function presentContract(env:Env,row:ContractRow){
 const ad=await adForContract(env,row),duration=Math.max(1,Number(row.durationDays||1)),started=Date.parse(row.startedAt),now=Date.now();
 const elapsedMs=Number.isFinite(started)?Math.max(0,now-started):0,completed=clamp(Math.floor(elapsedMs/DAY_MS),0,duration);
 const currentDay=completed>=duration?duration:completed+1,partial=completed>=duration?1:clamp((elapsedMs-completed*DAY_MS)/DAY_MS,0,1);
 const earned=unitsToPoints(row.earnedPointsUnits),total=unitsToPoints(row.totalPointsUnits),nextDelta=completed>=duration?0:unitsToPoints(dayTargetUnits(row,completed+1)-dayTargetUnits(row,completed));
 const totalElapsed=clamp((completed+partial)/duration,0,1);
 return {
  id:row.id,adId:row.adId,applicationId:row.applicationId,status:row.status,pointsModel:row.pointsModel,
  startedAt:row.startedAt,scheduledEndAt:row.scheduledEndAt,durationDays:duration,completedDays:completed,currentDay,
  remainingDays:Math.max(0,duration-completed),totalPoints:total,earnedPoints:earned,remainingPoints:round2(Math.max(0,total-earned)),
  earnedProgressPercent:total>0?round2(clamp(earned/total*100,0,100)):0,contractProgressPercent:round2(totalElapsed*100),todayProgressPercent:round2(partial*100),
  todayPotentialPoints:nextDelta,nextAwardAt:completed>=duration?null:new Date((Number.isFinite(started)?started:now)+(completed+1)*DAY_MS).toISOString(),
  welcomePending:row.status==="ACTIVE"&&row.pointsModel==="DAILY_V1"&&!row.welcomeSeenAt,
  ad:ad?{...ad,recipientConditionLabel:conditionLabel(ad.contractType,ad.recipientCondition),contractPoints:total}:null,
 };
}

export async function contractProgressPointsSummary(env:Env,caregiverId:string){
 await ensureContractProgressSchema(env);
 const [legacy,daily]=await Promise.all([
  env.DB.prepare("SELECT COALESCE(SUM(points),0) AS points,COUNT(*) AS contracts FROM caregiver_contract_point_ledger WHERE caregiver_id=?").bind(caregiverId).first<{points:number;contracts:number}>(),
  env.DB.prepare("SELECT COALESCE(SUM(points_units),0) AS units,COUNT(DISTINCT contract_id) AS contracts FROM caregiver_contract_point_daily_ledger WHERE caregiver_id=?").bind(caregiverId).first<{units:number;contracts:number}>(),
 ]);
 const totalPoints=round2(Number(legacy?.points||0)+unitsToPoints(daily?.units||0)),thresholds=[200,400,600,800],nextThreshold=thresholds.find(x=>totalPoints<x)||800;
 return {totalPoints,awardedContracts:Number(legacy?.contracts||0)+Number(daily?.contracts||0),legacyPoints:round2(Number(legacy?.points||0)),dailyEarnedPoints:unitsToPoints(daily?.units||0),nextThreshold,remainingToNext:round2(Math.max(0,nextThreshold-totalPoints)),maxThreshold:800,progressPercent:round2(Math.min(100,totalPoints/800*100))};
}

async function reconciledActive(env:Env,caregiverId:string){
 const row=await findActiveContract(env,caregiverId,true);if(!row)return null;
 const reconciled=await reconcileRow(env,row);
 return reconciled.status==="ACTIVE"?reconciled:null;
}

async function startContract(request:Request,env:Env,actor:AuthUser,adId:string,applicationId:string){
 const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
 const row=await env.DB.prepare(`SELECT ap.id,ap.caregiver_id AS caregiverId,ap.status AS applicationStatus,ap.ad_id AS adId,
  a.status AS adStatus,a.sales_consultant_user_id AS consultantId,a.duration_days AS durationDays,COALESCE(a.reward_points,a.contract_points,0) AS contractPoints
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? AND ap.ad_id=? LIMIT 1`).bind(applicationId,adId).first<any>();
 if(!row)return fail("درخواست پیدا نشد.",404,"application_not_found");
 if(actor.role.toUpperCase()==="SALES_CONSULTANT"&&row.consultantId!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 if(row.applicationStatus==="IN_CONTRACT"){
  const active=await findActiveContract(env,row.caregiverId,true);
  if(active?.applicationId===applicationId)return json({data:{status:"IN_CONTRACT",adStatus:"CLOSED",activeContract:await presentContract(env,await reconcileRow(env,active)),points:await contractProgressPointsSummary(env,row.caregiverId)}});
 }
 const other=await reconciledActive(env,row.caregiverId);if(other&&other.applicationId!==applicationId)return fail("این مراقب هم‌اکنون در یک قرارداد فعال است و تا پایان یا انصراف از آن نمی‌تواند وارد قرارداد دیگری شود.",409,"caregiver_already_in_contract");
 if(row.adStatus==="CLOSED")return fail("این آگهی بسته شده است.",409,"job_ad_expired");
 const ts=nowIso(),duration=Math.max(1,Number(row.durationDays||1)),contractId=randomId("jct_"),totalUnits=pointsToUnits(row.contractPoints);
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregiver_job_contracts(id,caregiver_id,ad_id,application_id,started_at,scheduled_end_at,duration_days,total_points_units,earned_points_units,last_reconciled_day,status,points_model,started_by_user_id,welcome_seen_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,0,0,'ACTIVE','DAILY_V1',?,NULL,?,?)`).bind(contractId,row.caregiverId,adId,applicationId,ts,plusDays(ts,duration),duration,totalUnits,actor.id,ts,ts),
   env.DB.prepare("UPDATE care_job_applications SET status='IN_CONTRACT',updated_at=? WHERE id=?").bind(ts,applicationId),
   env.DB.prepare("UPDATE care_job_ads SET status='CLOSED',updated_at=? WHERE id=?").bind(ts,adId),
  ]);
 }catch(error:any){
  if(String(error?.message||error).includes("UNIQUE"))return fail("این مراقب هم‌اکنون در یک قرارداد فعال است.",409,"caregiver_already_in_contract");
  throw error;
 }
 await audit(request,env,actor,"START_JOB_CONTRACT","caregiver_job_contract",contractId,{adId,applicationId,caregiverId:row.caregiverId,durationDays:duration,totalPoints:unitsToPoints(totalUnits),pointsModel:"DAILY_V1"});
 try{await awardReferralContractBonusOnFirstInContract(request,env,actor,row.caregiverId,applicationId,adId)}catch(error){console.error("referral_contract_bonus_reconciliation_required",{applicationId,adId,caregiverId:row.caregiverId,error:error instanceof Error?error.message:String(error)})}
 const active=await activeContractRow(env,row.caregiverId);
 return json({data:{status:"IN_CONTRACT",adStatus:"CLOSED",activeContract:active?await presentContract(env,active):null,points:await contractProgressPointsSummary(env,row.caregiverId)}});
}

async function endActiveContract(request:Request,env:Env,actor:AuthUser,row:ContractRow,nextApplicationStatus:string,reasonCode:string,reasonText:string){
 const reconciled=await reconcileRow(env,row);if(reconciled.status!=="ACTIVE")return reconciled;
 const ts=nowIso();
 await env.DB.batch([
  env.DB.prepare("UPDATE caregiver_job_contracts SET status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code=?,end_reason_text=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(ts,actor.id,reasonCode,reasonText||null,ts,row.id),
  env.DB.prepare("UPDATE care_job_applications SET status=?,updated_at=? WHERE id=?").bind(nextApplicationStatus,ts,row.applicationId),
  env.DB.prepare("UPDATE care_job_ads SET status='DRAFT',updated_at=? WHERE id=?").bind(ts,row.adId),
 ]);
 await audit(request,env,actor,"END_JOB_CONTRACT_EARLY","caregiver_job_contract",row.id,{applicationStatus:nextApplicationStatus,reasonCode,reasonText,earnedPoints:unitsToPoints(reconciled.earnedPointsUnits),futurePointsStopped:true});
 return {...reconciled,status:"ENDED_EARLY",endedAt:ts,endReasonCode:reasonCode,endReasonText:reasonText};
}

async function staffApplicationPatch(request:Request,env:Env,actor:AuthUser,adId:string,applicationId:string){
 const body=await readBody(request.clone()),next=str(body?.status).toUpperCase();
 if(!STAFF_APPLICATION_STATUSES.has(next))return routeJobAdsV3(request,env);
 if(next==="IN_CONTRACT")return startContract(request,env,actor,adId,applicationId);
 const app=await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM care_job_applications WHERE id=? AND ad_id=? LIMIT 1").bind(applicationId,adId).first<{caregiverId:string}>();
 if(app){
  const active=await reconciledActive(env,app.caregiverId);
  if(active?.applicationId===applicationId){
   const denied=await requireAccess(env,actor,"staff.job_ads","update");if(denied)return denied;
   await endActiveContract(request,env,actor,active,next,"STAFF_STATUS_CHANGE",str(body?.reason));
   return json({data:{status:next,adStatus:"DRAFT",points:await contractProgressPointsSummary(env,app.caregiverId)}});
  }
 }
 return routeJobAdsV3(request,env);
}

async function caregiverActive(env:Env,actor:AuthUser){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const active=await reconciledActive(env,actor.caregiverId),points=await contractProgressPointsSummary(env,actor.caregiverId);
 return json({data:{activeContract:active?await presentContract(env,active):null,welcomePending:Boolean(active&&active.pointsModel==="DAILY_V1"&&!active.welcomeSeenAt),points}});
}

async function welcomeSeen(env:Env,actor:AuthUser,contractId:string){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const ts=nowIso(),result=await env.DB.prepare("UPDATE caregiver_job_contracts SET welcome_seen_at=COALESCE(welcome_seen_at,?),updated_at=? WHERE id=? AND caregiver_id=?").bind(ts,ts,contractId,actor.caregiverId).run();
 if(!Number(result.meta?.changes||0))return fail("قرارداد پیدا نشد.",404,"contract_not_found");
 return json({data:{id:contractId,welcomeSeenAt:ts}});
}

async function withdraw(request:Request,env:Env,actor:AuthUser,contractId:string){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const body=await readBody(request),confirmed=body?.confirmed===true,reasonCode=str(body?.reasonCode).toUpperCase(),reasonText=str(body?.reasonText).slice(0,500);
 if(!confirmed)return fail("برای انصراف قطعی، تأیید نهایی الزامی است.",400,"withdraw_confirmation_required");
 if(!WITHDRAW_REASONS.has(reasonCode))return fail("علت انصراف را انتخاب کنید.",400,"withdraw_reason_required");
 const row=await env.DB.prepare(`${contractSelect()} WHERE id=? AND caregiver_id=? AND status='ACTIVE' LIMIT 1`).bind(contractId,actor.caregiverId).first<ContractRow>();
 if(!row)return fail("قرارداد فعال پیدا نشد.",404,"active_contract_not_found");
 const ended=await endActiveContract(request,env,actor,row,"WITHDRAWN",reasonCode,reasonText);
 return json({data:{status:ended.status,earnedPoints:unitsToPoints(ended.earnedPointsUnits),futurePointsStopped:true,bankUnlocked:true,points:await contractProgressPointsSummary(env,actor.caregiverId)}});
}

async function caregiverJobList(request:Request,env:Env,actor:AuthUser){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const active=await reconciledActive(env,actor.caregiverId),points=await contractProgressPointsSummary(env,actor.caregiverId);
 if(active)return json({data:{ads:[],activeContract:await presentContract(env,active),locked:true,points}});
 const response=await routeJobAdsV3(request,env);if(!response||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 payload.data.points=points;payload.data.activeContract=null;payload.data.locked=false;
 return json(payload,response.status);
}

async function caregiverJobDetail(request:Request,env:Env,actor:AuthUser,adId:string){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const active=await reconciledActive(env,actor.caregiverId);
 if(!active)return routeJobAdsV3(request,env);
 if(active.adId!==adId)return fail("تا زمانی که در قرارداد فعال هستید، آگهی دیگری برای شما قابل مشاهده یا انتخاب نیست.",409,"job_bank_locked_by_active_contract");
 const presented=await presentContract(env,active);
 return json({data:{ad:presented.ad,myApplication:{id:active.applicationId,status:"IN_CONTRACT",appliedAt:active.startedAt},activeContract:presented}});
}

async function caregiverApply(request:Request,env:Env,actor:AuthUser){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 const active=await reconciledActive(env,actor.caregiverId);
 if(active)return fail("شما هم‌اکنون در یک قرارداد فعال هستید؛ تا پایان یا انصراف از آن امکان ثبت درخواست برای شغل یا ورود به قرارداد دیگری وجود ندارد.",409,"job_bank_locked_by_active_contract");
 return routeJobAdsV3(request,env);
}

export async function reconcileAllActiveContracts(env:Env){
 await ensureContractProgressSchema(env);
 const rows=await env.DB.prepare(`${contractSelect()} WHERE status='ACTIVE' ORDER BY scheduled_end_at`).all<ContractRow>();
 let reconciled=0,completed=0,failed=0;
 for(const row of rows.results||[]){
  try{const next=await reconcileRow(env,row);reconciled++;if(next.status==="COMPLETED")completed++}catch(error){failed++;console.error("contract_progress_reconcile_failed",{contractId:row.id,error:error instanceof Error?error.message:String(error)})}
 }
 return {reconciled,completed,failed};
}

export async function routeContractProgressEngine(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 const relevant=path.startsWith("/api/caregiver/job-ads")||path.startsWith("/api/caregiver/contracts")||path==="/api/caregiver/contract-points"||path.startsWith("/api/staff/job-ads");
 if(!relevant)return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 await ensureContractProgressSchema(env);
 if(path==="/api/caregiver/contracts/active"&&method==="GET")return caregiverActive(env,actor);
 let m=path.match(/^\/api\/caregiver\/contracts\/([^/]+)\/welcome-seen$/);if(m&&method==="POST")return welcomeSeen(env,actor,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/caregiver\/contracts\/([^/]+)\/withdraw$/);if(m&&method==="POST")return withdraw(request,env,actor,decodeURIComponent(m[1]));
 if(path==="/api/caregiver/contract-points"&&method==="GET"){
  if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
  await reconciledActive(env,actor.caregiverId);return json({data:await contractProgressPointsSummary(env,actor.caregiverId)});
 }
 if(path==="/api/caregiver/job-ads"&&method==="GET")return caregiverJobList(request,env,actor);
 m=path.match(/^\/api\/caregiver\/job-ads\/([^/]+)\/apply$/);if(m&&method==="POST")return caregiverApply(request,env,actor);
 m=path.match(/^\/api\/caregiver\/job-ads\/([^/]+)$/);if(m&&method==="GET")return caregiverJobDetail(request,env,actor,decodeURIComponent(m[1]));
 m=path.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);if(m&&method==="PATCH")return staffApplicationPatch(request,env,actor,decodeURIComponent(m[1]),decodeURIComponent(m[2]));
 return routeJobAdsV3(request,env);
}
