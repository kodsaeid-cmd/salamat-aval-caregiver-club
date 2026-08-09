import {type AuthUser,type Env,fail,getUser,json,nowIso,readBody,securityHeaders,str} from "./lib";
import {ensureCaregiverPlatformSchema} from "./caregiver-platform-v1";
import {ensureEvaluationSchema} from "./evaluations";
import {ensureJobAdsSchema} from "./job-ads-v1";

const MODULES=new Set(["jobs","scorecard","benefits","wallet","support","training","contract","shifts","profile"]);
let schemaReady:Promise<void>|undefined;

type Item={id:string;moduleKey:string;kind:string;title:string;body:string;createdAt:string;route:string;amountToman?:number;points?:number;status?:string};

async function ensureNotificationSchema(env:Env){
 if(!schemaReady)schemaReady=(async()=>{
  await Promise.all([ensureCaregiverPlatformSchema(env),ensureEvaluationSchema(env),ensureJobAdsSchema(env)]);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_module_reads(
    caregiver_id TEXT NOT NULL,module_key TEXT NOT NULL,last_seen_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    PRIMARY KEY(caregiver_id,module_key),FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_caregiver_module_reads_caregiver ON caregiver_module_reads(caregiver_id,updated_at DESC)").run();
 })().catch(e=>{schemaReady=undefined;throw e});return schemaReady;
}
async function safeAll<T>(env:Env,sql:string,bindings:unknown[]=[]){try{const r=await env.DB.prepare(sql).bind(...bindings).all<T>();return r.results||[]}catch{return []}}
function caregiverOnly(actor:AuthUser){return actor.role.toUpperCase()==="CAREGIVER"&&Boolean(actor.caregiverId)}
function humanStatus(value:unknown){const s=String(value||"").toUpperCase();return ({FINAL:"نهایی",DRAFT:"در حال ارزیابی",APPROVED:"تأییدشده",UNDER_REVIEW:"در حال بررسی",REQUESTED:"در انتظار بررسی",REJECTED:"ردشده",PAID:"پرداخت‌شده"} as Record<string,string>)[s]||str(value)}

async function buildItems(env:Env,caregiverId:string):Promise<Item[]>{
 const [evaluations,ads,points,wallet,credits,support]=await Promise.all([
  safeAll<any>(env,`SELECT p.id,p.title,p.status,p.final_score AS finalScore,
      COALESCE((SELECT MAX(s.updated_at) FROM caregiver_evaluation_scores s WHERE s.evaluation_id=p.id),p.updated_at,p.created_at) AS eventAt
    FROM caregiver_evaluation_periods p WHERE p.caregiver_id=? ORDER BY eventAt DESC LIMIT 30`,[caregiverId]),
  safeAll<any>(env,`SELECT id,contract_type AS contractType,shift_type AS shiftType,caregiver_salary_rial AS salaryRial,
      duration_days AS durationDays,contract_points AS contractPoints,published_at AS eventAt
    FROM care_job_ads WHERE status='PUBLISHED' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 40`),
  safeAll<any>(env,`SELECT id,points,ad_id AS adId,awarded_at AS eventAt FROM caregiver_contract_point_ledger
    WHERE caregiver_id=? ORDER BY awarded_at DESC LIMIT 40`,[caregiverId]),
  safeAll<any>(env,`SELECT id,direction,transaction_type AS transactionType,amount_toman AS amountToman,title,description,created_at AS eventAt
    FROM caregiver_wallet_transactions WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 50`,[caregiverId]),
  safeAll<any>(env,`SELECT id,requested_amount_toman AS amountToman,status,decision_note AS decisionNote,
      eligibility_path AS eligibilityPath,updated_at AS eventAt FROM caregiver_credit_requests
    WHERE caregiver_id=? ORDER BY updated_at DESC LIMIT 30`,[caregiverId]),
  safeAll<any>(env,`SELECT m.id,m.message_type AS messageType,m.text_content AS textContent,m.created_at AS eventAt,t.subject,
      u.full_name AS senderName FROM support_messages m JOIN support_threads t ON t.id=m.thread_id
      JOIN users u ON u.id=m.sender_user_id WHERE t.caregiver_id=? AND (u.caregiver_id IS NULL OR u.caregiver_id<>?)
      ORDER BY m.created_at DESC LIMIT 50`,[caregiverId,caregiverId]),
 ]);
 const items:Item[]=[];
 for(const x of evaluations){const score=x.finalScore==null?"":` • امتیاز ${Number(x.finalScore).toLocaleString("fa-IR")}`;items.push({id:`evaluation:${x.id}:${x.eventAt}`,moduleKey:"scorecard",kind:"EVALUATION",title:x.status==="FINAL"?"کارنامه ارزیابی نهایی شد":"کارنامه ارزیابی به‌روزرسانی شد",body:`${str(x.title)||"دوره ارزیابی"} • ${humanStatus(x.status)}${score}`,createdAt:x.eventAt,route:"scorecard",status:x.status})}
 for(const x of ads){items.push({id:`job:${x.id}:${x.eventAt}`,moduleKey:"jobs",kind:"JOB_AD",title:"آگهی مراقبت جدید منتشر شد",body:`${Number(x.contractPoints||0).toLocaleString("fa-IR")} امتیاز • ${Number(x.durationDays||0).toLocaleString("fa-IR")} روز • حقوق ${Number(x.salaryRial||0).toLocaleString("fa-IR")} ریال`,createdAt:x.eventAt,route:"jobs",points:Number(x.contractPoints||0)})}
 for(const x of points){items.push({id:`points:${x.id}`,moduleKey:"benefits",kind:"CONTRACT_POINTS",title:"امتیاز قرارداد به شما تخصیص یافت",body:`${Number(x.points||0).toLocaleString("fa-IR")} امتیاز جدید به اعتبار قراردادی شما اضافه شد.`,createdAt:x.eventAt,route:"benefits",points:Number(x.points||0)})}
 for(const x of wallet){const direction=x.direction==="DEBIT"?"برداشت":"شارژ";items.push({id:`wallet:${x.id}`,moduleKey:"wallet",kind:"WALLET",title:`${direction} کیف پول`,body:`${str(x.title)||"تراکنش کیف پول"} • ${Number(x.amountToman||0).toLocaleString("fa-IR")} تومان`,createdAt:x.eventAt,route:"wallet",amountToman:Number(x.amountToman||0),status:x.direction})}
 for(const x of credits){items.push({id:`credit:${x.id}:${x.eventAt}`,moduleKey:"benefits",kind:"CREDIT",title:x.status==="APPROVED"?"تسهیلات شما تأیید شد":"وضعیت درخواست تسهیلات تغییر کرد",body:`${Number(x.amountToman||0).toLocaleString("fa-IR")} تومان • ${humanStatus(x.status)}${x.decisionNote?` • ${str(x.decisionNote)}`:""}`,createdAt:x.eventAt,route:"benefits",amountToman:Number(x.amountToman||0),status:x.status})}
 for(const x of support){items.push({id:`support:${x.id}`,moduleKey:"support",kind:"SUPPORT",title:`پیام جدید پشتیبانی${x.senderName?` از ${str(x.senderName)}`:""}`,body:x.messageType==="VOICE"?`پیام صوتی • ${str(x.subject)}`:(str(x.textContent)||str(x.subject)||"پیام جدید"),createdAt:x.eventAt,route:"support"})}
 return items.filter(x=>x.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,120);
}

async function list(env:Env,actor:AuthUser){const caregiverId=String(actor.caregiverId);const [items,reads]=await Promise.all([buildItems(env,caregiverId),safeAll<any>(env,"SELECT module_key AS moduleKey,last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=?",[caregiverId])]);const readMap=new Map(reads.map(x=>[x.moduleKey,x.lastSeenAt]));const enriched=items.map(item=>({...item,unread:!readMap.get(item.moduleKey)||String(item.createdAt)>String(readMap.get(item.moduleKey))}));const unreadByModule:Record<string,number>={};for(const item of enriched)if(item.unread)unreadByModule[item.moduleKey]=(unreadByModule[item.moduleKey]||0)+1;return json({data:{items:enriched,unreadByModule,unreadTotal:Object.values(unreadByModule).reduce((a,b)=>a+b,0),generatedAt:nowIso()}})}
async function markRead(request:Request,env:Env,actor:AuthUser){const body=await readBody(request),moduleKey=str(body?.moduleKey);if(!MODULES.has(moduleKey))return fail("ماژول اعلان معتبر نیست.",400,"invalid_notification_module");const ts=nowIso();await env.DB.prepare(`INSERT INTO caregiver_module_reads(caregiver_id,module_key,last_seen_at,updated_at) VALUES(?,?,?,?)
  ON CONFLICT(caregiver_id,module_key) DO UPDATE SET last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`).bind(actor.caregiverId,moduleKey,ts,ts).run();return json({data:{moduleKey,lastSeenAt:ts}})}

export async function routeCaregiverNotifications(request:Request,env:Env):Promise<Response|null>{const url=new URL(request.url);if(!url.pathname.startsWith("/api/caregiver/notifications"))return null;const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));if(!caregiverOnly(actor))return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");await ensureNotificationSchema(env);if(url.pathname==="/api/caregiver/notifications"&&request.method==="GET")return list(env,actor);if(url.pathname==="/api/caregiver/notifications/read"&&request.method==="POST")return markRead(request,env,actor);return fail("مسیر اعلان معتبر نیست.",404,"not_found")}
