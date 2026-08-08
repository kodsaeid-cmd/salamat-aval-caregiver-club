import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('preview/mobile-functional-fixes-v7-4.js');
const worker=read('worker/index-unified-financial-v4.ts');
const wrangler=read('wrangler.backend.jsonc');
const training=read('preview/caregiver-training-direct-v3.js');
const canonical=read('preview/caregiver-canonical-route-owner-v3.js');

const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(runtime);
assert(runtime.includes("const VERSION='7.4.2'"),'V7.4.2 runtime version is missing');
assert(runtime.includes("const CTA_TEXT='همین حالا به شبکه مراقبین سلامت اول بپیوندید'"),'Join CTA canonical text is missing');
assert(runtime.includes("strong&&strong.textContent!==CTA_TEXT"),'Join CTA write must be idempotent');
assert(runtime.includes("$$('small',button).forEach(node=>node.remove())"),'Join CTA helper copy is not removed');
assert(runtime.includes("$$('#mc5SoundButton,.mc5-sound').forEach(node=>node.remove())"),'Mute control is not removed');
assert(!runtime.includes('new MutationObserver'),'V7.4 must not install a document-wide MutationObserver');
assert(!runtime.includes("observer.observe(document.body,{childList:true,subtree:true})"),'Self-triggering body observer must stay retired');
assert(runtime.includes("salamat-mobile-preboot-v74"),'Preboot release contract is missing');
assert(runtime.includes("window.SalamatEvaluationModuleV4?.state?.selectedCaregiverId"),'Evaluation caregiver touch fallback is missing');
assert(runtime.includes("requestSubmit?.()"),'Evaluation search fallback is missing');
assert(runtime.includes("if(String(key)==='caregiver.training')"),'Canonical caregiver training interception is missing');
assert(runtime.includes("window.SalamatCaregiverTrainingRouteOwner"),'Training route owner is not used');
assert(runtime.includes("window.SalamatCaregiverTrainingV3"),'Training V3 fallback is missing');

assert(worker.includes('const MOBILE_FUNCTIONAL_FIX_VERSION = "7.4.2"'),'Worker V7.4.2 version is missing');
assert(worker.includes('html.salamat-mobile-preboot-v74 #appView{visibility:hidden!important}'),'Old mobile shell is not hidden before first paint');
assert(worker.includes('window.__salamatEvaluationSearchSubmitOwnerV1=true'),'Conflicting evaluation submit owner is not retired before parse');
assert(worker.includes('window.__salamatEvaluationSearchCanonicalV1=true'),'Conflicting legacy evaluation search owner is not retired before parse');
assert(worker.includes('evaluation-search-submit-owner-v1.js')&&worker.includes('evaluation-search-canonical-runtime.js'),'Legacy evaluation search scripts are not stripped');
assert(worker.includes('#mc5SoundButton,.mc5-sound{display:none!important}'),'Mute control does not have first-paint suppression');
assert(worker.includes('#loginView .join-network-action small')&&worker.includes('display:none!important'),'Login helper copy lacks first-paint suppression');
assert(worker.includes('.cgt3-card [data-cgt3-open]'),'Training view button lacks mobile visibility protection');
assert(worker.includes('injectMobileFunctionalFixes(html)'),'V7.4 runtime is not injected into the canonical response');
assert(worker.includes('x-salamat-mobile-functional-fixes'),'V7.4 evidence header missing');
assert(worker.includes('x-salamat-mobile-preboot'),'Preboot evidence header missing');
assert(worker.includes('x-salamat-evaluation-mobile-owner'),'Evaluation evidence header missing');
assert(worker.includes('x-salamat-training-mobile-owner'),'Training evidence header missing');

assert(wrangler.includes('"main": "./worker/index-unified-financial-v4.ts"'),'Canonical unified finance production entrypoint changed unexpectedly');
assert(training.includes('data-cgt3-open')&&training.includes('مشاهده آموزش'),'Canonical training runtime does not expose the requested view button');
assert(canonical.includes("if(key==='caregiver.training')"),'Canonical caregiver owner no longer contains a training route');

console.log('Mobile functional fixes V7.4.2 contract validated without a desktop mutation loop.');
