import {invalidateAdminDirectoryCounts} from "./admin-directory-light";
import {invalidateCaregiverDirectoryCache} from "./caregiver-directory-page";
import {routeCaregiverInitialCredentialsV1} from "./caregiver-initial-credentials-v1";
import {ensureReferralCodeV4} from "./referral-rewards-v4";
import {ensureReferralRewardsSchema} from "./referral-rewards-v1";
import {type AuthUser,type Env,audit,fail,getUser,json,normalizeMobile,nowIso,randomId,readBody,securityHeaders,str} from "./lib";

const STAGE1_TOMAN=200_000;
const STAGE2_TOMAN=300_000;

type Referrer={id:string;mobile:string|null;referralCode:string};
type ReferralCase={id:string;referrerCaregiverId:string;referredCaregiverId:string;referredName:string;confirmationStatus:string;status:string;registrationRewardTransactionId:string|null};
const referralCodeFrom=(body:any)=>str(body?.referralCode||body?.referrerCode||body?.inviteCode||body?.referral_code||body?.referrer_code).replace(/\D/g,"");

async function resolveReferrer(env:Env,code:string,registeringMobile:string):Promise<Referrer|null>{
 if(!code)return null;
 if(!/^\d{6}$/.test(code))throw new Error("invalid_referral_code");
 const row=await env.DB.prepare(`SELECT c.id,c.mobile,rc.referral_code AS referralCode
  FROM caregiver_referral_codes rc
  JOIN caregivers c ON c.id=rc.caregiver_id
  JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status) IN ('ACTIVE','APPROVED')
  WHERE rc.referral_code=? AND c.active=1 AND COALESCE(c.cooperation_status,'')<>'حذف‌شده' LIMIT 1`).bind(code).first<Referrer>();
 if(!row)throw new Error("invalid_referral_code");
 if(normalizeMobile(row.mobile)===registeringMobile)throw new Error("self_referral_not_allowed");
 return row;
}

async function registerWithReferral(request:Request,env:Env){
 await ensureReferralRewardsSchema(env);
 const body=await readBody(request.clone());if(!body)return securityHeaders(fail("اطلاعات ثبت‌نام معتبر نیست."));
 const mobile=normalizeMobile(str(body.mobile))||"",code=referralCodeFrom(body);
 let referrer:Referrer|null=null;
 try{referrer=await resolveReferrer(env,code,mobile)}catch(error){const reason=error instanceof Error?error.message:"invalid_referral_code";if(reason==="self_referral_not_allowed")return securityHeaders(fail("استفاده از کد معرف متعلق به شماره همراه خودتان مجاز نیست.",409,reason));return securityHeaders(fail("کد معرف معتبر نیست یا حساب معرف فعال نیست.",409,"invalid_referral_code"))}
 const base=await routeCaregiverInitialCredentialsV1(request,env);if(!base)return null;if(!base.ok)return base;
 const payload:any=await base.clone().json().catch(()=>null),caregiverId=String(payload?.data?.caregiverId||""),ts=nowIso();
 if(!caregiverId)return base;
 const ownReferralCode=await ensureReferralCodeV4(env,caregiverId);
 let caseId:string|null=null;
 if(referrer){
  caseId=randomId("ref_");
  await env.DB.prepare(`INSERT INTO caregiver_referral_cases(id,referrer_caregiver_id,referred_caregiver_id,referral_code,registration_reward_toman,contract_reward_toman,status,referrer_confirmation_status,created_at,updated_at)
   VALUES(?,?,?,?,?,?,'PENDING_REGISTRATION_REVIEW','PENDING',?,?)`).bind(caseId,referrer.id,caregiverId,referrer.referralCode,STAGE1_TOMAN,STAGE2_TOMAN,ts,ts).run();
  await audit(request,env,null,"CREATE_REFERRAL_CASE_WAITING_REFERRER","caregiver_referral_case",caseId,{referrerCaregiverId:referrer.id,referredCaregiverId:caregiverId,registrationRewardToman:STAGE1_TOMAN,contractRewardToman:STAGE2_TOMAN});
 }
 invalidateAdminDirectoryCounts();invalidateCaregiverDirectoryCache();
 if(payload?.data){payload.data.referralCode=ownReferralCode;payload.data.status="PENDING";payload.data.referral=caseId?{caseId,status:"WAITING_REFERRER_CONFIRMATION",referralCode:referrer?.referralCode}:null}
 const headers=new Headers(base.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");return new Response(JSON.stringify(payload),{status:base.status,statusText:base.statusText,headers});
}

async function loadCase(env:Env,id:string){return env.DB.prepare(`SELECT r.id,r.referrer_caregiver_id AS referrerCaregiverId,r.referred_caregiver_id AS referredCaregiverId,c.full_name AS referredName,
 r.referrer_confirmation_status AS confirmationStatus,r.status,r.registration_reward_transaction_id AS registrationRewardTransactionId
 FROM caregiver_referral_cases r JOIN caregivers c ON c.id=r.referred_caregiver_id WHERE r.id=? LIMIT 1`).bind(id).first<ReferralCase>()}

export async function awardReferralStage1OnAccountActivationV1(request:Request,env:Env,caregiverId:string,actorOverride?:AuthUser){
 await ensureReferralRewardsSchema(env);
 const current=await env.DB.prepare(`SELECT id,referrer_caregiver_id AS referrerCaregiverId,referred_caregiver_id AS referredCaregiverId,referrer_confirmation_status AS confirmationStatus,status,registration_reward_transaction_id AS stage1TransactionId FROM caregiver_referral_cases WHERE referred_caregiver_id=? LIMIT 1`).bind(caregiverId).first<any>();
 if(!current)return{awarded:false,reason:"no_referral"};
 if(String(current.confirmationStatus||"").toUpperCase()!=="APPROVED")return{awarded:false,reason:"referrer_not_confirmed"};
 if(current.stage1TransactionId)return{awarded:false,duplicate:true,transactionId:current.stage1TransactionId};
 if(String(current.status||"").toUpperCase()!=="PENDING_REGISTRATION_REVIEW")return{awarded:false,reason:"not_ready"};
 const activeAccount=await env.DB.prepare(`SELECT u.id FROM users u JOIN caregivers c ON c.id=u.caregiver_id WHERE u.caregiver_id=? AND upper(u.role)='CAREGIVER' AND upper(u.status) IN ('ACTIVE','APPROVED') AND c.active=1 LIMIT 1`).bind(caregiverId).first<{id:string}>();
 if(!activeAccount)return{awarded:false,reason:"account_not_active"};
 const actor=actorOverride||await getUser(request,env);if(!actor)return{awarded:false,reason:"unauthorized"};
 const transactionId=randomId("wtx_"),ts=nowIso(),description="واریز خودکار پس از فعال‌سازی حساب مراقب معرفی‌شده و تأیید معرف";
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT','REFERRAL_REGISTRATION_REWARD',?,?,?,'REFERRAL_STAGE1',?,?,?)`).bind(transactionId,current.referrerCaregiverId,STAGE1_TOMAN,"پاداش ثبت‌نام مراقب معرفی‌شده",description,current.id,actor.id,ts),
   env.DB.prepare(`UPDATE caregiver_referral_cases SET status='WAITING_CONTRACT',registration_reward_transaction_id=?,registration_reviewed_by_user_id=?,registration_reviewed_at=?,registration_decision_note=?,updated_at=? WHERE id=? AND referrer_confirmation_status='APPROVED' AND status='PENDING_REGISTRATION_REVIEW' AND registration_reward_transaction_id IS NULL`).bind(transactionId,actor.id,ts,description,ts,current.id),
  ]);
 }catch(error){const detail=error instanceof Error?error.message:String(error);if(/UNIQUE|unique/i.test(detail)){const row=await env.DB.prepare("SELECT registration_reward_transaction_id AS transactionId FROM caregiver_referral_cases WHERE id=? LIMIT 1").bind(current.id).first<any>();return{awarded:false,duplicate:true,transactionId:row?.transactionId||null}}throw error}
 await audit(request,env,actor,"AUTO_AWARD_REFERRAL_STAGE1_ACCOUNT_ACTIVATION","caregiver_referral_case",current.id,{caregiverId,amountToman:STAGE1_TOMAN,transactionId,nextStatus:"WAITING_CONTRACT"});
 return{awarded:true,caseId:current.id,transactionId,amountToman:STAGE1_TOMAN};
}

async function decide(request:Request,env:Env,actor:AuthUser,id:string){
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر فقط برای حساب مراقب فعال است.",403,"caregiver_only");
 const body=await readBody(request);if(!body)return fail("اطلاعات تصمیم معتبر نیست.");const action=str(body.action).toUpperCase();if(!["CONFIRM","REJECT"].includes(action))return fail("اقدام انتخاب‌شده معتبر نیست.");
 const current=await loadCase(env,id);if(!current||current.referrerCaregiverId!==actor.caregiverId)return fail("درخواست معرفی برای حساب شما پیدا نشد.",404,"referral_case_not_found");if(current.confirmationStatus!=="PENDING")return fail("تصمیم شما برای این معرفی قبلاً ثبت شده است.",409,"referrer_already_decided");
 const note=str(body.note)||null,ts=nowIso();
 if(action==="REJECT"){
  await env.DB.prepare(`UPDATE caregiver_referral_cases SET referrer_confirmation_status='REJECTED',referrer_rejected_at=?,referrer_decision_note=?,status='REGISTRATION_REJECTED',updated_at=? WHERE id=? AND referrer_caregiver_id=? AND referrer_confirmation_status='PENDING'`).bind(ts,note,ts,id,actor.caregiverId).run();
  await audit(request,env,actor,"REJECT_REFERRAL_OWNERSHIP","caregiver_referral_case",id,{referredCaregiverId:current.referredCaregiverId,note});return json({data:{id,status:"REFERRER_REJECTED",rewardPosted:false}})
 }
 await env.DB.prepare(`UPDATE caregiver_referral_cases SET referrer_confirmation_status='APPROVED',referrer_confirmed_at=?,referrer_rejected_at=NULL,referrer_decision_note=?,status='PENDING_REGISTRATION_REVIEW',updated_at=? WHERE id=? AND referrer_caregiver_id=? AND referrer_confirmation_status='PENDING'`).bind(ts,note,ts,id,actor.caregiverId).run();
 let reward:any={awarded:false,reason:"account_not_active"};
 try{reward=await awardReferralStage1OnAccountActivationV1(request,env,current.referredCaregiverId,actor)}catch(error){console.error("referral_stage1_post_confirmation_reconcile_failed",{caseId:id,caregiverId:current.referredCaregiverId,error:error instanceof Error?error.message:String(error)})}
 const rewardPosted=Boolean(reward?.awarded),status=rewardPosted?"WAITING_CONTRACT":"PENDING_REGISTRATION_REVIEW";
 await audit(request,env,actor,"CONFIRM_REFERRAL_OWNERSHIP","caregiver_referral_case",id,{referredCaregiverId:current.referredCaregiverId,nextStatus:status,rewardPosted});
 return json({data:{id,status,rewardPosted,transactionId:rewardPosted?reward.transactionId:null,amountToman:rewardPosted?STAGE1_TOMAN:0}})
}

export async function awardReferralStage2ForApplicationV1(request:Request,env:Env,applicationId:string,adIdHint?:string){
 await ensureReferralRewardsSchema(env);
 const actor=await getUser(request,env);if(!actor)return{awarded:false,reason:"unauthorized"};
 const application=await env.DB.prepare(`SELECT id,ad_id AS adId,caregiver_id AS caregiverId,status FROM care_job_applications WHERE id=? LIMIT 1`).bind(applicationId).first<any>();
 if(!application||String(application.status||"").toUpperCase()!=="IN_CONTRACT")return{awarded:false,reason:"not_in_contract"};
 const current=await env.DB.prepare(`SELECT id,referrer_caregiver_id AS referrerCaregiverId,status,referrer_confirmation_status AS confirmationStatus,registration_reward_transaction_id AS stage1TransactionId,contract_reward_transaction_id AS stage2TransactionId FROM caregiver_referral_cases WHERE referred_caregiver_id=? LIMIT 1`).bind(application.caregiverId).first<any>();
 if(!current)return{awarded:false,reason:"no_referral"};
 if(String(current.confirmationStatus||"").toUpperCase()!=="APPROVED"||!current.stage1TransactionId||String(current.status||"").toUpperCase()!=="WAITING_CONTRACT")return{awarded:false,reason:"not_ready"};
 if(current.stage2TransactionId)return{awarded:false,duplicate:true,transactionId:current.stage2TransactionId};
 const transactionId=randomId("wtx_"),ts=nowIso(),adId=String(application.adId||adIdHint||""),description=`اولین ورود مراقب معرفی‌شده به قرارداد${adId?` در آگهی ${adId}`:""}`;
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO caregiver_wallet_transactions(id,caregiver_id,direction,transaction_type,amount_toman,title,description,reference_type,reference_id,created_by_user_id,created_at) VALUES(?,?,'CREDIT','REFERRAL_CONTRACT_BONUS',?,?,?,'REFERRAL_STAGE2',?,?,?)`).bind(transactionId,current.referrerCaregiverId,STAGE2_TOMAN,"پاداش اولین قرارداد مراقب معرفی‌شده",description,current.id,actor.id,ts),
   env.DB.prepare(`UPDATE caregiver_referral_cases SET status='COMPLETED',contract_reward_transaction_id=?,contract_reviewed_by_user_id=?,contract_reviewed_at=?,contract_decision_note=?,updated_at=? WHERE id=? AND status='WAITING_CONTRACT' AND contract_reward_transaction_id IS NULL`).bind(transactionId,actor.id,ts,`ثبت خودکار با اولین وضعیت IN_CONTRACT • ${applicationId}`,ts,current.id),
  ]);
 }catch(error){const detail=error instanceof Error?error.message:String(error);if(/UNIQUE|unique/i.test(detail)){const row=await env.DB.prepare("SELECT contract_reward_transaction_id AS transactionId FROM caregiver_referral_cases WHERE id=? LIMIT 1").bind(current.id).first<any>();return{awarded:false,duplicate:true,transactionId:row?.transactionId||null}}throw error}
 await audit(request,env,actor,"AUTO_AWARD_REFERRAL_STAGE2_FIRST_CONTRACT","caregiver_referral_case",current.id,{caregiverId:application.caregiverId,applicationId,adId,amountToman:STAGE2_TOMAN,transactionId});
 return{awarded:true,caseId:current.id,transactionId,amountToman:STAGE2_TOMAN};
}

export async function routePendingReferralUnityV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname==="/api/public/caregivers/register"&&method==="POST")return registerWithReferral(request,env);
 const match=url.pathname.match(/^\/api\/caregiver\/platform\/referrals\/([^/]+)$/);if(match&&method==="PATCH"){
  await ensureReferralRewardsSchema(env);const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));return securityHeaders(await decide(request,env,actor,decodeURIComponent(match[1])));
 }
 return null;
}
