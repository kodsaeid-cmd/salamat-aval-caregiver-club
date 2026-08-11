import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Prelaunch production proof v3 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const syntax=path=>{const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(r.status===0,`${path} syntax failed: ${r.stderr||r.stdout}`)};

const catalog=read('worker/access-control.ts');
const router=read('preview/staff-module-router-v3.js');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const api=read('scripts/run-admin-priority-api-smoke-v2.mjs');
const browser=read('scripts/run-admin-priority-browser-smoke-v2.mjs');
const registration=read('scripts/run-self-registration-production-smoke.mjs');
const workflow=read('.github/workflows/admin-core-production-smoke.yml');

for(const key of ['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.job_ads','staff.payroll','staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings'])has(catalog,key,`access catalog missing ${key}`);
has(catalog,'label: "بانک آگهی‌ها"','job ads label is not canonical');
has(catalog,'label: "اعتبارات و تسهیلات"','financial credits catalog label is missing');
has(catalog,'label: "پشتیبانی و امنیت"','support catalog label is missing');

for(const value of ["const VERSION='5.0.0'","const ASSET_VERSION='2.4.0'",'function renderCanonicalNavigation','nav.innerHTML=list.map(module=>canonicalButton(module,active)).join(\'\')','hiddenKeys=new Set([\'staff.reports\'])'])has(router,value,`router missing ${value}`);
for(const forbidden of ['setInterval(','window.renderNav','nativeRenderNav'])lacks(router,forbidden,`router contains ${forbidden}`);
for(const value of ['const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"','"contract-module-priority-v2.js"','"staff-module-router-v3.js"','"access-control-runtime-v2.js"','x-salamat-router-priority'])has(wrapper,value,`outer worker missing ${value}`);

syntax('scripts/run-admin-priority-api-smoke-v2.mjs');
for(const value of [
 "const EXPECTED_MODULES=['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.job_ads'",
 "const EXPECTED_LABELS=['داشبورد مدیریتی','کاربران و دسترسی‌ها','پرونده مراقبین','قراردادها','بانک آگهی‌ها'",
 "'اعتبارات مالی'","'پشتیبانی'","passed('root.eleven-module-contract')","'/api/staff/job-ads?page=1'","passed('root.job-ads')",
 "'/api/training/admin'","'/api/staff/financial-credits'","'/api/staff/payroll?page=1&pageSize=10'","'/api/staff/system-settings'","'/api/caregiver/platform/support/threads'",
 "'/api/staff/contracts'",'contractEvents.length===7',"action==='DELETE_CONTRACT'",'contract-module-priority-v2.js','legacy contract owner v1',
])has(api,value,`API smoke v2 missing ${value}`);
lacks(api,'root.ten-module-contract','API smoke still asserts ten modules');

syntax('scripts/run-admin-priority-browser-smoke-v2.mjs');
for(const value of [
 "const EXPECTED_LABELS=['داشبورد مدیریتی','کاربران و دسترسی‌ها','پرونده مراقبین','قراردادها','بانک آگهی‌ها'",
 "['بانک آگهی‌ها','/app/job_ads','بانک آگهی‌ها','آگهی']","['اعتبارات مالی','/app/financial_credits','اعتبارات مالی','اعتبار']","['پشتیبانی','/app/support','پشتیبانی','پشتیبانی']",
 "'/mobile/admin/job_ads'","'/mobile/admin/caregivers'","'/mobile/admin/financial_credits'",'/mobile/scorecard?prelaunch=',
 'tabCount===4','iconCount===4','errors.length===0','priority-mobile-admin.png','priority-caregiver-scorecard.png',
])has(browser,value,`browser smoke v2 missing ${value}`);

syntax('scripts/run-self-registration-production-smoke.mjs');
for(const value of ['status=PENDING&registration=SELF_REGISTERED',"approvalAction:'APPROVE_SELF_REGISTRATION'",'pendingApproval===true','profileOnly===false','login(pendingUser.username)'])has(registration,value,`registration smoke missing ${value}`);

for(const value of ['workflow_run:','workflows: ["Production Deploy"]','github.event.workflow_run.conclusion == \'success\'','Run authenticated head-first API smoke','Run linked self-registration approval smoke','Run real browser head-first smoke','if: always()'])has(workflow,value,`serialized production smoke workflow missing ${value}`);

console.log('Prelaunch production proof v3 passed: 11 live staff modules, job ads, serialized deploy smoke, desktop/mobile React routes and linked-registration approval are gated.');
