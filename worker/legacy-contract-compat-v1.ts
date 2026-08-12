import {ensureContractProgressSchema,reconcileAllActiveContracts} from "./contract-progress-engine-v1";
import {type Env,nowIso,randomId} from "./lib";

const DAY_MS=86_400_000;
const POINT_SCALE=100;

type CompatContract={
 id:string;caregiverId:string;adId:string;applicationId:string;startedAt:string;scheduledEndAt:string;
 durationDays:number;totalPointsUnits:number;earnedPointsUnits:number;lastReconciledDay:number;status:string;pointsModel:string;
};

const pointsToUnits=(value:unknown)=>Math.max(0,Math.round(Number(value||0)*POINT_SCALE));
const plusDays=(iso:string,days:number)=>new Date(Date.parse(iso)+Math.max(1,days)*DAY_MS).toISOString();
const contractSelect=()=>`SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,started_at AS startedAt,
 scheduled_end_at AS scheduledEndAt,duration_days AS durationDays,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits,
 last_reconciled_day AS lastReconciledDay,status,points_model AS pointsModel FROM caregiver_job_contracts`;

async function activeByAd(env:Env,adId:string){return env.DB.prepare(`${contractSelect()} WHERE ad_id=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`).bind(adId).first<CompatContract>()}
async function byApplication(env:Env,applicationId:string){return env.DB.prepare(`${contractSelect()} WHERE application_id=? LIMIT 1`).bind(applicationId).first<CompatContract>()}
async function activeByCaregiver(env:Env,caregiverId:string){return env.DB.prepare(`${contractSelect()} WHERE caregiver_id=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`).bind(caregiverId).first<CompatContract>()}

async function legacySourceForAd(env:Env,adId:string){
 return env.DB.prepare(`SELECT ap.id AS applicationId,ap.caregiver_id AS caregiverId,ap.ad_id AS adId,ap.updated_at AS startedAt,
  a.duration_days AS durationDays,COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,
  (SELECT l.points FROM caregiver_contract_point_ledger l WHERE l.application_id=ap.id LIMIT 1) AS legacyPoints
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
  WHERE ap.ad_id=? AND ap.status='IN_CONTRACT' ORDER BY ap.updated_at DESC LIMIT 1`).bind(adId).first<any>();
}

/**
 * Converts a pre-progress-engine IN_CONTRACT application into the canonical contract row.
 * Existing immutable full-award ledgers stay LEGACY_PREPAID so points can never be doubled.
 * Legacy rows without a prepaid ledger enter DAILY_V1 and accrue from the historical
 * IN_CONTRACT timestamp using the ad's allocated reward_points (fallback contract_points).
 */
export async function ensureLegacyActiveContractForAd(env:Env,adId:string){
 await ensureContractProgressSchema(env);
 const existing=await activeByAd(env,adId);if(existing)return existing;
 const source=await legacySourceForAd(env,adId);if(!source)return null;
 const existingApplication=await byApplication(env,String(source.applicationId));
 if(existingApplication)return existingApplication.status==="ACTIVE"?existingApplication:null;
 const otherActive=await activeByCaregiver(env,String(source.caregiverId));
 if(otherActive){
  if(otherActive.adId===adId)return otherActive;
  console.warn("legacy_contract_backfill_skipped_active_conflict",{adId,applicationId:source.applicationId,caregiverId:source.caregiverId,activeContractId:otherActive.id,activeAdId:otherActive.adId});
  return null;
 }
 const ts=nowIso(),parsedStart=Date.parse(String(source.startedAt||"")),startedAt=Number.isFinite(parsedStart)?new Date(parsedStart).toISOString():ts;
 const durationDays=Math.max(1,Math.trunc(Number(source.durationDays||1))),legacyAwarded=source.legacyPoints!=null;
 const allocatedUnits=pointsToUnits(source.contractPoints),legacyUnits=legacyAwarded?pointsToUnits(source.legacyPoints):0,totalUnits=Math.max(allocatedUnits,legacyUnits),id=randomId("jct_");
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregiver_job_contracts(id,caregiver_id,ad_id,application_id,started_at,scheduled_end_at,duration_days,total_points_units,earned_points_units,last_reconciled_day,status,points_model,started_by_user_id,welcome_seen_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,0,'ACTIVE',?,NULL,?,?,?)`).bind(id,source.caregiverId,adId,source.applicationId,startedAt,plusDays(startedAt,durationDays),durationDays,totalUnits,legacyUnits,legacyAwarded?"LEGACY_PREPAID":"DAILY_V1",legacyAwarded?ts:null,ts,ts),
   env.DB.prepare("UPDATE care_job_ads SET status='CLOSED' WHERE id=? AND status<>'DELETED'").bind(adId),
  ]);
 }catch(error:any){
  const raced=await byApplication(env,String(source.applicationId))||await activeByAd(env,adId);
  if(raced)return raced.status==="ACTIVE"?raced:null;
  console.error("legacy_contract_backfill_failed",{adId,applicationId:source.applicationId,caregiverId:source.caregiverId,error:error instanceof Error?error.message:String(error)});
  throw error;
 }
 return activeByAd(env,adId);
}

function elapsedDays(row:CompatContract,at=Date.now()){
 const started=Date.parse(row.startedAt);if(!Number.isFinite(started))return 0;
 return Math.max(0,Math.min(Math.max(1,Number(row.durationDays||1)),Math.floor(Math.max(0,at-started)/DAY_MS)));
}
function targetUnits(row:CompatContract,day:number){
 const duration=Math.max(1,Number(row.durationDays||1)),safe=Math.max(0,Math.min(duration,Math.trunc(day))),total=Math.max(0,Number(row.totalPointsUnits||0));
 return safe>=duration?total:Math.floor(total*safe/duration);
}

/** Accrue earned points up to this instant without auto-closing the contract. */
export async function accrueContractPointsForStaffExit(env:Env,row:CompatContract){
 if(row.status!=="ACTIVE")return row;
 const completed=elapsedDays(row),ts=nowIso();
 if(row.pointsModel==="LEGACY_PREPAID"){
  if(completed>Number(row.lastReconciledDay||0))await env.DB.prepare("UPDATE caregiver_job_contracts SET last_reconciled_day=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(completed,ts,row.id).run();
  return (await activeByAd(env,row.adId))||row;
 }
 const from=Math.max(1,Number(row.lastReconciledDay||0)+1),statements:any[]=[];
 for(let day=from;day<=completed;day++){
  const delta=Math.max(0,targetUnits(row,day)-targetUnits(row,day-1));
  statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_contract_point_daily_ledger(id,contract_id,caregiver_id,ad_id,application_id,service_day,points_units,earned_at)
   VALUES(?,?,?,?,?,?,?,?)`).bind(randomId("dpt_"),row.id,row.caregiverId,row.adId,row.applicationId,day,delta,ts));
 }
 if(statements.length)await env.DB.batch(statements);
 const sum=await env.DB.prepare("SELECT COALESCE(SUM(points_units),0) AS units FROM caregiver_contract_point_daily_ledger WHERE contract_id=?").bind(row.id).first<{units:number}>();
 const earned=Math.min(Number(row.totalPointsUnits||0),Number(sum?.units||0));
 await env.DB.prepare("UPDATE caregiver_job_contracts SET earned_points_units=?,last_reconciled_day=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(earned,Math.max(completed,Number(row.lastReconciledDay||0)),ts,row.id).run();
 return (await activeByAd(env,row.adId))||{...row,earnedPointsUnits:earned,lastReconciledDay:completed};
}

export async function prepareContractForStaffExit(env:Env,adId:string){
 const row=await ensureLegacyActiveContractForAd(env,adId);if(!row)return null;
 return accrueContractPointsForStaffExit(env,row);
}

/** Scheduled, idempotent catch-up for all still-open contracts created before the progress engine. */
export async function reconcileLegacyOpenContracts(env:Env){
 await ensureContractProgressSchema(env);
 const rows=await env.DB.prepare(`SELECT ap.ad_id AS adId FROM care_job_applications ap
  LEFT JOIN caregiver_job_contracts jc ON jc.application_id=ap.id
  WHERE ap.status='IN_CONTRACT' AND jc.id IS NULL ORDER BY ap.updated_at ASC LIMIT 1000`).all<{adId:string}>();
 let discovered=0,backfilled=0,failed=0;
 for(const item of rows.results||[]){
  discovered++;
  try{if(await ensureLegacyActiveContractForAd(env,item.adId))backfilled++}catch(error){failed++;console.error("legacy_contract_scheduled_backfill_failed",{adId:item.adId,error:error instanceof Error?error.message:String(error)})}
 }
 const progress=await reconcileAllActiveContracts(env);
 return {discovered,backfilled,failed,progress};
}
