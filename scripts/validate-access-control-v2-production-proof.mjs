import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Router v5 production proof failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const check=path=>{const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(result.status===0,`${path} syntax failed: ${result.stderr||result.stdout}`)};

const access=read('preview/access-control-runtime-v2.js');
const router=read('preview/staff-module-router-v3.js');
const apiSmoke=read('scripts/run-admin-priority-api-smoke.mjs');
const browser=read('scripts/run-admin-priority-browser-smoke.mjs');
const workflow=read('.github/workflows/admin-core-production-smoke.yml');

for(const value of ["const VERSION='2.0.0'",'window.__salamatAccessControlRuntimeV1=true',"'staff.financial_credits':'اعتبارات مالی'","'staff.support':'پشتیبانی'",'window.SalamatAccessControl={version:VERSION','/api/users?','/api/admin/access/users/'])has(access,value,`access runtime missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])lacks(access,forbidden,`access runtime still contains ${forbidden}`);

for(const value of ["const VERSION='5.0.0'","const ASSET_VERSION='2.4.0'",'function canonicalButton','function renderCanonicalNavigation','<span data-icon=','nav.innerHTML=list.map','window.hydrateIcons?.(nav)','salamat-navigation-canonical'])has(router,value,`router v5 missing ${value}`);
for(const forbidden of ['nativeRenderNav','window.renderNav','renderNav(','setInterval(','window.icon('])lacks(router,forbidden,`router v5 still contains ${forbidden}`);

check('scripts/run-admin-priority-api-smoke.mjs');
for(const value of [
  "const PLATFORM = '2.4.0'","const ROUTER = '5.0.0'","const ACCESS = '2.0.0'",'EXPECTED_MODULES','ASSETS',
  'staff.financial_credits','staff.support','routerPriority','head-first','criticalOrder','priority-api-result.json',
])has(apiSmoke,value,`priority API smoke missing ${value}`);

check('scripts/run-admin-priority-browser-smoke.mjs');
for(const value of [
  "const PLATFORM = '2.4.0'","const ROUTER = '5.0.0'","const ACCESS = '2.0.0'",
  'EXPECTED_LABELS','priority-router.png','priority-router-failure.png','priority-browser-result.json','priority-browser-failure.json',
  'اعتبارات مالی','حقوق و پرداخت','بانک آموزش','پشتیبانی','کاربران و دسترسی‌ها',
])has(browser,value,`priority browser smoke missing ${value}`);

for(const value of [
  'Run authenticated head-first API smoke','run-admin-priority-api-smoke.mjs','Run real browser head-first smoke',
  'run-admin-priority-browser-smoke.mjs','Remove isolated admin identities','if: always()',
  'priority-api-result.json','priority-browser-result.json','priority-browser-failure.json','priority-router.png','priority-router-failure.png',
  'retention-days: 90','Report successful head-first smoke','Report failed head-first smoke',
  'Platform 2.4.0 / Router 5.0.0 / Access 2.0.0',
])has(workflow,value,`workflow missing ${value}`);
expect(workflow.indexOf('Run authenticated head-first API smoke')<workflow.indexOf('Run real browser head-first smoke'),'API smoke must run before browser smoke');
expect(workflow.indexOf('Run real browser head-first smoke')<workflow.indexOf('Remove isolated admin identities'),'cleanup must run after browser smoke');

console.log('Head-first direct sidebar router v5 production proof contract passed for platform 2.4.0.');
