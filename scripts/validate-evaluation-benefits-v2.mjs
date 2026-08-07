import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backend=await readFile(new URL('../worker/evaluation-benefits-v2.ts',import.meta.url),'utf8');
const profile=await readFile(new URL('../worker/caregiver-financial-profile-v4.ts',import.meta.url),'utf8');
const wrapper=await readFile(new URL('../worker/index-evaluation-benefits-v2.ts',import.meta.url),'utf8');
const entry=await readFile(new URL('../worker/index-unified-financial-v4.ts',import.meta.url),'utf8');
const index=await readFile(new URL('../worker/index-referral-rewards.ts',import.meta.url),'utf8');
const referralV1=await readFile(new URL('../preview/referral-rewards-runtime-v1.js',import.meta.url),'utf8');
const referralV2=await readFile(new URL('../preview/referral-rewards-experience-v2.js',import.meta.url),'utf8');
const financial=await readFile(new URL('../preview/server-financial-profile-v4.js',import.meta.url),'utf8');
const admin=await readFile(new URL('../preview/staff-financial-credits-runtime-v2.js',import.meta.url),'utf8');

for(const marker of [
  'amountToman: 7_000_000',
  'amountToman: 12_000_000',
  'amountToman: 50_000_000',
  'amountToman: 300_000_000',
  'amountToman: 500_000_000',
  'targetMonths: 2',
  'targetMonths: 3',
  'targetMonths: 6',
  'targetMonths: 12',
  'targetMonths: 24',
  'targetMonths: 70',
  'scoreMode: "MINIMUM"',
  'scoreMode: "AVERAGE"',
  'scoreThreshold: 50',
  'scoreThreshold: 60',
  'scoreThreshold: 65',
  'scoreThreshold: 70',
  "status='FINAL' AND final_score IS NOT NULL",
  'caregiver_evaluation_periods',
]) assert.ok(backend.includes(marker),`Missing benefit policy marker: ${marker}`);
assert.ok(!backend.includes('INSERT INTO caregiver_wallet_transactions'),'Loan eligibility must not auto-disburse wallet money.');

for(const marker of [
  'getFinancialBenefitsV2',
  'buildCaregiverFinancialProfileV4',
  'caregiver_evaluation_periods:FINAL',
  'evaluationAverageScore',
  'evaluationMinimumScore',
  'evaluationLatestScore',
  'evaluationFinalizedPeriods',
  'CREATE_EVALUATION_LINKED_BENEFIT_REQUEST',
  'evaluationLinkedEligibility',
  'credit_not_eligible',
]) assert.ok(profile.includes(marker),`Missing unified evaluation-credit marker: ${marker}`);

for(const marker of [
  'CONTRACT_SYNC_TTL_MS = 5 * 60_000',
  'getFinancialBenefitsV2',
  'server-financial-profile-v4.js',
  'LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js"',
  'FINANCIAL_BENEFITS_VERSION = "4.0.0"',
]) assert.ok(wrapper.includes(marker),`Missing benefits wrapper marker: ${marker}`);

assert.ok(entry.includes('routeCaregiverFinancialProfileV4'),'Active outer worker must own the unified financial profile routes.');
assert.ok(index.includes('import app from "./index-evaluation-benefits-v2"'),'Referral chain must retain the evaluation-benefits wrapper.');
assert.ok(index.includes('REFERRAL_RUNTIME_VERSION = "1.1.0"'),'Legacy referral runtime cache bust is required.');
assert.ok(index.includes('REFERRAL_REWARDS_VERSION = "2.2.0"'),'Dashboard-only referral experience cache bust is required.');

assert.ok(!referralV1.includes('observe(document.documentElement'),'Referral v1 must not observe the whole document.');
assert.ok(!referralV1.includes('characterData:true'),'Referral v1 must not react to every text mutation.');
assert.ok(referralV1.includes("observeTarget($('#content'),{childList:true})"),'Referral v1 must use bounded content observation.');
assert.ok(referralV1.includes("if(isCaregiver(user)){ $('#staffReferralRewardsV1')?.remove();return }"),'Referral v1 caregiver duplicate renderer must stay disabled.');

assert.ok(referralV2.includes("const VERSION='2.2.0'"),'Referral dashboard runtime version must be 2.2.0.');
assert.ok(referralV2.includes('renderDashboardCode'),'Referral runtime must keep the dashboard code/copy experience.');
assert.ok(referralV2.includes("$('#caregiverReferralRewardsV2')?.remove()"),'Referral runtime must not duplicate wallet referral UI.');
assert.ok(!referralV2.includes('observe(document.documentElement'),'Referral v2 must not observe the whole document.');
assert.ok(!referralV2.includes('setInterval('),'Referral v2 must not poll continuously.');
assert.ok(referralV2.includes('Date.now()-state.lastLoadedAt<30000'),'Referral dashboard API cache must be at least 30 seconds.');

for(const marker of [
  'کمک‌هزینه ماندگاری دوماهه',
  'پلکان وام مراقبین',
  'معرفی و اعتبارات معرفی مراقب',
  'کیف پول و اقدامات مالی',
  'میانگین ارزیابی FINAL',
  'کمترین امتیاز نهایی',
  'راهنمای نظام وام‌دهی مراقبین',
  'conic-gradient',
  '/api/caregiver/platform/financial-profile',
]) assert.ok(financial.includes(marker),`Missing caregiver financial UI marker: ${marker}`);
assert.ok(!financial.includes('setInterval('),'Unified caregiver financial runtime must not poll continuously.');
assert.ok(!financial.includes('document.documentElement'),'Unified caregiver financial runtime must not observe the entire document.');

for(const marker of [
  'میانگین ارزیابی FINAL',
  'کمک‌هزینه ماندگاری',
  'data-fch-caregiver-detail',
  'بستانکاری',
  'بدهکاری / برداشت',
  'کد معرفی',
  '/api/staff/financial-credits/caregivers/',
]) assert.ok(admin.includes(marker),`Missing admin financial scorecard marker: ${marker}`);

console.log('Evaluation benefits v4 contract passed: FINAL evaluations are a canonical server-side input to caregiver/admin credit eligibility, with four-tab caregiver UI and unified admin scorecards.');