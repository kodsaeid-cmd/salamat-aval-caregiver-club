import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const referral=read("worker/referral-rewards-v4.ts");
const unity=read("worker/pending-referral-unity-v1.ts");
const jobs=read("worker/job-ads-v3.ts");
const outer=read("worker/index-desktop-react-v1.ts");
const caregiver=read("mobile-react/caregiver-benefits-v3.tsx");
const desktop=read("desktop-react/referral-rewards-admin-v2.tsx");
const mobile=read("mobile-react/admin-referral-rewards-mobile-v4.tsx");
const checks=[
 [unity.includes("CONFIRM_REFERRAL_AND_AUTO_AWARD_STAGE1")&&unity.includes("WAITING_CONTRACT"),"caregiver confirmation owns stage-one transition"],
 [unity.includes("REGISTRATION_REJECTED"),"caregiver rejection is recorded"],
 [unity.includes("awardReferralStage2ForApplicationV1")&&unity.includes("REFERRAL_STAGE2")&&unity.includes("STAGE2_TOMAN"),"new stage2 helper posts the 300k wallet credit"],
 [unity.includes("contract_reward_transaction_id IS NULL")&&unity.includes("stage2TransactionId"),"new stage2 helper is duplicate-safe"],
 [referral.includes("contract_reward_transaction_id IS NULL"),"legacy contract stage remains idempotent"],
 [jobs.includes("awardReferralContractBonusOnFirstInContract"),"legacy contract transition still invokes referral completion"],
 [outer.includes("reconcileInContractSideEffects")&&outer.includes("awardReferralStage2ForApplicationV1")&&outer.includes("jobAdsResponse.ok"),"outer worker guarantees immediate stage2 reconciliation after successful IN_CONTRACT"],
 [outer.indexOf("routePendingReferralUnityV1(request,env)")>=0&&outer.indexOf("routePendingReferralUnityV1(request,env)")<outer.indexOf("routeReferralRewardsV5(request, env)"),"new referral route precedes legacy route"],
 [caregiver.includes("تأیید می‌کنم")&&caregiver.includes("contractRewardTransactionId"),"caregiver UI exposes referral decision and history"],
 [desktop.includes("پاداش معرفی")&&!desktop.includes("APPROVE_REGISTRATION"),"desktop admin is history-only"],
 [mobile.includes("سوابق")&&!mobile.includes("APPROVE_REGISTRATION"),"mobile admin is history-only"],
];
const failed=checks.filter(([ok])=>!ok);for(const [ok,label] of checks)console.log(`${ok?"✓":"✗"} ${label}`);if(failed.length)process.exit(1);console.log("Referral workflow invariants validated.");
