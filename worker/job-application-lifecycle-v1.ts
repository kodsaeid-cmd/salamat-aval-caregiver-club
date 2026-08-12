import {type Env} from "./lib";

const LEGACY_ALLOWED=new Set(["PENDING_CONSULTANT","TRIAL_DISPATCH","REJECTED","IN_CONTRACT"]);
let ready:Promise<void>|undefined;

export function applicationLifecycleStatusSql(alias="ap"){
 return `COALESCE(${alias}.lifecycle_status,${alias}.status)`;
}

export function applicationStorageStatus(nextStatus:string){
 const next=String(nextStatus||"").toUpperCase();
 return LEGACY_ALLOWED.has(next)?next:"REJECTED";
}

/**
 * Production originally shipped care_job_applications.status with a CHECK constraint that
 * only allows the four historical recruitment states. Contract lifecycle later introduced
 * WITHDRAWN and COMPLETED. Rebuilding that table is intentionally forbidden by the data
 * safety contract, so lifecycle_status is the additive canonical state while status remains
 * a backward-compatible shadow for old runtimes.
 */
export async function ensureJobApplicationLifecycleSchema(env:Env){
 if(!ready)ready=(async()=>{
  const cols=await env.DB.prepare("PRAGMA table_info(care_job_applications)").all<any>();
  const has=(cols.results||[]).some((x:any)=>String(x?.name||"")==="lifecycle_status");
  if(!has){
   try{await env.DB.prepare("ALTER TABLE care_job_applications ADD COLUMN lifecycle_status TEXT").run()}
   catch(error:any){if(!/duplicate column name|already exists/i.test(String(error?.message||error)))throw error}
  }
  await env.DB.prepare("UPDATE care_job_applications SET lifecycle_status=status WHERE lifecycle_status IS NULL OR lifecycle_status='' ").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_care_job_applications_lifecycle_status ON care_job_applications(lifecycle_status,updated_at DESC)").run();
 })().catch(error=>{ready=undefined;throw error});
 return ready;
}

export function lifecycleUpdateStatement(env:Env,applicationId:string,nextStatus:string,ts:string){
 const next=String(nextStatus||"").toUpperCase(),shadow=applicationStorageStatus(next);
 return env.DB.prepare("UPDATE care_job_applications SET status=?,lifecycle_status=?,updated_at=? WHERE id=?").bind(shadow,next,ts,applicationId);
}
