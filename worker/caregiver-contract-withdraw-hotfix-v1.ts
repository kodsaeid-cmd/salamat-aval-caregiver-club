import {audit,getUser,fail,json,nowIso,randomId,readBody,str,type Env} from "./lib";
import {contractProgressPointsSummary,ensureContractProgressSchema} from "./contract-progress-engine-v1";

const DAY_MS=86_400_000;
const SCALE=100;
const REASONS=new Set(["PERSONAL","CONDITIONS","SALARY","COMMUTE","MISMATCH","OTHER"]);
const fromUnits=(n:unknown)=>Math.round(Number(n||0))/SCALE;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

type WithdrawContractRow={
 id:string;caregiverId:string;adId:string;applicationId:string;startedAt:string;durationDays:number;
 totalPointsUnits:number;earnedPointsUnits:number;lastReconciledDay:number;status:string;pointsModel:string;
};

function elapsedDays(row:WithdrawContractRow){
 const started=Date.parse(row.startedAt);
 if(!Number.isFinite(started))return Math.max(0,Number(row.lastReconciledDay||0));
 return clamp(Math.floor(Math.max(0,Date.now()-started)/DAY_MS),0,Math.max(1,Number(row.durationDays||1)));
}

function targetUnits(row:WithdrawContractRow,day:number){
 const duration=Math.max(1,Number(row.durationDays||1));
 const total=Math.max(0,Number(row.totalPointsUnits||0));
 const safeDay=clamp(Math.trunc(day),0,duration);
 return safeDay>=duration?total:Math.floor(total*safeDay/duration);
}

async function reconcileEarnedBeforeWithdraw(env:Env,row:WithdrawContractRow){
 const completed=elapsedDays(row);
 if(row.pointsModel==="LEGACY_PREPAID"){
  return {completed,earned:Math.max(0,Number(row.earnedPointsUnits||0))};
 }
 const from=Math.max(1,Number(row.lastReconciledDay||0)+1),stmts:any[]=[],ts=nowIso();
 for(let day=from;day<=completed;day++){
  const delta=Math.max(0,targetUnits(row,day)-targetUnits(row,day-1));
  stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_contract_point_daily_ledger(id,contract_id,caregiver_id,ad_id,application_id,service_day,points_units,earned_at) VALUES(?,?,?,?,?,?,?,?)`).bind(randomId("dpt_"),row.id,row.caregiverId,row.adId,row.applicationId,day,delta,ts));
 }
 if(stmts.length)await env.DB.batch(stmts);
 const sum=await env.DB.prepare("SELECT COALESCE(SUM(points_units),0) AS units FROM caregiver_contract_point_daily_ledger WHERE contract_id=?").bind(row.id).first<{units:number}>();
 const earned=Math.min(Math.max(0,Number(row.totalPointsUnits||0)),Math.max(0,Number(sum?.units||0)));
 return {completed,earned};
}

export async function routeCaregiverContractWithdrawHotfix(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/caregiver\/contracts\/([^/]+)\/withdraw$/);
 if(!m||request.method.toUpperCase()!=="POST")return null;
 const actor=await getUser(request,env);
 if(!actor||actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 await ensureContractProgressSchema(env);
 const body=await readBody(request),confirmed=body?.confirmed===true,reasonCode=str(body?.reasonCode).toUpperCase(),reasonText=str(body?.reasonText).slice(0,500);
 if(!confirmed)return fail("برای انصراف قطعی، تأیید نهایی الزامی است.",400,"withdraw_confirmation_required");
 if(!REASONS.has(reasonCode))return fail("علت انصراف را انتخاب کنید.",400,"withdraw_reason_required");
 const contractId=decodeURIComponent(m[1]);
 const row=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,started_at AS startedAt,duration_days AS durationDays,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits,last_reconciled_day AS lastReconciledDay,status,points_model AS pointsModel FROM caregiver_job_contracts WHERE id=? AND caregiver_id=? AND status='ACTIVE' LIMIT 1`).bind(contractId,actor.caregiverId).first<WithdrawContractRow>();
 if(!row)return fail("قرارداد فعال پیدا نشد.",404,"active_contract_not_found");
 let reconciled:{completed:number;earned:number};
 try{
  reconciled=await reconcileEarnedBeforeWithdraw(env,row);
 }catch(error){
  console.error("caregiver_contract_withdraw_reconcile_failed",{contractId:row.id,error:error instanceof Error?error.message:String(error)});
  return fail("محاسبه امتیاز قرارداد انجام نشد. لطفاً دوباره تلاش کنید.",409,"withdraw_reconcile_failed");
 }
 const ts=nowIso();
 try{
  const result=await env.DB.batch([
   env.DB.prepare("UPDATE caregiver_job_contracts SET earned_points_units=?,last_reconciled_day=?,status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code=?,end_reason_text=?,updated_at=? WHERE id=? AND caregiver_id=? AND status='ACTIVE'").bind(reconciled.earned,reconciled.completed,ts,actor.id,reasonCode,reasonText||null,ts,row.id,row.caregiverId),
   env.DB.prepare("UPDATE care_job_applications SET status='WITHDRAWN',updated_at=? WHERE id=?").bind(ts,row.applicationId),
   env.DB.prepare("UPDATE care_job_ads SET status='DRAFT',updated_at=? WHERE id=? AND status='CLOSED'").bind(ts,row.adId),
  ]);
  if(!Number(result?.[0]?.meta?.changes||0))return fail("قرارداد قبلاً پایان یافته است.",409,"contract_already_ended");
 }catch(error){
  console.error("caregiver_contract_withdraw_transaction_failed",{contractId:row.id,error:error instanceof Error?error.message:String(error)});
  return fail("انصراف قرارداد ثبت نشد. لطفاً دوباره تلاش کنید.",409,"withdraw_transaction_failed");
 }
 try{
  await audit(request,env,actor,"END_JOB_CONTRACT_EARLY","caregiver_job_contract",row.id,{applicationStatus:"WITHDRAWN",reasonCode,reasonText,earnedPoints:fromUnits(reconciled.earned),futurePointsStopped:true,bankUnlocked:true});
 }catch(error){
  console.error("caregiver_contract_withdraw_audit_failed",{contractId:row.id,error:error instanceof Error?error.message:String(error)});
 }
 return json({data:{status:"ENDED_EARLY",earnedPoints:fromUnits(reconciled.earned),futurePointsStopped:true,bankUnlocked:true,points:await contractProgressPointsSummary(env,row.caregiverId)}});
}
