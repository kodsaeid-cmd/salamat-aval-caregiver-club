import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Financial credits hub validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const backend=read('worker/caregiver-platform-staff-tools.ts');
const runtime=read('preview/staff-financial-credits-runtime-v2.js');
new Function(runtime);

for(const value of [
  'const LOAN_AMOUNT_TOMAN = 500_000_000',
  'const CONTINUOUS_TARGET_DAYS = 730',
  'const CUMULATIVE_TARGET_DAYS = 1_200',
  'financial-credits-hub-v1',
  '/api/staff/financial-credits/caregivers',
  '/api/staff/financial-credits/wallet-adjustments',
  '/api/staff/financial-credits/rewards',
  '/api/staff/financial-credits/settlements/',
  '/api/staff/financial-credits/credit-requests/',
  'READ_FINANCIAL_CAREGIVER_DIRECTORY',
  'READ_CAREGIVER_FINANCIAL_FILE',
  'ADMIN_WALLET_ADJUSTMENT',
  'GRANT_REFERRAL_REWARD',
  'SETTLEMENT_${decision}',
  'CREDIT_REQUEST_${decision}',
  'reason_required',
  'requireAccess(env, actor, MODULE, action)',
  "referenceType = \"REFERRAL_CASE\"",
  "transactionType = \"ADMIN_TOPUP\"",
  "transactionType = \"ADMIN_DEBIT\"",
  "transactionType = \"REFERRAL_REWARD\"",
  "transaction_type,amount_toman,title,description",
  "status IN ('REQUESTED','APPROVED')",
  'paymentTrackingNumber',
  'credit_not_eligible',
  'calculateEligibility',
  'mergeIntervals',
  'pagination: { page, pageSize, total',
])has(backend,value);

for(const value of [
  "const VERSION='2.0.0'",
  "const HUB_VERSION='3.0.0'",
  'مرکز مبادلات مالی باشگاه مراقبین',
  'پرونده‌های مالی',
  'درخواست‌های تسویه',
  'اعتبار و وام',
  'شارژ و اصلاح کیف پول',
  '/api/staff/financial-credits/caregivers',
  '/api/staff/financial-credits/wallet-adjustments',
  '/api/staff/financial-credits/settlements/',
  '/api/staff/financial-credits/credit-requests/',
  'دلیل تصمیم',
  'شماره پیگیری پرداخت',
  'remainingDuration',
  'progressPercent',
  'window.SalamatFinancialCredits',
])has(runtime,value);

for(const forbidden of ['localStorage','/api/staff/financial-credits/payroll'])lacks(runtime,forbidden);
expect(backend.indexOf('authorize(request, env, "update")')<backend.indexOf('async function decideSettlement'),'settlement decisions must require update permission');
expect(backend.indexOf('authorize(request, env, "create")')<backend.indexOf('async function createWalletAdjustment'),'wallet adjustments must require create permission');
expect(backend.indexOf('requiredReason(body)')<backend.indexOf('async function decideSettlement'),'mandatory reason helper must guard decisions');

console.log('Financial credits hub v3 contract passed: searchable caregiver ledger, 500M eligibility, permissioned wallet adjustments and reasoned decisions are canonical.');
