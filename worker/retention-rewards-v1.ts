import {requireAccess} from "./access-control";
import {ensureCaregiverPlatformSchema} from "./caregiver-platform-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const MODULE="staff.financial_credits";
const FIRST_REWARD_TOMAN=1_000_000;
const FIRST_MIN_DAYS=60;
const DAY_MS=86_400_000;
const ACTIVE_TARGET_STATUSES=new Set(["ACTIVE","COMPLETED"]);

type ContractRow={id:string;caregiverId:string;contractNumber:string|null;status:string;startsAt:string|null;endsAt:string|null;franchiseToman:number;createdAt:string};
type RewardRow={id:string;caregiverId:string;rewardType:string;targetContractId:string;sourceContractId:string;targetContractSequence:number;sourceContractSequence:number;rateBasisPoints:number;franchiseToman:number;rewardToman:number;serviceDays:number;status:string;walletTransactionId:string|null;reviewedAt:string|null;decisionNote:string|null;createdAt:string;updatedAt:string};
let schemaReady:Promise<void>|undefined;

function upper(value:unknown){return str(value).toUpperCase()}
function isoDate(value:unknown){const raw=str(value).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:""}
function dateMs(value:string){return Date.parse(`${value}T00:00:00Z`)}
function daysInclusive(start:string,end:string){return Math.max(0,Math.floor((dateMs(end)-dateMs(start))/DAY_MS)+1)}
function today(){return new Date().toISOString().slice(0,10)}
function rateForSequence(sequence:number){return sequence===4?800:sequence===5?1100:sequence>=6?1500:0}
function ratePercent(basisPoints:number){return basisPoints/100}

export async function ensureRetentionRewardsSchema(env:Env){
 if(!schemaReady){schemaReady=(async()=>{
  await ensureCaregiverPlatformSchema(env);
  const columns=await env.DB.prepare("PRAGMA table_info(contracts)").all<{name:string}>(),present=new Set((columns.results||[]).map(x=>x.name));
  if(!present.has("franchise_toman"))await env.DB.prepare("ALTER TABLE contracts ADD COLUMN franchise_toman INTEGER NOT NULL DEFAULT 0").run();
  await env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_retention_rewards(
    id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,reward_type TEXT NOT NULL,target_contract_id TEXT NOT NULL,source_contract_id TEXT NOT NULL,
    target_contract_sequence INTEGER NOT NULL DEFAULT 1,source_contract_sequence INTEGER NOT NULL DEFAULT 1,rate_basis_points INTEGER NOT NULL DEFAULT 0,
    franchise_toman INTEGER NOT NULL DEFAULT 0,reward_toman INTEGER NOT NULL DEFAULT 0,service_days INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',wallet_transaction_id TEXT UNIQUE,reviewed_by_user_id TEXT,reviewed_at TEXT,decision_note TEXT,
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(reward_type,target_contract_id),
    FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,FOREIGN KEY(target_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT,
    FOREIGN KEY(source_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT,FOREIGN KEY(wallet_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
    FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL)`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_retention_rewards_caregiver_created ON caregiver_retention_rewards(caregiver_id,created_at DESC)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_retention_rewards_status_created ON caregiver_retention_rewards(status,created_at DESC)"),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contracts_caregiver_start_status ON contracts(caregiver_id,starts_at,status,created_at)"),
  ]);
 })().catch(error=>{schemaReady=undefined;throw error})}
 return schemaReady;
}

async function contractsFor(env:Env,caregiverId:string){
 await ensureRetentionRewardsSchema(env);
 const result=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_number AS contractNumber,status,starts_at AS startsAt,ends_at AS endsAt,
  COALESCE(franchise_toman,0) AS franchiseToman,created_at AS createdAt
  FROM contracts WHERE caregiver_id=? AND deleted_at IS NULL AND upper(status)<>'DRAFT'
  ORDER BY COALESCE(starts_at,substr(created_at,1,10)),created_at,id`).bind(caregiverId).all<ContractRow>();
 return (result.results||[]).map(row=>({...row,franchiseToman:Number(row.franchiseToman||0),status:upper(row.status)}));
}

function servedDays(contract:ContractRow,asOf=today()){
 const start=isoDate(contract.startsAt);if(!start||start>asOf)return 0;
 let end=isoDate(contract.endsAt)||asOf;if(end>asOf)end=asOf;if(end<start)return 0;
 return daysInclusive(start,end);
}

async function upsertCandidate(env:Env,input:{caregiverId:string;rewardType:"FIRST_CONTRACT_RETENTION"|"CONTRACT_CONTINUITY";target:ContractRow;source:ContractRow;targetSequence:number;sourceSequence:number;rateBasisPoints:number;franchiseToman:number;rewardToman:number;serviceDays:number;status:"WAITING_FRANCHISE"|"PENDING_APPROVAL"}){
 const existing=await env.DB.prepare("SELECT id,status FROM caregiver_retention_rewards WHERE reward_type=? AND target_contract_id=? LIMIT 1").bind(input.rewardType,input.target.id).first<{id:string;status:string}>();
 if(existing&&["PAID","REJECTED"].includes(upper(existing.status)))return existing.id;
 const ts=nowIso();
 if(existing){await env.DB.prepare(`UPDATE caregiver_retention_rewards SET source_contract_id=?,target_contract_sequence=?,source_contract_sequence=?,rate_basis_points=?,franchise_toman=?,reward_toman=?,service_days=?,status=?,updated_at=? WHERE id=?`).bind(input.source.id,input.targetSequence,input.sourceSequence,input.rateBasisPoints,input.franchiseToman,input.rewardToman,input.serviceDays,input.status,ts,existing.id).run();return existing.id}
 const id=randomId("rrw_");
 await env.DB.prepare(`INSERT INTO caregiver_retention_rewards(id,caregiver_id,reward_type,target_contract_id,source_contract_id,target_contract_sequence,source_contract_sequence,rate_basis_points,franchise_toman,reward_toman,service_days,status,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,input.caregiverId,input.rewardType,input.target.id,input.source.id,input.targetSequence,input.sourceSequence,input.rateBasisPoints,input.franchiseToman,input.rewardToman,input.serviceDays,input.status,ts,ts).run();
 return id;
}

export async function reconcileRetentionRewardsForCaregiver(env:Env,caregiverId:string){
 const contracts=await contractsFor(env,caregiverId);if(!contracts.length)return {contracts:[],created:0};
 let created=0;
 const first=contracts[0],firstDays=servedDays(first);
 if(ACTIVE_TARGET_STATUSES.has(first.status)&&firstDays>=FIRST_MIN_DAYS){await upsertCandidate(env,{caregiverId,rewardType:"FIRST_CONTRACT_RETENTION",target:first,source:first,targetSequence:1,sourceSequence:1,rateBasisPoints:0,franchiseToman:0,rewardToman:FIRST_REWARD_TOMAN,serviceDays:firstDays,status:"PENDING_APPROVAL"});created++}
 for(let index=3;index<contracts.length;index++){
  const target=contracts[index],previous=contracts.slice(index-3,index),sequence=index+1;
  if(!ACTIVE_TARGET_STATUSES.has(target.status)||previous.length!==3||previous.some(contract=>contract.status!=="COMPLETED"))continue;
  const rateBasisPoints=rateForSequence(sequence);if(!rateBasisPoints)continue;
  const source=contracts[index-3],franchiseToman=Math.max(0,Number(source.franchiseToman||0)),rewardToman=franchiseToman>0?Math.round(franchiseToman*rateBasisPoints/10_000):0;
  await upsertCandidate(env,{caregiverId,rewardType:"CONTRACT_CONTINUITY",target,source,targetSequence:sequence,sourceSequence:index-2,rateBasisPoints,franchiseToman,rewardToman,serviceDays:0,status:franchiseToman>0?"PENDING_APPROVAL":"WAITING_FRANCHISE"});created++;
 }
 return {contracts,created};
}

async function rewardRows(env:Env,caregiverId:string){
 const result=await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,reward_type AS rewardType,target_contract_id AS targetContractId,source_contract_id AS sourceContractId,
  target_contract_sequence AS targetContractSequence,source_contract_sequence AS sourceContractSequence,rate_basis_points AS rateBasisPoints,franchise_toman AS franchiseToman,
  reward_toman AS rewardToman,service_days AS serviceDays,status,wallet_transaction_id AS walletTransactionId,reviewed_at AS reviewedAt,decision_note AS decisionNote,created_at AS createdAt,updated_at AS updatedAt
  FROM caregiver_retention_rewards WHERE caregiver_id=? ORDER BY target_contract_sequence DESC,created_at DESC`).bind(caregiverId).all<RewardRow>();
 return (result.results||[]).map(row=>({...row,targetContractSequence:Number(row.targetContractSequence),sourceContractSequence:Number(row.sourceContractSequence),rateBasisPoints:Number(row.rateBasisPoints),franchiseToman:Number(row.franchiseToman),rewardToman:Number(row.rewardToman),serviceDays:Number(row.serviceDays)}));
}

export async function buildCaregiverRetentionRewardsSummary(env:Env,caregiverId:string){
 const reconciliation=await reconcileRetentionRewardsForCaregiver(env,caregiverId),contracts=reconciliation.contracts,rewards=await rewardRows(env,caregiverId),first=contracts[0]||null,firstDays=first?servedDays(first):0;
 const paid=rewards.filter(row=>row.status==="PAID"),pending=rewards.filter(row=>row.status==="PENDING_APPROVAL"),waiting=rewards.filter(row=>row.status==="WAITING_FRANCHISE");
 const workedCount=contracts.filter(contract=>["ACTIVE","COMPLETED"].includes(contract.status)).length;
 const nextSequence=Math.max(4,contracts.length+1),nextRate=rateForSequence(nextSequence);
 return {version:"1.0.0",policy:{firstContractRetention:{minimumDays:FIRST_MIN_DAYS,rewardToman:FIRST_REWARD_TOMAN},continuity:{sourceContractOffset:3,tiers:[{targetContractSequence:4,ratePercent:8},{targetContractSequence:5,ratePercent:11},{targetContractSequenceMin:6,ratePercent:15}]}},summary:{total:rewards.length,pendingApproval:pending.length,waitingFranchise:waiting.length,paidCount:paid.length,paidToman:paid.reduce((sum,row)=>sum+row.rewardToman,0)},firstContract:first?{id:first.id,contractNumber:first.contractNumber,status:first.status,startsAt:first.startsAt,endsAt:first.endsAt,serviceDays:firstDays,remainingDays:Math.max(0,FIRST_MIN_DAYS-firstDays),minimumDays:FIRST_MIN_DAYS,rewardToman:FIRST_REWARD_TOMAN,eligibleForReview:ACTIVE_TARGET_STATUSES.has(first.status)&&firstDays>=FIRST_MIN_DAYS,reward:rewards.find(row=>row.rewardType==="FIRST_CONTRACT_RETENTION")||null}:null,continuity:{contractCount:contracts.length,workedCount,nextTargetSequence:nextSequence,nextRatePercent:ratePercent(nextRate),nextSourceSequence:nextRate?nextSequence-3:null},rewards};
}

async function candidateCaregivers(env:Env,query:string){
 const like=`%${query}%`;
 const sql=query?`SELECT DISTINCT c.id FROM caregivers c JOIN contracts x ON x.caregiver_id=c.id WHERE x.deleted_at IS NULL AND (c.full_name LIKE ? OR c.membership_code LIKE ? OR c.mobile LIKE ?) ORDER BY x.updated_at DESC LIMIT 80`:`SELECT caregiver_id AS id FROM contracts WHERE deleted_at IS NULL AND upper(status)<>'DRAFT' GROUP BY caregiver_id ORDER BY MAX(updated_at) DESC LIMIT 250`;
 const rows=await env.DB.prepare(sql).bind(...(query?[like,like,like]:[])).all<{id:string}>();return (rows.results||[]).map(row=>row.id);
}

async function adminList(request:Request,env:Env,actor:AuthUser){
 const denied=await requireAccess(env,actor,MODULE,"view");if(denied)return denied;
 await ensureRetentionRewardsSchema(env);const url=new URL(request.url),query=str(url.searchParams.get("q")).trim(),filter=upper(url.searchParams.get("status"));
 const ids=await candidateCaregivers(env,query);for(const id of ids)await reconcileRetentionRewardsForCaregiver(env,id);
 const clauses:string[]=[];const bindings:unknown[]=[];
 if(query){const like=`%${query}%`;clauses.push("(c.full_name LIKE ? OR c.membership_code LIKE ? OR c.mobile LIKE ? OR tc.contract_number LIKE ? OR sc.contract_number LIKE ?)");bindings.push(like,like,like,like,like)}
 if(["WAITING_FRANCHISE","PENDING_APPROVAL","PAID","REJECTED"].includes(filter)){clauses.push("r.status=?");bindings.push(filter)}
 const where=clauses.length?`WHERE ${clauses.join(" AND ")}`:"";
 const result=await env.DB.prepare(`SELECT r.id,r.caregiver_id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
  r.reward_type AS rewardType,r.target_contract_id AS targetContractId,tc.contract_number AS targetContractNumber,r.source_contract_id AS sourceContractId,sc.contract_number AS sourceContractNumber,
  r.target_contract_sequence AS targetContractSequence,r.source_contract_sequence AS sourceContractSequence,r.rate_basis_points AS rateBasisPoints,r.franchise_toman AS franchiseToman,
  r.reward_toman AS rewardToman,r.service_days AS serviceDays,r.status,r.wallet_transaction_id AS walletTransactionId,r.reviewed_at AS reviewedAt,r.decision_note AS decisionNote,r.created_at AS createdAt,r.updated_at AS updatedAt
  FROM caregiver_retention_rewards r JOIN caregivers c ON c.id=r.caregiver_id JOIN contracts tc ON tc.id=r.target_contract_id JOIN contracts sc ON sc.id=r.source_contract_id ${where}
  ORDER BY CASE r.status WHEN 'PENDING_APPROVAL' THEN 0 WHEN 'WAITING_FRANCHISE' THEN 1 WHEN 'PAID' THEN 2 ELSE 3 END,r.updated_at DESC LIMIT 300`).bind(...bindings).all<any>();
 const rows=(result.results||[]).map(row=>({...row,targetContractSequence:Number(row.targetContractSequence),sourceContractSequence:Number(row.sourceContractSequence),rateBasisPoints:Number(row.rateBasisPoints),ratePercent:ratePercent(Number(row.rateBasisPoints)),franchiseToman:Number(row.franchiseToman),rewardToman:Number(row.rewardToman),serviceDays:Number(row.serviceDays)}));
 const summary={pendingApproval:rows.filter(x=>x.status==="PENDING_APPROVAL").length,waitingFranchise:rows.filter(x=>x.status==="WAITING_FRANCHISE").length,paidCount:rows.filter(x=>x.status==="PAID").length,paidToman:rows.filter(x=>x.status==="PAID").reduce((sum,x)=>sum+x.rewardToman,0)};
 return json({data:{summary,rewards:rows,policy:{firstRewardToman:FIRST_REWARD_TOMAN,firstMinimumDays:FIRST_MIN_DAYS,continuityRates:[8,11,15]}}});
}

async function fetchReward(env:Env,id:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,reward_type AS rewardType,target_contract_id AS targetContractId,source_contract_id AS sourceContractId,target_contract_sequence AS targetContractSequence,source_contract_sequence AS sourceContractSequence,rate_basis_points AS rateBasisPoints,franchise_toman AS franchiseToman,reward_toman AS rewardToman,service_days AS serviceDays,status,wallet_transaction_id AS walletTransactionId FROM caregiver_retention_rewards WHERE id=? LIMIT 1`).bind(id).first<any>()}

async function decideReward(request:Request,env:Env,actor:AuthUser,id:string){
 const denied=await requireAccess(env,actor,MODULE,"update");if(denied)return denied;
 await ensureRetentionRewardsSchema(env);const body=await readBody(request)||{},action=upper(body.action||body.decision),note=str(body.note||body.reason||body.decisionNote).trim();let row=await fetchReward(env,id);if(!row)return fail("پرونده پاداش ماندگاری پیدا نشد.",404,"retention_reward_not_found");
 if(action==="SET_FRANCHISE"){
  if(upper(row.rewardType)!=="CONTRACT_CONTINUITY")return fail("پاداش ثابت قرارداد اول به فرانشیز وابسته نیست.",409,"franchise_not_required");
  const franchise=Math.max(0,Math.trunc(Number(body.franchiseToman||0)));if(franchise<=0)return fail("مبلغ فرانشیز قرارداد مبنا باید بزرگ‌تر از صفر باشد.",400,"invalid_franchise");
  await env.DB.prepare("UPDATE contracts SET franchise_toman=?,updated_at=? WHERE id=?").bind(franchise,nowIso(),row.sourceContractId).run();
  await reconcileRetentionRewardsForCaregiver(env,row.caregiverId);row=await fetchReward(env,id);await audit(request,env,actor,"SET_RETENTION_REWARD_FRANCHISE","retention_reward",id,{sourceContractId:row?.sourceContractId,franchiseToman:franchise});return json({data:row});
 }
 if(action==="REJECT"){
  if(!["WAITING_FRANCHISE","PENDING_APPROVAL"].includes(upper(row.status)))return fail("این پاداش دیگر قابل رد نیست.",409,"invalid_reward_transition");if(note.length<3)return fail("ثبت دلیل رد الزامی است.",400,"reason_required");const ts=nowIso();await env.DB.prepare("UPDATE caregiver_retention_rewards SET status='REJECTED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?").bind(actor.id,ts,note,ts,id).run();await audit(request,env,actor,"REJECT_RETENTION_REWARD","retention_reward",id,{caregiverId:row.caregiverId,reason:note});return json({data:{id,status:"REJECTED",updatedAt:ts}});
 }
 if(action!=="APPROVE")return fail("اقدام پاداش معتبر نیست.",400,"invalid_reward_action");
 await reconcileRetentionRewardsForCaregiver(env,row.caregiverId);row=await fetchReward(env,id);if(!row||upper(row.status)!=="PENDING_APPROVAL"||Number(row.rewardToman||0)<=0)return fail(upper(row?.status)==="WAITING_FRANCHISE"?"ابتدا فرانشیز قرارداد مبنا را ثبت کنید.":"شرایط این پاداش در زمان تأیید احراز نیست.",409,"retention_reward_not_eligible");
 const ts=nowIso(),transactionId=randomId("wtx_"),title=upper(row.rewardType)==="FIRST_CONTRACT_RETENTION"?"پاداش ماندگاری در شبکه سلامت اول":`پاداش ماندگاری قرارداد ${Number(row.targetContractSequence).toLocaleString("fa-IR")}`;
 await env.DB.prepare(`INSERT OR IGNORE INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at)
  VALUES(?,?,'CREDIT',?,?,?,?, 'RETENTION_REWARD',?,?,?)`).bind(transactionId,row.caregiverId,upper(row.rewardType)==="FIRST_CONTRACT_RETENTION"?"NETWORK_RETENTION_REWARD":"CONTRACT_CONTINUITY_REWARD",Number(row.rewardToman),title,upper(row.rewardType)==="FIRST_CONTRACT_RETENTION"?"ماندگاری حداقل دو ماه در اولین قرارداد":"پاداش تداوم همکاری بر مبنای فرانشیز قرارداد مبنا",id,actor.id,ts).run();
 const tx=await env.DB.prepare("SELECT id FROM caregiver_wallet_transactions WHERE reference_type='RETENTION_REWARD' AND reference_id=? AND direction='CREDIT' LIMIT 1").bind(id).first<{id:string}>();if(!tx?.id)return fail("ثبت تراکنش پاداش انجام نشد.",500,"reward_transaction_failed");
 await env.DB.prepare("UPDATE caregiver_retention_rewards SET status='PAID',wallet_transaction_id=?,reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?").bind(tx.id,actor.id,ts,note||"تأیید و واریز پاداش ماندگاری",ts,id).run();
 await audit(request,env,actor,"APPROVE_RETENTION_REWARD","retention_reward",id,{caregiverId:row.caregiverId,rewardType:row.rewardType,rewardToman:Number(row.rewardToman),walletTransactionId:tx.id});return json({data:{id,status:"PAID",rewardToman:Number(row.rewardToman),walletTransactionId:tx.id,updatedAt:ts}});
}

export async function routeRetentionRewardsV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
 if(path==="/api/staff/financial-credits/retention-rewards"&&method==="GET"){
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await adminList(request,env,actor));
 }
 const match=path.match(/^\/api\/staff\/financial-credits\/retention-rewards\/([^/]+)$/);
 if(match&&method==="PATCH"){
  const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await decideReward(request,env,actor,decodeURIComponent(match[1])));
 }
 return null;
}
