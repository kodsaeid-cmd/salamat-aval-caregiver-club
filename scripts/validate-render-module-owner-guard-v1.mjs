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
const support = read('preview/staff-support-direct-runtime-v3.js');
const supportOwner = read('preview/staff-support-route-owner-v3.js');
const notifications = read('preview/server-notifications-runtime-v2.js');
const contractOwner = read('preview/contract-module-priority-v2.js');
const worker = read('worker/index-caregiver-platform-v1.ts');
const fixture = read('scripts/prepare-release-smoke-fixtures.mjs');
const browser = read('scripts/run-admin-priority-browser-smoke.mjs');
const deploy = read('.github/workflows/deploy-production.yml');
const smokeWorkflow = read('.github/workflows/admin-core-production-smoke.yml');

for (const path of [
  'preview/render-module-owner-guard-v1.js',
  'preview/staff-support-direct-runtime-v3.js',
  'preview/staff-support-route-owner-v3.js',
  'preview/server-notifications-runtime-v2.js',
  'preview/contract-module-priority-v2.js',
]) syntax(path);

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
  "const VERSION='3.0.0'",
  'window.SalamatStaffSupport={version:VERSION',
  '/api/caregiver/platform/support/threads',
  'navigator.mediaDevices.getUserMedia',
  'data-sts3-status',
  'data-support-unity-version',
  'پشتیبانی پرونده',
  'پشتیبانی فوری و امنیتی',
  'salamat-support-thread-read',
]) has(support, value, `direct support runtime v3 is missing ${value}`);
for (const forbidden of ['window.renderModule', 'eval(']) {
  lacks(support, forbidden, `direct support runtime v3 contains forbidden ${forbidden}`);
}

for (const value of [
  "const VERSION='3.0.0'",
  "window.addEventListener('click',capture,true)",
  "buttonKey(button)!=='staff.support'",
  'event.stopImmediatePropagation()',
  'MutationObserver(scheduleRepair)',
  'staff-support-direct-runtime-v3.js',
  'window.SalamatStaffSupportRouteOwner',
  "owner:'window-capture'",
]) has(supportOwner, value, `support route owner v3 is missing ${value}`);
lacks(supportOwner, 'window.renderModule', 'support route owner depends on renderModule');

for (const value of [
  "const VERSION='2.0.0'",
  'SUPPORT_MESSAGE',
  'support:',
  'salamat-open-support-thread',
  'salamat-open-caregiver-support-thread',
  'شما یک پیام خوانده‌نشده از پشتیبانی دارید.',
  'window.SalamatServerNotifications',
]) has(notifications, value, `notifications runtime v2 is missing ${value}`);

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

for (const value of [
  'const SUPPORT_RUNTIME_VERSION = "3.0.0"',
  'const SUPPORT_ROUTE_OWNER_VERSION = "3.0.0"',
  'const SUPPORT_UNITY_VERSION = "3.0.0"',
  'const NOTIFICATIONS_RUNTIME_VERSION = "2.0.0"',
  '"staff-support-route-owner-v3.js"',
  '"staff-support-direct-runtime-v3.js"',
  '"server-notifications-runtime-v2.js"',
  'routeSupportConversationUnityV3',
  'x-salamat-support-runtime',
  'x-salamat-support-route-owner',
  'x-salamat-support-unity',
  'x-salamat-notifications-runtime',
  'function stripRuntime',
  'stripRuntime(html, fileName)',
]) has(worker, value, `worker support ownership is missing ${value}`);
const removalBlock = worker.slice(worker.indexOf('for (const fileName of ['), worker.indexOf('html = injectCriticalRuntimes'));
for (const value of [
  '"staff-support-runtime-v1.js"',
  '"staff-support-direct-runtime-v2.js"',
  '"server-notifications-runtime.js"',
  '"contract-module-priority-v1.js"',
]) has(removalBlock, value, `worker does not strip ${value}`);
const runtimeBlock = worker.slice(worker.indexOf('const RUNTIMES'), worker.indexOf('function runtimeVersion'));
for (const forbidden of ['"staff-support-runtime-v1.js"', '"staff-support-direct-runtime-v2.js"', '"server-notifications-runtime.js"']) {
  lacks(runtimeBlock, forbidden, `legacy runtime remains in injected list: ${forbidden}`);
}
expect(
  runtimeBlock.indexOf('"staff-support-route-owner-v3.js"') < runtimeBlock.indexOf('"staff-support-direct-runtime-v3.js"'),
  'support route owner must load before support runtime',
);
expect(
  runtimeBlock.indexOf('"render-module-owner-guard-v1.js"') < runtimeBlock.indexOf('"staff-support-direct-runtime-v3.js"'),
  'render guard must load before direct support runtime v3',
);
const criticalBlock = worker.slice(worker.indexOf('const CRITICAL_RUNTIMES'), worker.indexOf('const RUNTIMES'));
has(criticalBlock, '"contract-module-priority-v2.js"', 'contract owner v2 is absent from critical runtimes');
lacks(criticalBlock, '"contract-module-priority-v1.js"', 'legacy contract owner remains in critical runtimes');
expect(worker.indexOf('"contract-module-priority-v2.js"') < worker.indexOf('"staff-module-router-v3.js"'), 'contract owner v2 must load before router');

const explicitSoftCleanup = fixture.includes("WHERE id LIKE 'RC-%-CARE-PROFILE'") || fixture.includes('WHERE id=${sql(caregiverProfile.id)}');
const multiProfileSoftCleanup = fixture.includes('[caregiverProfile,pendingRegistrationProfile].map') && fixture.includes('WHERE id=${sql(profile.id)}');
expect(explicitSoftCleanup || multiProfileSoftCleanup, 'stale smoke profiles are not soft-cleaned');
if (fixture.includes('pendingRegistrationProfile')) {
  expect(multiProfileSoftCleanup || fixture.includes('WHERE id=${sql(pendingRegistrationProfile.id)}'), 'pending self-registration smoke profile is not soft-cleaned');
}
has(fixture, "cooperation_status='حذف‌شده'", 'soft-delete status is missing');
has(fixture, 'active=0', 'smoke caregiver is not deactivated');
lacks(fixture, 'DELETE FROM caregivers', 'protected caregiver hard delete remains in cleanup');

has(deploy, '- "preview/**"', 'production deploy does not trigger for support assets');
has(smokeWorkflow, 'scripts/run-admin-priority-browser-smoke.mjs', 'authenticated browser smoke is not tracked');
for (const value of [
  "const CONTRACT_OWNER = '2.0.0'",
  "const SUPPORT = '3.0.0'",
  "const SUPPORT_OWNER = '3.0.0'",
  "headers['x-salamat-support-unity'] === SUPPORT",
  'staff-support-route-owner-v3.js',
  'staff-support-direct-runtime-v3.js',
  'legacyDirectSupportIndex < 0',
  "await clickModule('پشتیبانی'",
  'supportWorkspace.tabs.length === 2',
  'expect(browserErrors.length === 0',
]) has(browser, value, `browser smoke is missing ${value}`);

console.log('Window contract owner v2, support route owner/runtime v3, notifications v2, legacy stripping and protected smoke cleanup contracts passed.');
