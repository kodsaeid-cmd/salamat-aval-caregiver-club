import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('preview/mobile-functional-fixes-v7-4.js');
const caregiverPolish=read('preview/mobile-caregiver-profile-icon-polish-v7-2.js');
const panelPolish=read('preview/mobile-panel-polish-v7-3.js');
const worker=read('worker/index-unified-financial-v4.ts');
const wrangler=read('wrangler.backend.jsonc');
const training=read('preview/caregiver-training-direct-v3.js');
const canonical=read('preview/caregiver-canonical-route-owner-v3.js');

const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(runtime);
new Function(caregiverPolish);
new Function(panelPolish);
assert(runtime.includes("const VERSION='7.5.0'"),'V7.5 runtime version is missing');
assert(runtime.includes("const CTA_TEXT='همین حالا به شبکه مراقبین سلامت اول بپیوندید'"),'Join CTA canonical text is missing');
assert(runtime.includes("if(strong.textContent!==CTA_TEXT)strong.textContent=CTA_TEXT"),'Join CTA write must be idempotent');
assert(runtime.includes("$$('small',button).forEach(node=>node.remove())"),'Join CTA helper copy is not removed');
assert(runtime.includes("[...block.children].forEach(node=>{if(node!==button)node.remove()})"),'Join CTA block must contain only the button');
assert(runtime.includes('installCtaObserver'),'Join CTA reconstruction guard is missing');
assert(runtime.includes("ctaObserver.observe(login,{childList:true,subtree:true})"),'Join CTA observer must stay scoped to loginView');
assert(runtime.includes('retireCtaObserver'),'Login CTA observer must retire after authentication');
assert(runtime.includes("$$('#mc5SoundButton,.mc5-sound').forEach(node=>node.remove())"),'Mute control is not removed');
assert(runtime.includes('LEGACY_MOBILE_IDS'),'Legacy mobile shell registry is missing');
assert(runtime.includes('cleanupLegacyMobileShells'),'Legacy mobile shell cleanup is missing');
assert(runtime.includes("shellObserver.observe(app,{childList:true,subtree:true})"),'Legacy shell observer must stay scoped to appView');
assert(runtime.includes('retireShellObserverWhenStable'),'Legacy shell observer must retire after V7.1 is stable');
assert(!runtime.includes('observe(document.body,{childList:true,subtree:true})'),'Document-wide body observer must stay retired');
assert(!runtime.includes('observe(document.documentElement,{childList:true,subtree:true})'),'Document-wide html observer must stay retired');
assert(runtime.includes('salamat-mobile-route-pending-v75'),'Mobile module route transaction guard is missing');
assert(runtime.includes("window.addEventListener('salamat-mobile-v71-route'"),'Canonical V7.1 route completion is not used');
assert(runtime.includes("salamat-mobile-preboot-v74"),'Preboot release contract is missing');
assert(runtime.includes("window.SalamatEvaluationModuleV4?.state?.selectedCaregiverId"),'Evaluation caregiver touch fallback is missing');
assert(runtime.includes("#sev4SearchForm")&&runtime.includes("#sev4CareSearch"),'Evaluation mobile selectors do not match Server Evaluation V4 DOM');
assert(runtime.includes('evaluationSubmitOnlyGuard'),'Submit-only evaluation input guard is missing');
assert(runtime.includes('clearTimeout(state.searchTimer)'),'V4 live-search debounce is not cancelled on mobile typing');
assert(runtime.includes('state.query=evaluationCommittedQuery'),'Unsubmitted mobile search text must not become the committed query');
assert(runtime.includes('evaluationSubmitCapture'),'Committed evaluation query is not updated on explicit submit');
assert(!runtime.includes('input.__salamatV75Timer'),'Legacy live mobile search timer must stay retired');
assert(runtime.includes("requestSubmit?.()")||runtime.includes("requestSubmit?.(submit)"),'Evaluation search tap/Enter fallback is missing');
assert(runtime.includes("if(String(key)==='caregiver.training')"),'Canonical caregiver training interception is missing');
assert(runtime.includes("window.SalamatCaregiverTrainingRouteOwner"),'Training route owner is not used');
assert(runtime.includes("window.SalamatCaregiverTrainingV3"),'Training V3 fallback is missing');

assert(!caregiverPolish.includes('observe(document.documentElement'),'Caregiver mobile polish must not observe the whole document');
assert(!caregiverPolish.includes('setInterval(sync,1800)'),'Caregiver mobile polish polling must stay retired');
assert(caregiverPolish.includes('installScopedObservers'),'Caregiver mobile polish needs scoped launcher/profile observers');
assert(!panelPolish.includes('observe(document.documentElement'),'Admin mobile polish must not observe the whole document');
assert(!panelPolish.includes('setInterval(sync,1800)'),'Admin mobile polish polling must stay retired');
assert(panelPolish.includes('installScopedObservers'),'Admin mobile polish needs scoped nav/launcher observers');

assert(worker.includes('const MOBILE_FUNCTIONAL_FIX_VERSION = "7.5.0"'),'Worker V7.5 version is missing');
assert(worker.includes('html.salamat-mobile-preboot-v74 #loginView,html.salamat-mobile-preboot-v74 #appView{visibility:hidden!important}'),'Login and app surfaces are not both hidden during first-paint preboot');
assert(worker.includes('#salamatCaregiverDashboardV5')&&worker.includes('visibility:hidden!important;pointer-events:none!important'),'Legacy V5 post-auth shell lacks first-paint retirement');
assert(worker.includes('window.__salamatEvaluationSearchSubmitOwnerV1=true'),'Conflicting evaluation submit owner is not retired before parse');
assert(worker.includes('window.__salamatEvaluationSearchCanonicalV1=true'),'Conflicting legacy evaluation search owner is not retired before parse');
assert(worker.includes('evaluation-search-submit-owner-v1.js')&&worker.includes('evaluation-search-canonical-runtime.js'),'Legacy evaluation search scripts are not stripped');
assert(worker.includes('#mc5SoundButton,.mc5-sound{display:none!important}'),'Mute control does not have first-paint suppression');
assert(worker.includes('.join-network-action small')&&worker.includes('display:none!important'),'Login helper copy lacks first-paint suppression');
assert(worker.includes('.cgt3-card [data-cgt3-open]'),'Training view button lacks mobile visibility protection');
assert(worker.includes('injectMobileFunctionalFixes(html)'),'Mobile functional runtime is not injected into the canonical response');
assert(worker.includes('x-salamat-mobile-functional-fixes'),'Mobile functional evidence header missing');
assert(worker.includes('x-salamat-mobile-preboot'),'Preboot evidence header missing');
assert(worker.includes('x-salamat-evaluation-mobile-owner'),'Evaluation evidence header missing');
assert(worker.includes('x-salamat-training-mobile-owner'),'Training evidence header missing');

assert(wrangler.includes('"main": "./worker/index-unified-financial-v4.ts"'),'Canonical unified finance production entrypoint changed unexpectedly');
assert(training.includes('data-cgt3-open')&&training.includes('مشاهده آموزش'),'Canonical training runtime does not expose the requested view button');
assert(canonical.includes("if(key==='caregiver.training')"),'Canonical caregiver owner no longer contains a training route');

console.log('Mobile V7.5 contract validated with submit-only evaluation search, scoped observers and one-button CTA.');
