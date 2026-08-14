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
const targetFor=(key:string)=>key===NETWORK_KEY?NETWORK_TARGET:key===CONTRACT_KEY?CONTRACT_TARGET:0;
const titleFor=(key:string,cycleNumber?:number)=>`${key===NETWORK_KEY?"وام معرفی ۱۰ ثبت‌نام":"وام معرفی با ۷ ورود به قرارداد"}${cycleNumber?` - دوره ${cycleNumber}`:""}`;

async function registeredReferralRows(env:Env,caregiverId:string){
 const rows=await env.DB.prepare(`SELECT r.id,r.referred_caregiver_id AS referredCaregiverId,r.created_at AS referralCreatedAt,
   r.contract_reward_transaction_id AS contractRewardTransactionId,
   CASE WHEN r.contract_reward_transaction_id IS NOT NULL
     OR EXISTS(SELECT 1 FROM caregiver_job_contracts jc WHERE jc.caregiver_id=r.referred_caregiver_id LIMIT 1)
     OR EXISTS(SELECT 1 FROM care_job_applications ap WHERE ap.caregiver_id=r.referred_caregiver_id AND ap.status='IN_CONTRACT' LIMIT 1)
   THEN 1 ELSE 0 END AS contracted
  FROM caregiver_referral_cases r
  JOIN caregivers c ON c.id=r.referred_caregiver_id
  WHERE r.referrer_caregiver_id=?
  ORDER BY r.created_at ASC,r.id ASC`).bind(caregiverId).all<JsonRecord>();
 const seen=new Set<string>(),result:JsonRecord[]=[];
 for(const row of rows.results||[]){const id=String(row.referredCaregiverId||"");if(!id||seen.has(id))continue;seen.add(id);result.push(row)}
 return result;
}

function contractedMembers(members:any[]){
 const contractedIds:string[]=[];
 for(const member of members){if(Number(member.contracted||0)!==1)continue;const caregiverId=String(member.referredCaregiverId||"");if(caregiverId)contractedIds.push(caregiverId)}
 return {count:contractedIds.length,contractedIds};
}

async function existingRequests(env:Env,caregiverId:string){
 const rows=await env.DB.prepare(`SELECT r.id,r.milestone_key AS milestoneKey,r.cycle_number AS cycleNumber,r.target_count AS targetCount,
   r.qualified_count_at_request AS qualifiedCountAtRequest,r.status,r.requested_at AS requestedAt,r.reviewed_at AS reviewedAt,
   r.decision_note AS decisionNote,r.completion_reference_id AS completionReferenceId,r.completed_at AS completedAt,r.created_at AS createdAt,r.updated_at AS updatedAt
  FROM caregiver_referral_recurring_loan_requests r WHERE r.caregiver_id=? ORDER BY r.created_at DESC,r.cycle_number DESC`).bind(caregiverId).all<JsonRecord>();
 return rows.results||[];
}

function recurringTier(key:string,totalQualified:number,requests:any[]){
 const target=targetFor(key),amountToman=amountFor(key),own=requests.filter((x:any)=>String(x.milestoneKey)===key),submittedCycles=own.length,nextCycleNumber=submittedCycles+1;
 const consumedQualified=submittedCycles*target,current=Math.min(target,Math.max(0,totalQualified-consumedQualified)),qualifiedCycles=Math.floor(totalQualified/target),availableCycles=Math.max(0,qualifiedCycles-submittedCycles);
 return {key,title:titleFor(key),amountToman,target,current,totalQualified,remaining:Math.max(0,target-current),eligible:availableCycles>0,submittedCycles,qualifiedCycles,availableCycles,nextCycleNumber,request:own[0]||null,latestRequest:own[0]||null};
}

export async function buildReferralMilestoneBenefitsSummaryV2(env:Env,caregiverId:string){
 const registered=await registeredReferralRows(env,caregiverId),contracted=contractedMembers(registered),requests=await existingRequests(env,caregiverId);
 return {
  policyVersion:"REFERRAL-RECURRING-MILESTONES-2026-08-V5",
  mode:"RECURRING_AGGREGATE",
  totals:{registered:registered.length,contracted:contracted.count},
  cohort:{id:null,size:null,locked:false,achievedAt:null,referralCaseIds:[],deprecated:true},
  network10:recurringTier(NETWORK_KEY,registered.length,requests),
  contract7:{...recurringTier(CONTRACT_KEY,contracted.count,requests),contractedCaregiverIds:contracted.contractedIds}
 };
}

async function addEvent(env:Env,requestId:string,eventType:string,previousStatus:string|null,newStatus:string,actorId:string,snapshot:any){
 await env.DB.prepare(`INSERT INTO caregiver_referral_recurring_loan_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)`)
  .bind(randomId("rfev_"),requestId,eventType,previousStatus,newStatus,actorId,JSON.stringify(snapshot||{}),nowIso()).run();
}

async function staffRows(env:Env){
 const rows=await env.DB.prepare(`SELECT r.id,r.caregiver_id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
   r.milestone_key AS milestoneKey,r.cycle_number AS cycleNumber,r.target_count AS targetCount,r.qualified_count_at_request AS qualifiedCountAtRequest,
   r.status,r.eligibility_snapshot_json AS eligibilitySnapshotJson,r.requested_at AS requestedAt,r.reviewed_at AS reviewedAt,
   r.decision_note AS decisionNote,r.completion_reference_id AS completionReferenceId,r.completed_at AS completedAt
  FROM caregiver_referral_recurring_loan_requests r JOIN caregivers c ON c.id=r.caregiver_id
  ORDER BY CASE r.status WHEN 'REQUESTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 WHEN 'REJECTED' THEN 2 ELSE 3 END,r.requested_at DESC LIMIT 500`).all<JsonRecord>();
 return (rows.results||[]).map((x:any)=>({...x,amountToman:amountFor(String(x.milestoneKey)),title:titleFor(String(x.milestoneKey),Number(x.cycleNumber||1)),eligibilitySnapshot:(()=>{try{return JSON.parse(String(x.eligibilitySnapshotJson||"{}"))}catch{return {}}})()}));
}

export async function buildStaffReferralMilestoneDataV2(env:Env){
 const requests=await staffRows(env);const summary=requests.reduce((s:any,x:any)=>{s.total+=1;if(x.status==="REQUESTED")s.requested+=1;if(x.status==="UNDER_REVIEW")s.underReview+=1;if(x.status==="COMPLETED"){s.completed+=1;s.completedAmountToman+=Number(x.amountToman||0)}return s},{total:0,requested:0,underReview:0,completed:0,completedAmountToman:0});
 return {summary,requests,policy:{mode:"RECURRING_AGGREGATE",network:{key:NETWORK_KEY,target:NETWORK_TARGET,amountToman:NETWORK_AMOUNT_TOMAN,recurring:true},contract:{key:CONTRACT_KEY,target:CONTRACT_TARGET,amountToman:CONTRACT_AMOUNT_TOMAN,recurring:true}}};
}

async function requestRow(env:Env,id:string){return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,milestone_key AS milestoneKey,cycle_number AS cycleNumber,target_count AS targetCount,qualified_count_at_request AS qualifiedCountAtRequest,status,eligibility_snapshot_json AS eligibilitySnapshotJson,completion_reference_id AS completionReferenceId FROM caregiver_referral_recurring_loan_requests WHERE id=? LIMIT 1`).bind(id).first<JsonRecord>()}

async function qualifiedCountFor(env:Env,caregiverId:string,key:string){const registered=await registeredReferralRows(env,caregiverId);if(key===NETWORK_KEY)return {count:registered.length,contractedIds:[] as string[]};const contracted=contractedMembers(registered);return {count:contracted.count,contractedIds:contracted.contractedIds}}

async function staffAction(request:Request,env:Env,actor:AuthUser,id:string){
 const denied=await requireAccess(env,actor,STAFF_FINANCE_MODULE,"update");if(denied)return denied;
 const body=await readBody(request.clone());if(!body)return fail("اطلاعات تصمیم معتبر نیست.");
 const action=upper(body.action),note=str(body.note)||null,current=await requestRow(env,id);if(!current)return fail("درخواست وام معرفی پیدا نشد.",404,"referral_milestone_request_not_found");
 const oldStatus=upper(current.status),ts=nowIso();
 if(action==="UNDER_REVIEW"){if(oldStatus==="COMPLETED")return fail("این درخواست قبلاً تکمیل شده است.",409,"already_completed");await env.DB.prepare(`UPDATE caregiver_referral_recurring_loan_requests SET status='UNDER_REVIEW',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,note,ts,id).run();await addEvent(env,id,"UNDER_REVIEW",oldStatus,"UNDER_REVIEW",actor.id,{note});await audit(request,env,actor,"REVIEW_REFERRAL_MILESTONE_REQUEST","caregiver_referral_recurring_loan_request",id,{previousStatus:oldStatus,note});return json({data:{id,status:"UNDER_REVIEW"}})}
 if(action==="REJECT"){if(oldStatus==="COMPLETED")return fail("درخواست تکمیل‌شده قابل رد نیست.",409,"already_completed");await env.DB.prepare(`UPDATE caregiver_referral_recurring_loan_requests SET status='REJECTED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,updated_at=? WHERE id=?`).bind(actor.id,ts,note,ts,id).run();await addEvent(env,id,"REJECTED",oldStatus,"REJECTED",actor.id,{note});await audit(request,env,actor,"REJECT_REFERRAL_MILESTONE_REQUEST","caregiver_referral_recurring_loan_request",id,{previousStatus:oldStatus,note});return json({data:{id,status:"REJECTED"}})}
 if(action!=="APPROVE")return fail("اقدام انتخاب‌شده معتبر نیست.");
 if(oldStatus==="COMPLETED")return json({data:{id,status:"COMPLETED",completionReferenceId:current.completionReferenceId,alreadyCompleted:true}});
 const key=String(current.milestoneKey),cycleNumber=Math.max(1,Number(current.cycleNumber||1)),target=targetFor(key),latest=await qualifiedCountFor(env,String(current.caregiverId),key),required=cycleNumber*target;
 if(latest.count<required)return fail("شرایط این دوره در زمان تأیید کامل نیست.",409,"referral_milestone_revalidation_failed");
 const existingTx=await env.DB.prepare(`SELECT id FROM caregiver_wallet_transactions WHERE reference_type='REFERRAL_MILESTONE_REQUEST' AND reference_id=? AND direction='CREDIT' LIMIT 1`).bind(id).first<{id:string}>();
 const transactionId=existingTx?.id||randomId("wtx_"),amount=amountFor(key),transactionType=key===NETWORK_KEY?"REFERRAL_NETWORK_BENEFIT_3M":"REFERRAL_CONTRACT_BENEFIT_8M",title=titleFor(key,cycleNumber);
 const statements:any[]=[];
 if(!existingTx)statements.push(env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT',?,?,?,?, 'REFERRAL_MILESTONE_REQUEST',?,?,?)`).bind(transactionId,current.caregiverId,transactionType,amount,title,note||"تأیید درخواست در تب پاداش معرفی",id,actor.id,ts));
 statements.push(env.DB.prepare(`UPDATE caregiver_referral_recurring_loan_requests SET status='COMPLETED',reviewed_by_user_id=?,reviewed_at=?,decision_note=?,completion_reference_id=?,completed_at=?,updated_at=? WHERE id=? AND status<>'COMPLETED'`).bind(actor.id,ts,note,transactionId,ts,ts,id));
 statements.push(env.DB.prepare(`INSERT INTO caregiver_referral_recurring_loan_request_events(id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at) VALUES(?,?,'APPROVED',?,'COMPLETED',?,?,?)`).bind(randomId("rfev_"),id,oldStatus,actor.id,JSON.stringify({amountToman:amount,completionReferenceId:transactionId,revalidated:true,cycleNumber,requiredQualified:required,currentQualified:latest.count,note}),ts));
 await env.DB.batch(statements);
 await audit(request,env,actor,"APPROVE_REFERRAL_MILESTONE_REQUEST","caregiver_referral_recurring_loan_request",id,{milestoneKey:key,cycleNumber,amountToman:amount,transactionId,revalidated:true});
 return json({data:{id,status:"COMPLETED",cycleNumber,completionReferenceId:transactionId,amountToman:amount}})
}

export async function routeReferralMilestoneBenefitsV2(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const staffMatch=url.pathname.match(/^\/api\/staff\/financial-credits\/referrals\/milestones\/([^/]+)$/);
 if(staffMatch&&method==="PATCH"){const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await staffAction(request,env,actor,decodeURIComponent(staffMatch[1])))}
 return null;
}
