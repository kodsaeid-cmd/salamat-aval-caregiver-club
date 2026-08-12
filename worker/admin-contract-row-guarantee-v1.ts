import {ensureContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {type Env,nowIso,randomId} from "./lib";

function int(v:unknown,f=0){const n=Number(v);return Number.isFinite(n)?Math.trunc(n):f}
function rankFromScore(score:unknown){const n=Number(score);if(!Number.isFinite(n))return{code:null,stars:0};if(n>=90)return{code:"R-1",stars:5};if(n>=80)return{code:"R-2",stars:4};if(n>=70)return{code:"R-3",stars:3};if(n>=60)return{code:"R-4",stars:2};return{code:"R-5",stars:1}}
function contractNumber(applicationId:string,startedAt:string){const year=new Date(startedAt).getUTCFullYear(),suffix=applicationId.replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase()||crypto.randomUUID().slice(0,8).toUpperCase();return `SA-CTR-${year}-${suffix}-${crypto.randomUUID().slice(0,4).toUpperCase()}`}
function renewal(status:string,endsAt:string){if(status!=="ACTIVE")return status==="COMPLETED"?"COMPLETED":"INACTIVE";const days=Math.max(0,Math.ceil((Date.parse(endsAt)-Date.now())/86_400_000));if(days<=6)return"RENEW_NOW";if(days<=14)return"RENEW_SOON";if(days<=30)return"NEAR_RENEWAL";return"CURRENT"}

async function source(env:Env,applicationId:string){return env.DB.prepare(`SELECT jc.id AS jobContractId,jc.caregiver_id AS caregiverId,jc.ad_id AS adId,jc.application_id AS applicationId,
 jc.started_at AS startedAt,jc.scheduled_end_at AS endsAt,jc.duration_days AS durationDays,jc.status AS jobStatus,jc.ended_at AS endedAt,
 a.customer_full_name AS customerFullName,a.caregiver_salary_rial AS caregiverSalaryRial
 FROM caregiver_job_contracts jc JOIN care_job_ads a ON a.id=jc.ad_id WHERE jc.application_id=? LIMIT 1`).bind(applicationId).first<any>()}
async function latestRank(env:Env,caregiverId:string){const row=await env.DB.prepare(`SELECT final_score AS score FROM caregiver_evaluation_periods WHERE caregiver_id=? AND status='FINAL' AND final_score IS NOT NULL ORDER BY COALESCE(finalized_at,updated_at,created_at) DESC LIMIT 1`).bind(caregiverId).first<any>();return rankFromScore(row?.score)}

/**
 * Contract Cases are the projection consumed by the administrator Contracts module.
 * A canonical caregiver_job_contract must never be allowed to exist without that projection.
 * The normal lifecycle reconciler remains first choice; this function adds a direct idempotent
 * persistence fallback and verifies the row afterwards instead of swallowing reconciliation errors.
 */
export async function ensureAdminContractRowForApplication(env:Env,applicationId:string){
 await ensureContractProgressSchema(env);await ensureContractLifecycleV2(env);
 try{const id=await reconcileContractCaseByApplication(env,applicationId);if(id){const ok=await env.DB.prepare("SELECT id FROM contract_cases_v2 WHERE id=? LIMIT 1").bind(id).first<any>();if(ok?.id)return String(ok.id)}}catch(error){console.error("admin_contract_primary_reconcile_failed",{applicationId,error:error instanceof Error?error.message:String(error)})}
 const src=await source(env,applicationId);if(!src)return null;
 const ts=nowIso(),title=String(src.customerFullName||"").trim()||`قرارداد ${applicationId}`,state=renewal(String(src.jobStatus||"ACTIVE"),String(src.endsAt||ts));
 let existing=await env.DB.prepare("SELECT id FROM contract_cases_v2 WHERE job_ad_id=? LIMIT 1").bind(src.adId).first<any>();
 try{
  if(existing?.id){
   await env.DB.prepare(`UPDATE contract_cases_v2 SET job_contract_id=?,source_application_id=?,contract_title=?,primary_caregiver_id=?,caregiver_salary_rial=?,duration_days=?,starts_at=?,ends_at=?,status=?,renewal_state=?,updated_at=? WHERE id=?`).bind(src.jobContractId,src.applicationId,title,src.caregiverId,int(src.caregiverSalaryRial),Math.max(1,int(src.durationDays,1)),src.startedAt,src.endsAt,src.jobStatus,state,ts,existing.id).run();
  }else{
   const caseId=randomId("ccv2_");
   await env.DB.prepare(`INSERT INTO contract_cases_v2(id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,renewal_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(caseId,src.jobContractId,src.adId,src.applicationId,contractNumber(src.applicationId,src.startedAt),title,src.caregiverId,int(src.caregiverSalaryRial),Math.max(1,int(src.durationDays,1)),src.startedAt,src.endsAt,src.jobStatus,state,ts,ts).run();
   existing={id:caseId};
  }
  const rank=await latestRank(env,src.caregiverId),providerStatus=src.jobStatus==="ACTIVE"?"ACTIVE":src.jobStatus==="COMPLETED"?"COMPLETED":"REMOVED",endedAt=providerStatus==="ACTIVE"?null:(src.endedAt||ts);
  if(providerStatus!=="ACTIVE")await env.DB.prepare("UPDATE contract_service_providers_v2 SET status=?,ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id=? AND caregiver_id=? AND status='ACTIVE'").bind(providerStatus,endedAt,ts,existing.id,src.caregiverId).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO contract_service_providers_v2(id,contract_case_id,caregiver_id,source_application_id,started_at,ended_at,status,rank_code_snapshot,stars_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(randomId("cspv2_"),existing.id,src.caregiverId,src.applicationId,src.startedAt,endedAt,providerStatus,rank.code,rank.stars,ts,ts).run();
 }catch(error){console.error("admin_contract_fallback_persistence_failed",{applicationId,jobContractId:src.jobContractId,adId:src.adId,error:error instanceof Error?error.message:String(error)});return null}
 const verified=await env.DB.prepare("SELECT id FROM contract_cases_v2 WHERE job_contract_id=? OR job_ad_id=? LIMIT 1").bind(src.jobContractId,src.adId).first<any>();return verified?.id?String(verified.id):null;
}

export async function reconcileMissingAdminContractRows(env:Env){
 await ensureContractProgressSchema(env);await ensureContractLifecycleV2(env);
 const rows=await env.DB.prepare(`SELECT jc.application_id AS applicationId FROM caregiver_job_contracts jc LEFT JOIN contract_cases_v2 c ON c.job_contract_id=jc.id WHERE c.id IS NULL ORDER BY jc.created_at ASC LIMIT 1000`).all<{applicationId:string}>();
 let discovered=0,repaired=0,failed=0;
 for(const row of rows.results||[]){discovered++;try{if(await ensureAdminContractRowForApplication(env,row.applicationId))repaired++;else failed++}catch(error){failed++;console.error("admin_contract_missing_row_repair_failed",{applicationId:row.applicationId,error:error instanceof Error?error.message:String(error)})}}
 return{discovered,repaired,failed};
}
