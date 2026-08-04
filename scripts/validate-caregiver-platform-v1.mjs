import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`)};
const rejectText=(source,needle,label)=>{if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`)};
const syntax=(path)=>{const source=read(path);new Function(source);return source};

const migration=read('migrations/0100_caregiver_finance_support.sql');
for(const table of ['caregiver_wallet_transactions','caregiver_settlement_requests','caregiver_credit_requests','caregiver_payroll_slips','support_threads','support_messages'])requireText(migration,`CREATE TABLE IF NOT EXISTS ${table}`,'migration');
requireText(migration,'wallet_transaction_is_immutable','migration');
requireText(migration,'support_message_is_immutable','migration');

const catalog=read('worker/caregiver-platform-catalog.ts');
for(const key of ['staff.financial_credits','staff.reports','caregiver.contracts','caregiver.security','caregiver.rank'])requireText(catalog,key,'catalog');
requireText(catalog,'REMOVE_KEYS','catalog removal contract');
requireText(catalog,'کیف پول و اعتبارات','catalog caregiver wallet');
requireText(catalog,'CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "3.0.0"','catalog version');
rejectText(catalog,'اعتبار و حقوق مراقبین','finance must not own payroll');

const access=read('worker/panel-access-contract-v2.ts');
for(const value of ['moduleContractVersion: "3.0.0"','"staff.reports"','insertAfterPayroll','پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار'])requireText(access,value,'access contract');

const backend=read('worker/caregiver-platform-v1.ts');
for(const route of ['/api/caregiver/platform/dashboard','/api/caregiver/platform/scorecard-record','/api/caregiver/platform/wallet','/api/caregiver/platform/settlements','/api/caregiver/platform/credit-requests','/api/caregiver/platform/payroll','/api/caregiver/platform/support/threads','/api/staff/financial-credits'])requireText(backend,route,'caregiver platform backend route');
requireText(backend,'CUMULATIVE_TARGET_DAYS = 1_200','credit rule');
requireText(backend,'LOAN_AMOUNT_TOMAN = 500_000_000','credit amount');
requireText(backend,'requireAccess(env, actor, STAFF_FINANCE_MODULE','financial access');
requireText(backend,'requireAccess(env, actor, STAFF_SUPPORT_MODULE','support access');

const payrollBackend=read('worker/staff-payroll-v1.ts');
for(const route of ['/api/staff/payroll','/api/staff/payroll/caregivers','/api/staff/payroll/'])requireText(payrollBackend,route,'staff payroll route');
requireText(payrollBackend,'const MODULE_KEY = "staff.payroll"','payroll permission boundary');
requireText(payrollBackend,'ISSUE_PAYROLL','payroll audit');
requireText(payrollBackend,'MARK_PAYROLL_PAID','payroll payment audit');
rejectText(payrollBackend,'staff.financial_credits','payroll must not use finance permission');

const systemBackend=read('worker/admin-system-tools-v1.ts');
for(const route of ['/api/system/admin-core-version','/api/staff/system-settings','/api/staff/audit-logs'])requireText(systemBackend,route,'system tools route');
requireText(systemBackend,'organization_settings','persistent settings');
requireText(systemBackend,'audit_logs','real audit log source');

const overrides=read('worker/caregiver-platform-overrides.ts');
for(const value of ['CUMULATIVE_TARGET_DAYS = 1_200','cumulativeTargetMonths: 40','correctedDashboard','correctedWallet',"'REFERRAL_CASE'"])requireText(overrides,value,'caregiver overrides');

const signup=syntax('preview/caregiver-signup-jalali-v1.js');
requireText(signup,'انتخاب تاریخ تولد شمسی','signup calendar');
requireText(signup,"/api/public/caregivers/register",'signup server route');
rejectText(signup,'localStorage.setItem','signup must not persist accounts locally');
const caregiver=syntax('preview/caregiver-platform-runtime-v1.js');
for(const route of ['/api/caregiver/platform/dashboard','/api/caregiver/platform/scorecard-record','/api/caregiver/platform/wallet','/api/caregiver/platform/payroll','/api/caregiver/platform/support/threads'])requireText(caregiver,route,'caregiver runtime');
requireText(caregiver,'کیف پول و اعتبارات','caregiver label');
requireText(caregiver,'navigator.mediaDevices.getUserMedia','caregiver voice');
rejectText(caregiver,'localStorage','caregiver server source');

const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
for(const value of ['اعتبارات مالی مراقبین','/api/staff/financial-credits/rewards','/api/staff/financial-credits/settlements/','/api/staff/financial-credits/credit-requests/'])requireText(finance,value,'staff finance');
rejectText(finance,'/api/staff/financial-credits/payroll','finance runtime must not own payroll');
const payroll=syntax('preview/staff-payroll-runtime-v1.js');
for(const value of ['حقوق و پرداخت مراقبین','/api/staff/payroll','window.SalamatStaffPayroll','شماره پیگیری پرداخت'])requireText(payroll,value,'staff payroll');
const settings=syntax('preview/staff-system-settings-runtime-v1.js');
for(const value of ['/api/staff/system-settings','/api/staff/audit-logs','window.SalamatSystemTools','تنظیمات ذخیره شد'])requireText(settings,value,'settings runtime');
const support=syntax('preview/staff-support-runtime-v1.js');
for(const value of ['پشتیبانی فوری و امنیتی','navigator.mediaDevices.getUserMedia',"data-sts-status"])requireText(support,value,'staff support');

const accessRuntime=syntax('preview/access-control-runtime-v2.js');
for(const value of ["const VERSION='2.0.0'","'staff.financial_credits':'اعتبارات مالی'","'staff.support':'پشتیبانی'",'window.SalamatAccessControl','salamat-access-ready'])requireText(accessRuntime,value,'access runtime');
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])rejectText(accessRuntime,forbidden,'access runtime');

const router=syntax('preview/staff-module-router-v3.js');
for(const value of ["const VERSION='5.0.0'","const ASSET_VERSION='2.3.0'",'function canonicalButton','function renderCanonicalNavigation','<span data-icon=','nav.innerHTML=list.map','window.hydrateIcons?.(nav)','dataset.panelModuleKey','dataset.accessModule','async function openRuntime'])requireText(router,value,'direct sidebar router v5');
for(const forbidden of ['setInterval(','nativeRenderNav','window.renderNav','renderNav(','window.icon(','modules[index]','data-index'])rejectText(router,forbidden,'direct sidebar router v5');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const runtime of ['access-control-runtime-v2.js','caregiver-signup-jalali-v1.js','caregiver-platform-runtime-v1.js','caregiver-urgent-gate-v1.js','staff-financial-credits-runtime-v2.js','staff-payroll-runtime-v1.js','staff-system-settings-runtime-v1.js','staff-support-runtime-v1.js','staff-module-router-v3.js'])requireText(wrapper,runtime,'worker injection');
for(const value of ['const PLATFORM_VERSION = "2.3.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"','x-salamat-admin-router','x-salamat-access-control','microphone=(self)'])requireText(wrapper,value,'worker wrapper');
rejectText(wrapper,'"panel-module-isolation-v2.js"','legacy router download');

console.log('Caregiver platform 2.3, direct sidebar router v5 and event-driven access control v2 contract validation passed.');
