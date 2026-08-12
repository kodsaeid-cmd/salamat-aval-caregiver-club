import {getUser,fail,json,nowIso,readBody,str,type Env,type AuthUser} from "./lib";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";

const DAY_MS=86_400_000;
const SCALE=100;
const REASONS=new Set(["PERSONAL","CONDITIONS","SALARY","COMMUTE","MISMATCH","OTHER"]);
const points=(n:unknown)=>Math.max(0,Math.round(Number(n||0)*SCALE));
const fromUnits=(n:unknown)=>Math.round(Number(n||0))/SCALE;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

export async function routeCaregiverContractWithdrawHotfix(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/caregiver\/contracts\/([^/]+)\/withdraw$/);
 if(!m||request.method.toUpperCase()!=="POST")return null;
 const actor=await getUser(request,env);
 if(!actor||actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 await ensureContractProgressSchema(env);
 const body=await readBody(request),confirmed=body?.confirmed===true,reasonCode=str(body?.reasonCode).toUpperCase(),reasonText=str(body?.reasonText).slice(0,500);
 if(!confirmed)return fail("برای انصراف قطعی، تأیید نهایی الزامی است.",400,"withdraw_confirmation_required");
 if(!REASONS.has(reasonCode))return fail("علت انصراف را انتخاب کنید.",400,"withdraw_reason_required");
 const row=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,ad_id AS adId,application_id AS applicationId,started_at AS startedAt,duration_days AS durationDays,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits,last_reconciled_day AS lastReconciledDay,status FROM caregiver_job_contracts WHERE id=? AND caregiver_id=? AND status='ACTIVE' LIMIT 1`).bind(decodeURIComponent(m[1]),actor.caregiverId).first<any>();
 if(!row)return fail("قرارداد فعال پیدا نشد.",404,"active_contract_not_found");
 const started=Date.parse(row.startedAt),completed=clamp(Math.floor(Math.max(0,Date.now()-started)/DAY_MS),0,Math.max(1,Number(row.durationDays||1))),total=Number(row.totalPointsUnits||0),from=Math.max(1,Number(row.lastReconciledDay||0)+1),stmts:any[]=[];
 for(let day=from;day<=completed;day++){
  const target=(d:number)=>d>=Number(row.durationDays||1)?total:Math.floor(total*clamp(d,0,Number(row.durationDays||1))/Math.max(1,Number(row.durationDays||1)));
  const delta=Math.max(0,target(day)-target(day-1));
  stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_contract_point_daily_ledger(id,contract_id,caregiver_id,ad_id,application_id,service_day,points_units,earned_at) VALUES(?,?,?,?,?,?,?,?)`).bind(`dpt_${crypto.randomUUID()}`,row.id,row.caregiverId,row.adId,row.applicationId,day,delta,nowIso()));
 }
 if(stmts.length)await env.DB.batch(stmts);
 const sum=await env.DB.prepare("SELECT COALESCE(SUM(points_units),0) AS units FROM caregiver_contract_point_daily_ledger WHERE contract_id=?").bind(row.id).first<any>();
 const earned=Math.min(total,Number(sum?.units||0)),ts=nowIso();
 try{
  await env.DB.batch([
   env.DB.prepare("UPDATE caregiver_job_contracts SET earned_points_units=?,last_reconciled_day=?,status='ENDED_EARLY',ended_at=?,ended_by_user_id=?,end_reason_code=?,end_reason_text=?,updated_at=? WHERE id=? AND caregiver_id=? AND status='ACTIVE'").bind(earned,completed,ts,actor.id,reasonCode,reasonText||null,ts,row.id,row.caregiverId),
   env.DB.prepare("UPDATE care_job_applications SET status='WITHDRAWN',updated_at=? WHERE id=?").bind(ts,row.applicationId),
   env.DB.prepare("UPDATE care_job_ads SET status='DRAFT',updated_at=? WHERE id=? AND status='CLOSED'").bind(ts,row.adId),
  ]);
 }catch(error:any){
  console.error("caregiver_contract_withdraw_hotfix_failed",{contractId:row.id,error:error instanceof Error?error.message:String(error)});
  return fail("انصراف قرارداد ثبت نشد. لطفاً دوباره تلاش کنید.",409,"withdraw_transaction_failed");
 }
 return json({data:{status:"ENDED_EARLY",earnedPoints:fromUnits(earned),futurePointsStopped:true,bankUnlocked:true,pointsUnits:earned}});
}
