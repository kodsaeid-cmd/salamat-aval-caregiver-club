import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('../preview/panel-route-bootstrap-v1.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/index-referral-rewards.ts',import.meta.url),'utf8');

for(const marker of [
  "const VERSION='1.2.0'",
  'const STAFF_BOOT_TIMEOUT_MS=3200',
  'function legacyStaffSurfacePresent()',
  'function canonicalStaffSurfaceReady()',
  'function sanitizeLegacyStaffSurface()',
  'function requestPreferredStaffSurface',
  'staffNavigationReady()',
  'data-salamat-staff-surface',
  'window.SalamatAccessControl?.openModule',
  'clearTimeout(deadlineTimer)',
  'forceReleaseAfterDeadline',
]) assert.ok(runtime.includes(marker),`Missing panel loader recovery marker: ${marker}`);

assert.ok(!runtime.includes('dashboardRetry=setTimeout(retryCanonicalDashboard,180)'), 'Panel bootstrap must not keep an unbounded dashboard-only retry loop.');
assert.ok(!runtime.includes('function canonicalStaffDashboardReady()'), 'Panel readiness must not require the dashboard specifically.');
assert.ok(runtime.includes('data-salamat-staff-surface="loading"'), 'Legacy staff content must be replaced with a canonical loading surface before release.');
assert.ok(runtime.includes("releasePanel('staff-shell-bounded-fallback')"), 'Staff loader needs a bounded exit after canonical router ownership.');
assert.ok(runtime.includes("releasePanel('sanitized-bounded-fallback')"), 'Legacy content must be sanitized before the last-resort release.');
assert.ok(worker.includes('const PANEL_ROUTE_VERSION = "1.2.0"'), 'Worker must cache-bust panel bootstrap 1.2.0.');

console.log('Panel loader deadlock v2 contract is valid.');
