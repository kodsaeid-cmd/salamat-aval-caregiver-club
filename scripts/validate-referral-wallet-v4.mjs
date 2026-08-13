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
const milestone=read("worker/referral-milestone-benefits-v1.ts");
const milestoneRequest=read("worker/referral-milestone-request-v2.ts");
const milestoneMigration=read("migrations/0116_referral_milestone_requests.sql");
const milestoneCaregiver=read("mobile-react/referral-milestone-progress-v1.tsx");
const milestoneAdmin=read("desktop-react/referral-milestone-review-v1.tsx");
const milestoneAdminEntry=read("desktop-react/referral-rewards-admin-v1.tsx");
const financialTabs=read("desktop-react/financial-credits-v4.tsx");
const checks=[
 [unity.includes("CONFIRM_REFERRAL_AND_AUTO_AWARD_STAGE1")&&unity.includes("WAITING_CONTRACT"),"caregiver confirmation owns stage-one transition"],
 [unity.includes("REGISTRATION_REJECTED"),"caregiver rejection is recorded"],
 [referral.includes("contract_reward_transaction_id IS NULL"),"contract stage remains idempotent"],
 [jobs.includes("awardReferralContractBonusOnFirstInContract"),"contract transition invokes referral completion"],
 [outer.indexOf("routePendingReferralUnityV1(request,env)")>=0&&outer.indexOf("routePendingReferralUnityV1(request,env)")<outer.indexOf("routeReferralRewardsV5(request, env)"),"new referral route precedes legacy route"],
 [caregiver.includes("تأیید می‌کنم")&&caregiver.includes("contractRewardTransactionId"),"caregiver UI exposes referral decision and history"],
 [desktop.includes("پاداش معرفی")&&!desktop.includes("APPROVE_REGISTRATION"),"desktop legacy referral rows remain history-only"],
 [mobile.includes("سوابق")&&!mobile.includes("APPROVE_REGISTRATION"),"mobile legacy referral rows remain history-only"],
 [milestone.includes("NETWORK_TARGET=10")&&milestone.includes("CONTRACT_TARGET=7"),"new referral thresholds are 10 and 7"],
 [milestone.includes("NETWORK_AMOUNT_TOMAN=3_000_000")&&milestone.includes("CONTRACT_AMOUNT_TOMAN=8_000_000"),"new referral amounts are 3m and 8m"],
 [milestone.includes("upper(u.status) IN ('ACTIVE','APPROVED')")&&milestone.includes("JOIN users u ON u.caregiver_id=r.referred_caregiver_id"),"network milestone counts confirmed caregiver network membership"],
 [milestone.includes("contractRewardTransactionId")&&milestone.includes("caregiver_job_contracts"),"contract milestone uses historical contract evidence"],
 [milestoneRequest.includes("env.DB.batch")&&milestoneRequest.includes("eligibility_snapshot_json"),"request and evidence snapshot are written together"],
 [!(/\bDROP\s+(TABLE|INDEX|TRIGGER|COLUMN)\b/i.test(milestoneMigration)),"milestone migration is additive"],
 [milestoneMigration.includes("trg_referral_milestone_cohort_no_update")&&milestoneMigration.includes("trg_referral_milestone_cohort_no_delete"),"frozen first-ten cohort is immutable"],
 [milestoneMigration.includes("trg_referral_milestone_events_no_update")&&milestoneMigration.includes("trg_referral_milestone_events_no_delete"),"milestone audit events are immutable"],
 [milestoneMigration.includes("trg_referral_case_identity_immutable_v3")&&milestoneMigration.includes("trg_referral_case_no_delete_v3"),"referral attribution history cannot be rewritten or deleted"],
 [milestoneCaregiver.includes("ارسال برای بررسی")&&milestoneCaregiver.includes("وام ۳ میلیون")&&milestoneCaregiver.includes("وام ۸ میلیون"),"existing caregiver referral tab exposes both milestone requests"],
 [milestoneAdmin.includes('"UNDER_REVIEW"|"REJECT"|"APPROVE"')&&milestoneAdminEntry.includes("ReferralMilestoneReview"),"existing admin referral tab owns manual milestone review"],
 [financialTabs.includes("پرونده مالی و وام")&&financialTabs.includes("پاداش معرفی")&&financialTabs.includes("پاداش ماندگاری"),"financial credits keeps its existing tabs"],
];
const failed=checks.filter(([ok])=>!ok);for(const [ok,label] of checks)console.log(`${ok?"✓":"✗"} ${label}`);if(failed.length)process.exit(1);console.log("Referral workflow invariants validated.");
