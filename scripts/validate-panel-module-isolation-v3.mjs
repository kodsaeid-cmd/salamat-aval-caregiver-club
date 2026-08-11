import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin core module isolation v3 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const syntax=path=>{new Function(read(path));return read(path)};

const access=read('worker/panel-access-contract-v2.ts');
const catalog=read('worker/access-control.ts');
const router=syntax('preview/staff-module-router-v3.js');
const accessRuntime=syntax('preview/access-control-runtime-v2.js');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
const payroll=syntax('preview/staff-payroll-runtime-v1.js');
const settings=syntax('preview/staff-system-settings-runtime-v1.js');
const training=read('preview/training-admin-classic-runtime.js');

for(const key of ['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.job_ads','staff.payroll','staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings'])has(catalog,key,`canonical catalog missing ${key}`);
for(const value of ['label: "بانک آگهی‌ها"','label: "اعتبارات و تسهیلات"','label: "پشتیبانی و امنیت"'])has(catalog,value,`canonical label missing ${value}`);
for(const value of ['/api/access/me','staff.financial_credits','moduleContractVersion: "3.0.0"','"staff.reports"'])has(access,value,`access contract missing ${value}`);

for(const value of ["const VERSION='5.0.0'",'function canonicalButton','function renderCanonicalNavigation','nav.innerHTML=list.map(module=>canonicalButton(module,active)).join(\'\')','hiddenKeys=new Set([\'staff.reports\'])','legacyRender(key)',"if(key==='staff.users')","if(key==='staff.financial_credits')","if(key==='staff.payroll')","if(key==='staff.training')","if(key==='staff.support')","if(key==='staff.settings')"])has(router,value,`router missing ${value}`);
for(const forbidden of ['setInterval(','nativeRenderNav','window.renderNav','renderNav(','modules[index]','data-index'])lacks(router,forbidden,`router still contains ${forbidden}`);
for(const value of ["const VERSION='2.0.0'",'/api/users?','/api/admin/access/users/','window.SalamatAccessControl={version:VERSION'])has(accessRuntime,value,`access runtime missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])lacks(accessRuntime,forbidden,`access runtime contains ${forbidden}`);

for(const value of ['const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"','"contract-module-priority-v2.js"','"staff-module-router-v3.js"','"access-control-runtime-v2.js"','headers.set("x-salamat-router-priority", "head-first")'])has(wrapper,value,`outer worker missing ${value}`);
lacks(wrapper,'"panel-module-isolation-v2.js"','legacy positional router is still injected');

has(finance,'اعتبارات مالی مراقبین','finance UI missing');has(finance,'/api/staff/financial-credits/credit-requests/','finance decisions missing');lacks(finance,'/api/staff/financial-credits/payroll','finance still owns payroll');
has(payroll,'حقوق و پرداخت مراقبین','payroll UI missing');has(payroll,'/api/staff/payroll','payroll API missing');
has(settings,'/api/staff/system-settings','settings persistence missing');has(settings,'/api/staff/audit-logs','audit log source missing');
has(training,'renderTrainingAdminClassic','training renderer missing');

console.log('Direct canonical sidebar router v5 passed: 11-module navigation including job ads, server-backed finance/payroll/settings, stable access control and no positional routing.');
