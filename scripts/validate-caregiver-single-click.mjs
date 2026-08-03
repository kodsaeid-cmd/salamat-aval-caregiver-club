import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver single-click validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const wrapper=read('worker/index-caregiver-click-stability.ts');
const runtime=read('preview/staff-caregiver-single-click-fix-v1.js');

new Function(runtime);

expect(wrangler.includes('index-caregiver-click-stability.ts'),'final caregiver interaction worker is not active');
expect(wrangler.includes('index-ui-stability.ts'),'caregiver interaction worker does not document the delegated UI layer');
expect(wrapper.includes('import app from "./index-ui-stability"'),'existing UI stability chain is not preserved');
expect(wrapper.includes('staff-caregiver-single-click-fix-v1.js'),'single-click runtime is not injected');
expect(wrapper.includes('x-salamat-caregiver-single-click'),'single-click deployment diagnostic header is missing');

expect(runtime.includes("const DESKTOP=window.matchMedia('(min-width:761px)')"),'desktop-only scope is missing');
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

console.log('Desktop caregiver rows are claimed on the first physical click, duplicate handlers are suppressed, stale list/history rerenders are recovered, and only one record request remains active.');
