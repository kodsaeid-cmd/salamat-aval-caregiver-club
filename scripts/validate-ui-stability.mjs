import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`UI stability validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const entry=read('worker/index-ui-stability.ts');
const bootstrap=read('preview/staff-shell-bootstrap-v3.js');
const performanceBootstrap=read('preview/performance-bootstrap.js');
const jalali=read('preview/evaluation-jalali-calendar.js');
const mobile=read('preview/mobile-responsive-runtime.js');
const internalHistory=read('preview/internal-history-runtime-v2.js');
const mobileApp=read('preview/mobile-app-experience.js');
const mobileStability=read('preview/mobile-app-stability-runtime.js');

new Function(bootstrap);
new Function(performanceBootstrap);
new Function(jalali);
new Function(mobile);
new Function(internalHistory);
new Function(mobileApp);
new Function(mobileStability);

expect(wrangler.includes('worker/index-ui-stability.ts'),'UI stability worker is not the active entrypoint');
expect(entry.includes('staff-shell-bootstrap-v3.js'),'staff shell bootstrap is not injected');
expect(entry.includes('evaluation-jalali-calendar.js'),'Jalali calendar is not injected');
expect(entry.includes('performance-bootstrap.js'),'performance bootstrap is not injected');
expect(entry.includes('mobile-responsive-runtime.js'),'mobile responsive runtime is not injected');
expect(entry.includes('internal-history-runtime-v2.js'),'deterministic history runtime is not injected');
expect(entry.includes('mobile-app-experience.js'),'mobile app experience is not injected');
expect(entry.includes('mobile-app-stability-runtime.js'),'mobile app stability runtime is not injected');
expect(entry.indexOf('mobile-app-stability-runtime.js')>entry.indexOf('mobile-app-experience.js'),'mobile stability runtime must load after the app shell');
expect(entry.includes('stripScript(html, "internal-history-runtime.js")'),'legacy history runtime is not retired');
expect(entry.includes('import app from "./index-account-stability"'),'UI worker does not preserve account/access stability');

expect(bootstrap.includes('salamat-shell-preparing'),'legacy staff shell is not hidden during access resolution');
expect(bootstrap.includes('visibility:hidden!important'),'pre-render shell suppression is missing');
expect(bootstrap.includes("justify-content','flex-start','important'"),'compact navigation alignment is missing');
expect(bootstrap.includes('navigationReady(snapshot)'),'staff panel is revealed before authorized navigation is ready');
expect(bootstrap.includes('setTimeout(check,72)'),'staff readiness checks are not throttled');
expect(!bootstrap.includes('setInterval('),'staff shell bootstrap must not poll with setInterval');
expect(!bootstrap.includes('requestAnimationFrame(check)'),'staff shell bootstrap must not run a full-frame polling loop');

expect(performanceBootstrap.includes('accessInflight'),'concurrent access requests are not coalesced');
expect(performanceBootstrap.includes('x-salamat-client-cache'),'client access cache diagnostics are missing');
expect(performanceBootstrap.includes('requestIdleCallback'),'non-critical hero loading is not deferred to idle time');
expect(performanceBootstrap.includes('hero-hq-avif-part-0.js'),'high-resolution hero is not available as a deferred enhancement');
expect(performanceBootstrap.includes("['slow-2g','2g']"),'slow-connection hero protection is missing');
expect(!performanceBootstrap.includes('setInterval('),'performance bootstrap must not add polling');

expect(entry.includes('cachedShell'),'transformed HTML shell is not cached in the worker isolate');
expect(entry.includes('HERO_RUNTIME_FILES'),'eager hero scripts are not removed from the critical path');
expect(entry.includes('addDeferToScripts'),'legacy script execution is not deferred');
expect(entry.includes('makeStyleNonBlocking'),'feature styles remain render-blocking');
expect(entry.includes('max-age=31536000, immutable'),'versioned static assets do not receive immutable caching');
expect(entry.includes('x-salamat-shell-cache'),'server shell-cache diagnostics are missing');

expect(jalali.includes('jalaliToIso'),'Jalali to Gregorian storage conversion is missing');
expect(jalali.includes('isoToJalali'),'Gregorian storage to Jalali display conversion is missing');
expect(jalali.includes('تقویم رسمی هجری شمسی'),'Persian calendar UI is missing');
expect(jalali.includes("input.type='hidden'"),'native Gregorian date control is not retired');
expect(jalali.includes('MONTHS=['),'Persian month names are missing');
expect(jalali.includes('data-sjal-day'),'calendar day selection is missing');
expect(!jalali.includes('setInterval('),'Jalali calendar must not use polling');

expect(mobile.includes("const BACKDROP_ID='mobileSidebarBackdrop'"),'mobile menu backdrop is missing');
expect(mobile.includes('overflow-y:auto!important'),'mobile sidebar does not have an independent scroll region');
expect(mobile.includes('salamat-mobile-nav-open'),'background scroll locking is missing');
expect(mobile.includes("event.key==='Escape'"),'Escape key does not close the mobile menu');
expect(mobile.includes("target.closest(`#${BACKDROP_ID}`)"),'background click does not close the mobile menu');
expect(mobile.includes('aria-expanded'),'mobile menu accessibility state is missing');
expect(mobile.includes("event.stopImmediatePropagation()"),'legacy hamburger handler is not neutralized');
expect(mobile.includes('font-size:16px!important'),'mobile form controls can trigger browser zoom');
expect(mobile.includes('100dvh'),'mobile drawers do not use the dynamic viewport height');
expect(!mobile.includes('setInterval('),'mobile runtime must not poll with setInterval');

expect(internalHistory.includes("const STATE_KEY='__salamatClubHistoryV2'"),'history v2 state namespace is missing');
expect(internalHistory.includes("kind:'landing'"),'landing-page history entry is missing');
expect(internalHistory.includes("kind:'app'"),'application history entries are missing');
expect(internalHistory.includes('history.pushState(appState'),'dashboard is not pushed above the landing entry');
expect(internalHistory.includes('scheduleViewCheck'),'view changes are not observed independently of clicks');
expect(internalHistory.includes('viewFingerprint'),'stable view fingerprints are missing');
expect(internalHistory.includes('pendingChain'),'nested module action chains are not retained');
expect(internalHistory.includes("window.addEventListener('popstate'"),'browser back and forward are not handled');
expect(internalHistory.includes('showLanding()'),'browser back cannot return to the club landing page');
expect(internalHistory.includes('await replay(state.chain)'),'previous module and subview are not reconstructed');
expect(internalHistory.includes('scrollY'),'scroll position is not retained per route');
expect(internalHistory.includes("version:'2.0.0'"),'history runtime version is not exposed');
expect(!internalHistory.includes('setInterval('),'history runtime must not poll with setInterval');

expect(mobileApp.includes("const HEADER_ID='salamatMobileAppHeader'"),'dedicated mobile application header is missing');
expect(mobileApp.includes("const NAV_ID='salamatMobileBottomNav'"),'mobile bottom navigation is missing');
expect(mobileApp.includes('grid-template-columns:repeat(5'),'five-slot app navigation is missing');
expect(mobileApp.includes('salamat-mobile-app'),'mobile-only application mode is missing');
expect(mobileApp.includes('mapp-card-table'),'mobile data tables are not converted to readable cards');
expect(mobileApp.includes('annotateTables'),'table headings are not preserved as card labels');
expect(mobileApp.includes('source.click()'),'mobile navigation does not reuse the existing data-aware module handlers');
expect(mobileApp.includes('SalamatInternalHistory?.back'),'mobile app back button is not connected to internal history');
expect(mobileApp.includes('scroll-snap-type:x mandatory'),'mobile KPI cards do not use app-like horizontal paging');
expect(mobileApp.includes('env(safe-area-inset-bottom)'),'mobile safe areas are not respected');
expect(!mobileApp.includes('setInterval('),'mobile app experience must not poll with setInterval');

expect(mobileStability.includes("const VERSION='2.0.0'"),'mobile stability version is missing');
expect(mobileStability.includes('document.addEventListener(\'click\',onBottomNavigationClick,true)'),'bottom navigation is not intercepted in capture phase');
expect(mobileStability.includes('event.stopImmediatePropagation()'),'broken legacy bottom navigation handler is not neutralized');
expect(mobileStability.includes('data-source-key'),'bottom navigation does not use stable source identifiers');
expect(mobileStability.includes('HTMLElement.prototype.click.call(source)'),'native source-button activation is missing');
expect(mobileStability.includes("new MouseEvent('click'"),'fallback navigation event is missing');
expect(mobileStability.includes('aria-current'),'active bottom-tab accessibility state is missing');
expect(mobileStability.includes('main.inert=false'),'stale inert background state is not repaired');
expect(mobileStability.includes("classList.remove('salamat-mobile-nav-open')"),'stale mobile scroll lock is not repaired');
expect(mobileStability.includes('z-index:135!important'),'bottom navigation is not protected from invisible overlays');
expect(mobileStability.includes('#appView.app.hidden'),'mobile hidden-state regression is not overridden');
expect(mobileStability.includes('salamat-mobile-navigation-failed'),'navigation failures are not observable');
expect(!mobileStability.includes('setInterval('),'mobile stability runtime must not poll with setInterval');

console.log('Jalali calendar, compact shell, deterministic browser history, mobile app navigation stability, access cache and critical-path performance contracts passed.');
