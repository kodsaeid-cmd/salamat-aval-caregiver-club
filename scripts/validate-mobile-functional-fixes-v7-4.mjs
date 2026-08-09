import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const desktop=read('worker/index-desktop-react-v1.ts');
const reset=read('worker/index-mobile-reset-v1.ts');
const baseline=read('preview/mobile-responsive-runtime.js');
const wrangler=read('wrangler.backend.jsonc');
const training=read('preview/caregiver-training-direct-v3.js');
const canonical=read('preview/caregiver-canonical-route-owner-v3.js');
const caregiverReact=read('mobile-react/app.tsx');
const adminReact=read('mobile-react/admin.tsx');
const mobileDocument=read('preview/mobile/index.html');
const adminDocument=read('preview/mobile/admin.html');

new Function(baseline);

assert(wrangler.includes('"main": "./worker/index-desktop-react-v1.ts"'),'Production entrypoint must use the React desktop outer wrapper');
assert(desktop.includes('import app from "./index-mobile-reset-v1"'),'React desktop wrapper must preserve the single-layer mobile reset wrapper');
assert(reset.includes('import app from "./index-unified-financial-v4"'),'Mobile reset must preserve canonical backend ownership');
assert(reset.includes('MOBILE_REACT_INDEX = "/mobile/index.html"'),'Caregiver React mobile document is not canonical');
assert(reset.includes('MOBILE_REACT_ADMIN_INDEX = "/mobile/admin.html"'),'Admin React mobile document is not canonical');
assert(reset.includes('shouldRedirectToReactMobile'),'Mobile requests are not promoted into the isolated React surface');
assert(reset.includes('serveMobileReact'),'React mobile static surface is not served before the legacy presentation chain');
assert(reset.includes('x-salamat-mobile-layer-count'),'Single-layer evidence header missing');
assert(reset.includes('x-salamat-mobile-owner'),'Mobile owner evidence header missing');
assert(reset.includes('MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js"'),'Classic compatibility baseline is missing');
assert(reset.includes('MOBILE_BASELINE_VERSION = "2.0.0"'),'Classic baseline cache version is not current');
assert(reset.includes('stripAllLaterMobileScripts'),'Later classic mobile runtimes are not stripped');
assert(reset.includes('stripInlineMobileOwners'),'Inline classic mobile presentation owners are not stripped');

assert(baseline.includes("const VERSION='2.0.0'"),'Responsive classic baseline version is missing');
assert(baseline.includes("const BACKDROP_ID='mobileSidebarBackdrop'"),'Classic baseline menu backdrop is missing');
assert(baseline.includes('overflow-y:auto!important'),'Classic sidebar is not independently scrollable');
assert(baseline.includes("event.stopImmediatePropagation()"),'Classic hamburger does not neutralize legacy click ownership');
assert(baseline.includes("target.closest(`#${BACKDROP_ID}`)"),'Classic backdrop click close is missing');
assert(baseline.includes("event.key==='Escape'"),'Classic Escape close is missing');
assert(baseline.includes('font-size:16px!important'),'Classic form controls can trigger Safari zoom');
assert(baseline.includes('100dvh'),'Classic baseline does not use dynamic viewport height');
assert(!baseline.includes('setInterval('),'Classic baseline must remain polling-free for mobile performance');

for(const source of [caregiverReact,adminReact]){
  assert(!source.includes('#sidebarNav'),'React mobile must not depend on the hidden classic sidebar');
  assert(!source.includes('HTMLElement.prototype.click'),'React mobile must not synthesize classic DOM clicks');
  assert(!source.includes('MutationObserver'),'React mobile must not repair legacy DOM through observers');
}
assert(mobileDocument.includes('mobile-react-root')&&mobileDocument.includes('/mobile/app.js'),'Caregiver React mobile document is incomplete');
assert(adminDocument.includes('mobile-react-admin-root')&&adminDocument.includes('/mobile/admin-app.js'),'Admin React mobile document is incomplete');
assert(training.includes('data-cgt3-open')&&training.includes('مشاهده آموزش'),'Canonical classic training runtime does not expose the requested view button');
assert(canonical.includes("if(key==='caregiver.training')"),'Canonical classic caregiver owner no longer contains a training route');

console.log('Mobile ownership contract validated: caregiver/admin mobile are isolated React surfaces, while the current classic compatibility baseline remains contained beneath them.');
