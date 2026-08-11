import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const referral=read("worker/referral-rewards-v4.ts");
const referralV5=read("worker/referral-rewards-v5.ts");
const jobs=read("worker/job-ads-v3.ts");
const outer=read("worker/index-desktop-react-v1.ts");
const desktop=read("desktop-react/referral-rewards-admin-v1.tsx");
const mobile=read("mobile-react/admin-financial-credits-v3.tsx");
const checks=[
 [referral.includes("rewardPosted:false")&&!referral.includes("CONFIRM_REFERRAL_AND_AWARD_REGISTRATION"),"referrer confirmation must not post 200k"],
 [referral.includes("referredAccountReady")&&referral.includes("referred_account_not_active"),"stage1 requires active referred account"],
 [referral.includes("REFERRAL_REGISTRATION_REWARD")&&referral.includes("REGISTRATION_REWARD_TOMAN"),"stage1 posts fixed 200k ledger entry"],
 [referral.includes("REFERRAL_CONTRACT_BONUS")&&referral.includes("contract_reward_transaction_id IS NULL"),"stage2 is idempotent"],
 [referral.includes("ORDER BY updated_at ASC LIMIT 1")&&referral.includes("status='IN_CONTRACT'"),"first in-contract evidence is selected"],
 [jobs.includes("next!==\"IN_CONTRACT\"")&&jobs.includes("awardReferralContractBonusOnFirstInContract"),"job transition triggers stage2"],
 [referralV5.includes("APPROVE_REGISTRATION")&&referralV5.includes("awardReferralContractBonusOnFirstInContract"),"late stage1 approval reconciles existing contract evidence"],
 [outer.includes("routeReferralRewardsV5")&&outer.includes("routeJobAdsV3")&&outer.includes("routeCaregiverFinancialProfileReferralFixV1"),"active stable worker owns referral, financial mirror and job hooks"],
 [desktop.includes("پاداش معرفی")&&desktop.includes("APPROVE_REGISTRATION")&&desktop.includes("APPROVE_CONTRACT"),"desktop admin exposes both referral stages"],
 [mobile.includes("پاداش معرفی")&&mobile.includes("APPROVE_REGISTRATION")&&mobile.includes("APPROVE_CONTRACT"),"mobile admin exposes both referral stages"],
];
const failed=checks.filter(([ok])=>!ok);for(const [ok,label] of checks)console.log(`${ok?"✓":"✗"} ${label}`);if(failed.length)process.exit(1);console.log("Referral wallet v4 invariants validated.");
