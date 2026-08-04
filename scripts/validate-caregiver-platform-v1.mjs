import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{
  if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`);
};
const rejectText=(source,needle,label)=>{
  if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`);
};
const syntax=(path)=>{
  const source=read(path);
  new Function(source);
  return source;
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
for(const key of [
  'staff.financial_credits',
  'staff.reports',
  'caregiver.contracts',
  'caregiver.security',
  'caregiver.rank',
])requireText(catalog,key,'catalog');
requireText(catalog,'REMOVE_KEYS','catalog removal contract');
requireText(catalog,'کیف پول و اعتبارات','catalog caregiver wallet');
requireText(catalog,'CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "3.0.0"','catalog version');
rejectText(catalog,'اعتبار و حقوق مراقبین','finance must not own payroll');

const access=read('worker/panel-access-contract-v2.ts');
requireText(access,'moduleContractVersion: "3.0.0"','access contract version');
requireText(access,'"staff.reports"','hidden reports contract');
requireText(access,'insertAfterPayroll','finance ordering');
requireText(access,'پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار','finance scope');
rejectText(access,'اعتبار و حقوق مراقبین','finance access scope');

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
])requireText(backend,route,'caregiver platform backend route');
requireText(backend,'CUMULATIVE_TARGET_DAYS = 1_200','credit rule');
requireText(backend,'LOAN_AMOUNT_TOMAN = 500_000_000','credit amount');
requireText(backend,'requireAccess(env, actor, STAFF_FINANCE_MODULE','financial access');
requireText(backend,'requireAccess(env, actor, STAFF_SUPPORT_MODULE','support access');

const payrollBackend=read('worker/staff-payroll-v1.ts');
for(const route of [
  '/api/staff/payroll',
  '/api/staff/payroll/caregivers',
  '/api/staff/payroll/:id/pay',
]){
  if(route.includes(':id'))requireText(payrollBackend,'/api/staff/payroll/','staff payroll route');
  else requireText(payrollBackend,route,'staff payroll route');
}
requireText(payrollBackend,'const MODULE_KEY = "staff.payroll"','payroll permission boundary');
requireText(payrollBackend,'ISSUE_PAYROLL','payroll audit');
requireText(payrollBackend,'MARK_PAYROLL_PAID','payroll payment audit');
rejectText(payrollBackend,'staff.financial_credits','payroll must not use finance permission');

const systemBackend=read('worker/admin-system-tools-v1.ts');
for(const route of [
  '/api/system/admin-core-version',
  '/api/staff/system-settings',
  '/api/staff/audit-logs',
])requireText(systemBackend,route,'system tools route');
requireText(systemBackend,'organization_settings','persistent settings');
requireText(systemBackend,'audit_logs','real audit log source');
requireText(systemBackend,'adminCoreModules: VERSION','public admin core proof');
requireText(systemBackend,'const MODULE_KEY = "staff.settings"','settings permission boundary');

const overrides=read('worker/caregiver-platform-overrides.ts');
requireText(overrides,'CUMULATIVE_TARGET_DAYS = 1_200','benefits correction');
requireText(overrides,'cumulativeTargetMonths: 40','benefits correction');
requireText(overrides,'correctedDashboard','dashboard credit correction');
requireText(overrides,'correctedWallet','wallet credit correction');
requireText(overrides,"'REFERRAL_CASE'",'referral reward');

const signup=syntax('preview/caregiver-signup-jalali-v1.js');
requireText(signup,'انتخاب تاریخ تولد شمسی','signup calendar');
requireText(signup,"/api/public/caregivers/register",'signup server route');
requireText(signup,"input.type='hidden'",'signup ISO storage');
rejectText(signup,'localStorage.setItem','signup must not persist accounts locally');

const caregiver=syntax('preview/caregiver-platform-runtime-v1.js');
for(const route of [
  '/api/caregiver/platform/dashboard',
  '/api/caregiver/platform/scorecard-record',
  '/api/caregiver/platform/wallet',
  '/api/caregiver/platform/payroll',
  '/api/caregiver/platform/support/threads',
])requireText(caregiver,route,'caregiver runtime');
requireText(caregiver,'کیف پول و اعتبارات','caregiver label');
requireText(caregiver,'navigator.mediaDevices.getUserMedia','caregiver voice');
rejectText(caregiver,'localStorage','caregiver server source');

const dangerGate=syntax('preview/caregiver-urgent-gate-v1.js');
requireText(dangerGate,'آیا در خطر هستید؟','urgent support guard');
requireText(dangerGate,'بله، در خطر هستم','urgent yes choice');
requireText(dangerGate,'لطفاً از پشتیبانی پرونده استفاده کنید.','urgent no route');
requireText(dangerGate,'stopImmediatePropagation','urgent legacy interception');

const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
requireText(finance,'اعتبارات مالی مراقبین','staff finance');
requireText(finance,'/api/staff/financial-credits/rewards','staff reward');
requireText(finance,'/api/staff/financial-credits/settlements/','staff settlement');
requireText(finance,'/api/staff/financial-credits/credit-requests/','staff credit request');
rejectText(finance,'/api/staff/financial-credits/payroll','finance runtime must not own payroll');
rejectText(finance,"['payroll'",'finance runtime must not render payroll tab');

const payroll=syntax('preview/staff-payroll-runtime-v1.js');
requireText(payroll,'حقوق و پرداخت مراقبین','staff payroll');
requireText(payroll,'/api/staff/payroll','staff payroll API');
requireText(payroll,'window.SalamatStaffPayroll','payroll router hook');
requireText(payroll,'شماره پیگیری پرداخت','payroll payment evidence');

const settings=syntax('preview/staff-system-settings-runtime-v1.js');
requireText(settings,'/api/staff/system-settings','settings API');
requireText(settings,'/api/staff/audit-logs','audit API');
requireText(settings,'window.SalamatSystemTools','settings router hook');
requireText(settings,'تنظیمات ذخیره شد','settings write action');

const support=syntax('preview/staff-support-runtime-v1.js');
requireText(support,'پشتیبانی فوری و امنیتی','staff support');
requireText(support,'navigator.mediaDevices.getUserMedia','staff voice');
requireText(support,"data-sts-status",'support lifecycle');

const router=syntax('preview/staff-module-router-v3.js');
for(const key of ['staff.training','staff.financial_credits','staff.payroll','staff.settings'])requireText(router,key,'stable admin route');
requireText(router,"const VERSION='4.0.0'",'router v4 version');
requireText(router,'window.__salamatPanelModuleIsolationV2=true','legacy positional router guard');
requireText(router,'data-panel-module-key','stable navigation key');
requireText(router,'nativeRenderNav','native icon renderer');
requireText(router,'async function openRuntime','resilient runtime opener');
rejectText(router,'setInterval(','router polling');
rejectText(router,'window.icon(','raw SVG icon injection');
rejectText(router,'modules[index]','positional module routing');
rejectText(router,'data-index','legacy positional navigation');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const runtime of [
  'caregiver-signup-jalali-v1.js',
  'caregiver-platform-runtime-v1.js',
  'caregiver-urgent-gate-v1.js',
  'staff-financial-credits-runtime-v2.js',
  'staff-payroll-runtime-v1.js',
  'staff-system-settings-runtime-v1.js',
  'staff-support-runtime-v1.js',
  'staff-module-router-v3.js',
])requireText(wrapper,runtime,'worker injection');
requireText(wrapper,'routeStaffPayrollV1','payroll backend route active');
requireText(wrapper,'routeAdminSystemToolsV1','system tools backend route active');
requireText(wrapper,'x-salamat-admin-core','admin core response header');
requireText(wrapper,'x-salamat-admin-router','admin router proof header');
requireText(wrapper,'const PLATFORM_VERSION = "2.1.0"','runtime cache version');
requireText(wrapper,'microphone=(self)','microphone policy');
rejectText(wrapper,'"panel-module-isolation-v2.js"','legacy router download');

console.log('Caregiver platform and admin router v4 contract validation passed.');
