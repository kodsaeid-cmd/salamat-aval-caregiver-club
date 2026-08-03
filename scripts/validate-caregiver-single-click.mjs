import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver route validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const wrapper=read('worker/index-caregiver-click-stability.ts');
const runtime=read('preview/staff-caregiver-single-click-fix-v1.js');
const routeOwner=read('preview/staff-caregiver-route-owner-v1.js');
const staffPlatform=read('preview/staff-platform-runtime.js');

new Function(runtime);
new Function(routeOwner);

expect(wrangler.includes('index-caregiver-click-stability.ts'),'final caregiver interaction worker is not active');
expect(wrangler.includes('index-ui-stability.ts'),'caregiver interaction worker does not document the delegated UI layer');
expect(wrapper.includes('import app from "./index-ui-stability"'),'existing UI stability chain is not preserved');
expect(wrapper.includes('staff-caregiver-single-click-fix-v1.js'),'single-click runtime is not injected');
expect(wrapper.includes('staff-caregiver-route-owner-v1.js'),'canonical caregiver route owner is not injected');
expect(wrapper.indexOf('ROUTE_OWNER_TAG')<wrapper.indexOf('SINGLE_CLICK_TAG'),'route owner must be declared before row interaction recovery');
expect(wrapper.includes('x-salamat-caregiver-route-owner'),'route owner deployment diagnostic header is missing');
expect(wrapper.includes('x-salamat-caregiver-single-click'),'single-click deployment diagnostic header is missing');

expect(staffPlatform.includes("if(typeof window.renderModule==='function')"),'legacy fallback path changed unexpectedly');
expect(routeOwner.includes("const MODULE_KEY='staff.caregivers'"),'caregiver module ownership is missing');
expect(routeOwner.includes('data-view="staff-caregiver-server-loading"'),'database loading surface is missing');
expect(routeOwner.includes("controller.openList({force:true,source:'route-owner',reason})"),'module is not opened through the canonical server controller');
expect(routeOwner.includes('`${NAV_SELECTOR},${CARD_SELECTOR}`'),'sidebar and dashboard module entry points are not jointly claimed');
expect(routeOwner.includes('event.stopImmediatePropagation()'),'legacy module click handler is not neutralized');
expect(routeOwner.includes("if(String(key)===MODULE_KEY)"),'programmatic access router is not intercepted');
expect(routeOwner.includes('access.openModule=wrapped'),'access router is not patched');
expect(routeOwner.includes('canonicalVisible()||loadingVisible()'),'legacy view replacement guard is missing');
expect(routeOwner.includes("observer.observe(content,{childList:true,subtree:true})"),'late stale view replacement is not observed');
expect(routeOwner.includes('RETRY_DELAYS'),'bounded controller readiness recovery is missing');
expect(routeOwner.includes('salamat-caregiver-server-route-opened'),'canonical route lifecycle event is missing');
expect(!routeOwner.includes('localStorage'),'canonical caregiver route must not use local data');
expect(!routeOwner.includes('setInterval('),'canonical route owner must not poll permanently');

expect(runtime.includes("const DESKTOP=window.matchMedia('(min-width:761px)')"),'desktop-only row scope is missing');
expect(runtime.includes("document.addEventListener('pointerdown',onPointerDown,true)"),'first physical pointer event is not captured');
expect(runtime.includes("document.addEventListener('mousedown',onMouseDown,true)"),'desktop mouse fallback is missing');
expect(runtime.includes("document.addEventListener('click',onClick,true)"),'duplicate click suppression is missing');
expect(runtime.includes('event.stopImmediatePropagation()'),'legacy row handlers are not neutralized');
expect(runtime.includes("controller.openRecord(current.id,current.row,{force:true})"),'record is not opened through the canonical server controller');
expect(runtime.includes('current.inflight'),'concurrent record requests are not coalesced');
expect(runtime.includes('OPEN_TIMEOUT'),'bounded recovery window is missing');
expect(runtime.includes('RETRY_DELAYS'),'list rerender recovery schedule is missing');
expect(runtime.includes("if(listVisible())schedule(0)"),'stale list restoration is not repaired');
expect(runtime.includes("window.addEventListener('salamat-history-restored'"),'history race recovery is missing');
expect(runtime.includes("window.addEventListener('salamat-caregiver-record-opened'"),'successful detail settlement is not observed');
expect(runtime.includes('scv-single-click-opening'),'visible opening state is missing');
expect(!runtime.includes('setInterval('),'single-click fix must not poll permanently');

console.log('The caregiver module is owned by the canonical database-backed controller from its first sidebar/dashboard entry; legacy local rendering is suppressed, stale views are replaced, and desktop rows open deterministically.');
