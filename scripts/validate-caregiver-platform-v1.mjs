import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{
  if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`);
};
const rejectText=(source,needle,label)=>{
  if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`);
};

const migration=read('migrations/0100_caregiver_finance_support.sql');
for(const table of [
  'caregiver_wallet_transactions',
  'caregiver_settlement_requests',
  'caregiver_credit_requests',
  'caregiver_payroll_slips',
  'support_threads',
  'support_messages',
])requireText(migration,`CREATE TABLE IF NOT EXISTS ${table}`,'migration');
requireText(migration,'wallet_transaction_is_immutable','migration');
requireText(migration,'support_message_is_immutable','migration');

const catalog=read('worker/caregiver-platform-catalog.ts');
requireText(catalog,'staff.financial_credits','catalog');
requireText(catalog,'کیف پول و اعتبارات','catalog');
requireText(catalog,'caregiver.contracts','catalog removal');
requireText(catalog,'caregiver.security','catalog removal');
requireText(catalog,'caregiver.rank','catalog removal');

const backend=read('worker/caregiver-platform-v1.ts');
for(const route of [
  '/api/caregiver/platform/dashboard',
  '/api/caregiver/platform/scorecard-record',
  '/api/caregiver/platform/wallet',
  '/api/caregiver/platform/settlements',
  '/api/caregiver/platform/credit-requests',
  '/api/caregiver/platform/payroll',
  '/api/caregiver/platform/support/threads',
  '/api/staff/financial-credits',
  '/api/staff/financial-credits/payroll',
])requireText(backend,route,'backend route');
requireText(backend,'CUMULATIVE_TARGET_DAYS = 1_200','credit rule');
requireText(backend,'LOAN_AMOUNT_TOMAN = 500_000_000','credit amount');
requireText(backend,'requireAccess(env, actor, STAFF_FINANCE_MODULE','financial access');
requireText(backend,'requireAccess(env, actor, STAFF_SUPPORT_MODULE','support access');

const overrides=read('worker/caregiver-platform-overrides.ts');
requireText(overrides,'CUMULATIVE_TARGET_DAYS = 1_200','benefits correction');
requireText(overrides,'cumulativeTargetMonths: 40','benefits correction');
requireText(overrides,"'REFERRAL_CASE'",'referral reward');

const signup=read('preview/caregiver-signup-jalali-v1.js');
requireText(signup,'انتخاب تاریخ تولد شمسی','signup calendar');
requireText(signup,"/api/public/caregivers/register",'signup server route');
requireText(signup,"input.type='hidden'",'signup ISO storage');
rejectText(signup,'localStorage.setItem','signup must not persist accounts locally');

const caregiver=read('preview/caregiver-platform-runtime-v1.js');
for(const route of [
  '/api/caregiver/platform/dashboard',
  '/api/caregiver/platform/scorecard-record',
  '/api/caregiver/platform/wallet',
  '/api/caregiver/platform/payroll',
  '/api/caregiver/platform/support/threads',
])requireText(caregiver,route,'caregiver runtime');
requireText(caregiver,'کیف پول و اعتبارات','caregiver label');
requireText(caregiver,'آیا در خطر هستید؟','urgent support guard');
requireText(caregiver,'navigator.mediaDevices.getUserMedia','caregiver voice');
rejectText(caregiver,'localStorage','caregiver server source');

const finance=read('preview/staff-financial-credits-runtime-v1.js');
requireText(finance,'اعتبارات مالی مراقبین','staff finance');
requireText(finance,'/api/staff/financial-credits/rewards','staff reward');
requireText(finance,'/api/staff/financial-credits/payroll','staff payroll');
requireText(finance,'شماره پیگیری','staff payment evidence');

const support=read('preview/staff-support-runtime-v1.js');
requireText(support,'پشتیبانی فوری و امنیتی','staff support');
requireText(support,'navigator.mediaDevices.getUserMedia','staff voice');
requireText(support,"data-sts-status",'support lifecycle');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const runtime of [
  'caregiver-signup-jalali-v1.js',
  'caregiver-platform-runtime-v1.js',
  'staff-financial-credits-runtime-v1.js',
  'staff-support-runtime-v1.js',
])requireText(wrapper,runtime,'worker injection');
requireText(wrapper,'microphone=(self)','microphone policy');

console.log('Caregiver platform v1 contract validation passed.');
