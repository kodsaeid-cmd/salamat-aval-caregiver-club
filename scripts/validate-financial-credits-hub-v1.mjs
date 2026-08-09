import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Financial credits hub validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const legacyBackend=read('worker/caregiver-platform-staff-tools.ts');
const profileBackend=read('worker/caregiver-financial-profile-v4.ts');
const referralBackend=read('worker/referral-rewards-v2.ts');
const entry=read('worker/index-unified-financial-v4.ts');
const resetEntry=read('worker/index-mobile-reset-v1.ts');
const desktopEntry=read('worker/index-desktop-react-v1.ts');
const runtime=read('preview/staff-financial-credits-runtime-v2.js');
const routeOwner=read('preview/staff-financial-credits-route-owner-v3.js');
const caregiverRuntime=read('preview/server-financial-profile-v4.js');
const retiredCaregiverRuntime=read('preview/server-financial-benefits-runtime.js');
const uiHotfix=read('preview/financial-ui-hotfix-v4.js');
const continuity=read('preview/financial-referral-continuity-v5.js');
const backendIntegration=read('preview/backend-integration.js');
const dashboardEntry=read('preview/staff-dashboard-entry-fix-v1.js');
const singleOwner=read('preview/runtime-single-owner-v8.js');
const wrangler=read('wrangler.backend.jsonc');
for(const source of [runtime,routeOwner,caregiverRuntime,retiredCaregiverRuntime,uiHotfix,continuity,backendIntegration,dashboardEntry,singleOwner])new Function(source);

for(const value of ['/api/staff/financial-credits/caregivers','/api/staff/financial-credits/wallet-adjustments','READ_FINANCIAL_CAREGIVER_DIRECTORY','ADMIN_WALLET_ADJUSTMENT','reason_required',"transactionType = \"ADMIN_TOPUP\"","transactionType = \"ADMIN_DEBIT\"","status IN ('REQUESTED','APPROVED')",'pagination: { page, pageSize, total'])has(legacyBackend,value,`existing financial directory/mutation contract: ${value}`);
for(const value of ['buildCaregiverFinancialProfileV4','getFinancialBenefitsV2','caregiver_evaluation_periods:FINAL','caregiver_wallet_transactions','caregiver_referral_cases','receivableToman','payableToman','netToman','allocations: allocations(wallet)','/api/caregiver/platform/financial-profile','/api/caregiver/platform/credit-requests','CREATE_EVALUATION_LINKED_BENEFIT_REQUEST','evaluationLinkedEligibility','credit_not_eligible','referralCode','remainingToMilestone','WHERE r.referrer_caregiver_id=?'])has(profileBackend,value,`unified backend contract: ${value}`);
lacks(profileBackend,"r.referrer_confirmation_status='APPROVED'",'financial scorecard must not hide pending referral cases');
for(const value of ['caregiver_referral_cases','referrer_confirmation_status','PENDING_REGISTRATION_REVIEW','referralCode'])has(referralBackend,value,`referral backend attribution: ${value}`);

for(const value of ['routeCaregiverFinancialProfileV4','FINANCIAL_PROFILE_VERSION = "4.1.0"','ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1"','FINANCIAL_UI_HOTFIX_VERSION = "4.2.0"','FINANCIAL_REFERRAL_CONTINUITY_VERSION = "5.1.0"','STAFF_DASHBOARD_ENTRY_VERSION = "1.3.0"','SINGLE_OWNER_RUNTIME_VERSION = "8.0.0"','LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js"','LEGACY_FINANCIAL_RETIREMENT_VERSION = "9.0.0"','stripScript(html, LEGACY_FINANCIAL_RUNTIME)','injectLegacyFinancialKillSwitch(html)','data-salamat-retire-financial-v4','window.__salamatUnifiedFinancialV4=true','x-salamat-legacy-financial-retired','runtime-single-owner-v8.js','x-salamat-single-owner-runtime'])has(entry,value,`outer production entry: ${value}`);
has(wrangler,'"main": "./worker/index-desktop-react-v1.ts"','production entrypoint must activate the React desktop wrapper');
for(const value of ['import app from "./index-mobile-reset-v1"','DESKTOP_REACT_INDEX = "/app/index.html"','x-salamat-desktop-owner','return app.fetch(request, env, ctx)'])has(desktopEntry,value,`desktop wrapper must delegate through the proven mobile reset chain: ${value}`);
for(const value of ['import app from "./index-unified-financial-v4"','MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js"','MOBILE_BASELINE_VERSION = "2.0.0"','stripAllLaterMobileScripts','x-salamat-mobile-layer-count','x-salamat-mobile-owner'])has(resetEntry,value,`mobile reset wrapper must preserve unified finance ownership: ${value}`);

for(const value of ["const VERSION='3.0.0'",'id="fchDirectorySearch"','/api/staff/financial-credits/caregivers?','/profile','data-fch-caregiver-detail','کارنامه مالی','کد معرفی','میانگین ارزیابی FINAL','بستانکاری','بدهکاری / برداشت','لیست تخصیص اعتبارات','درخواست‌های کمک‌هزینه و وام','window.SalamatFinancialCredits'])has(runtime,value,`admin financial scorecard runtime: ${value}`);
for(const value of ["const VERSION='3.2.1'",'function canonicalRoot()','#content .fch3[data-finance-hub-version="3.0.0"]','const root=canonicalRoot()'])has(routeOwner,value,`admin financial route owner stability: ${value}`);
lacks(runtime,"addEventListener('input',",'caregiver directory search must not be live');
lacks(runtime,"addEventListener('keyup',",'caregiver directory search must not fetch on keyup');
has(runtime,"addEventListener('submit'",'caregiver directory search must fetch on submit');

for(const value of ["const VERSION='4.1.0'",'کمک‌هزینه ماندگاری دوماهه','پلکان وام مراقبین','معرفی و اعتبارات معرفی مراقب','کیف پول و اقدامات مالی','راهنمای نظام وام‌دهی مراقبین','میانگین ارزیابی FINAL','/api/caregiver/platform/financial-profile','function activateTab(','touch-action:manipulation','ufp4-money-card','موجودی کیف پول'])has(caregiverRuntime,value,`caregiver financial runtime: ${value}`);
const walletSection=caregiverRuntime.slice(caregiverRuntime.indexOf('function wallet('),caregiverRuntime.indexOf('function markup('));
lacks(walletSection,'gauge(','wallet values are money, not progress charts');
lacks(caregiverRuntime,'scrollIntoView','caregiver tab switching must not jump the viewport');
lacks(caregiverRuntime,'location.hash','caregiver tab switching must not mutate browser hash');

for(const value of ["window.__salamatUnifiedFinancialV4=true","version:'4.0.1-retired'","retired:true","superseded-by-server-financial-profile-v4"])has(retiredCaregiverRuntime,value,`legacy caregiver finance retirement: ${value}`);
lacks(retiredCaregiverRuntime,'MutationObserver','retired caregiver finance runtime must not observe DOM');
lacks(retiredCaregiverRuntime,'caregiverUnifiedFinancialV4','retired caregiver finance runtime must not recreate the old root');
lacks(retiredCaregiverRuntime,'data-tab','retired caregiver finance runtime must not own tabs');
lacks(retiredCaregiverRuntime,'innerHTML','retired caregiver finance runtime must never rewrite content');

has(uiHotfix,"const VERSION='4.2.0'",'retired financial hotfix revision is missing');
has(uiHotfix,'observer:false','financial hotfix must explicitly remain observer-free');
lacks(uiHotfix,'MutationObserver','financial compatibility asset must not observe finance DOM');
lacks(uiHotfix,"addEventListener('click'",'financial compatibility asset must not own clicks');

for(const value of ["const VERSION='8.0.0'",'async function openAdminDashboard()','async function openCaregiverWallet()','platform.openWallet=openCaregiverWallet',"router.route=key=>key==='staff.dashboard'?openAdminDashboard():original(key)",'event.stopImmediatePropagation()','runtime.refresh()','data-single-owner-dashboard'])has(singleOwner,value,`single-owner runtime: ${value}`);
lacks(singleOwner,'MutationObserver','single-owner runtime must not observe and repair the DOM');
lacks(singleOwner,'setInterval(','single-owner runtime must not poll continuously');
lacks(singleOwner,'scrollIntoView','single-owner runtime must not force viewport movement');
has(dashboardEntry,'SalamatRuntimeSingleOwnerV8','dashboard entry must delegate to single owner');
lacks(dashboardEntry,'SalamatAccessControl.openModule','dashboard entry must not call incompatible access API');
lacks(dashboardEntry,'MutationObserver','dashboard entry must remain event-driven');
lacks(dashboardEntry,'setInterval(','dashboard entry must not poll');

for(const value of ["const VERSION='5.1.0'","REGISTER_PATH='/api/public/caregivers/register'",'payload.referralCode=code','registrationAuthority:true','tabOwner:false'])has(continuity,value,`referral continuity: ${value}`);
lacks(continuity,'MutationObserver','referral continuity must not repair DOM or trigger page jumps');
for(const value of ['normalizeReferralCode','const referralCode=normalizeReferralCode(data.get(\'referralCode\'))','referralCode:referralCode||undefined'])has(backendIntegration,value,`direct registration referral payload: ${value}`);

for(const source of [runtime,caregiverRuntime,retiredCaregiverRuntime,uiHotfix,continuity,singleOwner]){lacks(source,'observe(document.documentElement','financial runtimes must not observe the entire document');lacks(source,'localStorage','financial truth must stay server-backed')}
await import('./validate-react-desktop-parity.mjs');
console.log('Financial credits hub contract passed: unified finance remains canonical beneath the React desktop wrapper and the single-layer mobile reset.');
