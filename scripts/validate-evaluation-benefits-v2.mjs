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
const staffRouter=await readFile(new URL('../preview/staff-module-router-v3.js',import.meta.url),'utf8');
const dashboardEntry=await readFile(new URL('../preview/staff-dashboard-entry-fix-v1.js',import.meta.url),'utf8');

for(const marker of [
  'amountToman: 7_000_000','amountToman: 12_000_000','amountToman: 50_000_000','amountToman: 300_000_000','amountToman: 500_000_000',
  'targetMonths: 2','targetMonths: 3','targetMonths: 6','targetMonths: 12','targetMonths: 24','targetMonths: 70',
  'scoreMode: "MINIMUM"','scoreMode: "AVERAGE"','scoreThreshold: 50','scoreThreshold: 60','scoreThreshold: 65','scoreThreshold: 70',
  "status='FINAL' AND final_score IS NOT NULL",'caregiver_evaluation_periods',
]) assert.ok(backend.includes(marker),`Missing benefit policy marker: ${marker}`);
assert.ok(!backend.includes('INSERT INTO caregiver_wallet_transactions'),'Loan eligibility must not auto-disburse wallet money.');

for(const marker of ['getFinancialBenefitsV2','buildCaregiverFinancialProfileV4','caregiver_evaluation_periods:FINAL','evaluationAverageScore','evaluationMinimumScore','evaluationLatestScore','evaluationFinalizedPeriods','CREATE_EVALUATION_LINKED_BENEFIT_REQUEST','evaluationLinkedEligibility','credit_not_eligible']) assert.ok(profile.includes(marker),`Missing unified evaluation-credit marker: ${marker}`);

for(const marker of ['CONTRACT_SYNC_TTL_MS = 5 * 60_000','getFinancialBenefitsV2','server-financial-profile-v4.js','LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js"','FINANCIAL_BENEFITS_VERSION = "4.0.0"']) assert.ok(wrapper.includes(marker),`Missing benefits wrapper marker: ${marker}`);

assert.ok(entry.includes('routeCaregiverFinancialProfileV4'),'Active outer worker must own the unified financial profile routes.');
assert.ok(entry.includes('FINANCIAL_PROFILE_VERSION = "4.1.0"'),'Outer worker must cache-bust finance runtime 4.1.0.');
assert.ok(entry.includes('STAFF_DASHBOARD_ENTRY_VERSION = "1.2.0"'),'Outer worker must cache-bust canonical dashboard entry.');
assert.ok(entry.includes('STAFF_MODULE_ROUTER_VERSION = "5.1.0"'),'Outer worker must cache-bust canonical staff router.');
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

for(const marker of ['کمک‌هزینه ماندگاری دوماهه','پلکان وام مراقبین','معرفی و اعتبارات معرفی مراقب','کیف پول و اقدامات مالی','میانگین ارزیابی FINAL','کمترین امتیاز نهایی','راهنمای نظام وام‌دهی مراقبین','conic-gradient','/api/caregiver/platform/financial-profile',"const VERSION='4.1.0'",'touch-action:manipulation','function activateTab(','function captureTabPointer(','function captureTabClick(']) assert.ok(financial.includes(marker),`Missing caregiver financial UI marker: ${marker}`);
assert.ok(!financial.includes('setInterval('),'Unified caregiver financial runtime must not poll continuously.');
assert.ok(!financial.includes('document.documentElement'),'Unified caregiver financial runtime must not observe the entire document.');
assert.ok(!financial.includes("$$('[data-tab]',root).forEach(b=>b.addEventListener('click'"),'Finance tabs must not use fragile per-render click listeners.');
assert.ok(financial.includes("o.observe(content,{childList:true,subtree:true})"),'Finance content observer must ignore tab class changes.');
const walletSection=financial.slice(financial.indexOf('function wallet('),financial.indexOf('function markup('));
assert.ok(walletSection.includes('موجودی کیف پول')&&walletSection.includes('ufp4-money-card'),'Wallet balance must render as a plain money card.');
assert.ok(!walletSection.includes('gauge('),'Wallet tab must not contain donut/progress gauges.');

for(const marker of ['میانگین ارزیابی FINAL','کمک‌هزینه ماندگاری','data-fch-caregiver-detail','بستانکاری','بدهکاری / برداشت','کد معرفی','/api/staff/financial-credits/caregivers/']) assert.ok(admin.includes(marker),`Missing admin financial scorecard marker: ${marker}`);

assert.ok(staffRouter.includes("const VERSION='5.0.0'"),'Staff router contract version must remain v5.0.0.');
assert.ok(staffRouter.includes("if(key==='staff.dashboard'){await openManagementDashboard();return}"),'Staff dashboard route must use the canonical management dashboard.');
assert.ok(staffRouter.includes("access.openModule('staff.dashboard')"),'Canonical dashboard must be opened by the staff platform access runtime.');
assert.ok(!staffRouter.includes("key==='staff.dashboard'&&typeof window.renderDashboard"),'Legacy renderDashboard must never own staff.dashboard.');
assert.ok(dashboardEntry.includes("const VERSION='1.1.0'"),'Dashboard entry contract version must remain v1.1.0.');
assert.ok(dashboardEntry.includes("return Boolean(content&&$('.spx-dashboard',content))"),'Only the new spx dashboard may satisfy admin entry.');
assert.ok(!dashboardEntry.includes('[data-view="staff-dashboard"]'),'Legacy dashboard markers must not satisfy admin entry.');

console.log('Evaluation benefits v4.1 contract passed: finance tabs are instant, wallet balances are numeric, and admin entry targets the canonical management dashboard.');
