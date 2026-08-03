import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`UI stability validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const entry=read('worker/index-ui-stability.ts');
const bootstrap=read('preview/staff-shell-bootstrap-v3.js');
const performanceBootstrap=read('preview/performance-bootstrap.js');
const jalali=read('preview/evaluation-jalali-calendar.js');
const mobile=read('preview/mobile-responsive-runtime.js');
const internalHistory=read('preview/internal-history-runtime.js');

new Function(bootstrap);
new Function(performanceBootstrap);
new Function(jalali);
new Function(mobile);
new Function(internalHistory);

expect(wrangler.includes('worker/index-ui-stability.ts'),'UI stability worker is not the active entrypoint');
expect(entry.includes('staff-shell-bootstrap-v3.js'),'staff shell bootstrap is not injected');
expect(entry.includes('evaluation-jalali-calendar.js'),'Jalali calendar is not injected');
expect(entry.includes('performance-bootstrap.js'),'performance bootstrap is not injected');
expect(entry.includes('mobile-responsive-runtime.js'),'mobile responsive runtime is not injected');
expect(entry.includes('internal-history-runtime.js'),'internal history runtime is not injected');
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

expect(internalHistory.includes("const STATE_KEY='__salamatClubHistory'"),'history states are not namespaced');
expect(internalHistory.includes('history.pushState'),'internal views are not added to browser history');
expect(internalHistory.includes('history.replaceState'),'the in-domain history boundary is missing');
expect(internalHistory.includes("window.addEventListener('popstate'"),'browser back/forward is not handled');
expect(internalHistory.includes('replayChain'),'historical views cannot be restored');
expect(internalHistory.includes('MutationObserver'),'async internal navigation is not detected');
expect(internalHistory.includes('closeTransientViews'),'drawers and overlays are not closed during back navigation');
expect(internalHistory.includes("history.pushState(dashboard"),'back navigation can still escape the domain from panel root');
expect(internalHistory.includes('salamat-authenticated'),'history is not initialized after login');
expect(internalHistory.includes('disableForLogout'),'explicit logout does not release the history guard');
expect(!internalHistory.includes('beforeunload'),'history runtime must not use disruptive unload prompts');
expect(!internalHistory.includes('setInterval('),'history runtime must not poll with setInterval');

console.log('Jalali calendar, compact shell, mobile drawer, internal browser history, shared access cache and critical-path performance contracts passed.');
