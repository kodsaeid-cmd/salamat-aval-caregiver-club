import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {ensureJobApplicationLifecycleSchema} from "./job-application-lifecycle-v1";
import {type Env,nowIso,randomId} from "./lib";

const DAY_MS=86_400_000;
const POINT_SCALE=100;
const units=(value:unknown)=>Math.max(0,Math.round(Number(value||0)*POINT_SCALE));
const plusDays=(iso:string,days:number)=>new Date(Date.parse(iso)+Math.max(1,days)*DAY_MS).toISOString();

async function byApplication(env:Env,applicationId:string){
 return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,started_at AS startedAt,
  scheduled_end_at AS scheduledEndAt,duration_days AS durationDays,total_points_units AS totalPointsUnits,
  earned_points_units AS earnedPointsUnits,last_reconciled_day AS lastReconciledDay,status,points_model AS pointsModel
  FROM caregiver_job_contracts WHERE application_id=? LIMIT 1`).bind(applicationId).first<any>();
}

/**
 * Repairs a contract that existed only as a lifecycle application and was already ended.
 * This never re-opens service or invents future points: historical immutable award evidence is
 * preserved when present; otherwise earned points remain zero because no canonical accrual ledger existed.
 */
export async function ensureHistoricalContractForApplication(env:Env,applicationId:string,endedByUserId?:string|null){
 await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
 const existing=await byApplication(env,applicationId);if(existing)return existing;
 const src=await env.DB.prepare(`SELECT ap.id AS applicationId,ap.caregiver_id AS caregiverId,ap.ad_id AS adId,
  COALESCE(ap.lifecycle_status,ap.status) AS lifecycleStatus,ap.applied_at AS appliedAt,ap.updated_at AS endedAt,
  a.duration_days AS durationDays,COALESCE(a.reward_points,a.contract_points,0) AS contractPoints,
  (SELECT l.points FROM caregiver_contract_point_ledger l WHERE l.application_id=ap.id LIMIT 1) AS legacyPoints,
  (SELECT l.awarded_at FROM caregiver_contract_point_ledger l WHERE l.application_id=ap.id LIMIT 1) AS legacyAwardedAt
  FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id WHERE ap.id=? LIMIT 1`).bind(applicationId).first<any>();
 if(!src)return null;
 const lifecycle=String(src.lifecycleStatus||"").toUpperCase();if(!["WITHDRAWN","COMPLETED"].includes(lifecycle))return null;
 const endedRaw=Date.parse(String(src.endedAt||"")),endedAt=Number.isFinite(endedRaw)?new Date(endedRaw).toISOString():nowIso();
 const startCandidate=src.legacyAwardedAt||src.appliedAt||endedAt,startRaw=Date.parse(String(startCandidate||"")),startedAt=Number.isFinite(startRaw)?new Date(Math.min(startRaw,Date.parse(endedAt))).toISOString():endedAt;
 const durationDays=Math.max(1,Math.trunc(Number(src.durationDays||1))),legacyAwarded=src.legacyPoints!=null;
 const allocatedUnits=units(src.contractPoints),legacyUnits=legacyAwarded?units(src.legacyPoints):0,totalUnits=Math.max(allocatedUnits,legacyUnits);
 const status=lifecycle==="COMPLETED"?"COMPLETED":"ENDED_EARLY",reason=lifecycle==="COMPLETED"?"LEGACY_COMPLETED_BACKFILL":"LEGACY_WITHDRAWN_BACKFILL",id=randomId("jct_");
 try{
  await env.DB.prepare(`INSERT INTO caregiver_job_contracts(id,caregiver_id,ad_id,application_id,started_at,scheduled_end_at,duration_days,total_points_units,earned_points_units,last_reconciled_day,status,points_model,started_by_user_id,ended_at,ended_by_user_id,end_reason_code,end_reason_text,welcome_seen_at,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,0,?,?,NULL,?,?,?,NULL,NULL,?,?)`).bind(id,src.caregiverId,src.adId,src.applicationId,startedAt,plusDays(startedAt,durationDays),durationDays,totalUnits,legacyUnits,status,legacyAwarded?"LEGACY_PREPAID":"DAILY_V1",endedAt,endedByUserId||null,reason,endedAt,endedAt).run();
 }catch(error:any){
  const raced=await byApplication(env,applicationId);if(raced)return raced;
  console.error("historical_contract_row_backfill_failed",{applicationId,adId:src.adId,error:error instanceof Error?error.message:String(error)});throw error;
 }
 return byApplication(env,applicationId);
}

export async function reconcileHistoricalContractRows(env:Env){
 await ensureJobApplicationLifecycleSchema(env);await ensureContractProgressSchema(env);
 const rows=await env.DB.prepare(`SELECT ap.id AS applicationId FROM care_job_applications ap
  LEFT JOIN caregiver_job_contracts jc ON jc.application_id=ap.id
  WHERE COALESCE(ap.lifecycle_status,ap.status) IN ('WITHDRAWN','COMPLETED') AND jc.id IS NULL
  ORDER BY ap.updated_at ASC LIMIT 1000`).all<{applicationId:string}>();
 let discovered=0,backfilled=0,failed=0;
 for(const row of rows.results||[]){discovered++;try{if(await ensureHistoricalContractForApplication(env,row.applicationId))backfilled++}catch(error){failed++;console.error("historical_contract_batch_backfill_failed",{applicationId:row.applicationId,error:error instanceof Error?error.message:String(error)})}}
 return{discovered,backfilled,failed};
}
