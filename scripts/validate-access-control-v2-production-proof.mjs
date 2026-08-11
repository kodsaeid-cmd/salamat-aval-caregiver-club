import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Router v5 production proof failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const check=path=>{const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(result.status===0,`${path} syntax failed: ${result.stderr||result.stdout}`)};

const access=read('preview/access-control-runtime-v2.js');
const router=read('preview/staff-module-router-v3.js');
const contractsPriority=read('preview/contract-module-priority-v2.js');
const contractsRuntime=read('preview/staff-contracts-runtime-v1.js');
const fixture=read('scripts/prepare-release-smoke-fixtures.mjs');
const apiSmoke=read('scripts/run-admin-priority-api-smoke.mjs');
const registrationSmoke=read('scripts/run-self-registration-production-smoke.mjs');
const browser=read('scripts/run-admin-priority-browser-smoke.mjs');
const workflow=read('.github/workflows/admin-core-production-smoke.yml');

for(const value of ["const VERSION='2.0.0'",'window.__salamatAccessControlRuntimeV1=true',"'staff.financial_credits':'اعتبارات مالی'","'staff.support':'پشتیبانی'",'window.SalamatAccessControl={version:VERSION','/api/users?','/api/admin/access/users/'])has(access,value,`access runtime missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])lacks(access,forbidden,`access runtime still contains ${forbidden}`);

for(const value of ["const VERSION='5.0.0'","const ASSET_VERSION='2.4.0'",'function canonicalButton','function renderCanonicalNavigation','<span data-icon=','nav.innerHTML=list.map','window.hydrateIcons?.(nav)','salamat-navigation-canonical'])has(router,value,`router v5 missing ${value}`);
for(const forbidden of ['nativeRenderNav','window.renderNav','renderNav(','setInterval(','window.icon('])lacks(router,forbidden,`router v5 still contains ${forbidden}`);

for(const value of ["const VERSION='2.0.0'","const ASSET_VERSION='2.4.0'",'staff.contracts','staff-contracts-runtime-v1.js',"window.addEventListener('click',capture,true)","String(id).startsWith('contract:')",'window.SalamatContractModulePriority'])has(contractsPriority,value,`contracts priority v2 missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','document.addEventListener(\'click\''])lacks(contractsPriority,forbidden,`contracts priority v2 still contains ${forbidden}`);
for(const value of ['window.SalamatStaffContracts','مدیریت قراردادهای مراقبین','/api/staff/contracts/caregivers','خدمت‌گیرنده همان مشترک است','data-sct-jyear','data-sct-jmonth'])has(contractsRuntime,value,`contracts runtime missing ${value}`);
lacks(contractsRuntime,'localStorage','contracts runtime is not server-backed');
lacks(contractsRuntime,'type="date"','contracts runtime still uses native Gregorian dates');

for(const value of [
  'const caregiverProfile = {','const pendingRegistrationProfile = {','INSERT INTO caregivers(','caregiverId: caregiverProfile.id',
  'caregiverId: pendingRegistrationProfile.id',"cooperation_status='حذف‌شده'",'active=0','caregiverProfile,','pendingRegistrationProfile',
])has(fixture,value,`isolated contract/registration fixture missing ${value}`);
expect(
  fixture.includes("DELETE FROM contracts WHERE caregiver_id LIKE 'RC-%-CARE-PROFILE'")
    || fixture.includes('DELETE FROM contracts WHERE caregiver_id=${sql(caregiverProfile.id)}')
    || (fixture.includes('DELETE FROM contracts WHERE caregiver_id IN') && fixture.includes('${sql(caregiverProfile.id)}') && fixture.includes('${sql(pendingRegistrationProfile.id)}')),
  'isolated fixture missing safe contract cleanup',
);
lacks(fixture,'DELETE FROM caregivers','protected caregiver hard delete remains in smoke cleanup');

check('scripts/run-admin-priority-api-smoke.mjs');
for(const value of [
  "const ALLOWED_BASE_URL = 'https://salamatavalcaregivers.site'",'normalizedRequestedBaseUrl !== ALLOWED_BASE_URL','const baseUrl = ALLOWED_BASE_URL',
  "const PLATFORM = '2.4.0'","const ROUTER = '5.0.0'","const ACCESS = '2.0.0'","const CONTRACTS = '1.0.0'","const CONTRACT_OWNER = '2.0.0'",
  'contract-module-priority-v2.js','staff-contracts-runtime-v1.js','x-salamat-contract-route-owner','/api/staff/contracts/caregivers?q=',
  "await authedRequest(rootCookie, '/api/staff/contracts', { method: 'POST'",'recipientSameAsSubscriber: true',
  "method: 'PATCH'",'/api/calendar?start=','contractEvents.length === 7',
  "method: 'DELETE'",'deleted contract remained in caregiver calendar','DELETE_CONTRACT',
  'contractLifecycle: {','sameSubscriberCopied: true','deletedAndRemovedFromCalendar: true',
  'criticalOrder','priority-api-result.json','x-salamat-contracts','function scriptSources','function scriptIndex',
  "const legacyContractIndex = scriptIndex(scripts, 'contract-module-priority-v1.js')",'routerIndex > contractPriorityIndex','accessIndex > routerIndex',
])has(apiSmoke,value,`priority API smoke missing ${value}`);
lacks(apiSmoke,"const baseUrl = requestedBaseUrl",'priority API smoke still trusts an arbitrary network target');

check('scripts/run-self-registration-production-smoke.mjs');
for(const value of [
  "const ALLOWED_BASE_URL='https://salamatavalcaregivers.site'",'pendingCaregiver','pendingRegistrationProfile',
  'status=PENDING&registration=SELF_REGISTERED','pendingApproval===true','profileOnly===false',
  "approvalAction:'APPROVE_SELF_REGISTRATION'",'approved?.data?.status===\'ACTIVE\'','recruitmentStage).toUpperCase()===\'APPROVED\'',
  'login(pendingUser.username)','self-registration-approval-result.json',
])has(registrationSmoke,value,`self-registration production smoke missing ${value}`);
lacks(registrationSmoke,"const baseUrl=requestedBaseUrl",'self-registration smoke still trusts an arbitrary network target');

check('scripts/run-admin-priority-browser-smoke.mjs');
for(const value of [
  "const ALLOWED_BASE_URL = 'https://salamatavalcaregivers.site'",'normalizedRequestedBaseUrl !== ALLOWED_BASE_URL','const baseUrl = ALLOWED_BASE_URL',
  "const PLATFORM = '2.4.0'","const ROUTER = '5.0.0'","const ACCESS = '2.0.0'","const CONTRACTS = '1.0.0'","const CONTRACT_OWNER = '2.0.0'",
  'contract-module-priority-v2.js','const scriptIndex = (file)','contractsPriorityIndex >= 0','legacyContractsPriorityIndex < 0','routerIndex > contractsPriorityIndex','accessIndex > routerIndex','مدیریت قراردادهای مراقبین',
  'contractForm.jalaliFields === 4','contractForm.weekdayOptions === 7','sameSubscriber','nativeDateInputs === 0',
  'priority-router.png','priority-router-failure.png','priority-browser-result.json','priority-browser-failure.json','criticalScriptOrder',
  'اعتبارات مالی','حقوق و پرداخت','بانک آموزش','پشتیبانی','کاربران و دسترسی‌ها',
])has(browser,value,`priority browser smoke missing ${value}`);
lacks(browser,"const baseUrl = requestedBaseUrl",'priority browser smoke still trusts an arbitrary network target');

for(const value of [
  'workflow_run:','workflows: ["Production Deploy"]','types: [completed]','github.event.workflow_run.conclusion == \'success\'','github.event.workflow_run.head_sha',
  'scripts/prepare-release-smoke-fixtures.mjs','Prepare isolated admin and caregiver identities',
  'Run authenticated head-first API smoke','run-admin-priority-api-smoke.mjs','Run linked self-registration approval smoke','run-self-registration-production-smoke.mjs','Run real browser head-first smoke',
  'run-admin-priority-browser-smoke.mjs','Remove isolated admin and caregiver identities','if: always()',
  'priority-api-result.json','self-registration-approval-result.json','priority-browser-result.json','priority-browser-failure.json','priority-router.png','priority-router-failure.png',
  'retention-days: 90','Report successful head-first smoke','Report failed head-first smoke',
  'Platform 2.4.0 / Router 5.0.0 / Access 2.0.0 / Contracts 1.0.0','چهار تقویم شمسی Dropdown',
])has(workflow,value,`workflow missing ${value}`);
expect(workflow.indexOf('Prepare isolated admin and caregiver identities')<workflow.indexOf('Run authenticated head-first API smoke'),'isolated identities must be prepared before API smoke');
expect(workflow.indexOf('Run authenticated head-first API smoke')<workflow.indexOf('Run linked self-registration approval smoke'),'API smoke must run before self-registration smoke');
expect(workflow.indexOf('Run linked self-registration approval smoke')<workflow.indexOf('Run real browser head-first smoke'),'self-registration smoke must run before browser smoke');
expect(workflow.indexOf('Run real browser head-first smoke')<workflow.indexOf('Remove isolated admin and caregiver identities'),'cleanup must run after browser smoke');

console.log('Head-first router v5, contract owner v2, query-agnostic critical runtime ordering, isolated operational contract lifecycle, linked self-registration approval and caregiver calendar production proof passed for platform 2.4.0.');
