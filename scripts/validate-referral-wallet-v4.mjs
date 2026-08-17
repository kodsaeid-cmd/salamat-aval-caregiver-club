import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const referral=read("worker/referral-rewards-v4.ts");
const unity=read("worker/pending-referral-unity-v1.ts");
const jobs=read("worker/job-ads-v3.ts");
const outer=read("worker/index-desktop-react-v1.ts");
const caregiverLegacy=read("mobile-react/caregiver-benefits-v3.tsx");
const desktop=read("desktop-react/referral-rewards-admin-v2.tsx");
const mobile=read("mobile-react/admin-referral-rewards-mobile-v4.tsx");
const milestone=read("worker/referral-milestone-benefits-v2.ts");
const milestoneRequest=read("worker/referral-milestone-request-v2.ts");
const milestoneMigration=read("migrations/0117_recurring_referral_loans.sql");
const milestoneCaregiver=read("mobile-react/referral-benefits-v6.tsx");
const milestoneAdmin=read("desktop-react/referral-milestone-review-v1.tsx");
const milestoneAdminEntry=read("desktop-react/referral-rewards-admin-v1.tsx");
const financialTabs=read("desktop-react/financial-credits-v4.tsx");
const checks=[
 [unity.includes("CONFIRM_REFERRAL_OWNERSHIP")&&unity.includes("awardReferralStage1OnAccountActivationV1")&&unity.includes("account_not_active")&&outer.includes("if(credentialResponse)return reconcileReferralStage1AfterActivation(request,env,credentialResponse")&&outer.includes("response=await reconcileReferralStage1AfterActivation(request,env,response")&&!unity.includes("CONFIRM_REFERRAL_AND_AUTO_AWARD_STAGE1"),"all caregiver account activation route owners reconcile stage-one reward after referrer confirmation"],
 [unity.includes("REGISTRATION_REJECTED"),"caregiver rejection is recorded"],
 [referral.includes("contract_reward_transaction_id IS NULL"),"contract stage remains idempotent"],
 [jobs.includes("awardReferralContractBonusOnFirstInContract"),"contract transition invokes referral completion"],
 [outer.indexOf("routePendingReferralUnityV1(request,env)")>=0&&outer.indexOf("routePendingReferralUnityV1(request,env)")<outer.indexOf("routeReferralRewardsV5(request, env)"),"new referral route precedes legacy route"],
 [caregiverLegacy.includes("تأیید می‌کنم")&&caregiverLegacy.includes("contractRewardTransactionId"),"caregiver legacy referral decision history remains intact"],
 [desktop.includes("پاداش معرفی")&&!desktop.includes("APPROVE_REGISTRATION"),"desktop legacy referral rows remain history-only"],
 [mobile.includes("سوابق")&&!mobile.includes("APPROVE_REGISTRATION"),"mobile legacy referral rows remain history-only"],
 [milestone.includes("NETWORK_TARGET=10")&&milestone.includes("CONTRACT_TARGET=7"),"recurring referral thresholds are 10 and 7"],
 [milestone.includes("NETWORK_AMOUNT_TOMAN=3_000_000")&&milestone.includes("CONTRACT_AMOUNT_TOMAN=8_000_000"),"recurring referral loan amounts are 3m and 8m"],
 [milestone.includes("RECURRING_AGGREGATE")&&milestone.includes("submittedCycles*target")&&milestone.includes("nextCycleNumber=submittedCycles+1"),"progress resets by consumed recurring cycles"],
 [milestone.includes("contractedMembers(registered)")&&!milestone.includes("cohortMembers("),"contract milestone counts all referred contracted caregivers, not a frozen ten"],
 [milestone.includes("JOIN caregivers c ON c.id=r.referred_caregiver_id")&&!milestone.includes("upper(u.status) IN ('ACTIVE','APPROVED')"),"registration milestone counts actual referred registrations without network-status gating"],
 [milestoneRequest.includes("cycleNumber")&&milestoneRequest.includes("caregiver_referral_recurring_loan_requests")&&milestoneRequest.includes("env.DB.batch"),"each recurring request records a numbered cycle and evidence snapshot"],
 [milestoneMigration.includes("UNIQUE(caregiver_id,milestone_key,cycle_number)"),"recurring requests allow many cycles while preventing duplicate cycle claims"],
 [milestoneMigration.includes("INSERT OR IGNORE INTO caregiver_referral_recurring_loan_requests")&&milestoneMigration.includes("FROM caregiver_referral_milestone_requests"),"existing one-time requests are preserved as cycle-one history"],
 [!(/\bDROP\s+(TABLE|INDEX|TRIGGER|COLUMN)\b/i.test(milestoneMigration)),"recurring migration is additive"],
 [milestoneMigration.includes("trg_referral_recurring_request_no_delete")&&milestoneMigration.includes("trg_referral_recurring_events_no_delete"),"recurring request and audit history cannot be deleted"],
 [milestoneCaregiver.includes("هر ۱۰ ثبت‌نام یک دوره مستقل است")&&milestoneCaregiver.includes("هیچ گروه ۱۰ نفره‌ای")&&milestoneCaregiver.includes("nextCycleNumber"),"caregiver UI explains recurring non-frozen cycles"],
 [milestoneCaregiver.includes("تقاضای وام دوره")&&milestoneCaregiver.includes("آخرین درخواست"),"caregiver can request each newly qualified cycle while retaining request status"],
 [milestoneAdmin.includes('"UNDER_REVIEW"|"REJECT"|"APPROVE"')&&milestoneAdminEntry.includes("ReferralMilestoneReview"),"existing admin referral tab owns manual recurring loan review"],
 [financialTabs.includes("پرونده مالی و وام")&&financialTabs.includes("پاداش معرفی")&&financialTabs.includes("پاداش ماندگاری"),"financial credits keeps its existing tabs"],
];
const failed=checks.filter(([ok])=>!ok);for(const [ok,label] of checks)console.log(`${ok?"✓":"✗"} ${label}`);if(failed.length)process.exit(1);console.log("Referral workflow invariants validated.");