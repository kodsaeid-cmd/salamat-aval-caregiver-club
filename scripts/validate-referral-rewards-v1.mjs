import fs from 'node:fs';

const files = {
  backend: fs.readFileSync('worker/referral-rewards-v1.ts','utf8'),
  wrapper: fs.readFileSync('worker/index-referral-rewards.ts','utf8'),
  outer: fs.readFileSync('worker/index-unified-financial-v4.ts','utf8'),
  reset: fs.readFileSync('worker/index-mobile-reset-v1.ts','utf8'),
  desktop: fs.readFileSync('worker/index-desktop-react-v1.ts','utf8'),
  referralV4: fs.readFileSync('worker/referral-rewards-v4.ts','utf8'),
  referralV5: fs.readFileSync('worker/referral-rewards-v5.ts','utf8'),
  jobAdsV3: fs.readFileSync('worker/job-ads-v3.ts','utf8'),
  runtime: fs.readFileSync('preview/referral-rewards-runtime-v1.js','utf8'),
  migration: fs.readFileSync('migrations/0106_referral_rewards.sql','utf8'),
  wrangler: fs.readFileSync('wrangler.backend.jsonc','utf8'),
};

const checks = [
  ['fixed 200k registration reward', files.backend.includes('REGISTRATION_REWARD_TOMAN = 200_000') && files.referralV4.includes('REGISTRATION_REWARD_TOMAN=200_000')],
  ['fixed 300k contract reward', files.backend.includes('CONTRACT_REWARD_TOMAN = 300_000') && files.referralV4.includes('CONTRACT_REWARD_TOMAN=300_000')],
  ['registration reward transaction type', files.referralV4.includes('REFERRAL_REGISTRATION_REWARD')],
  ['contract bonus transaction type', files.referralV4.includes('REFERRAL_CONTRACT_BONUS')],
  ['caregiver mirror endpoint', files.referralV4.includes('/api/caregiver/platform/referrals')],
  ['staff referral endpoint', files.referralV4.includes('/api/staff/financial-credits/referrals')],
  ['monthly CSV endpoint preserved', files.backend.includes('/report.csv')],
  ['registration approval action', files.referralV4.includes('APPROVE_REGISTRATION')],
  ['manual no-contract action preserved', files.referralV4.includes('HOLD_CONTRACT')],
  ['contract approval action', files.referralV4.includes('APPROVE_CONTRACT')],
  ['referrer confirmation does not post wallet credit', files.referralV4.includes('rewardPosted:false') && !files.referralV4.includes('CONFIRM_REFERRAL_AND_AWARD_REGISTRATION')],
  ['stage1 requires active referred caregiver account', files.referralV4.includes('referredAccountReady') && files.referralV4.includes('referred_account_not_active')],
  ['first IN_CONTRACT triggers referral stage2', files.jobAdsV3.includes('awardReferralContractBonusOnFirstInContract') && files.jobAdsV3.includes('next!=="IN_CONTRACT"')],
  ['stage2 duplicate guard', files.referralV4.includes('contract_reward_transaction_id IS NULL') && files.referralV4.includes('contractRewardTransactionId')],
  ['late stage1 approval reconciles existing first contract', files.referralV5.includes('APPROVE_REGISTRATION') && files.referralV5.includes('awardReferralContractBonusOnFirstInContract')],
  ['registration payload bridge', files.runtime.includes('payload.referralCode=referralCode')],
  ['caregiver referral mirror UI exists for compatibility', files.runtime.includes('caregiverReferralRewardsV1')],
  ['staff referral decision hub UI preserved for compatibility', files.runtime.includes('staffReferralRewardsV1')],
  ['runtime injection', files.wrapper.includes('referral-rewards-runtime-v1.js')],
  ['route owner wrapper', files.wrapper.includes('routeReferralRewardsV1') || files.wrapper.includes('routeReferralRewardsV2')],
  ['outer financial entry preserves referral wrapper', files.outer.includes('import app from "./index-referral-rewards"')],
  ['mobile reset wrapper preserves unified financial outer', files.reset.includes('import app from "./index-unified-financial-v4"')],
  ['active worker remains stable React desktop owner', files.wrangler.includes('"main": "./worker/index-desktop-react-v1.ts"')],
  ['stable React owner owns v5 referral route', files.desktop.includes('routeReferralRewardsV5') && files.desktop.includes('routeCaregiverFinancialProfileReferralFixV1') && files.desktop.includes('routeJobAdsV3')],
  ['React owner preserves protected backend chain', files.desktop.includes('import app from "./index-caregiver-onboarding-permission-defaults-v2"') && files.desktop.includes('return app.fetch(request, env, ctx)')],
  ['mobile reset keeps only baseline runtime', files.reset.includes('MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js"') && files.reset.includes('stripAllLaterMobileScripts')],
  ['migration referral table', files.migration.includes('CREATE TABLE IF NOT EXISTS caregiver_referral_cases')],
  ['one referred caregiver one referrer', files.migration.includes('referred_caregiver_id TEXT NOT NULL UNIQUE')],
  ['migration fixed stage 1 amount', files.migration.includes('CHECK(registration_reward_toman = 200000)')],
  ['migration fixed stage 2 amount', files.migration.includes('CHECK(contract_reward_toman = 300000)')],
];

const failed = checks.filter(([,ok])=>!ok);
for (const [name,ok] of checks) console.log(`${ok?'✓':'✗'} ${name}`);
if (failed.length) {
  console.error(`Referral rewards validation failed: ${failed.map(([name])=>name).join(', ')}`);
  process.exit(1);
}
console.log('Referral rewards unity validation passed through referral v5, job-ad first-contract posting and the stable React desktop owner.');
