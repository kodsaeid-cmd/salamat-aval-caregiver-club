import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('../preview/panel-route-bootstrap-v1.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/index-referral-rewards.ts',import.meta.url),'utf8');
new Function(runtime);

for(const marker of [
  "const VERSION='1.3.0'",
  "const STAFF_ROLES=new Set",
  'function dispatchStaffRoute',
  'window.SalamatStaffModuleRouter',
  'router.route(key)',
  'preferredStaffModuleKey()',
  "releasePanel('staff-route-dispatched')",
  "window.addEventListener(eventName,()=>settle(eventName))",
  'forceReleaseAfterDeadline',
]) assert.ok(runtime.includes(marker),`Missing direct panel recovery marker: ${marker}`);

assert.ok(!runtime.includes('staff-shell-loading'),'Panel bootstrap must never replace real content with a loading placeholder.');
assert.ok(!runtime.includes('MutationObserver'),'Panel bootstrap must not repair-loop over the application DOM.');
assert.ok(!runtime.includes('canonicalStaffDashboardReady'),'Panel readiness must not wait for dashboard DOM before routing it.');
assert.ok(!runtime.includes('SalamatAccessControl?.openModule'),'Retired access routing API must not own panel entry.');
assert.ok(worker.includes('const PANEL_ROUTE_VERSION = "1.3.0"'),'Worker must cache-bust panel bootstrap 1.3.0.');
assert.ok(worker.includes('data-salamat-panel-direct'),'Panel document must declare direct routing mode.');
assert.ok(!worker.includes('salamatPanelRouteSpin'),'Server panel shell must not ship a full-screen loading overlay.');

console.log('Panel loader deadlock v2 contract is valid with direct canonical routing and no blocking placeholder.');
