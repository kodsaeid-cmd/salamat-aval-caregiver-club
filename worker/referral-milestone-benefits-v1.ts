import {requireAccess} from "./access-control";
import {type AuthUser,type Env,audit,fail,getUser,json,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const NETWORK_KEY="NETWORK_10";
const CONTRACT_KEY="CONTRACT_7";
const NETWORK_TARGET=10;
const CONTRACT_TARGET=7;
const NETWORK_AMOUNT_TOMAN=3_000_000;
const CONTRACT_AMOUNT_TOMAN=8_000_000;
const STAFF_FINANCE_MODULE="staff.financial_credits";

type JsonRecord=Record<string,any>;
const upper=(value:unknown)=>str(value).toUpperCase();
const amountFor=(key:string)=>key===NETWORK_KEY?NETWORK_AMOUNT_TOMAN:key===CONTRACT_KEY?CONTRACT_AMOUNT_TOMAN:0;
const titleFor=(key:string)=>key===NETWORK_KEY?"تسهیلات معرفی ۱۰ عضو شبکه":"تسهیلات معرفی با ۷ ورود به قرارداد";

async function qualifyingReferralRows(env:Env,caregiverId:string){
 const rows=await env.DB.prepare(`SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,r.created_at AS referralCreatedAt,
  u.id AS userId,u.status AS accountStatus,u.created_at AS accountCreatedAt,c.full_name AS referredName,c.membership_code AS referredMembershipCode
  FROM caregiver_referral_cases r
  JOIN caregivers c ON c.id=r.referred_caregiver_id
  JOIN users u ON u.caregiver_id=r.referred_caregiver_id AND upper(u.role)='CAREGIVER' AND upper(u.status) IN ('ACTIVE','APPROVED')
  WHERE r.referrer_caregiver_id=? AND upper(r.referrer_confirmation_status)='APPROVED'
  ORDER BY r.created_at ASC,r.id ASC`).bind(caregiverId).all<JsonRecord>();
 const seen=new Set<string>(),result:any[]=[];
 for(const row of rows.results||[]){if(seen.has(String(row.referredCaregiverId)))continue;seen.add(String(row.referredCaregiverId));result.push(row)}
 return result;
}

async function loadCohort(env:Env,caregiverId:string){
 return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,cohort_size AS cohortSize,referral_case_ids_json AS referralCaseIdsJson,achieved_at AS achievedAt,created_at AS createdAt
  FROM caregiver_referral_milestone_cohorts WHERE caregiver_id=? LIMIT 1`).bind(caregiverId).first<JsonRecord>();
}

async function ensureCohort(env:Env,caregiverId:string,qualified?:any[]){
 const existing=await loadCohort(env,caregiverId);if(existing)return existing;
 const rows=qualified||await qualifyingReferralRows(env,caregiverId);if(rows.length<NETWORK_TARGET)return null;
 const firstTen=rows.slice(0,NETWORK_TARGET),id=randomId("rfco_"),ts=nowIso(),achievedAt=String(firstTen[NETWORK_TARGET-1]?.accountCreatedAt||firstTen[NETWORK_TARGET-1]?.referralCreatedAt||ts);
 await env.DB.prepare(`INSERT OR IGNORE INTO caregiver_referral_milestone_cohorts(id,caregiver_id,cohort_size,referral_case_ids_json,achieved_at,created_at) VALUES(?,?,?,?,?,?)`)
  .bind(id,caregiverId,NETWORK_TARGET,JSON.stringify(firstTen.map(x=>String(x.id))),achievedAt,ts).run();
 return loadCohort(env,caregiverId);
}

function parseIds(value:unknown){try{const parsed=JSON.parse(String(value||"[]"));return Array.isArray(parsed)?parsed.map(String).filter(Boolean):[]}catch{return []}}

async function cohortMembers(env:Env,cohort:any){
 const ids=parseIds(cohort?.referralCaseIdsJson);if(!ids.length)return [];
 const marks=ids.map(()=>"?").join(",");
 const rows=await env.DB.prepare(`SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,c.full_name AS referredName,c.membership_code AS referredMembershipCode
  FROM caregiver_referral_cases r JOIN caregivers c ON c.id=r.referred_caregiver_id WHERE r.id IN (${marks})`).bind(...ids).all<JsonRecord>();
 const byId=new Map((rows.results||[]).map((x:any)=>[String(x.id),x]));
 return ids.map(id=>byId.get(id)).filter(Boolean);
}

async function contractedMembers(env:Env,members:any[]){
 let count=0;const contractedIds:string[]=[];
 for(const member of members){const caregiverId=String(member.referredCaregiverId||"");if(!caregiverId)continue;
  const evidence=await env.DB.prepare(`SELECT 1 AS ok WHERE EXISTS(SELECT 1 FROM caregiver_job_contracts jc WHERE jc.caregiver_id=? LIMIT 1) OR EXISTS(SELECT 1 FROM care_job_applications ap WHERE ap.caregiver_id=? AND ap.status='IN_CONTRACT' LIMIT 1)`).bind(caregiverId,caregiverId).first<{ok:number}>();
  if(evidence?.ok){count+=1;contractedIds.push(caregiverId)}
 }
 return {count,contractedIds};
}

async function existingRequests(env:Env,caregiverId:string){
 const rows=await env.DB.prepare(`SELECT r.id,r.milestone_key AS milestoneKey,r.status,r.requested_at AS requestedAt,r.reviewed_at AS reviewedAt,r.decision_note AS decisionNote,r.completion_reference_id AS completionReferenceId,r.completed_at AS completedAt,r.created_at AS createdAt,r.updated_at AS updatedAt
  FROM caregiver_referral_milestone_requests r WHERE r.caregiver_id=? ORDER BY r.created_at DESC`).bind(caregiverId).all<JsonRecord>();
 return rows.results||[];
}

export async function buildReferralMilestoneBenefitsSummary(env:Env,caregiverId:string){
 const qualified=await qualifyingReferralRows(env,caregiverId),cohort=await ensureCohort(env,caregiverId,qualified),members=cohort?await cohortMembers(env,cohort):[],contracted=cohort?await contractedMembers(env,members):{count:0,contractedIds:[]},requests=await existingRequests(env,caregiverId);
 const requestByKey=new Map(requests.map((x:any)=>[String(x.milestoneKey),x]));
 const networkCurrent=Math.min(NETWORK_TARGET,qualified.length),contractCurrent=Math.min(CONTRACT_TARGET,contracted.count);
 return {
  policyVersion:"REFERRAL-MILESTONES-2026-08",
  cohort:cohort?{id:cohort.id,size:NETWORK_TARGET,locked:true,achievedAt:cohort.achievedAt,referralCaseIds:parseIds(cohort.referralCaseIdsJson)}:{id:null,size:NETWORK_TARGET,locked:false,achievedAt:null,referralCaseIds:[]},
  network10:{key:NETWORK_KEY,title:titleFor(NETWORK_KEY),amountToman:NETWORK_AMOUNT_TOMAN,target:NETWORK_TARGET,current:networkCurrent,totalQualified:qualified.length,remaining:Math.max(0,NETWORK_TARGET-networkCurrent),eligible:qualified.length>=NETWORK_TARGET,request:requestByKey.get(NETWORK_KEY)||null},
  contract7:{key:CONTRACT_KEY,title:titleFor(CONTRACT_KEY),amountToman:CONTRACT_AMOUNT_TOMAN,target:CONTRACT_TARGET,current:contractCurrent,cohortSize:NETWORK_TARGET,remaining:Math.max(0,CONTRACT_TARGET-contractCurrent),eligible:Boolean(cohort&&contracted.count>=CONTRACT_TARGET),contractedCaregiverIds:contracted.contractedIds,request:requestByKey.get(CONTRACT_KEY)||null}
 };
}

async function addEvent(env:Env,requestId:string,eventType:string,previousStatus:string|null,newStatus:string,actorId:string,snapshot:any){
 await env.DB.prepare(`INSERT INTO caregiver_referral_milestone_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)`)
  .bind(randomId("rfev_"),requestId,eventType,previousStatus,newStatus,actorId,JSON.stringify(snapshot||{}),nowIso()).run();
}

async function createRequest(request:Request,env:Env,actor:AuthUser){
 if(upper(actor.role)!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only");
 const body=await readBody(request);if(!body)return fail("اطلاعات درخواست معتبر نیست.");const key=upper(body.milestoneKey);if(![NETWORK_KEY,CONTRACT_KEY].includes(key))return fail("پله معرفی انتخاب‌شده معتبر نیست.");
 const summary=await buildReferralMilestoneBenefitsSummary(env,actor.caregiverId),tier=key===NETWORK_KEY?summary.network10:summary.contract7;if(!tier.eligible)return fail("شرایط این پله معرفی هنوز کامل نشده است.",409,"referral_milestone_not_eligible");if(!summary.cohort.id)return fail("گروه ۱۰ نفره معرفی هنوز تثبیت نشده است.",409,"referral_cohort_not_ready");
 const existing=tier.request;if(existing)return fail("برای این پله قبلاً درخواست ثبت شده است.",409,"referral_milestone_request_exists");
 const id=randomId("rfrq_"),ts=nowIso(),snapshot={policyVersion:summary.policyVersion,milestoneKey:key,amountToman:amountFor(key),cohort:summary.cohort,network10:{current:summary.network10.current,target:summary.network10.target,totalQualified:summary.network10.totalQualified},contract7:{current:summary.contract7.current,target:summary.contract7.target}};
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO caregiver_referral_milestone_requests(id,caregiver_id,cohort_id,milestone_key,eligibility_snapshot_json,status,requested_by_user_id,requested_at,created_at,updated_at) VALUES(?,?,?,?,?,'REQUESTED',?,?,?,?,?)`).bind(id,actor.caregiverId,summary.cohort.id,key,JSON.stringify(snapshot),actor.id,ts,ts,ts),
  env.DB.prepare(`INSERT INTO caregiver_referral_milestone_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,'REQUESTED',NULL,'REQUESTED',?,?,?)`).bind(randomId("rfev_"),id,actor.id,JSON.stringify(snapshot),ts)
 ]);
 await audit(request,env,actor,"CREATE_REFERRAL_MILESTONE_REQUEST","caregiver_referral_milestone_request",id,{milestoneKey:key,amountToman:amountFor(key),snapshot});
 return json({data:{id,status:"REQUESTED",milestoneKey:key,amountToman:amountFor(key)}},201);
}

async function staffRows(env:Env){
 const rows=await env.DB.prepare(`SELECT r.id,r.caregiver_id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,r.milestone_key AS milestoneKey,r.status,r.eligibility_snapshot_json AS eligibilitySnapshotJson,r.requested_at AS requestedAt,r.reviewed_at AS reviewedAt,r.decision_note AS decisionNote,r.completion_reference_id AS completionReferenceId,r.completed_at AS completedAt
  FROM caregiver_referral_milestone_requests r JOIN caregivers c ON c.id=r.caregiver_id ORDER BY CASE r.status WHEN 'REQUESTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 WHEN 'REJECTED' THEN 2 ELSE 3 END,r.requested_at DESC LIMIT 500`).all<JsonRecord>();
 return (rows.results||[]).map((x:any)=>({...x,amountToman:amountFor(String(x.milestoneKey)),title:titleFor(String(x.milestoneKey)),eligibilitySnapshot:(()=>{try{return JSON.parse(String(x.eligibilitySnapshotJson||"{}"))}catch{return {}}})()}));
}

export async function buildStaffReferralMilestoneData(env:Env){
 const requests=await staffRows(env);const summary=requests.reduce((s:any,x:any)=>{s.total+=1;if(x.status==="REQUESTED")s.requested+=1;if(x.status==="UNDER_REVIEW")s.underReview+=1;if(x.status==="COMPLETED"){s.completed+=1;s.completedAmountToman+=Number(x.amountToman||0)}return s},{total:0,requested:0,underReview:0,completed:0,completedAmountToman:0});
 return {summary,requests,policy:{network:{key:NETWORK_KEY,target:NETWORK_TARGET,amountToman:NETWORK_AMOUNT_TOMAN},contract:{key:CONTRACT_KEY,target:CONTRACT_TARGET,cohortSize:NETWORK_TARGET,amountToman:CONTRACT_AMOUNT_TOMAN}}};
}

async function requestRow(env:Env,id:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,cohort_id AS cohortId,milestone_key AS milestoneKey,status,eligibility_snapshot_json AS eligibilitySnapshotJson,completion_reference_id AS completionReferenceId FROM caregiver_referral_milestone_requests WHERE id=? LIMIT 1`).bind(id).first<JsonRecord>()}

async function staffAction(request:Request,env:Env,actor:AuthUser,id:string){
 const denied=await requireAccess(env,actor,STAFF_FINANCE_MODULE,"update");if(denied)return denied;const body=await readBody(request.clone());if(!body)return fail("اطلاعات تصمیم معتبر نیست.");const action=upper(body.action),note=str(body.note)||null,current=await requestRow(env,id);if(!current)return fail("درخواست معرفی پیدا نشد.",404,"referral_milestone_request_not_found");
 const oldStatus=upper(current.status),ts=nowIso();if(action==="UNDER_REVIEW"){if(oldStatus==="COMPLETED")return fail("این درخواست قبلاً تکمیل شده است.",409,"already_completed");await env.DB.prepare(`UPDATE caregiver_referral_milestone_requests SET status='UNDER_REVIEW',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,note,ts,id).run();await addEvent(env,id,"UNDER_REVIEW",oldStatus,"UNDER_REVIEW",actor.id,{note});await audit(request,env,actor,"REVIEW_REFERRAL_MILESTONE_REQUEST","caregiver_referral_milestone_request",id,{previousStatus:oldStatus,note});return json({data:{id,status:"UNDER_REVIEW"}})}
 if(action==="REJECT"){if(oldStatus==="COMPLETED")return fail("درخواست تکمیل‌شده قابل رد نیست.",409,"already_completed");await env.DB.prepare(`UPDATE caregiver_referral_milestone_requests SET status='REJECTED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,note,ts,id).run();await addEvent(env,id,"REJECTED",oldStatus,"REJECTED",actor.id,{note});await audit(request,env,actor,"REJECT_REFERRAL_MILESTONE_REQUEST","caregiver_referral_milestone_request",id,{previousStatus:oldStatus,note});return json({data:{id,status:"REJECTED"}})}
 if(action!=="APPROVE")return fail("اقدام انتخاب‌شده معتبر نیست.");if(oldStatus==="COMPLETED")return json({data:{id,status:"COMPLETED",completionReferenceId:current.completionReferenceId,alreadyCompleted:true}});
 const latest=await buildReferralMilestoneBenefitsSummary(env,String(current.caregiverId)),tier=String(current.milestoneKey)===NETWORK_KEY?latest.network10:latest.contract7;if(!tier.eligible)return fail("شرایط این پله در زمان تأیید کامل نیست.",409,"referral_milestone_revalidation_failed");
 const existingTx=await env.DB.prepare(`SELECT id FROM caregiver_wallet_transactions WHERE reference_type='REFERRAL_MILESTONE_REQUEST' AND reference_id=? AND direction='CREDIT' LIMIT 1`).bind(id).first<{id:string}>();
 const transactionId=existingTx?.id||randomId("wtx_"),amount=amountFor(String(current.milestoneKey)),transactionType=String(current.milestoneKey)===NETWORK_KEY?"REFERRAL_NETWORK_BENEFIT_3M":"REFERRAL_CONTRACT_BENEFIT_8M",title=titleFor(String(current.milestoneKey));
 const statements:any[]=[];if(!existingTx)statements.push(env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT',?,?,?,?, 'REFERRAL_MILESTONE_REQUEST',?,?,?)`).bind(transactionId,current.caregiverId,transactionType,amount,title,note||"تأیید درخواست در تب پاداش معرفی",id,actor.id,ts));
 statements.push(env.DB.prepare(`UPDATE caregiver_referral_milestone_requests SET status='COMPLETED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,completion_reference_id=?,completed_at=?,updated_at=? WHERE id=? AND status<>'COMPLETED'`).bind(actor.id,ts,note,transactionId,ts,ts,id));
 statements.push(env.DB.prepare(`INSERT INTO caregiver_referral_milestone_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,'APPROVED',?,'COMPLETED',?,?,?)`).bind(randomId("rfev_"),id,oldStatus,actor.id,JSON.stringify({amountToman:amount,completionReferenceId:transactionId,revalidated:true,note}),ts));
 await env.DB.batch(statements);await audit(request,env,actor,"APPROVE_REFERRAL_MILESTONE_REQUEST","caregiver_referral_milestone_request",id,{milestoneKey:current.milestoneKey,amountToman:amount,transactionId,revalidated:true});return json({data:{id,status:"COMPLETED",completionReferenceId:transactionId,amountToman:amount}})
}

export async function routeReferralMilestoneBenefitsV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname==="/api/caregiver/platform/referral-milestone-requests"&&method==="POST"){const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await createRequest(request,env,actor))}
 const staffMatch=url.pathname.match(/^\/api\/staff\/financial-credits\/referrals\/milestones\/([^/]+)$/);if(staffMatch&&method==="PATCH"){const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await staffAction(request,env,actor,decodeURIComponent(staffMatch[1])))}
 return null;
}
