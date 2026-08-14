import {ensureReferralRewardsSchema} from "./referral-rewards-v1";
import {type AuthUser,type Env,audit,nowIso} from "./lib";

const STAGE1_TOMAN=200_000;
const STAGE2_TOMAN=300_000;

type ReferralRow={
 id:string;referrerCaregiverId:string;referredCaregiverId:string;referredName:string;
 confirmationStatus:string;status:string;stage1TransactionId:string|null;stage2TransactionId:string|null;
 applicationId:string|null;adId:string|null;contractAt:string|null;
};
const upper=(value:unknown)=>String(value||"").toUpperCase();
const txId=(prefix:string,caseId:string)=>`${prefix}_${caseId}`.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,120);

async function eligibleRows(env:Env,referrerCaregiverId:string){
 await ensureReferralRewardsSchema(env);
 const rows=await env.DB.prepare(`SELECT r.id,r.referrer_caregiver_id AS referrerCaregiverId,r.referred_caregiver_id AS referredCaregiverId,c.full_name AS referredName,
  r.referrer_confirmation_status AS confirmationStatus,r.status,r.registration_reward_transaction_id AS stage1TransactionId,r.contract_reward_transaction_id AS stage2TransactionId,
  COALESCE((SELECT ap.id FROM care_job_applications ap WHERE ap.caregiver_id=r.referred_caregiver_id AND upper(ap.status)='IN_CONTRACT' ORDER BY ap.updated_at ASC LIMIT 1),(SELECT jc.application_id FROM caregiver_job_contracts jc WHERE jc.caregiver_id=r.referred_caregiver_id ORDER BY jc.started_at ASC LIMIT 1)) AS applicationId,
  COALESCE((SELECT ap.ad_id FROM care_job_applications ap WHERE ap.caregiver_id=r.referred_caregiver_id AND upper(ap.status)='IN_CONTRACT' ORDER BY ap.updated_at ASC LIMIT 1),(SELECT jc.ad_id FROM caregiver_job_contracts jc WHERE jc.caregiver_id=r.referred_caregiver_id ORDER BY jc.started_at ASC LIMIT 1)) AS adId,
  COALESCE((SELECT ap.updated_at FROM care_job_applications ap WHERE ap.caregiver_id=r.referred_caregiver_id AND upper(ap.status)='IN_CONTRACT' ORDER BY ap.updated_at ASC LIMIT 1),(SELECT jc.started_at FROM caregiver_job_contracts jc WHERE jc.caregiver_id=r.referred_caregiver_id ORDER BY jc.started_at ASC LIMIT 1)) AS contractAt
 FROM caregiver_referral_cases r JOIN caregivers c ON c.id=r.referred_caregiver_id
 WHERE r.referrer_caregiver_id=? AND r.contract_reward_transaction_id IS NULL AND upper(COALESCE(r.referrer_confirmation_status,'PENDING'))<>'REJECTED'
 AND (EXISTS(SELECT 1 FROM care_job_applications ap WHERE ap.caregiver_id=r.referred_caregiver_id AND upper(ap.status)='IN_CONTRACT') OR EXISTS(SELECT 1 FROM caregiver_job_contracts jc WHERE jc.caregiver_id=r.referred_caregiver_id))
 ORDER BY COALESCE(contractAt,r.updated_at,r.created_at) ASC LIMIT 100`).bind(referrerCaregiverId).all<ReferralRow>();
 return rows.results||[];
}

export async function reconcileReferralContractRewardsV1(request:Request,env:Env,actor:AuthUser){
 if(upper(actor.role)!=="CAREGIVER"||!actor.caregiverId)return {checked:0,awarded:0};
 const rows=await eligibleRows(env,actor.caregiverId),ts=nowIso();let awarded=0;
 for(const row of rows){
  const stage1Id=row.stage1TransactionId||txId("wtx_ref1",row.id),stage2Id=txId("wtx_ref2",row.id),statements:any[]=[];
  if(!row.stage1TransactionId){
   statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT','REFERRAL_REGISTRATION_REWARD',?,?,?,'REFERRAL_STAGE1',?,?,?)`).bind(stage1Id,row.referrerCaregiverId,STAGE1_TOMAN,"پاداش ثبت‌نام مراقب معرفی‌شده",`ثبت خودکار پاداش معرفی ${row.referredName} پس از احراز ورود او به قرارداد`,row.id,actor.id,row.contractAt||ts));
  }
  statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT','REFERRAL_CONTRACT_BONUS',?,?,?,'REFERRAL_STAGE2',?,?,?)`).bind(stage2Id,row.referrerCaregiverId,STAGE2_TOMAN,`مراقب ${row.referredName} وارد قرارداد شد؛ پاداش معرفی شما`,`${row.referredName} که با کد معرفی شما ثبت‌نام کرده بود وارد قرارداد شد و پاداش مرحله قرارداد به کیف پول شما واریز شد.`,row.id,actor.id,row.contractAt||ts));
  statements.push(env.DB.prepare(`UPDATE caregiver_referral_cases SET referrer_confirmation_status=CASE WHEN upper(COALESCE(referrer_confirmation_status,'PENDING'))='PENDING' THEN 'APPROVED' ELSE referrer_confirmation_status END,referrer_confirmed_at=COALESCE(referrer_confirmed_at,?),status='COMPLETED',registration_reward_transaction_id=COALESCE(registration_reward_transaction_id,?),registration_reviewed_by_user_id=COALESCE(registration_reviewed_by_user_id,?),registration_reviewed_at=COALESCE(registration_reviewed_at,?),registration_decision_note=COALESCE(registration_decision_note,'تکمیل خودکار پس از ورود مراقب معرفی‌شده به قرارداد'),contract_reward_transaction_id=?,contract_reviewed_by_user_id=?,contract_reviewed_at=?,contract_decision_note=?,contract_check_last_at=?,contract_check_note=?,updated_at=? WHERE id=? AND contract_reward_transaction_id IS NULL AND upper(COALESCE(referrer_confirmation_status,'PENDING'))<>'REJECTED'`).bind(ts,stage1Id,actor.id,ts,stage2Id,actor.id,row.contractAt||ts,`ثبت خودکار با اولین ورود به قرارداد${row.applicationId?` • ${row.applicationId}`:""}`,ts,`پاداش قرارداد ${row.referredName}${row.adId?` • آگهی ${row.adId}`:""}`,ts,row.id));
  try{
   await env.DB.batch(statements);awarded+=1;
   await audit(request,env,actor,"AUTO_RECONCILE_REFERRAL_CONTRACT_REWARD","caregiver_referral_case",row.id,{referredCaregiverId:row.referredCaregiverId,referredName:row.referredName,applicationId:row.applicationId,adId:row.adId,stage1Created:!row.stage1TransactionId,stage1AmountToman:row.stage1TransactionId?0:STAGE1_TOMAN,stage2AmountToman:STAGE2_TOMAN,stage2TransactionId:stage2Id});
  }catch(error){
   console.error("referral_contract_reward_reconcile_failed",{caseId:row.id,referredCaregiverId:row.referredCaregiverId,error:error instanceof Error?error.message:String(error)});
  }
 }
 return {checked:rows.length,awarded};
}
