import {routeCaregiverPlatformOverrides} from "./caregiver-platform-overrides";
import {decorateCaregiverWelcomeNotificationV1} from "./caregiver-initial-credentials-v1";
import {routeCaregiverNotificationsUnityV1} from "./job-ad-caregiver-unity-v1";
import {type AuthUser,type Env,fail,getUser,json,securityHeaders,str} from "./lib";

const REFERRAL_AMOUNTS:Record<string,number>={NETWORK_10:3_000_000,CONTRACT_7:8_000_000};
const REFERRAL_TITLES:Record<string,string>={NETWORK_10:"وام معرفی ۱۰ ثبت‌نام",CONTRACT_7:"وام معرفی با ۷ ورود به قرارداد"};
const STATUS_FA:Record<string,string>={REQUESTED:"در انتظار بررسی",UNDER_REVIEW:"در حال بررسی",APPROVED:"تأیید شده",REJECTED:"رد شده",PAID:"پرداخت شده",COMPLETED:"تأیید و واریز شده",CANCELLED:"لغو شده"};
const upper=(value:unknown)=>str(value).toUpperCase();
type CaregiverAuth={error:Response}|{actor:AuthUser;caregiverId:string};

async function safeAll<T>(env:Env,sql:string,bindings:unknown[]=[]){try{const r=await env.DB.prepare(sql).bind(...bindings).all<T>();return r.results||[]}catch(error){console.error("caregiver_request_center_query_failed",error instanceof Error?error.message:String(error));return []}}
async function actorCaregiver(request:Request,env:Env):Promise<CaregiverAuth>{const actor=await getUser(request,env);if(!actor)return{error:securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"))};if(upper(actor.role)!=="CAREGIVER"||!actor.caregiverId)return{error:securityHeaders(fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only"))};return{actor,caregiverId:String(actor.caregiverId)}}
function event(status:string,at:unknown,note?:unknown){return at?{status:upper(status),label:STATUS_FA[upper(status)]||str(status),at:String(at),note:str(note)||null}:null}
function cleanTimeline(items:any[]){const seen=new Set<string>();return items.filter(Boolean).sort((a,b)=>String(a.at).localeCompare(String(b.at))).filter(x=>{const key=`${x.status}:${x.at}`;if(seen.has(key))return false;seen.add(key);return true})}

async function requestHistory(request:Request,env:Env):Promise<Response>{
 const auth=await actorCaregiver(request,env);if("error" in auth)return auth.error;const caregiverId=auth.caregiverId;
 const [credits,settlements,referrals,referralEvents]=await Promise.all([
  safeAll<any>(env,`SELECT id,requested_amount_toman AS amountToman,eligibility_path AS eligibilityPath,note,status,decision_note AS decisionNote,reviewed_at AS reviewedAt,created_at AS requestedAt,updated_at AS updatedAt FROM caregiver_credit_requests WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 100`,[caregiverId]),
  safeAll<any>(env,`SELECT id,amount_toman AS amountToman,status,note,decision_note AS decisionNote,reviewed_at AS reviewedAt,paid_at AS paidAt,payment_tracking_number AS paymentTrackingNumber,created_at AS requestedAt,updated_at AS updatedAt FROM caregiver_settlement_requests WHERE caregiver_id=? ORDER BY created_at DESC LIMIT 100`,[caregiverId]),
  safeAll<any>(env,`SELECT id,milestone_key AS milestoneKey,cycle_number AS cycleNumber,target_count AS targetCount,qualified_count_at_request AS qualifiedCountAtRequest,status,decision_note AS decisionNote,requested_at AS requestedAt,reviewed_at AS reviewedAt,completed_at AS completedAt,updated_at AS updatedAt FROM caregiver_referral_recurring_loan_requests WHERE caregiver_id=? ORDER BY requested_at DESC LIMIT 100`,[caregiverId]),
  safeAll<any>(env,`SELECT e.request_id AS requestId,e.event_type AS eventType,e.previous_status AS previousStatus,e.new_status AS newStatus,e.snapshot_json AS snapshotJson,e.created_at AS createdAt FROM caregiver_referral_recurring_loan_request_events e JOIN caregiver_referral_recurring_loan_requests r ON r.id=e.request_id WHERE r.caregiver_id=? ORDER BY e.created_at ASC LIMIT 500`,[caregiverId]),
 ]);
 const eventMap=new Map<string,any[]>();for(const e of referralEvents){const arr=eventMap.get(String(e.requestId))||[];let snapshot:any={};try{snapshot=JSON.parse(String(e.snapshotJson||"{}"))}catch{}arr.push({status:upper(e.newStatus),label:STATUS_FA[upper(e.newStatus)]||str(e.newStatus),at:e.createdAt,note:str(snapshot?.note)||null,eventType:e.eventType});eventMap.set(String(e.requestId),arr)}
 const items:any[]=[];
 for(const x of settlements){const s=upper(x.status),timeline=cleanTimeline([event("REQUESTED",x.requestedAt),x.reviewedAt?event(s==="PAID"?"APPROVED":s,x.reviewedAt,x.decisionNote):null,x.paidAt?event("PAID",x.paidAt,x.decisionNote):null]);items.push({id:x.id,type:"SETTLEMENT",title:"تقاضای تسویه کیف پول",amountToman:Number(x.amountToman||0),status:s,statusLabel:STATUS_FA[s]||str(x.status),requestedAt:x.requestedAt,updatedAt:x.updatedAt,decisionNote:x.decisionNote||null,paymentTrackingNumber:x.paymentTrackingNumber||null,timeline})}
 for(const x of referrals){const key=upper(x.milestoneKey),s=upper(x.status),cycle=Math.max(1,Number(x.cycleNumber||1)),timeline=eventMap.get(String(x.id))||cleanTimeline([event("REQUESTED",x.requestedAt),x.reviewedAt?event(s,x.reviewedAt,x.decisionNote):null,x.completedAt?event("COMPLETED",x.completedAt,x.decisionNote):null]);items.push({id:x.id,type:"REFERRAL_LOAN",title:`${REFERRAL_TITLES[key]||"وام معرفی"} - دوره ${cycle.toLocaleString("fa-IR")}`,amountToman:REFERRAL_AMOUNTS[key]||0,status:s,statusLabel:STATUS_FA[s]||str(x.status),requestedAt:x.requestedAt,updatedAt:x.updatedAt,decisionNote:x.decisionNote||null,milestoneKey:key,cycleNumber:cycle,targetCount:Number(x.targetCount||0),qualifiedCountAtRequest:Number(x.qualifiedCountAtRequest||0),timeline})}
 for(const x of credits){const s=upper(x.status),path=str(x.eligibilityPath),timeline=cleanTimeline([event("REQUESTED",x.requestedAt),x.reviewedAt?event(s,x.reviewedAt,x.decisionNote):null]);items.push({id:x.id,type:"CREDIT",title:path.startsWith("POINT_LOAN_")?`درخواست تسهیلات ${path.replace("POINT_LOAN_","")} امتیازی`:"درخواست تسهیلات",amountToman:Number(x.amountToman||0),status:s,statusLabel:STATUS_FA[s]||str(x.status),requestedAt:x.requestedAt,updatedAt:x.updatedAt,decisionNote:x.decisionNote||null,note:x.note||null,eligibilityPath:path,timeline})}
 items.sort((a,b)=>String(b.requestedAt||b.updatedAt).localeCompare(String(a.requestedAt||a.updatedAt)));
 const open=items.filter(x=>["REQUESTED","UNDER_REVIEW","APPROVED"].includes(x.status)).length;
 return securityHeaders(json({data:{items,summary:{total:items.length,open,settlements:settlements.length,referralLoans:referrals.length,credits:credits.length}}}));
}

function settlementStatusLine(row:any){const s=upper(row?.status),label=STATUS_FA[s]||str(row?.status);const parts=[`وضعیت درخواست: ${label}`];if(row?.decisionNote)parts.push(`نتیجه: ${str(row.decisionNote)}`);if(row?.paymentTrackingNumber)parts.push(`پیگیری: ${str(row.paymentTrackingNumber)}`);return parts.join(" • ")}
async function walletUnified(request:Request,env:Env):Promise<Response|null>{
 const response=await routeCaregiverPlatformOverrides(request,env);if(!response)return null;if(!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 const summary=payload.data.summary||{},spendable=Math.max(0,Number(summary.availableToman??summary.balanceToman??0));payload.data.summary={...summary,balanceToman:spendable,availableToman:spendable,pendingSettlementToman:0};
 const settlementMap=new Map<string,any>((Array.isArray(payload.data.settlements)?payload.data.settlements:[]).map((x:any)=>[String(x.id),x]));
 if(Array.isArray(payload.data.transactions))payload.data.transactions=payload.data.transactions.map((tx:any)=>{if(upper(tx.referenceType)!=="SETTLEMENT_REQUEST")return tx;const row=settlementMap.get(String(tx.referenceId));if(!row)return tx;return{...tx,description:settlementStatusLine(row),requestStatus:row.status,decisionNote:row.decisionNote||null,paymentTrackingNumber:row.paymentTrackingNumber||null,reviewedAt:row.reviewedAt||null,paidAt:row.paidAt||null}});
 return securityHeaders(json(payload,response.status));
}

function financialNotification(kind:string,row:any,lastSeen:string){
 const s=upper(row.status),amount=Number(row.amountToman||0),amountFa=amount.toLocaleString("fa-IR");let title="",body="",moduleKey="benefits",route="benefits",createdAt=String(row.eventAt||row.updatedAt||"");
 if(kind==="SETTLEMENT"){moduleKey="wallet";route="wallet";if(s==="APPROVED")title="درخواست تسویه شما تأیید شد";else if(s==="REJECTED")title="درخواست تسویه شما رد شد";else if(s==="PAID")title="تسویه کیف پول شما پرداخت شد";else return null;body=`${amountFa} تومان • ${STATUS_FA[s]||s}${row.decisionNote?` • ${str(row.decisionNote)}`:""}${row.paymentTrackingNumber?` • شماره پیگیری ${str(row.paymentTrackingNumber)}`:""}`}
 else {if(s==="UNDER_REVIEW")title="درخواست وام معرفی در حال بررسی است";else if(s==="REJECTED")title="درخواست وام معرفی رد شد";else if(s==="COMPLETED")title="درخواست وام معرفی تأیید شد";else return null;body=`${str(row.title)||"وام معرفی"} • ${amountFa} تومان • ${STATUS_FA[s]||s}${row.decisionNote?` • ${str(row.decisionNote)}`:""}`}
 return{id:`request-result:${kind}:${row.id}:${s}:${createdAt}`,moduleKey,kind:`${kind}_REQUEST_RESULT`,title,body,createdAt,route,amountToman:amount,status:s,unread:Boolean(createdAt)&&createdAt>lastSeen};
}
async function notificationsUnified(request:Request,env:Env):Promise<Response|null>{
 const base=await routeCaregiverNotificationsUnityV1(request,env);if(!base)return null;const withWelcome=await decorateCaregiverWelcomeNotificationV1(request,env,base);if(!withWelcome.ok)return withWelcome;
 const auth=await actorCaregiver(request,env);if("error" in auth)return auth.error;const caregiverId=auth.caregiverId,payload:any=await withWelcome.clone().json().catch(()=>null);if(!payload?.data?.items)return withWelcome;
 const [reads,settlements,referrals]=await Promise.all([
  safeAll<any>(env,"SELECT module_key AS moduleKey,last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key IN ('wallet','benefits')",[caregiverId]),
  safeAll<any>(env,`SELECT id,amount_toman AS amountToman,status,decision_note AS decisionNote,payment_tracking_number AS paymentTrackingNumber,CASE WHEN status='PAID' THEN COALESCE(paid_at,updated_at) ELSE COALESCE(reviewed_at,updated_at) END AS eventAt FROM caregiver_settlement_requests WHERE caregiver_id=? AND status IN ('APPROVED','REJECTED','PAID') ORDER BY eventAt DESC LIMIT 50`,[caregiverId]),
  safeAll<any>(env,`SELECT id,milestone_key AS milestoneKey,cycle_number AS cycleNumber,status,decision_note AS decisionNote,updated_at AS eventAt FROM caregiver_referral_recurring_loan_requests WHERE caregiver_id=? AND status IN ('UNDER_REVIEW','REJECTED','COMPLETED') ORDER BY updated_at DESC LIMIT 50`,[caregiverId]),
 ]);
 const readMap=new Map(reads.map(x=>[String(x.moduleKey),String(x.lastSeenAt||"")]));const extra:any[]=[];
 for(const x of settlements){const n=financialNotification("SETTLEMENT",x,readMap.get("wallet")||"");if(n)extra.push(n)}
 for(const x of referrals){const key=upper(x.milestoneKey),cycle=Math.max(1,Number(x.cycleNumber||1)),n=financialNotification("REFERRAL_LOAN",{...x,amountToman:REFERRAL_AMOUNTS[key]||0,title:`${REFERRAL_TITLES[key]||"وام معرفی"} - دوره ${cycle.toLocaleString("fa-IR")}`},readMap.get("benefits")||"");if(n)extra.push(n)}
 const byId=new Map<string,any>();for(const item of [...payload.data.items,...extra])if(item?.id)byId.set(String(item.id),item);const merged=[...byId.values()].filter(x=>x.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,160),unreadByModule:Record<string,number>={};for(const item of merged)if(item.unread)unreadByModule[item.moduleKey]=(unreadByModule[item.moduleKey]||0)+1;payload.data.items=merged;payload.data.unreadByModule=unreadByModule;payload.data.unreadTotal=Object.values(unreadByModule).reduce((a,b)=>a+b,0);return securityHeaders(json(payload,withWelcome.status));
}

export async function routeCaregiverRequestCenterV1(request:Request,env:Env):Promise<Response|null>{const url=new URL(request.url),method=request.method.toUpperCase();if(url.pathname==="/api/caregiver/platform/requests"&&method==="GET")return requestHistory(request,env);if(url.pathname==="/api/caregiver/platform/wallet"&&method==="GET")return walletUnified(request,env);if(url.pathname==="/api/caregiver/notifications"&&method==="GET")return notificationsUnified(request,env);return null}
