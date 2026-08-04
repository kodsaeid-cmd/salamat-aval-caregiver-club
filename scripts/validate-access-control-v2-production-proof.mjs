import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Router v5 production proof failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);
const check=path=>{const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(result.status===0,`${path} syntax failed: ${result.stderr||result.stdout}`)};

const access=read('preview/access-control-runtime-v2.js');
const router=read('preview/staff-module-router-v3.js');
const apiSmoke=read('scripts/run-admin-api-smoke-v2.mjs');
const browser=read('scripts/run-admin-ui-browser-smoke-v2.mjs');
const workflow=read('.github/workflows/admin-core-production-smoke.yml');

for(const value of ["const VERSION='2.0.0'",'window.__salamatAccessControlRuntimeV1=true',"'staff.financial_credits':'اعتبارات مالی'","'staff.support':'پشتیبانی'",'window.SalamatAccessControl={version:VERSION','/api/users?','/api/admin/access/users/'])has(access,value,`access runtime missing ${value}`);
for(const forbidden of ['setInterval(','new MutationObserver(','renderNav('])lacks(access,forbidden,`access runtime still contains ${forbidden}`);

for(const value of ["const VERSION='5.0.0'","const ASSET_VERSION='2.3.0'",'function canonicalButton','function renderCanonicalNavigation','<span data-icon=','nav.innerHTML=list.map','window.hydrateIcons?.(nav)','direct canonical sidebar'])has(router,value,`router v5 missing ${value}`);
for(const forbidden of ['nativeRenderNav','window.renderNav','renderNav(','setInterval(','window.icon('])lacks(router,forbidden,`router v5 still contains ${forbidden}`);

check('scripts/run-admin-api-smoke-v2.mjs');
for(const value of [
  "const PLATFORM='2.3.0',ROUTER='5.0.0',ACCESS='2.0.0'",'RUNTIME_FILES','fetchRuntime(file)',
  'asset.status===200','router asset contains',"text.includes(\"const VERSION='5.0.0'\")",
  'EXPECTED_MODULES','staff.financial_credits','staff.support','runtimeAssets:RUNTIME_FILES',
])has(apiSmoke,value,`API smoke missing ${value}`);

check('scripts/run-admin-ui-browser-smoke-v2.mjs');
for(const value of [
  "const PLATFORM='2.3.0',ROUTER='5.0.0',ACCESS='2.0.0'",
  "window.SalamatStaffModuleRouter?.version==='5.0.0'",'access-control-runtime-v2.js?v=${PLATFORM}',
  'staff-module-router-v3.js?v=${PLATFORM}','expectedLabels','canonicalEvent.length===10',
  'اعتبارات مالی','پشتیبانی','icon.host','mutations<=1','#ac2Workspace',
  'directCanonicalSidebar:true','browser-result-v2.json','browser-failure-v2.json',
])has(browser,value,`browser smoke missing ${value}`);

for(const value of [
  'Run authenticated router v5 API smoke','run-admin-api-smoke-v2.mjs','Run real browser router v5 smoke',
  'run-admin-ui-browser-smoke-v2.mjs','Remove isolated admin identities','if: always()',
  'result-v2.json','browser-result-v2.json','browser-failure-v2.json','access-control-v2.png',
  'retention-days: 90','Report successful router v5 smoke','Report failed router v5 smoke',
])has(workflow,value,`workflow missing ${value}`);
expect(workflow.indexOf('Run authenticated router v5 API smoke')<workflow.indexOf('Run real browser router v5 smoke'),'API smoke must run before browser smoke');
expect(workflow.indexOf('Run real browser router v5 smoke')<workflow.indexOf('Remove isolated admin identities'),'cleanup must run after browser smoke');

console.log('Direct sidebar router v5 production proof contract passed.');
