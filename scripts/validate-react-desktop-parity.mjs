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
const caregiverDocument=read('preview/mobile/index.html');
const adminDocument=read('preview/mobile/admin.html');
const caregiverDesktopCss=read('preview/mobile/caregiver-responsive-desktop-v1.css');
const caregiverVideoAudio=read('preview/mobile/caregiver-video-audio-v1.js');
const caregiverV2=read('mobile-react/caregiver-v2.tsx');
const caregiverV2Css=read('mobile-react/caregiver-v2.css');
const caregiverGrid=read('mobile-react/caregiver-module-grid-v3.css');
const caregiverScorecard=read('mobile-react/caregiver-scorecard-v2.tsx');
const caregiverFinance=read('mobile-react/caregiver-finance-v2.tsx');
const caregiverSupport=read('mobile-react/caregiver-support-v2.tsx');
const caregiverTraining=read('mobile-react/caregiver-training-v2.tsx');
const adminRouter=read('mobile-react/admin-router-v2.tsx');
const adminEntry=read('mobile-react/admin-entry.tsx');
const adminMobile=read('mobile-react/admin.tsx');
const adminEvaluation=read('mobile-react/admin-evaluations-v3.tsx');
const adminGrid=read('mobile-react/admin-grid-v2.css');
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

for(const value of ["STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS','SALES_CONSULTANT'])","reactDesktopTarget(user)","mobileStaffViewport()","'/mobile/admin/'","if(role==='CAREGIVER')return '/mobile/'","classicRequested()","/api/auth/login","salamat-authenticated","legacyMobileSubmit(event)","pollAuthenticatedSession()","fetch('/api/auth/me'","window.addEventListener('salamat-authenticated',authenticatedEvent)"])has(login,value,`responsive staff login continuity: ${value}`);
has(loginWorker,'login-identifier-compat.js?v=3.5.0','production login worker must publish device-aware staff login asset');
has(desktopWorker,'role === "CAREGIVER" ? "/mobile/" : "/app/"','desktop session redirect must promote caregiver sessions into React');

for(const value of ['mobile-react/caregiver-v2.tsx','mobile-react/admin-entry.tsx','desktop-react/entry.tsx','preview/app','desktop-app.js','desktop-app.css'])has(build,value,`build pipeline must include React entry: ${value}`);
for(const value of ['id="desktop-react-root"','/app/desktop-app.css?v=1.0.0','/app/desktop-app.js?v=1.0.0'])has(document,value,`isolated desktop document contract: ${value}`);
for(const value of ['mobile-react-root','/mobile/app.js?v=1.4.0','caregiver-responsive-desktop-v1.css','caregiver-video-audio-v1.js'])has(caregiverDocument,value,`caregiver unified React document contract: ${value}`);
for(const value of ['mobile-admin-root','/mobile/admin-app.css?v=1.2.0','/mobile/admin-app.js?v=1.2.0'])has(adminDocument,value,`admin mobile React document contract: ${value}`);
has(caregiverDesktopCss,'@media(min-width:900px)','caregiver React surface must keep desktop compatibility layer');
for(const value of ['فعال‌کردن صدا','video.muted=!enable','await video.play()'])has(caregiverVideoAudio,value,`mobile login video audio control: ${value}`);

// Caregiver React v2 requirements: same server truth on mobile and desktop.
for(const value of ['cv2-desktop-sidebar','خروج از حساب','label:"کیف پول"','route:"benefits"','route:"scorecard"','CaregiverScorecardView','referralCode','کپی کد','cv2-mobile-module-grid','navigate={navigate}'])has(caregiverV2,value,`caregiver v2 shell missing: ${value}`);
has(caregiverV2Css,'font-family:"Vazirmatn"','caregiver UI must use Vazirmatn');
has(caregiverV2Css,'@media(min-width:900px)','caregiver v2 must implement desktop layout');
has(caregiverV2Css,'.cv2-desktop-sidebar{position:fixed;right:0','desktop caregiver modules must be a fixed list on the right');
for(const value of ['.cv2-mobile-module-grid','grid-template-columns:repeat(2','@media(min-width:900px){.cv2-mobile-modules{display:none}}'])has(caregiverGrid,value,`caregiver mobile module card grid missing: ${value}`);
for(const value of ['/api/caregiver/platform/scorecard-v2','/api/caregiver/platform/financial-profile','کارنامه فعالیت مراقب','نظام ارزیابی و رتبه حرفه‌ای','رتبه‌بندی اعتباری و توان مالی'])has(caregiverScorecard,value,`self scorecard must mirror admin scorecard truth: ${value}`);
for(const value of ['type BenefitTab="scorecard"|"loans"|"referrals"|"requests"','اعتبارشمارها','وام و تسهیلات','معرفی‌ها','درخواست‌ها','/api/caregiver/platform/financial-profile','/api/caregiver/platform/settlements'])has(caregiverFinance,value,`caregiver financial hub missing: ${value}`);
lacks(caregiverFinance,'تقاضای اعتبار','caregiver wallet must not expose credit-request button');
lacks(caregiverFinance,'method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});notify("درخواست اعتبار','caregiver wallet must not post a new credit request');
for(const value of ['MediaRecorder','getUserMedia({audio:true})','storedFileId','<audio controls','cv2-thread-pane','گفت‌وگوهای من'])has(caregiverSupport,value,`caregiver support voice/list contract missing: ${value}`);
for(const value of ['دیدن آموزش','window.open("about:blank"','_blank','contentUrl'])has(caregiverTraining,value,`training external-link behavior missing: ${value}`);

// Mobile staff v3: all non-caregiver staff use a branded icon launcher and drill-down screens.
for(const value of ['AdminEvaluationsMobileV3','AdminCaregiversMobileV3','/mobile/admin/evaluations','/mobile/admin/caregivers','salamat-admin-route-v2'])has(adminRouter,value,`mobile admin router v3 missing: ${value}`);
for(const value of ['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS','SALES_CONSULTANT','setPhase("staff")'])has(adminEntry,value,`mobile staff entry missing: ${value}`);
for(const value of ['SALES_CONSULTANT','staff.job_ads','ma-welcome','FullPage','BottomNav','سلام،','job_ads'])has(adminMobile,value,`mobile staff shell missing: ${value}`);
lacks(adminMobile,'<Menu','mobile staff shell must not render hamburger navigation');
lacks(adminMobile,'ma-side-backdrop','mobile staff shell must not use side drawer navigation');
for(const value of ['/api/admin/caregivers-page','/api/evaluations?','/api/evaluations/${encodeURIComponent(data.evaluation.id)}/indicators/','/finalize','دوره ارزیابی جدید','سابقه کارنامه‌ها','منطق امتیازدهی','شاخص‌های ارزیابی','mae-indicator-list','mae-indicator-page','mae-score-scale','BackHeader','auditVisible=Boolean(data.auditVisible)'])has(adminEvaluation,value,`mobile evaluation workflow missing: ${value}`);
for(const value of ['.ma-app .ma-module-grid','grid-template-columns:repeat(3','.ma-app .ma-module>span svg','--sa-green:#17733f','--sa-red:#ed2024','.ma-subpage','.ma-bottom'])has(adminGrid,value,`mobile staff branded launcher missing: ${value}`);

const staffModules=['staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll','staff.training','staff.evaluations','staff.support','staff.reports','staff.settings'];
for(const key of staffModules){has(access,`key: "${key}"`,`Access Control module definition must remain canonical: ${key}`);has(app,`"${key}"`,`React shell must route Access Control module: ${key}`)}
for(const route of ['dashboard','users','caregivers','contracts','payroll','financial_credits','training','evaluations','support','reports','settings'])has(app,`route==="${route}"`,`React desktop route missing: ${route}`);
has(app,'visibleStaffModules(access)','desktop navigation must derive from Access Control rather than a hard-coded role menu');
has(app,'key:"staff.financial_credits"','financial credits UI must be surfaced without altering the backend Access Control schema');
has(core,'"staff.payroll"','financial credits UI must inherit the existing payroll permission policy');

const endpoints=['/api/users','/api/admin/access/config','/api/admin/access/users/','/api/admin/caregivers-page','/api/admin/caregiver-profile','/api/admin/caregivers/','/api/staff/contracts','/api/staff/payroll','/api/staff/financial-credits/caregivers','/api/staff/financial-credits/wallet-adjustments','/api/training/admin','/api/training/courses','/api/training/assignments','/api/evaluations','/api/caregiver/platform/support/threads','/api/staff/system-settings','/api/staff/audit-logs','/api/files','/api/profile-images'];
for(const endpoint of endpoints)has(allReact,endpoint,`canonical server-backed operation missing from React desktop: ${endpoint}`);
for(const value of ['/panel?classic=1','ClassicFallback'])has(allReact,value,'Classic compatibility escape hatch must remain available during parity migration');
for(const forbidden of ['#sidebarNav','HTMLElement.prototype.click','MutationObserver','SalamatPanelTapBridge'])lacks(allReact,forbidden,`React desktop must not depend on legacy DOM routing: ${forbidden}`);
lacks(allReact,'localStorage','React desktop business truth must remain server-backed');lacks(allReact,'sessionStorage','React desktop business truth must not depend on browser session storage');
has(workforce,'/api/evaluations/${encodeURIComponent(data.evaluation.id)}/finalize','evaluation finalization must remain server authoritative');
has(workforce,'/api/staff/payroll/${encodeURIComponent(id)}/pay','payroll payment mutation must remain server authoritative');
has(workforce,'/api/staff/financial-credits/credit-requests/${encodeURIComponent(id)}','credit decision mutation must remain server authoritative');
has(support,'/api/caregiver/platform/support/threads/${encodeURIComponent(active)}/messages','support conversation continuity must remain server authoritative');
has(admin,'/api/staff/contracts/${encodeURIComponent(item.id)}','contract update must remain server authoritative');
has(admin,'/api/admin/caregiver-profile','caregiver professional profile must remain server authoritative');

console.log('React parity contract passed: desktop remains isolated, caregiver mobile stays server-backed, and staff mobile uses Salamat Aval branded icon navigation with independent evaluation and caregiver-scorecard drill-down pages.');
