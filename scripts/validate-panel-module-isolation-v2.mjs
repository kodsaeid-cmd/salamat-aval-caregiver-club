import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin core module isolation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const syntax=(path)=>{const source=read(path);new Function(source);return source};

const access=read('worker/panel-access-contract-v2.ts');
const catalog=read('worker/caregiver-platform-catalog.ts');
const router=syntax('preview/staff-module-router-v3.js');
const legacyRouter=read('preview/panel-module-isolation-v2.js');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
const payroll=syntax('preview/staff-payroll-runtime-v1.js');
const settings=syntax('preview/staff-system-settings-runtime-v1.js');
const payrollBackend=read('worker/staff-payroll-v1.ts');
const settingsBackend=read('worker/admin-system-tools-v1.ts');
const training=read('preview/training-admin-classic-runtime.js');

for(const value of [
  '/api/access/me',
  '/api/access/configuration',
  'staff.financial_credits',
  'insertAfterPayroll',
  'HIDDEN_KEYS',
  'moduleContractVersion: "3.0.0"',
  '"staff.reports"',
])has(access,value,`access contract is missing ${value}`);

has(catalog,'"staff.reports"','reports are not explicitly removed from the module catalog');
has(catalog,'staff.financial_credits','finance is absent from the authoritative catalog');
has(catalog,'CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "3.0.0"','catalog version is not v3');
lacks(catalog,'اعتبار و حقوق مراقبین','finance description still claims payroll ownership');

for(const key of [
  'staff.dashboard',
  'staff.users',
  'staff.caregivers',
  'staff.contracts',
  'staff.payroll',
  'staff.financial_credits',
  'staff.training',
  'staff.evaluations',
  'staff.support',
  'staff.settings',
])has(router,key,`router is missing stable key ${key}`);

has(router,'data-panel-module-key','sidebar items do not receive stable keys');
has(router,'window.__salamatPanelModuleIsolationV2=true','legacy positional router is not disabled');
has(router,"key==='staff.training'",'training does not have an exact key');
has(router,"key==='staff.financial_credits'",'financial credits do not have an exact key');
has(router,"key==='staff.payroll'",'payroll does not have an exact key');
has(router,"key==='staff.settings'",'settings do not have an exact key');
has(router,'window.SalamatFinancialCredits?.open?.()','finance renderer is not routed directly');
has(router,'window.SalamatStaffPayroll?.open?.()','payroll renderer is not routed directly');
has(router,'window.SalamatSystemTools?.open?.()','settings renderer is not routed directly');
has(router,'event.stopImmediatePropagation()','admin modules do not have a single click owner');
has(router,'hiddenKeys=new Set([\'staff.reports\'])','reports are not blocked at the router boundary');
lacks(router,'modules[index]','routing still depends on menu position');
lacks(router,'data-index','navigation still uses legacy positional indexes');
lacks(router,"label.includes('آموزش')",'router still depends on partial training labels');
lacks(router,"label.includes('اعتبارات')",'router still depends on partial finance labels');

has(legacyRouter,'modules[index]','test fixture no longer proves the removed positional defect existed');
expect(wrapper.indexOf('staff-module-router-v3.js')>=0,'v3 router is not injected');
expect(wrapper.indexOf('panel-module-isolation-v2.js')>=0,'legacy router compatibility tag is missing');
expect(wrapper.indexOf('staff-module-router-v3.js')<wrapper.indexOf('panel-module-isolation-v2.js'),'v3 guard must load before legacy router');

has(finance,'اعتبارات مالی مراقبین','finance UI is missing');
has(finance,'/api/staff/financial-credits/rewards','finance reward route is missing');
has(finance,'/api/staff/financial-credits/settlements/','finance settlement route is missing');
has(finance,'/api/staff/financial-credits/credit-requests/','finance credit route is missing');
lacks(finance,'/api/staff/financial-credits/payroll','payroll is still mixed into finance');
lacks(finance,"['payroll'",'finance still exposes a payroll tab');

has(payroll,'حقوق و پرداخت مراقبین','payroll UI is missing');
has(payroll,'/api/staff/payroll','payroll UI does not use its independent API');
has(payroll,'window.SalamatStaffPayroll','payroll router hook is missing');
has(payrollBackend,'const MODULE_KEY = "staff.payroll"','payroll backend uses the wrong permission');
lacks(payrollBackend,'staff.financial_credits','payroll backend is still coupled to finance permission');

has(settings,'/api/staff/system-settings','settings UI has no persistent endpoint');
has(settings,'/api/staff/audit-logs','settings UI has no real audit source');
has(settings,'window.SalamatSystemTools','settings router hook is missing');
has(settingsBackend,'organization_settings','settings backend does not persist data');
has(settingsBackend,'audit_logs','settings backend does not query real logs');
has(settingsBackend,'adminCoreModules: VERSION','production version proof is missing');

has(training,'renderTrainingAdminClassic','existing training renderer is not preserved');
has(training,"label.includes('آموزش')",'mature training renderer no longer recognizes training');
has(router,'legacyRender(key)','router does not delegate training to the preserved renderer');

has(wrapper,'routePanelAccessContractV2','normalized access route is not active');
has(wrapper,'routeStaffPayrollV1','independent payroll route is not active');
has(wrapper,'routeAdminSystemToolsV1','settings and logs route is not active');
has(wrapper,'staff-financial-credits-runtime-v2.js','finance v2 is not injected');
has(wrapper,'staff-payroll-runtime-v1.js','payroll UI is not injected');
has(wrapper,'staff-system-settings-runtime-v1.js','settings UI is not injected');
has(wrapper,'x-salamat-admin-core','admin core production header is missing');

console.log('Admin core modules v3 isolation passed: training, financial credits, payroll and settings use independent stable routes; reports and positional routing are rejected.');
