import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Financial credits hub validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const legacyBackend=read('worker/caregiver-platform-staff-tools.ts');
const profileBackend=read('worker/caregiver-financial-profile-v4.ts');
const referralBackend=read('worker/referral-rewards-v2.ts');
const entry=read('worker/index-unified-financial-v4.ts');
const runtime=read('preview/staff-financial-credits-runtime-v2.js');
const routeOwner=read('preview/staff-financial-credits-route-owner-v3.js');
const caregiverRuntime=read('preview/server-financial-profile-v4.js');
const uiHotfix=read('preview/financial-ui-hotfix-v4.js');
const continuity=read('preview/financial-referral-continuity-v5.js');
const backendIntegration=read('preview/backend-integration.js');
const wrangler=read('wrangler.backend.jsonc');
new Function(runtime);new Function(routeOwner);new Function(caregiverRuntime);new Function(uiHotfix);new Function(continuity);new Function(backendIntegration);

for(const value of ['/api/staff/financial-credits/caregivers','/api/staff/financial-credits/wallet-adjustments','READ_FINANCIAL_CAREGIVER_DIRECTORY','ADMIN_WALLET_ADJUSTMENT','reason_required',"transactionType = \"ADMIN_TOPUP\"","transactionType = \"ADMIN_DEBIT\"","status IN ('REQUESTED','APPROVED')",'pagination: { page, pageSize, total'])has(legacyBackend,value,`existing financial directory/mutation contract: ${value}`);
for(const value of ['buildCaregiverFinancialProfileV4','getFinancialBenefitsV2','caregiver_evaluation_periods:FINAL','caregiver_wallet_transactions','caregiver_referral_cases','receivableToman','payableToman','netToman','allocations: allocations(wallet)','/api/caregiver/platform/financial-profile','/api/caregiver/platform/credit-requests','CREATE_EVALUATION_LINKED_BENEFIT_REQUEST','evaluationLinkedEligibility','credit_not_eligible','referralCode','remainingToMilestone','WHERE r.referrer_caregiver_id=?'])has(profileBackend,value,`unified backend contract: ${value}`);
lacks(profileBackend,"r.referrer_confirmation_status='APPROVED'",'financial scorecard must not hide pending referral cases');
for(const value of ['caregiver_referral_cases','referrer_confirmation_status','PENDING_REGISTRATION_REVIEW','referralCode'])has(referralBackend,value,`referral backend attribution: ${value}`);

for(const value of ['routeCaregiverFinancialProfileV4','FINANCIAL_PROFILE_VERSION = "4.0.0"','ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1"','FINANCIAL_UI_HOTFIX_VERSION = "4.1.0"','FINANCIAL_REFERRAL_CONTINUITY_VERSION = "5.1.0"','BACKEND_INTEGRATION_VERSION = "1.3.0"','STAFF_SHELL_BOOTSTRAP_VERSION = "1.2.0"','STAFF_DASHBOARD_ENTRY_VERSION = "1.1.0"','PANEL_ROUTE_BOOTSTRAP_VERSION = "1.3.0"','staff-financial-credits-runtime-v2.js','financial-ui-hotfix-v4.js','financial-referral-continuity-v5.js','backend-integration.js','x-salamat-financial-profile','x-salamat-financial-ui-hotfix','x-salamat-financial-referral-continuity'])has(entry,value,`outer production financial entry: ${value}`);
has(wrangler,'"main": "./worker/index-unified-financial-v4.ts"','production entrypoint must activate v4');

for(const value of ["const VERSION='3.0.0'","const HUB_VERSION='3.0.0'","const PROFILE_VERSION='4.0.0'",'id="fchDirectorySearch"','/api/staff/financial-credits/caregivers?','/profile','/api/staff/financial-credits/credit-requests/','data-fch-caregiver-detail','کارنامه مالی','کد معرفی','میانگین ارزیابی FINAL','بستانکاری','بدهکاری / برداشت','لیست تخصیص اعتبارات','درخواست‌های کمک‌هزینه و وام','conic-gradient','window.SalamatFinancialCredits'])has(runtime,value,`admin financial scorecard runtime: ${value}`);
for(const value of ["const VERSION='3.2.1'",'function canonicalRoot()','#content .fch3[data-finance-hub-version="3.0.0"]','const root=canonicalRoot()'])has(routeOwner,value,`admin financial route owner stability: ${value}`);
lacks(routeOwner,"#content .fch-root[data-finance-hub-version=\"3.0.0\"]",'route owner must not require the retired fch-root selector');
lacks(runtime,"addEventListener('input',",'caregiver directory search must not be live');lacks(runtime,"addEventListener('keyup',",'caregiver directory search must not fetch on keyup');has(runtime,"addEventListener('submit'",'caregiver directory search must fetch on submit');

for(const value of ['کمک‌هزینه ماندگاری دوماهه','پلکان وام مراقبین','معرفی و اعتبارات معرفی مراقب','کیف پول و اقدامات مالی','راهنمای نظام وام‌دهی مراقبین','میانگین ارزیابی FINAL','conic-gradient','/api/caregiver/platform/financial-profile',"$$('[data-tab]',root).forEach(b=>b.addEventListener('click'"])has(caregiverRuntime,value,`caregiver four-tab financial runtime: ${value}`);
lacks(caregiverRuntime,'scrollIntoView','caregiver tab switching must not jump the viewport');
lacks(caregiverRuntime,'location.hash','caregiver tab switching must not mutate browser hash');

for(const value of ["const VERSION='4.1.0'",'normalizeCaregiverTabs','financialRoot.classList.add(\'fch-root\')','tabOwner:false'])has(uiHotfix,value,`financial UI normalization: ${value}`);
lacks(uiHotfix,'activateCaregiverTab','financial UI hotfix must not compete for caregiver tab ownership');
lacks(uiHotfix,"addEventListener('click'",'financial UI hotfix must not intercept finance tab clicks');
lacks(uiHotfix,"addEventListener('keydown'",'financial UI hotfix must not intercept finance tab keyboard events');

for(const value of ["const VERSION='5.1.0'","REGISTER_PATH='/api/public/caregivers/register'",'payload.referralCode=code','input instanceof Request','normalizeReferralCode:normalizeDigits','registrationAuthority:true','tabOwner:false'])has(continuity,value,`referral continuity runtime: ${value}`);
lacks(continuity,"addEventListener('pointerdown'",'referral continuity must not intercept pointer events');
lacks(continuity,"addEventListener('click'",'referral continuity must not own financial tabs');
lacks(continuity,'VALID_TABS','referral continuity must not contain financial tab state');
lacks(continuity,'activateAdminView','referral continuity must not own admin finance views');
lacks(continuity,'MutationObserver','referral continuity must not repair DOM or trigger page jumps');
for(const value of ['normalizeReferralCode','const referralCode=normalizeReferralCode(data.get(\'referralCode\'))','referralCode:referralCode||undefined'])has(backendIntegration,value,`direct registration referral payload: ${value}`);

for(const source of [runtime,caregiverRuntime,uiHotfix,continuity]){lacks(source,'observe(document.documentElement','financial runtimes must not observe the entire document');lacks(source,'setInterval(','financial runtimes must not poll continuously');lacks(source,'localStorage','financial truth must stay server-backed')}
console.log('Financial credits hub v5.1 contract passed: caregiver tabs have one click owner with no viewport jumps, while referral attribution and canonical server-backed finance remain intact.');
