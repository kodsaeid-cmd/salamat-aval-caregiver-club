import fs from 'node:fs';

const files = {
  backend: fs.readFileSync('worker/referral-rewards-v1.ts','utf8'),
  wrapper: fs.readFileSync('worker/index-referral-rewards.ts','utf8'),
  runtime: fs.readFileSync('preview/referral-rewards-runtime-v1.js','utf8'),
  migration: fs.readFileSync('migrations/0106_referral_rewards.sql','utf8'),
  wrangler: fs.readFileSync('wrangler.backend.jsonc','utf8'),
};

const checks = [
  ['fixed 200k registration reward', files.backend.includes('REGISTRATION_REWARD_TOMAN = 200_000')],
  ['fixed 300k contract reward', files.backend.includes('CONTRACT_REWARD_TOMAN = 300_000')],
  ['registration reward transaction type', files.backend.includes('REFERRAL_REGISTRATION_REWARD')],
  ['contract bonus transaction type', files.backend.includes('REFERRAL_CONTRACT_BONUS')],
  ['caregiver mirror endpoint', files.backend.includes('/api/caregiver/platform/referrals')],
  ['staff referral endpoint', files.backend.includes('/api/staff/financial-credits/referrals')],
  ['monthly CSV endpoint', files.backend.includes('/report.csv')],
  ['registration approval action', files.backend.includes('APPROVE_REGISTRATION')],
  ['manual no-contract action', files.backend.includes('HOLD_CONTRACT')],
  ['contract approval action', files.backend.includes('APPROVE_CONTRACT')],
  ['registration payload bridge', files.runtime.includes('payload.referralCode=referralCode')],
  ['caregiver referral mirror UI', files.runtime.includes('caregiverReferralRewardsV1')],
  ['staff referral decision hub UI', files.runtime.includes('staffReferralRewardsV1')],
  ['runtime injection', files.wrapper.includes('referral-rewards-runtime-v1.js')],
  ['route owner wrapper', files.wrapper.includes('routeReferralRewardsV1')],
  ['active worker points to wrapper', files.wrangler.includes('"main": "./worker/index-referral-rewards.ts"')],
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
console.log('Referral rewards unity v1 validation passed.');
