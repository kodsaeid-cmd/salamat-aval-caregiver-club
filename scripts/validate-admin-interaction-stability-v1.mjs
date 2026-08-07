import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('../preview/admin-interaction-stability-v1.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/index-referral-rewards.ts',import.meta.url),'utf8');

for(const marker of [
  "const VERSION='1.0.0'",
  "id='salamatEvalSearchDraft'",
  "id='salamatEvalSearchSubmit'",
  "id='sctSubmitSearch'",
  "window.addEventListener('input',guardContractLiveInput,true)",
  "event.__salamatSubmitSearch===true",
  "window.SalamatEvaluationSearch",
  "access.openModule('staff.dashboard')",
  "salamat-admin-entry-guard",
  "مدیریت یکپارچه باشگاه مراقبین",
]) assert.ok(runtime.includes(marker),`Missing admin stability marker: ${marker}`);

assert.ok(!runtime.includes("setTimeout(()=>void execute(),350)"),'The new runtime must not introduce evaluation live-search debounce.');
assert.ok(runtime.includes("draft?.addEventListener('input',()=>{evalDraft=draft.value})"),'Evaluation typing must only update draft text.');
assert.ok(runtime.includes("draft?.addEventListener('keydown',event=>{if(event.key==='Enter')"),'Evaluation Enter submit is required.');
assert.ok(runtime.includes("button.addEventListener('click',()=>submitContractSearch(input))"),'Contracts search must submit by explicit button click.');

for(const marker of [
  'const ADMIN_STABILITY_RUNTIME = "admin-interaction-stability-v1.js"',
  'const ADMIN_STABILITY_VERSION = "1.0.0"',
  'const PANEL_ROUTE_VERSION = "1.0.2"',
  'html.includes(ADMIN_STABILITY_RUNTIME)',
  'x-salamat-admin-stability',
]) assert.ok(worker.includes(marker),`Missing worker integration marker: ${marker}`);

console.log('Admin interaction stability v1 contract is valid.');
