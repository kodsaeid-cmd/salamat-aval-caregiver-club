import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Financial credits hub validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const legacyBackend=read('worker/caregiver-platform-staff-tools.ts');
const profileBackend=read('worker/caregiver-financial-profile-v4.ts');
const entry=read('worker/index-unified-financial-v4.ts');
const runtime=read('preview/staff-financial-credits-runtime-v2.js');
const routeOwner=read('preview/staff-financial-credits-route-owner-v3.js');
const caregiverRuntime=read('preview/server-financial-profile-v4.js');
const uiHotfix=read('preview/financial-ui-hotfix-v4.js');
const wrangler=read('wrangler.backend.jsonc');
new Function(runtime);
new Function(routeOwner);
new Function(caregiverRuntime);
new Function(uiHotfix);

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
])has(legacyBackend,value,`existing financial directory/mutation contract: ${value}`);

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
  '/api/caregiver/platform/credit-requests',
  'CREATE_EVALUATION_LINKED_BENEFIT_REQUEST',
  'evaluationLinkedEligibility',
  'credit_not_eligible',
  'referralCode',
  'remainingToMilestone',
])has(profileBackend,value,`unified backend contract: ${value}`);

for(const value of [
  'routeCaregiverFinancialProfileV4',
  'FINANCIAL_PROFILE_VERSION = "4.0.0"',
  'ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1"',
  'FINANCIAL_UI_HOTFIX_VERSION = "4.0.1"',
  'staff-financial-credits-runtime-v2.js?v=',
  'financial-ui-hotfix-v4.js?v=',
  'x-salamat-financial-profile',
  'x-salamat-financial-ui-hotfix',
])has(entry,value,`outer production financial entry: ${value}`);
has(wrangler,'"main": "./worker/index-unified-financial-v4.ts"','production entrypoint must activate v4');

for(const value of [
  "const VERSION='3.0.0'",
  "const HUB_VERSION='3.0.0'",
  "const PROFILE_VERSION='4.0.0'",
  'id="fchDirectorySearch"',
  '/api/staff/financial-credits/caregivers?',
  '/profile',
  '/api/staff/financial-credits/credit-requests/',
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
])has(runtime,value,`admin financial scorecard runtime: ${value}`);

for(const value of [
  "const VERSION='3.2.1'",
  'function canonicalRoot()',
  '#content .fch3[data-finance-hub-version="3.0.0"]',
  'const root=canonicalRoot()',
])has(routeOwner,value,`admin financial route owner stability: ${value}`);
lacks(routeOwner,"#content .fch-root[data-finance-hub-version=\"3.0.0\"]",'route owner must not require the retired fch-root selector');

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
])has(caregiverRuntime,value,`caregiver four-tab financial runtime: ${value}`);

for(const value of [
  "const VERSION='4.0.1'",
  '#caregiverUnifiedFinancialProfileV4 [data-tab]',
  'function activateCaregiverTab(button)',
  "node.classList.toggle('active'",
  'window.addEventListener(\'click\'',
  'financialRoot.classList.add(\'fch-root\')',
])has(uiHotfix,value,`financial UI hotfix: ${value}`);

for(const source of [runtime,caregiverRuntime,uiHotfix]) {
  lacks(source,'observe(document.documentElement','financial runtimes must not observe the entire document');
  lacks(source,'setInterval(','financial runtimes must not poll continuously');
  lacks(source,'localStorage','financial truth must stay server-backed');
}

console.log('Financial credits hub v4 contract passed: caregiver tabs remain interactive after DOM replacement and the admin finance owner recognizes the canonical fch3 root without repair loops.');
