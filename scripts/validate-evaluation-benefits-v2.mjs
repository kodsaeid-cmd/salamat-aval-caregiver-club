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
const dashboardEntry=await readFile(new URL('../preview/staff-dashboard-entry-fix-v1.js',import.meta.url),'utf8');
const singleOwner=await readFile(new URL('../preview/runtime-single-owner-v8.js',import.meta.url),'utf8');

for(const marker of [
  'amountToman: 7_000_000','amountToman: 12_000_000','amountToman: 50_000_000','amountToman: 300_000_000','amountToman: 500_000_000',
  'targetMonths: 2','targetMonths: 3','targetMonths: 6','targetMonths: 12','targetMonths: 24','targetMonths: 70',
  'scoreMode: "MINIMUM"','scoreMode: "AVERAGE"','scoreThreshold: 50','scoreThreshold: 60','scoreThreshold: 65','scoreThreshold: 70',
  "status='FINAL' AND final_score IS NOT NULL",'caregiver_evaluation_periods',
]) assert.ok(backend.includes(marker),`Missing benefit policy marker: ${marker}`);
assert.ok(!backend.includes('INSERT INTO caregiver_wallet_transactions'),'Loan eligibility must not auto-disburse wallet money.');

for(const marker of ['getFinancialBenefitsV2','buildCaregiverFinancialProfileV4','caregiver_evaluation_periods:FINAL','evaluationAverageScore','evaluationMinimumScore','evaluationLatestScore','evaluationFinalizedPeriods','CREATE_EVALUATION_LINKED_BENEFIT_REQUEST','evaluationLinkedEligibility','credit_not_eligible']) assert.ok(profile.includes(marker),`Missing unified evaluation-credit marker: ${marker}`);
for(const marker of ['CONTRACT_SYNC_TTL_MS = 5 * 60_000','getFinancialBenefitsV2','server-financial-profile-v4.js','LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js"']) assert.ok(wrapper.includes(marker),`Missing benefits wrapper marker: ${marker}`);

for(const marker of ['routeCaregiverFinancialProfileV4','FINANCIAL_PROFILE_VERSION = "4.1.0"','FINANCIAL_UI_HOTFIX_VERSION = "4.2.0"','STAFF_DASHBOARD_ENTRY_VERSION = "1.3.0"','SINGLE_OWNER_RUNTIME_VERSION = "8.0.0"','runtime-single-owner-v8.js','x-salamat-single-owner-runtime']) assert.ok(entry.includes(marker),`Missing active single-owner entry marker: ${marker}`);
assert.ok(index.includes('import app from "./index-evaluation-benefits-v2"'),'Referral chain must retain the evaluation-benefits wrapper.');

assert.ok(!referralV1.includes('observe(document.documentElement'),'Referral v1 must not observe the whole document.');
assert.ok(!referralV2.includes('setInterval('),'Referral v2 must not poll continuously.');
assert.ok(referralV2.includes('renderDashboardCode'),'Referral dashboard code experience must remain available.');

for(const marker of ['کمک‌هزینه ماندگاری دوماهه','پلکان وام مراقبین','معرفی و اعتبارات معرفی مراقب','کیف پول و اقدامات مالی','میانگین ارزیابی FINAL','کمترین امتیاز نهایی','راهنمای نظام وام‌دهی مراقبین','conic-gradient','/api/caregiver/platform/financial-profile','touch-action:manipulation','ufp4-money-card','موجودی کیف پول']) assert.ok(financial.includes(marker),`Missing caregiver financial UI marker: ${marker}`);
assert.ok(!financial.includes('setInterval('),'Unified caregiver financial runtime must not poll continuously.');
const walletSection=financial.slice(financial.indexOf('function wallet('),financial.indexOf('function markup('));
assert.ok(walletSection.includes('موجودی کیف پول')&&walletSection.includes('ufp4-money-card'),'Wallet balance must render as a plain money card.');
assert.ok(!walletSection.includes('gauge('),'Wallet tab must not contain donut/progress gauges.');

for(const marker of ['میانگین ارزیابی FINAL','کمک‌هزینه ماندگاری','data-fch-caregiver-detail','بستانکاری','بدهکاری / برداشت','کد معرفی','/api/staff/financial-credits/caregivers/']) assert.ok(admin.includes(marker),`Missing admin financial scorecard marker: ${marker}`);

for(const marker of ["const VERSION='8.0.0'",'async function openAdminDashboard()','async function openCaregiverWallet()','event.stopImmediatePropagation()','runtime.refresh()','data-single-owner-dashboard','caregiver.wallet','staff.dashboard']) assert.ok(singleOwner.includes(marker),`Missing single-owner runtime marker: ${marker}`);
assert.ok(!singleOwner.includes('MutationObserver'),'Single-owner runtime must not repair the DOM with MutationObserver.');
assert.ok(!singleOwner.includes('setInterval('),'Single-owner runtime must not poll continuously.');
assert.ok(singleOwner.includes("platform.openWallet=openCaregiverWallet"),'Legacy caregiver wallet entry must delegate to the unified owner.');
assert.ok(singleOwner.includes("router.route=key=>key==='staff.dashboard'?openAdminDashboard():original(key)"),'Programmatic admin dashboard routing must delegate to the single owner.');
assert.ok(dashboardEntry.includes('SalamatRuntimeSingleOwnerV8'),'Dashboard entry must delegate to the single owner.');
assert.ok(!dashboardEntry.includes('SalamatAccessControl.openModule'),'Dashboard entry must not call the incompatible access-control API.');

console.log('Evaluation benefits v4.1 + single-owner v8 contract passed: evaluation-linked credit rules remain intact, wallet money stays numeric, and admin/wallet routes have one browser owner.');
