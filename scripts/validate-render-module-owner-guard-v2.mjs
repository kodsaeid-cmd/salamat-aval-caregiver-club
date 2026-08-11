import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Runtime ownership prelaunch v2 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const syntax=path=>{const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(r.status===0,`${path} syntax failed: ${r.stderr||r.stdout}`)};

const guard=read('preview/render-module-owner-guard-v1.js');
const contractOwner=read('preview/contract-module-priority-v2.js');
const supportOwner=read('preview/staff-support-route-owner-v3.js');
const support=read('preview/staff-support-direct-runtime-v3.js');
const notifications=read('preview/server-notifications-runtime-v2.js');
const worker=read('worker/index-caregiver-platform-v1.ts');
const fixture=read('scripts/prepare-release-smoke-fixtures.mjs');
const browser=read('scripts/run-admin-priority-browser-smoke-v2.mjs');
const workflow=read('.github/workflows/admin-core-production-smoke.yml');

for(const path of ['preview/render-module-owner-guard-v1.js','preview/contract-module-priority-v2.js','preview/staff-support-route-owner-v3.js','preview/staff-support-direct-runtime-v3.js','preview/server-notifications-runtime-v2.js','scripts/run-admin-priority-browser-smoke-v2.mjs'])syntax(path);
for(const value of ["const VERSION='1.0.0'","Object.defineProperty(window,'renderModule'",'isSupportWrapper','isTrainingWrapper','window.SalamatRenderModuleOwnerGuard'])has(guard,value,`render owner guard missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','eval('])lacks(guard,forbidden,`render owner guard contains ${forbidden}`);

for(const value of ["const VERSION='2.0.0'","window.addEventListener('click',capture,true)","buttonKey(button)!=='staff.contracts'",'event.stopImmediatePropagation()','window.SalamatContractModulePriority',"owner:'window-capture'"])has(contractOwner,value,`contract route owner missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','document.addEventListener(\'click\''])lacks(contractOwner,forbidden,`contract route owner contains ${forbidden}`);
for(const value of ["const VERSION='3.0.0'","window.addEventListener('click',capture,true)","buttonKey(button)!=='staff.support'",'event.stopImmediatePropagation()','window.SalamatStaffSupportRouteOwner',"owner:'window-capture'"])has(supportOwner,value,`support route owner missing ${value}`);
for(const value of ["const VERSION='3.0.0'",'window.SalamatStaffSupport={version:VERSION','/api/caregiver/platform/support/threads','navigator.mediaDevices.getUserMedia'])has(support,value,`support runtime missing ${value}`);
for(const value of ["const VERSION='2.0.0'",'SUPPORT_MESSAGE','salamat-open-support-thread','window.SalamatServerNotifications'])has(notifications,value,`notification runtime missing ${value}`);

const critical=worker.slice(worker.indexOf('const CRITICAL_RUNTIMES'),worker.indexOf('const RUNTIMES'));
for(const value of ['"contract-module-priority-v2.js"','"staff-module-router-v3.js"','"access-control-runtime-v2.js"'])has(critical,value,`critical runtime list missing ${value}`);
lacks(critical,'"contract-module-priority-v1.js"','legacy contract owner remains critical');
expect(critical.indexOf('"contract-module-priority-v2.js"')<critical.indexOf('"staff-module-router-v3.js"')&&critical.indexOf('"staff-module-router-v3.js"')<critical.indexOf('"access-control-runtime-v2.js"'),'critical runtime order invalid');
const runtimes=worker.slice(worker.indexOf('const RUNTIMES'),worker.indexOf('function runtimeVersion'));
expect(runtimes.indexOf('"staff-support-route-owner-v3.js"')<runtimes.indexOf('"staff-support-direct-runtime-v3.js"'),'support owner must precede runtime');
for(const forbidden of ['"staff-support-runtime-v1.js"','"staff-support-direct-runtime-v2.js"','"server-notifications-runtime.js"'])lacks(runtimes,forbidden,`legacy runtime remains injected ${forbidden}`);

expect(!fixture.includes('DELETE FROM caregivers'),'smoke fixture hard-deletes protected caregiver records');
has(fixture,"cooperation_status='حذف‌شده'",'smoke caregiver soft-delete status missing');has(fixture,'active=0','smoke caregiver deactivation missing');has(fixture,'pendingRegistrationProfile','linked pending registration fixture missing');

for(const value of ["'/mobile/admin/job_ads'","'/mobile/admin/caregivers'","'/mobile/admin/financial_credits'",'/mobile/scorecard?prelaunch=',"['پشتیبانی','/app/support','پشتیبانی','پشتیبانی']",'errors.length===0'])has(browser,value,`browser smoke v2 missing ${value}`);
for(const value of ['workflow_run:','workflows: ["Production Deploy"]','github.event.workflow_run.conclusion == \'success\'','Run real browser head-first smoke','if: always()'])has(workflow,value,`production smoke sequencing missing ${value}`);

console.log('Runtime ownership prelaunch v2 passed: contract owner v2, support owner/runtime v3, notifications v2, protected fixture cleanup and desktop/mobile React smoke contracts are stable.');
