import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Financial credits hub validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const legacyBackend=read('worker/caregiver-platform-staff-tools.ts');
const profileBackend=read('worker/caregiver-financial-profile-v4.ts');
const entry=read('worker/index-unified-financial-v4.ts');
const runtime=read('preview/staff-financial-credits-runtime-v2.js');
const caregiverRuntime=read('preview/server-financial-profile-v4.js');
const wrangler=read('wrangler.backend.jsonc');
new Function(runtime);
new Function(caregiverRuntime);

for(const value of [
  '/api/staff/financial-credits/caregivers',
  '/api/staff/financial-credits/wallet-adjustments',
  'READ_FINANCIAL_CAREGIVER_DIRECTORY',
  'ADMIN_WALLET_ADJUSTMENT',
  'reason_required',
  "transactionType = \"ADMIN_TOPUP\"",
  "transactionType = \"ADMIN_DEBIT\"",
  "status IN ('REQUESTED','APPROVED')",
  'pagination: { page, pageSize, total',
])has(legacyBackend,value,'existing financial directory/mutation contract');

for(const value of [
  'buildCaregiverFinancialProfileV4',
  'getFinancialBenefitsV2',
  'caregiver_evaluation_periods:FINAL',
  'caregiver_wallet_transactions',
  'caregiver_referral_cases',
  'receivableToman',
  'payableToman',
  'netToman',
  'allocations: allocations(wallet)',
  '/api/caregiver/platform/financial-profile',
  '/api/staff/financial-credits/caregivers/',
  '/api/caregiver/platform/credit-requests',
  '/api/staff/financial-credits/credit-requests/',
  'CREATE_EVALUATION_LINKED_BENEFIT_REQUEST',
  'evaluationLinkedEligibility',
  'credit_not_eligible',
  'referralCode',
  'remainingToMilestone',
])has(profileBackend,value,'unified backend contract');

for(const value of [
  'routeCaregiverFinancialProfileV4',
  'FINANCIAL_PROFILE_VERSION = "4.0.0"',
  'staff-financial-credits-runtime-v2.js?v=',
  'x-salamat-financial-profile',
])has(entry,value,'outer production financial entry');
has(wrangler,'"main": "./worker/index-unified-financial-v4.ts"','production entrypoint must activate v4');

for(const value of [
  "const VERSION='3.0.0'",
  "const HUB_VERSION='3.0.0'",
  "const PROFILE_VERSION='4.0.0'",
  'id="fchDirectorySearch"',
  '/api/staff/financial-credits/caregivers?',
  '/profile',
  'data-fch-caregiver-detail',
  'کارنامه مالی',
  'کد معرفی',
  'میانگین ارزیابی FINAL',
  'بستانکاری',
  'بدهکاری / برداشت',
  'لیست تخصیص اعتبارات',
  'درخواست‌های کمک‌هزینه و وام',
  'conic-gradient',
  'window.SalamatFinancialCredits',
])has(runtime,value,'admin financial scorecard runtime');

// Search must be explicit-submit only: no directory fetch bound to input/keyup events.
lacks(runtime,"addEventListener('input',",'caregiver directory search must not be live');
lacks(runtime,"addEventListener('keyup',",'caregiver directory search must not fetch on keyup');
has(runtime,"addEventListener('submit'",'caregiver directory search must fetch on submit');

for(const value of [
  'کمک‌هزینه ماندگاری دوماهه',
  'پلکان وام مراقبین',
  'معرفی و اعتبارات معرفی مراقب',
  'کیف پول و اقدامات مالی',
  'راهنمای نظام وام‌دهی مراقبین',
  'میانگین ارزیابی FINAL',
  'conic-gradient',
  '/api/caregiver/platform/financial-profile',
])has(caregiverRuntime,value,'caregiver four-tab financial runtime');

for(const source of [runtime,caregiverRuntime]) {
  lacks(source,'document.documentElement','financial runtimes must not observe the entire document');
  lacks(source,'setInterval(','financial runtimes must not poll continuously');
  lacks(source,'localStorage','financial truth must stay server-backed');
}

console.log('Financial credits hub v4 contract passed: non-live caregiver directory, unified FINAL-evaluation scorecards, referral drilldown, allocations and wallet balances share one canonical profile.');
