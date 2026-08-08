import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('preview/mobile-functional-fixes-v7-4.js');
const wrapper=read('worker/index-mobile-v7-4.ts');
const wrangler=read('wrangler.backend.jsonc');
const training=read('preview/caregiver-training-direct-v3.js');
const canonical=read('preview/caregiver-canonical-route-owner-v3.js');

const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(runtime);
assert(runtime.includes("const VERSION='7.4.0'"),'V7.4 runtime version is missing');
assert(runtime.includes("strong.textContent='همین حالا به شبکه مراقبین سلامت اول بپیوندید'"),'Join CTA is not normalized to the requested single label');
assert(runtime.includes("$$('small',button).forEach(node=>node.remove())"),'Join CTA helper copy is not removed');
assert(runtime.includes("$$('#mc5SoundButton,.mc5-sound').forEach(node=>node.remove())"),'Mute control is not removed');
assert(runtime.includes("salamat-mobile-preboot-v74"),'Preboot release contract is missing');
assert(runtime.includes("window.SalamatEvaluationModuleV4?.state?.selectedCaregiverId"),'Evaluation caregiver touch fallback is missing');
assert(runtime.includes("form?.requestSubmit?.()")||runtime.includes("requestSubmit?.()"),'Evaluation search fallback is missing');
assert(runtime.includes("if(String(key)==='caregiver.training')"),'Canonical caregiver training interception is missing');
assert(runtime.includes("window.SalamatCaregiverTrainingRouteOwner"),'Training route owner is not used');
assert(runtime.includes("window.SalamatCaregiverTrainingV3"),'Training V3 fallback is missing');

assert(wrapper.includes('const VERSION = "7.4.0"'),'Worker V7.4 version is missing');
assert(wrapper.includes('html.salamat-mobile-preboot-v74 #appView{visibility:hidden!important}'),'Old mobile shell is not hidden before first paint');
assert(wrapper.includes('window.__salamatEvaluationSearchSubmitOwnerV1=true'),'Conflicting evaluation submit owner is not retired before parse');
assert(wrapper.includes('window.__salamatEvaluationSearchCanonicalV1=true'),'Conflicting legacy evaluation search owner is not retired before parse');
assert(wrapper.includes('#mc5SoundButton,.mc5-sound{display:none!important}'),'Mute control does not have first-paint suppression');
assert(wrapper.includes('#loginView .join-network-action small')&&wrapper.includes('display:none!important'),'Login helper copy lacks first-paint suppression');
assert(wrapper.includes('.cgt3-card [data-cgt3-open]'),'Training view button lacks mobile visibility protection');
assert(wrapper.includes('x-salamat-mobile-functional-fixes'),'V7.4 evidence header missing');
assert(wrapper.includes('x-salamat-mobile-preboot'),'Preboot evidence header missing');
assert(wrapper.includes('x-salamat-evaluation-mobile-owner'),'Evaluation evidence header missing');
assert(wrapper.includes('x-salamat-training-mobile-owner'),'Training evidence header missing');

assert(wrangler.includes('"main": "./worker/index-mobile-v7-4.ts"'),'V7.4 outer worker is not active');
assert(training.includes('data-cgt3-open')&&training.includes('مشاهده آموزش'),'Canonical training runtime does not expose the requested view button');
assert(canonical.includes("if(key==='caregiver.training')"),'Canonical caregiver owner no longer contains a training route');

console.log('Mobile functional fixes V7.4 contract validated.');
