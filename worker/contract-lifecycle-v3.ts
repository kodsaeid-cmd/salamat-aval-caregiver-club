import {requireAccess} from "./access-control";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,str} from "./lib";

const MODULE="staff.contracts";
const DAY=86_400_000;
let ready:Promise<void>|undefined;

function int(v:unknown,f=0){const n=Number(v);return Number.isFinite(n)?Math.trunc(n):f}
function optionalInt(params:URLSearchParams,key:string){const raw=params.get(key);if(raw==null||raw.trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?Math.trunc(n):null}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n))}
function daysBetween(a:string,b:string){return Math.max(0,Math.ceil((Date.parse(b)-Date.parse(a))/DAY))}
function rankFromScore(score:unknown){const n=Number(score);if(!Number.isFinite(n))return{code:null,title:"بدون ارزیابی",stars:0};if(n>=90)return{code:"R-1",title:"ممتاز",stars:5};if(n>=80)return{code:"R-2",title:"ارشد",stars:4};if(n>=70)return{code:"R-3",title:"حرفه‌ای",stars:3};if(n>=60)return{code:"R-4",title:"پایه",stars:2};return{code:"R-5",title:"مشروط",stars:1}}
function renewalState(remaining:number,status:string){if(status!=="ACTIVE")return status==="COMPLETED"?"COMPLETED":"INACTIVE";if(remaining<=6)return"RENEW_NOW";if(remaining<=14)return"RENEW_SOON";if(remaining<=30)return"NEAR_RENEWAL";return"CURRENT"}
function contractNumber(applicationId:string,startedAt:string){const year=new Date(startedAt).getUTCFullYear(),suffix=applicationId.replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase()||crypto.randomUUID().slice(0,8).toUpperCase();return `SA-CTR-${year}-${suffix}-${crypto.randomUUID().slice(0,4).toUpperCase()}`}
function jobAdTitle(src:any){return str(src?.customerFullName)||`قرارداد ${str(src?.applicationId)||"بدون عنوان"}`}

export async function ensureContractLifecycleV3(env:Env){
 if(!ready)ready=(async()=>{
  await ensureContractProgressSchema(env);
  await env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_cases_v3(id TEXT PRIMARY KEY,job_contract_id TEXT NOT NULL UNIQUE,job_ad_id TEXT NOT NULL,source_application_id TEXT NOT NULL,contract_number TEXT NOT NULL UNIQUE,contract_title TEXT NOT NULL,primary_caregiver_id TEXT NOT NULL,caregiver_salary_rial INTEGER NOT NULL DEFAULT 0,duration_days INTEGER NOT NULL DEFAULT 1,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',renewal_state TEXT NOT NULL DEFAULT 'CURRENT',supervisor_user_id TEXT,supervision_note TEXT NOT NULL DEFAULT '',settlement_method TEXT NOT NULL DEFAULT 'MONTHLY',caregiver_settlement_status TEXT NOT NULL DEFAULT 'PENDING',caregiver_bad_debt INTEGER NOT NULL DEFAULT 0,franchise_toman INTEGER NOT NULL DEFAULT 0,franchise_status TEXT NOT NULL DEFAULT 'UNPAID',franchise_paid_at TEXT,franchise_reference TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`),
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_service_providers_v3(id TEXT PRIMARY KEY,contract_case_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,source_application_id TEXT,started_at TEXT NOT NULL,ended_at TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',rank_code_snapshot TEXT,stars_snapshot INTEGER,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(contract_case_id,caregiver_id,started_at))`),
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_note_revisions_v3(id TEXT PRIMARY KEY,contract_case_id TEXT NOT NULL,note_text TEXT NOT NULL,actor_user_id TEXT NOT NULL,created_at TEXT NOT NULL)`),
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_financial_revisions_v3(id TEXT PRIMARY KEY,contract_case_id TEXT NOT NULL,snapshot_json TEXT NOT NULL,actor_user_id TEXT NOT NULL,created_at TEXT NOT NULL)`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_status_end ON contract_cases_v3(status,ends_at)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_caregiver ON contract_cases_v3(primary_caregiver_id,created_at DESC)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_ad_history ON contract_cases_v3(job_ad_id,starts_at DESC)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_service_providers_v3_case ON contract_service_providers_v3(contract_case_id,started_at)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_note_revisions_v3_case ON contract_note_revisions_v3(contract_case_id,created_at DESC)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_financial_revisions_v3_case ON contract_financial_revisions_v3(contract_case_id,created_at DESC)"),
  ]);
  try{await env.DB.prepare(`INSERT OR IGNORE INTO contract_cases_v3(id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,renewal_state,supervisor_user_id,supervision_note,settlement_method,caregiver_settlement_status,caregiver_bad_debt,franchise_toman,franchise_status,franchise_paid_at,franchise_reference,created_at,updated_at) SELECT id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,renewal_state,supervisor_user_id,supervision_note,settlement_method,caregiver_settlement_status,caregiver_bad_debt,franchise_toman,franchise_status,franchise_paid_at,franchise_reference,created_at,updated_at FROM contract_cases_v2`).run()}catch{}
  try{await env.DB.prepare(`INSERT OR IGNORE INTO contract_service_providers_v3(id,contract_case_id,caregiver_id,source_application_id,started_at,ended_at,status,rank_code_snapshot,stars_snapshot,created_at,updated_at) SELECT p.id,p.contract_case_id,p.caregiver_id,p.source_application_id,p.started_at,p.ended_at,p.status,p.rank_code_snapshot,p.stars_snapshot,p.created_at,p.updated_at FROM contract_service_providers_v2 p JOIN contract_cases_v3 c ON c.id=p.contract_case_id`).run()}catch{}
  try{await env.DB.prepare(`INSERT OR IGNORE INTO contract_note_revisions_v3(id,contract_case_id,note_text,actor_user_id,created_at) SELECT n.id,n.contract_case_id,n.note_text,n.actor_user_id,n.created_at FROM contract_note_revisions_v2 n JOIN contract_cases_v3 c ON c.id=n.contract_case_id`).run()}catch{}
  try{await env.DB.prepare(`INSERT OR IGNORE INTO contract_financial_revisions_v3(id,contract_case_id,snapshot_json,actor_user_id,created_at) SELECT f.id,f.contract_case_id,f.snapshot_json,f.actor_user_id,f.created_at FROM contract_financial_revisions_v2 f JOIN contract_cases_v3 c ON c.id=f.contract_case_id`).run()}catch{}
 })().catch(error=>{ready=undefined;throw error});
 return ready;
}

export const ensureContractLifecycleV2=ensureContractLifecycleV3;

async function latestRank(env:Env,caregiverId:string){
 const row=await env.DB.prepare(`SELECT final_score AS score FROM caregiver_evaluation_periods WHERE caregiver_id=? AND status='FINAL' AND final_score IS NOT NULL ORDER BY COALESCE(finalized_at,updated_at,created_at) DESC LIMIT 1`).bind(caregiverId).first<any>();
 return rankFromScore(row?.score);
}

export async function reconcileContractCaseByApplication(env:Env,applicationId:string){
 await ensureContractLifecycleV3(env);
 const src=await env.DB.prepare(`SELECT jc.id AS jobContractId,jc.caregiver_id AS caregiverId,jc.ad_id AS adId,jc.application_id AS applicationId,jc.started_at AS startedAt,jc.scheduled_end_at AS endsAt,jc.duration_days AS durationDays,jc.status AS jobStatus,jc.ended_at AS endedAt,a.customer_full_name AS customerFullName,a.caregiver_salary_rial AS caregiverSalaryRial FROM caregiver_job_contracts jc JOIN care_job_ads a ON a.id=jc.ad_id WHERE jc.application_id=? LIMIT 1`).bind(applicationId).first<any>();
 if(!src)return null;
 const existing=await env.DB.prepare("SELECT id,primary_caregiver_id AS primaryCaregiverId FROM contract_cases_v3 WHERE job_contract_id=? LIMIT 1").bind(src.jobContractId).first<any>();
 const rank=await latestRank(env,src.caregiverId),ts=nowIso(),remaining=Math.max(0,daysBetween(ts,src.endsAt)),state=renewalState(remaining,String(src.jobStatus||"ACTIVE")),title=jobAdTitle(src),providerStatus=src.jobStatus==="ACTIVE"?"ACTIVE":src.jobStatus==="COMPLETED"?"COMPLETED":"REMOVED",providerEndedAt=providerStatus==="ACTIVE"?null:(src.endedAt||ts);
 let caseId=existing?.id;
 if(!caseId){
  caseId=randomId("ccv3_");
  await env.DB.prepare(`INSERT INTO contract_cases_v3(id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,renewal_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(caseId,src.jobContractId,src.adId,src.applicationId,contractNumber(src.applicationId,src.startedAt),title,src.caregiverId,int(src.caregiverSalaryRial),Math.max(1,int(src.durationDays,1)),src.startedAt,src.endsAt,src.jobStatus,state,ts,ts).run();
 }else{
  if(existing.primaryCaregiverId!==src.caregiverId)await env.DB.prepare("UPDATE contract_service_providers_v3 SET status='REPLACED',ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id=? AND status='ACTIVE'").bind(src.startedAt||ts,ts,caseId).run();
  await env.DB.prepare("UPDATE contract_cases_v3 SET source_application_id=?,contract_title=?,primary_caregiver_id=?,status=?,renewal_state=?,ends_at=?,duration_days=?,caregiver_salary_rial=?,updated_at=? WHERE id=?").bind(src.applicationId,title,src.caregiverId,src.jobStatus,state,src.endsAt,Math.max(1,int(src.durationDays,1)),int(src.caregiverSalaryRial),ts,caseId).run();
 }
 if(providerStatus!=="ACTIVE")await env.DB.prepare("UPDATE contract_service_providers_v3 SET status=?,ended_at=COALESCE(ended_at,?),updated_at=? WHERE contract_case_id=? AND caregiver_id=? AND status='ACTIVE'").bind(providerStatus,providerEndedAt,ts,caseId,src.caregiverId).run();
 await env.DB.prepare(`INSERT OR IGNORE INTO contract_service_providers_v3(id,contract_case_id,caregiver_id,source_application_id,started_at,ended_at,status,rank_code_snapshot,stars_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(randomId("cspv3_"),caseId,src.caregiverId,src.applicationId,src.startedAt,providerEndedAt,providerStatus,rank.code,rank.stars,ts,ts).run();
 return caseId;
}

export async function reconcileAllContractCasesV3(env:Env){
 await ensureContractLifecycleV3(env);
 const rows=await env.DB.prepare("SELECT application_id AS applicationId FROM caregiver_job_contracts ORDER BY created_at ASC LIMIT 5000").all<{applicationId:string}>();
 let discovered=0,repaired=0,failed=0;
 for(const row of rows.results||[]){
  discovered++;
  try{if(await reconcileContractCaseByApplication(env,row.applicationId))repaired++;else failed++}
  catch(error){failed++;console.error("contract_case_v3_reconcile_failed",{applicationId:row.applicationId,error:error instanceof Error?error.message:String(error)})}
 }
 return{discovered,repaired,failed};
}

async function actor(request:Request,env:Env,action:"view"|"update"){
 const user=await getUser(request,env);if(!user)return{response:fail("ابتدا وارد حساب شوید.",401,"unauthorized")};
 const denied=await requireAccess(env,user,MODULE,action);return denied?{response:denied}:{user};
}

async function list(request:Request,env:Env){
 await reconcileAllContractCasesV3(env);
 const u=new URL(request.url),p=u.searchParams,q=str(p.get("q")),status=str(p.get("status")).toUpperCase(),renewal=str(p.get("renewal")).toUpperCase(),stars=optionalInt(p,"stars"),salaryMin=optionalInt(p,"salaryMin"),salaryMax=optionalInt(p,"salaryMax"),durationMin=optionalInt(p,"durationMin"),durationMax=optionalInt(p,"durationMax"),remainingMin=optionalInt(p,"remainingMin"),remainingMax=optionalInt(p,"remainingMax"),startFrom=str(p.get("startFrom")),startTo=str(p.get("startTo")),endFrom=str(p.get("endFrom")),endTo=str(p.get("endTo")),sort=str(p.get("sort"))||"end_asc",page=Math.max(1,optionalInt(p,"page")??1),pageSize=clamp(optionalInt(p,"pageSize")??40,10,100),offset=(page-1)*pageSize;
 const clauses=["1=1"],binds:any[]=[];
 if(q){clauses.push("(c.contract_number LIKE ? OR c.contract_title LIKE ? OR g.full_name LIKE ? OR g.membership_code LIKE ?)");binds.push(...Array(4).fill(`%${q}%`))}
 if(status){clauses.push("c.status=?");binds.push(status)}
 if(renewal){clauses.push("c.renewal_state=?");binds.push(renewal)}
 if(stars!=null){clauses.push("COALESCE(r.stars,0)=?");binds.push(stars)}
 if(salaryMin!=null){clauses.push("c.caregiver_salary_rial>=?");binds.push(salaryMin)}
 if(salaryMax!=null){clauses.push("c.caregiver_salary_rial<=?");binds.push(salaryMax)}
 if(durationMin!=null){clauses.push("c.duration_days>=?");binds.push(durationMin)}
 if(durationMax!=null){clauses.push("c.duration_days<=?");binds.push(durationMax)}
 if(remainingMin!=null){clauses.push("(julianday(c.ends_at)-julianday('now'))>=?");binds.push(remainingMin)}
 if(remainingMax!=null){clauses.push("(julianday(c.ends_at)-julianday('now'))<=?");binds.push(remainingMax)}
 if(startFrom){clauses.push("date(c.starts_at)>=date(?)");binds.push(startFrom)}
 if(startTo){clauses.push("date(c.starts_at)<=date(?)");binds.push(startTo)}
 if(endFrom){clauses.push("date(c.ends_at)>=date(?)");binds.push(endFrom)}
 if(endTo){clauses.push("date(c.ends_at)<=date(?)");binds.push(endTo)}
 const order=({end_asc:"c.ends_at ASC",remaining_asc:"c.ends_at ASC",end_desc:"c.ends_at DESC",remaining_desc:"c.ends_at DESC",start_desc:"c.starts_at DESC",start_asc:"c.starts_at ASC",salary_desc:"c.caregiver_salary_rial DESC",salary_asc:"c.caregiver_salary_rial ASC",stars_desc:"COALESCE(r.stars,0) DESC,c.ends_at ASC",stars_asc:"COALESCE(r.stars,0) ASC,c.ends_at ASC",duration_desc:"c.duration_days DESC",duration_asc:"c.duration_days ASC"} as Record<string,string>)[sort]||"c.ends_at ASC";
 const base=`FROM contract_cases_v3 c JOIN caregivers g ON g.id=c.primary_caregiver_id LEFT JOIN (SELECT contract_case_id,MAX(COALESCE(stars_snapshot,0)) stars FROM contract_service_providers_v3 GROUP BY contract_case_id) r ON r.contract_case_id=c.id WHERE ${clauses.join(" AND ")}`;
 const [rows,count]=await Promise.all([
  env.DB.prepare(`SELECT c.*,g.full_name AS caregiverName,g.membership_code AS membershipCode,COALESCE(r.stars,0) AS caregiverStars ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds,pageSize,offset).all<any>(),
  env.DB.prepare(`SELECT COUNT(*) total ${base}`).bind(...binds).first<any>(),
 ]);
 const now=nowIso(),data=(rows.results||[]).map((x:any)=>{const remaining=Math.max(0,daysBetween(now,x.ends_at)),elapsed=Math.max(0,daysBetween(x.starts_at,now)),duration=Math.max(1,int(x.duration_days,1));return{...x,remainingDays:remaining,elapsedDays:Math.min(duration,elapsed),progressPercent:Math.round(Math.min(1,elapsed/duration)*100),renewalState:renewalState(remaining,x.status)}}),total=int(count?.total);
 return json({data:{contracts:data,pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))}}});
}

async function detail(env:Env,id:string){
 await ensureContractLifecycleV3(env);
 const c=await env.DB.prepare(`SELECT c.*,g.full_name AS caregiverName,g.membership_code AS membershipCode,u.full_name AS supervisorName,jc.total_points_units AS totalPointsUnits,jc.earned_points_units AS earnedPointsUnits,COALESCE((SELECT p.stars_snapshot FROM contract_service_providers_v3 p WHERE p.contract_case_id=c.id AND p.caregiver_id=c.primary_caregiver_id ORDER BY p.started_at DESC LIMIT 1),0) AS caregiverStars FROM contract_cases_v3 c JOIN caregivers g ON g.id=c.primary_caregiver_id LEFT JOIN users u ON u.id=c.supervisor_user_id LEFT JOIN caregiver_job_contracts jc ON jc.id=c.job_contract_id WHERE c.id=? LIMIT 1`).bind(id).first<any>();
 if(!c)return fail("قرارداد پیدا نشد.",404,"contract_not_found");
 const [dispatches,providers,notes,financialRevisions]=await Promise.all([
  env.DB.prepare(`SELECT ap.id,ap.caregiver_id AS caregiverId,COALESCE(ap.lifecycle_status,ap.status) AS status,ap.applied_at AS appliedAt,ap.updated_at AS updatedAt,g.full_name AS caregiverName,g.membership_code AS membershipCode,(SELECT final_score FROM caregiver_evaluation_periods ep WHERE ep.caregiver_id=g.id AND ep.status='FINAL' AND ep.final_score IS NOT NULL ORDER BY COALESCE(ep.finalized_at,ep.updated_at,ep.created_at) DESC LIMIT 1) AS evaluationScore FROM care_job_applications ap JOIN caregivers g ON g.id=ap.caregiver_id WHERE ap.ad_id=? AND COALESCE(ap.lifecycle_status,ap.status) IN ('TRIAL_DISPATCH','IN_CONTRACT','COMPLETED','WITHDRAWN') ORDER BY ap.updated_at DESC`).bind(c.job_ad_id).all<any>(),
  env.DB.prepare(`SELECT p.*,g.full_name AS caregiverName,g.membership_code AS membershipCode,jc.total_points_units AS totalPointsUnits,jc.earned_points_units AS earnedPointsUnits FROM contract_service_providers_v3 p JOIN caregivers g ON g.id=p.caregiver_id LEFT JOIN caregiver_job_contracts jc ON jc.application_id=p.source_application_id WHERE p.contract_case_id=? ORDER BY p.started_at`).bind(id).all<any>(),
  env.DB.prepare(`SELECT n.id,n.note_text AS noteText,n.created_at AS createdAt,u.full_name AS actorName FROM contract_note_revisions_v3 n LEFT JOIN users u ON u.id=n.actor_user_id WHERE n.contract_case_id=? ORDER BY n.created_at DESC LIMIT 100`).bind(id).all<any>(),
  env.DB.prepare(`SELECT id,snapshot_json AS snapshotJson,created_at AS createdAt FROM contract_financial_revisions_v3 WHERE contract_case_id=? ORDER BY created_at DESC LIMIT 30`).bind(id).all<any>(),
 ]);
 const totalPts=Number(c.totalPointsUnits||0)/100,earnedPts=Number(c.earnedPointsUnits||0)/100,now=nowIso(),remaining=Math.max(0,daysBetween(now,c.ends_at));
 const contract={...c,remainingDays:remaining,progressPercent:Math.round(Math.min(1,Math.max(0,daysBetween(c.starts_at,now))/Math.max(1,c.duration_days))*100),renewalState:renewalState(remaining,c.status),totalPoints:totalPts,earnedPoints:earnedPts,remainingPoints:Math.max(0,totalPts-earnedPts)};
 const dispatchRows=(dispatches.results||[]).map((x:any)=>({...x,rank:rankFromScore(x.evaluationScore)}));
 const providerRows=(providers.results||[]).map((x:any)=>{const total=Number(x.totalPointsUnits||0)/100,earned=Number(x.earnedPointsUnits||0)/100;return{...x,totalPoints:total,earnedPoints:earned,remainingPoints:Math.max(0,total-earned)}});
 const financialRows=(financialRevisions.results||[]).map((x:any)=>({...x,snapshot:(()=>{try{return JSON.parse(x.snapshotJson)}catch{return{}}})()}));
 return json({data:{contract,dispatches:dispatchRows,providers:providerRows,notes:notes.results||[],financialRevisions:financialRows}});
}

async function updateSupervision(request:Request,env:Env,user:AuthUser,id:string){
 const b=await readBody(request);if(!b)return fail("اطلاعات معتبر نیست.");
 const supervisorId=str(b.supervisorUserId)||null,note=str(b.note).slice(0,10000),ts=nowIso();
 if(supervisorId){const support=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('SUPPORT','ADMIN') AND status IN ('ACTIVE','APPROVED') LIMIT 1").bind(supervisorId).first();if(!support)return fail("ناظر انتخاب‌شده معتبر نیست.",400,"invalid_supervisor")}
 await env.DB.prepare("UPDATE contract_cases_v3 SET supervisor_user_id=?,supervision_note=?,updated_at=? WHERE id=?").bind(supervisorId,note,ts,id).run();
 if(note)await env.DB.prepare("INSERT INTO contract_note_revisions_v3(id,contract_case_id,note_text,actor_user_id,created_at) VALUES(?,?,?,?,?)").bind(randomId("cnrv3_"),id,note,user.id,ts).run();
 await audit(request,env,user,"UPDATE_CONTRACT_SUPERVISION","contract_case_v3",id,{supervisorId,noteLength:note.length});
 return json({ok:true,updatedAt:ts});
}

async function updateFinancial(request:Request,env:Env,user:AuthUser,id:string){
 const b=await readBody(request);if(!b)return fail("اطلاعات معتبر نیست.");
 const settlementMethod=str(b.settlementMethod)||"MONTHLY",caregiverSettlementStatus=str(b.caregiverSettlementStatus)||"PENDING",badDebt=Boolean(b.caregiverBadDebt)?1:0,franchiseToman=Math.max(0,int(b.franchiseToman)),franchiseStatus=str(b.franchiseStatus)||"UNPAID",franchiseReference=str(b.franchiseReference).slice(0,120)||null,paidAt=franchiseStatus==="PAID"?(str(b.franchisePaidAt)||nowIso()):null,ts=nowIso(),snapshot={settlementMethod,caregiverSettlementStatus,caregiverBadDebt:Boolean(badDebt),franchiseToman,franchiseStatus,franchisePaidAt:paidAt,franchiseReference};
 await env.DB.batch([
  env.DB.prepare(`UPDATE contract_cases_v3 SET settlement_method=?,caregiver_settlement_status=?,caregiver_bad_debt=?,franchise_toman=?,franchise_status=?,franchise_paid_at=?,franchise_reference=?,updated_at=? WHERE id=?`).bind(settlementMethod,caregiverSettlementStatus,badDebt,franchiseToman,franchiseStatus,paidAt,franchiseReference,ts,id),
  env.DB.prepare("INSERT INTO contract_financial_revisions_v3(id,contract_case_id,snapshot_json,actor_user_id,created_at) VALUES(?,?,?,?,?)").bind(randomId("cfrv3_"),id,JSON.stringify(snapshot),user.id,ts),
 ]);
 await audit(request,env,user,"UPDATE_CONTRACT_FINANCIAL","contract_case_v3",id,snapshot);
 return json({ok:true,updatedAt:ts});
}

async function supportUsers(env:Env){
 const rows=await env.DB.prepare("SELECT id,full_name AS fullName,mobile,role FROM users WHERE role IN ('SUPPORT','ADMIN') AND status IN ('ACTIVE','APPROVED') ORDER BY full_name").all();
 return json({data:{users:rows.results||[]}});
}

export async function routeContractLifecycleV2(request:Request,env:Env):Promise<Response|null>{
 const u=new URL(request.url),p=u.pathname,m=request.method.toUpperCase();
 if(!p.startsWith("/api/staff/contracts-v2"))return null;
 const auth=await actor(request,env,m==="GET"?"view":"update");if(auth.response)return auth.response;
 if(p==="/api/staff/contracts-v2"&&m==="GET")return list(request,env);
 if(p==="/api/staff/contracts-v2/support-users"&&m==="GET")return supportUsers(env);
 const match=p.match(/^\/api\/staff\/contracts-v2\/([^/]+)(?:\/(supervision|financial))?$/);if(!match)return fail("مسیر پیدا نشد.",404);
 const id=decodeURIComponent(match[1]),sub=match[2];
 if(!sub&&m==="GET")return detail(env,id);
 if(sub==="supervision"&&m==="PATCH")return updateSupervision(request,env,auth.user!,id);
 if(sub==="financial"&&m==="PATCH")return updateFinancial(request,env,auth.user!,id);
 return fail("روش درخواست پشتیبانی نمی‌شود.",405);
}
