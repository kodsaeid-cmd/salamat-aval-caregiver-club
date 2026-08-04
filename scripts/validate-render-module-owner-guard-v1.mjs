import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Direct support runtime validation failed: ${message}`);
};
const has = (source, value, message) => expect(source.includes(value), message);
const lacks = (source, value, message) => expect(!source.includes(value), message);
const syntax = (path) => {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  expect(result.status === 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
};

const guard = read('preview/render-module-owner-guard-v1.js');
const support = read('preview/staff-support-direct-runtime-v2.js');
const worker = read('worker/index-caregiver-platform-v1.ts');
const fixture = read('scripts/prepare-release-smoke-fixtures.mjs');
const browser = read('scripts/run-admin-priority-browser-smoke.mjs');
const deploy = read('.github/workflows/deploy-production.yml');
const smokeWorkflow = read('.github/workflows/admin-core-production-smoke.yml');

syntax('preview/render-module-owner-guard-v1.js');
syntax('preview/staff-support-direct-runtime-v2.js');
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

has(worker, 'const SUPPORT_RUNTIME_VERSION = "2.0.0"', 'worker support version is missing');
has(worker, '"staff-support-direct-runtime-v2.js"', 'direct support runtime is not injected');
has(worker, 'x-salamat-support-runtime', 'support response header is missing');
has(worker, 'staff-support-runtime-v1\\.js', 'worker does not remove the legacy support script');
const runtimeBlock = worker.slice(worker.indexOf('const RUNTIMES'), worker.indexOf('function runtimeTag'));
lacks(runtimeBlock, '"staff-support-runtime-v1.js"', 'legacy support runtime remains in the injected runtime list');
expect(
  worker.indexOf('"render-module-owner-guard-v1.js"') < worker.indexOf('"staff-support-direct-runtime-v2.js"'),
  'guard must load before direct support runtime',
);

has(fixture, "WHERE id LIKE 'RC-%-CARE-PROFILE'", 'stale smoke profiles are not soft-cleaned');
has(fixture, "cooperation_status='حذف‌شده'", 'soft-delete status is missing');
has(fixture, 'active=0', 'smoke caregiver is not deactivated');
lacks(fixture, 'DELETE FROM caregivers', 'protected caregiver hard delete remains in cleanup');

has(deploy, '- "preview/**"', 'production deploy does not trigger for support assets');
has(smokeWorkflow, 'preview/staff-support-direct-runtime-v2.js', 'authenticated smoke does not track direct support');
has(browser, 'expect(browserErrors.length === 0', 'browser smoke no longer fails on recursion errors');
has(browser, "await clickModule('بانک آموزش'", 'browser smoke does not click training');
has(browser, "await clickModule('پشتیبانی'", 'browser smoke does not click support');

console.log('Direct support runtime v2, training isolation and protected smoke cleanup contracts passed.');
