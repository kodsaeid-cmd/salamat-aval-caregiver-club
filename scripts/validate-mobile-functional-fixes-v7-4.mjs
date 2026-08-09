import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const reset=read('worker/index-mobile-reset-v1.ts');
const baseline=read('preview/mobile-responsive-runtime.js');
const wrangler=read('wrangler.backend.jsonc');
const training=read('preview/caregiver-training-direct-v3.js');
const canonical=read('preview/caregiver-canonical-route-owner-v3.js');

new Function(baseline);

assert(wrangler.includes('"main": "./worker/index-mobile-reset-v1.ts"'),'Production entrypoint must use the single-layer mobile reset wrapper');
assert(reset.includes('import app from "./index-unified-financial-v4"'),'Mobile reset must preserve canonical backend ownership');
assert(reset.includes('MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js"'),'Original responsive mobile baseline is not the sole owner');
assert(reset.includes('MOBILE_BASELINE_VERSION = "1.1.1"'),'Baseline cache version is not current');
assert(reset.includes('stripAllLaterMobileScripts'),'Later mobile runtimes are not stripped');
assert(reset.includes('mobile-[^"\'/?]+\\.js'),'Reset does not generically remove later mobile-* scripts');
assert(reset.includes('stripInlineMobileOwners'),'Inline mobile presentation owners are not stripped');
assert(reset.includes('x-salamat-mobile-layer-count'),'Single-layer evidence header missing');
assert(reset.includes('x-salamat-mobile-owner'),'Mobile owner evidence header missing');

assert(baseline.includes("const VERSION='1.1.1'"),'Responsive baseline version is missing');
assert(baseline.includes("const BACKDROP_ID='mobileSidebarBackdrop'"),'Baseline menu backdrop is missing');
assert(baseline.includes('overflow-y:auto!important'),'Baseline sidebar is not independently scrollable');
assert(baseline.includes("event.stopImmediatePropagation()"),'Baseline hamburger does not neutralize legacy click ownership');
assert(baseline.includes("target.closest(`#${BACKDROP_ID}`)"),'Baseline backdrop click close is missing');
assert(baseline.includes("event.key==='Escape'"),'Baseline Escape close is missing');
assert(baseline.includes('font-size:16px!important'),'Baseline form controls can trigger Safari zoom');
assert(baseline.includes('100dvh'),'Baseline does not use dynamic viewport height');
assert(!baseline.includes('MutationObserver'),'Baseline must remain observer-free for mobile performance');
assert(!baseline.includes('setInterval('),'Baseline must remain polling-free for mobile performance');

assert(training.includes('data-cgt3-open')&&training.includes('مشاهده آموزش'),'Canonical training runtime does not expose the requested view button');
assert(canonical.includes("if(key==='caregiver.training')"),'Canonical caregiver owner no longer contains a training route');

console.log('Mobile reset contract validated: all later shells are retired from production and only the observer-free responsive baseline remains.');
