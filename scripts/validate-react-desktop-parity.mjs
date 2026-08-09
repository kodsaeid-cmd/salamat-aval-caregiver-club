import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`React desktop parity validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const wrangler=read('wrangler.backend.jsonc');
const desktopWorker=read('worker/index-desktop-react-v1.ts');
const mobileWorker=read('worker/index-mobile-reset-v1.ts');
const login=read('preview/login-identifier-compat.js');
const loginWorker=read('worker/index-login-hotfix.ts');
const build=read('scripts/build-mobile-react.mjs');
const document=read('preview/app/index.html');
const app=read('desktop-react/app.tsx');
const core=read('desktop-react/core.tsx');
const admin=read('desktop-react/modules-admin.tsx');
const workforce=read('desktop-react/modules-workforce.tsx');
const support=read('desktop-react/modules-support.tsx');
const access=read('worker/access-control.ts');
const allReact=[app,core,admin,workforce,support].join('\n');

has(wrangler,'"main": "./worker/index-desktop-react-v1.ts"','Wrangler must activate the React desktop outer owner');
for(const value of ['import app from "./index-mobile-reset-v1"','DESKTOP_REACT_INDEX = "/app/index.html"','STAFF_ROLES','serveDesktopReact','x-salamat-desktop-owner','x-salamat-desktop-layer-count','return app.fetch(request, env, ctx)'])has(desktopWorker,value,`desktop worker contract: ${value}`);
for(const value of ['import app from "./index-unified-financial-v4"','MOBILE_REACT_INDEX = "/mobile/index.html"','MOBILE_REACT_ADMIN_INDEX = "/mobile/admin.html"','x-salamat-mobile-layer-count'])has(mobileWorker,value,`mobile delegation must remain intact: ${value}`);

for(const value of ["STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS'])","location.replace('/app/')","classicRequested()","/api/auth/login","salamat-authenticated"])has(login,value,`desktop login continuity: ${value}`);
has(loginWorker,'login-identifier-compat.js?v=3.1.0','production login worker must publish desktop-aware login asset');

for(const value of ['desktop-react/entry.tsx','preview/app','desktop-app.js','desktop-app.css'])has(build,value,`build pipeline must include desktop React: ${value}`);
for(const value of ['id="desktop-react-root"','/app/desktop-app.css?v=1.0.0','/app/desktop-app.js?v=1.0.0'])has(document,value,`isolated desktop document contract: ${value}`);

const staffModules=['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll','staff.training','staff.evaluations','staff.support','staff.reports','staff.settings'];
for(const key of staffModules){has(access,`key: "${key}"`,`Access Control module definition must remain canonical: ${key}`);has(app,`"${key}"`,`React shell must route Access Control module: ${key}`)}
for(const route of ['dashboard','users','caregivers','contracts','payroll','financial_credits','training','evaluations','support','reports','settings'])has(app,`route==="${route}"`,`React desktop route missing: ${route}`);
has(app,'visibleStaffModules(access)','desktop navigation must derive from Access Control rather than a hard-coded role menu');
has(app,'key:"staff.financial_credits"','financial credits UI must be surfaced without altering the backend Access Control schema');
has(core,'"staff.payroll"','financial credits UI must inherit the existing payroll permission policy');

const endpoints=[
 '/api/users',
 '/api/admin/access/config',
 '/api/admin/access/users/',
 '/api/admin/caregivers-page',
 '/api/admin/caregiver-profile',
 '/api/admin/caregivers/',
 '/api/staff/contracts',
 '/api/staff/payroll',
 '/api/staff/financial-credits/caregivers',
 '/api/staff/financial-credits/wallet-adjustments',
 '/api/training/admin',
 '/api/training/courses',
 '/api/training/assignments',
 '/api/evaluations',
 '/api/caregiver/platform/support/threads',
 '/api/staff/system-settings',
 '/api/staff/audit-logs',
 '/api/files',
 '/api/profile-images',
];
for(const endpoint of endpoints)has(allReact,endpoint,`canonical server-backed operation missing from React desktop: ${endpoint}`);

for(const value of ['/panel?classic=1','ClassicFallback'])has(allReact,value,'Classic compatibility escape hatch must remain available during parity migration');
for(const forbidden of ['#sidebarNav','HTMLElement.prototype.click','MutationObserver','SalamatPanelTapBridge'])lacks(allReact,forbidden,`React desktop must not depend on legacy DOM routing: ${forbidden}`);
lacks(allReact,'localStorage','React desktop business truth must remain server-backed');
lacks(allReact,'sessionStorage','React desktop business truth must not depend on browser session storage');

has(workforce,'/api/evaluations/${encodeURIComponent(data.evaluation.id)}/finalize','evaluation finalization must remain server authoritative');
has(workforce,'/api/staff/payroll/${encodeURIComponent(id)}/pay','payroll payment mutation must remain server authoritative');
has(workforce,'/api/staff/financial-credits/credit-requests/${encodeURIComponent(id)}','credit decision mutation must remain server authoritative');
has(support,'/api/caregiver/platform/support/threads/${encodeURIComponent(active)}/messages','support conversation continuity must remain server authoritative');
has(admin,'/api/staff/contracts/${encodeURIComponent(item.id)}','contract update must remain server authoritative');
has(admin,'/api/admin/caregiver-profile','caregiver professional profile must remain server authoritative');

console.log('React desktop parity contract passed: organizational UI is React-owned while backend, D1, auth, Access Control and classic fallback remain authoritative.');
