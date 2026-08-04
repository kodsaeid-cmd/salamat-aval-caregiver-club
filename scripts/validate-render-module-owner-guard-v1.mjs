import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Direct module ownership validation failed: ${message}`);
};
const has = (source, value, message) => expect(source.includes(value), message);
const lacks = (source, value, message) => expect(!source.includes(value), message);
const syntax = (path) => {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  expect(result.status === 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
};

const guard = read('preview/render-module-owner-guard-v1.js');
const support = read('preview/staff-support-direct-runtime-v2.js');
const contractOwner = read('preview/contract-module-priority-v2.js');
const worker = read('worker/index-caregiver-platform-v1.ts');
const fixture = read('scripts/prepare-release-smoke-fixtures.mjs');
const browser = read('scripts/run-admin-priority-browser-smoke.mjs');
const deploy = read('.github/workflows/deploy-production.yml');
const smokeWorkflow = read('.github/workflows/admin-core-production-smoke.yml');

syntax('preview/render-module-owner-guard-v1.js');
syntax('preview/staff-support-direct-runtime-v2.js');
syntax('preview/contract-module-priority-v2.js');
for (const value of [
  "const VERSION='1.0.0'",
  "Object.defineProperty(window,'renderModule'",
  'isSupportWrapper',
  'isTrainingWrapper',
  'window.SalamatRenderModuleOwnerGuard',
]) has(guard, value, `guard is missing ${value}`);
for (const forbidden of ['setInterval(', 'new MutationObserver(', 'eval(']) {
  lacks(guard, forbidden, `guard contains forbidden ${forbidden}`);
}

for (const value of [
  "const VERSION='2.0.0'",
  'window.SalamatStaffSupport={version:VERSION,open:load,reload:load,direct:true}',
  '/api/caregiver/platform/support/threads',
  'navigator.mediaDevices.getUserMedia',
  'data-sts2-status',
  'salamat-staff-support-ready',
]) has(support, value, `direct support runtime is missing ${value}`);
for (const forbidden of ['renderModule', '__staffSupportV1', 'setInterval(', 'new MutationObserver(', 'eval(']) {
  lacks(support, forbidden, `direct support runtime contains forbidden ${forbidden}`);
}

for (const value of [
  "const VERSION='2.0.0'",
  "window.addEventListener('click',capture,true)",
  "owner:'window-capture'",
  "buttonKey(button)!=='staff.contracts'",
  'event.stopImmediatePropagation()',
  'window.SalamatStaffContracts',
  'staff-contracts-runtime-v1.js',
  'salamat-contract-route-owner-ready',
]) has(contractOwner, value, `contract route owner v2 is missing ${value}`);
for (const forbidden of ['document.addEventListener(\'click\'', 'setInterval(', 'new MutationObserver(', 'renderModule']) {
  lacks(contractOwner, forbidden, `contract route owner v2 contains forbidden ${forbidden}`);
}

has(worker, 'const SUPPORT_RUNTIME_VERSION = "2.0.0"', 'worker support version is missing');
has(worker, 'const CONTRACT_ROUTE_OWNER_VERSION = "2.0.0"', 'worker contract owner version is missing');
has(worker, '"staff-support-direct-runtime-v2.js"', 'direct support runtime is not injected');
has(worker, '"contract-module-priority-v2.js"', 'contract route owner v2 is not injected');
has(worker, 'x-salamat-support-runtime', 'support response header is missing');
has(worker, 'x-salamat-contract-route-owner', 'contract owner response header is missing');
has(worker, 'function stripRuntime', 'generic runtime stripping helper is missing');
has(worker, 'stripRuntime(html, fileName)', 'generic runtime stripping is not executed');
const removalBlock = worker.slice(
  worker.indexOf('for (const fileName of ['),
  worker.indexOf('html = injectCriticalRuntimes'),
);
has(removalBlock, '"staff-support-runtime-v1.js"', 'worker does not remove the legacy support script');
has(removalBlock, '"contract-module-priority-v1.js"', 'worker does not remove the legacy contract owner script');
const runtimeBlock = worker.slice(worker.indexOf('const RUNTIMES'), worker.indexOf('function runtimeVersion'));
lacks(runtimeBlock, '"staff-support-runtime-v1.js"', 'legacy support runtime remains in the injected runtime list');
const criticalBlock = worker.slice(worker.indexOf('const CRITICAL_RUNTIMES'), worker.indexOf('const RUNTIMES'));
has(criticalBlock, '"contract-module-priority-v2.js"', 'contract owner v2 is absent from critical runtimes');
lacks(criticalBlock, '"contract-module-priority-v1.js"', 'legacy contract owner remains in critical runtimes');
expect(
  worker.indexOf('"contract-module-priority-v2.js"') < worker.indexOf('"staff-module-router-v3.js"'),
  'contract owner v2 must load before the sidebar router',
);
expect(
  worker.indexOf('"render-module-owner-guard-v1.js"') < worker.indexOf('"staff-support-direct-runtime-v2.js"'),
  'guard must load before direct support runtime',
);

expect(
  fixture.includes("WHERE id LIKE 'RC-%-CARE-PROFILE'") || fixture.includes('WHERE id=${sql(caregiverProfile.id)}'),
  'stale smoke profiles are not soft-cleaned',
);
has(fixture, "cooperation_status='حذف‌شده'", 'soft-delete status is missing');
has(fixture, 'active=0', 'smoke caregiver is not deactivated');
lacks(fixture, 'DELETE FROM caregivers', 'protected caregiver hard delete remains in cleanup');

has(deploy, '- "preview/**"', 'production deploy does not trigger for module owner assets');
has(smokeWorkflow, 'scripts/run-admin-priority-browser-smoke.mjs', 'authenticated browser smoke is not tracked');
has(browser, "const CONTRACT_OWNER = '2.0.0'", 'browser smoke does not require contract owner v2');
has(browser, "headers['x-salamat-contract-route-owner'] === CONTRACT_OWNER", 'browser smoke does not wait for live contract owner header');
has(browser, 'contract-module-priority-v2.js', 'browser smoke does not inspect contract owner v2');
has(browser, 'legacyContractsPriorityIndex < 0', 'browser smoke does not reject contract owner v1');
has(browser, 'expect(browserErrors.length === 0', 'browser smoke no longer fails on browser errors');
has(browser, "await clickModule('قراردادها'", 'browser smoke does not click contracts');
has(browser, "await clickModule('بانک آموزش'", 'browser smoke does not click training');
has(browser, "await clickModule('پشتیبانی'", 'browser smoke does not click support');

console.log('Window contract route owner v2, direct support v2, generic legacy stripping and protected smoke cleanup contracts passed.');
