import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backend=await readFile(new URL('../worker/evaluation-benefits-v2.ts',import.meta.url),'utf8');
const wrapper=await readFile(new URL('../worker/index-evaluation-benefits-v2.ts',import.meta.url),'utf8');
const index=await readFile(new URL('../worker/index-referral-rewards.ts',import.meta.url),'utf8');
const referralV1=await readFile(new URL('../preview/referral-rewards-runtime-v1.js',import.meta.url),'utf8');
const referralV2=await readFile(new URL('../preview/referral-rewards-experience-v2.js',import.meta.url),'utf8');
const financial=await readFile(new URL('../preview/server-financial-benefits-runtime.js',import.meta.url),'utf8');

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
  'scoreThreshold: 50',
  'scoreThreshold: 60',
  'scoreThreshold: 65',
  'scoreThreshold: 70',
  "status='FINAL' AND final_score IS NOT NULL",
  'caregiver_evaluation_periods',
]) assert.ok(backend.includes(marker),`Missing benefit policy marker: ${marker}`);
assert.ok(!backend.includes('INSERT INTO caregiver_wallet_transactions'),'Loan eligibility must not auto-disburse wallet money.');

for(const marker of [
  'CONTRACT_SYNC_TTL_MS = 5 * 60_000',
  'getFinancialBenefitsV2',
  'server-financial-benefits-runtime.js',
  'FINANCIAL_BENEFITS_VERSION = "2.0.0"',
]) assert.ok(wrapper.includes(marker),`Missing benefits wrapper marker: ${marker}`);

assert.ok(index.includes('import app from "./index-evaluation-benefits-v2"'),'Active worker must include evaluation-benefits wrapper.');
assert.ok(index.includes('REFERRAL_RUNTIME_VERSION = "1.1.0"'),'Legacy referral runtime cache bust is required.');
assert.ok(index.includes('REFERRAL_REWARDS_VERSION = "2.1.0"'),'Caregiver referral experience cache bust is required.');

assert.ok(!referralV1.includes('observe(document.documentElement'),'Referral v1 must not observe the whole document.');
assert.ok(!referralV1.includes('characterData:true'),'Referral v1 must not react to every text mutation.');
assert.ok(referralV1.includes("observeTarget($('#content'),{childList:true})"),'Referral v1 must use bounded content observation.');
assert.ok(referralV1.includes("if(isCaregiver(user)){ $('#staffReferralRewardsV1')?.remove();return }"),'Referral v1 caregiver duplicate renderer must be disabled.');

assert.ok(!referralV2.includes('characterData:true'),'Referral v2 must not react to every text mutation.');
assert.ok(referralV2.includes("if(current==='dashboard')"),'Referral v2 must render dashboard only on dashboard surface.');
assert.ok(referralV2.includes("if(current==='wallet')"),'Referral v2 must render wallet only on wallet surface.');
assert.ok(referralV2.includes('Date.now()-state.lastLoadedAt<30000'),'Referral API cache must be at least 30 seconds.');

assert.ok(!financial.includes('setInterval('),'Financial benefits runtime must not poll continuously.');
assert.ok(!financial.includes('characterData:true'),'Financial benefits runtime must not observe text mutations.');
assert.ok(financial.includes('تسهیلات و اعتبارات مبتنی بر ارزیابی'),'Caregiver wallet must expose evaluation-based benefits.');
assert.ok(financial.includes('کمک‌هزینه ماندگاری دوماهه'),'Two-month assistance must be visible in wallet.');
assert.ok(financial.includes('پلکان وام مراقبین'),'Loan ladder must stay inside caregiver wallet.');

console.log('Evaluation benefits v2 and referral performance contract passed.');
