import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin core module isolation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const syntax=(path)=>{const source=read(path);new Function(source);return source};

const access=read('worker/panel-access-contract-v2.ts');
const catalog=read('worker/caregiver-platform-catalog.ts');
const accessRuntime=syntax('preview/access-control-runtime-v2.js');
const router=syntax('preview/staff-module-router-v3.js');
const legacyRouter=read('preview/panel-module-isolation-v2.js');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
const payroll=syntax('preview/staff-payroll-runtime-v1.js');
const settings=syntax('preview/staff-system-settings-runtime-v1.js');
const payrollBackend=read('worker/staff-payroll-v1.ts');
const settingsBackend=read('worker/admin-system-tools-v1.ts');
const training=read('preview/training-admin-classic-runtime.js');

for(const value of ['/api/access/me','/api/access/configuration','staff.financial_credits','insertAfterPayroll','HIDDEN_KEYS','moduleContractVersion: "3.0.0"','"staff.reports"'])has(access,value,`access contract is missing ${value}`);
has(catalog,'"staff.reports"','reports are not explicitly removed from the module catalog');
has(catalog,'staff.financial_credits','finance is absent from the authoritative catalog');
has(catalog,'CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "3.0.0"','catalog version is not v3');
lacks(catalog,'اعتبار و حقوق مراقبین','finance description still claims payroll ownership');

for(const key of ['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll','staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings'])has(router,key,`router is missing stable key ${key}`);
for(const value of [
  "const VERSION='5.0.0'","const ASSET_VERSION='2.4.0'",
  'window.__salamatStaffModuleRouterV4=true','window.__salamatStaffModuleRouterV3=true','window.__salamatPanelModuleIsolationV2=true',
  'function canonicalButton','function renderCanonicalNavigation','nav.innerHTML=list.map(module=>canonicalButton(module,active)).join(\'\')',
  '<span data-icon=','window.hydrateIcons?.(nav)','dataset.panelModuleKey','dataset.accessModule',
  'async function openRuntime',"'SalamatFinancialCredits'","'SalamatStaffPayroll'","'SalamatSystemTools'",
  'event.stopImmediatePropagation()','hiddenKeys=new Set([\'staff.reports\'])',
  'new MutationObserver(()=>{if(!state.repairing)scheduleRepair(false)})','state.observer.observe(nav,{childList:true,subtree:false})',
])has(router,value,`router v5 is missing ${value}`);
for(const forbidden of ['setInterval(','nativeRenderNav','window.renderNav','renderNav(','window.icon(','modules[index]','data-index','installRenderGuard'])lacks(router,forbidden,`router still contains ${forbidden}`);

for(const required of ["const VERSION='2.0.0'",'window.__salamatAccessControlRuntimeV1=true',"'staff.financial_credits':'اعتبارات مالی'","'staff.support':'پشتیبانی'",'window.SalamatAccessControl={version:VERSION',"window.addEventListener('salamat-authenticated'","window.addEventListener('salamat-access-changed'",'/api/users?','/api/admin/access/users/','/api/admin/access/config'])has(accessRuntime,required,`access control v2 is missing ${required}`);
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])lacks(accessRuntime,forbidden,`access control v2 still contains ${forbidden}`);

has(legacyRouter,'modules[index]','test fixture no longer proves the removed positional defect existed');
has(wrapper,'const PLATFORM_VERSION = "2.4.0"','runtime cache version is not 2.4.0');
has(wrapper,'const ADMIN_ROUTER_VERSION = "5.0.0"','router version constant is missing');
has(wrapper,'const ACCESS_CONTROL_VERSION = "2.0.0"','access control version is not explicit');
has(wrapper,'"access-control-runtime-v2.js"','access control v2 is not injected');
has(wrapper,'"staff-module-router-v3.js"','router v5 compatibility asset is not injected');
has(wrapper,'access-control-runtime\\.js','old access control script tag is not removed');
has(wrapper,'headers.set("x-salamat-admin-router", ADMIN_ROUTER_VERSION)','router v5 proof header is missing');
has(wrapper,'headers.set("x-salamat-access-control", ACCESS_CONTROL_VERSION)','access control proof header is missing');
has(wrapper,'headers.set("x-salamat-router-priority", "head-first")','router priority proof header is missing');
lacks(wrapper,'"panel-module-isolation-v2.js"','legacy positional router is still downloaded');

has(finance,'اعتبارات مالی مراقبین','finance UI is missing');
has(finance,'/api/staff/financial-credits/rewards','finance reward route is missing');
has(finance,'/api/staff/financial-credits/settlements/','finance settlement route is missing');
has(finance,'/api/staff/financial-credits/credit-requests/','finance credit request route is missing');
lacks(finance,'/api/staff/financial-credits/payroll','payroll is still mixed into finance');
has(payroll,'حقوق و پرداخت مراقبین','payroll UI is missing');
has(payroll,'/api/staff/payroll','payroll UI does not use its independent API');
has(payrollBackend,'const MODULE_KEY = "staff.payroll"','payroll backend uses the wrong permission');
lacks(payrollBackend,'staff.financial_credits','payroll backend is still coupled to finance permission');
has(settings,'/api/staff/system-settings','settings UI has no persistent endpoint');
has(settings,'/api/staff/audit-logs','settings UI has no real audit source');
has(settingsBackend,'organization_settings','settings backend does not persist data');
has(settingsBackend,'audit_logs','settings backend does not query real logs');
has(training,'renderTrainingAdminClassic','existing training renderer is not preserved');
has(router,"legacyRender('staff.training')",'router does not delegate training to the preserved renderer');

console.log('Direct canonical sidebar router v5 passed: exact ten-module navigation, original line-icon hosts, no renderNav dependency, platform 2.4 assets and no polling.');
