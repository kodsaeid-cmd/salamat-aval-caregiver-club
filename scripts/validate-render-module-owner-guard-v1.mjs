import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Render module owner guard validation failed: ${message}`);
};
const has = (source, value, message) => expect(source.includes(value), message);
const lacks = (source, value, message) => expect(!source.includes(value), message);
const syntax = (path) => {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  expect(result.status === 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
};

const guard = read('preview/render-module-owner-guard-v1.js');
const worker = read('worker/index-caregiver-platform-v1.ts');
const fixture = read('scripts/prepare-release-smoke-fixtures.mjs');
const browser = read('scripts/run-admin-priority-browser-smoke.mjs');
const deploy = read('.github/workflows/deploy-production.yml');
const smokeWorkflow = read('.github/workflows/admin-core-production-smoke.yml');

syntax('preview/render-module-owner-guard-v1.js');
for (const value of [
  "const VERSION='1.0.0'",
  "Object.defineProperty(window,'renderModule'",
  'isSupportWrapper',
  'isTrainingWrapper',
  'rejectedSupportAssignments',
  'safeTraining',
  'window.SalamatRenderModuleOwnerGuard',
]) has(guard, value, `guard is missing ${value}`);
for (const forbidden of ['setInterval(', 'new MutationObserver(', 'eval(']) {
  lacks(guard, forbidden, `guard contains forbidden ${forbidden}`);
}

has(worker, 'const RENDER_MODULE_GUARD_VERSION = "1.0.0"', 'worker guard version is missing');
has(worker, '"render-module-owner-guard-v1.js"', 'guard is not injected');
has(worker, 'x-salamat-render-module-guard', 'guard response header is missing');
expect(
  worker.indexOf('"render-module-owner-guard-v1.js"') < worker.indexOf('"staff-support-runtime-v1.js"'),
  'guard must load immediately before support runtime',
);

has(fixture, "WHERE id LIKE 'RC-%-CARE-PROFILE'", 'stale smoke profiles are not soft-cleaned');
has(fixture, "cooperation_status='حذف‌شده'", 'soft-delete status is missing');
has(fixture, 'active=0', 'smoke caregiver is not deactivated');
lacks(fixture, 'DELETE FROM caregivers', 'protected caregiver hard delete remains in cleanup');

for (const source of [deploy, smokeWorkflow]) {
  has(source, 'render-module-owner-guard-v1.js', 'workflow does not track the guard asset');
}
has(browser, 'SalamatRenderModuleOwnerGuard', 'browser smoke does not wait for the guard');
has(browser, 'rejectedSupportAssignments', 'browser smoke does not prove support wrapper rejection');

console.log('Render module owner guard and protected smoke soft-cleanup contracts passed.');
