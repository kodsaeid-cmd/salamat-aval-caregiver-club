import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Admin core production proof validation failed: ${message}`);
};
const has = (source, value, message) => expect(source.includes(value), message);
const lacks = (source, value, message) => expect(!source.includes(value), message);
const checkNode = (path) => {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  expect(result.status === 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
};

const payroll = read('worker/staff-payroll-v1.ts');
const tools = read('worker/admin-system-tools-v1.ts');
const wrapper = read('worker/index-caregiver-platform-v1.ts');
const smoke = read('scripts/run-admin-core-production-smoke.mjs');
const workflow = read('.github/workflows/admin-core-production-smoke.yml');

has(payroll, 'financeOnlyDashboard', 'financial credits response is not sanitized');
has(payroll, 'delete payload.data.payroll', 'payroll rows are not removed from financial credits');
has(payroll, 'delete payload.data.summary.payrollIssued', 'payroll summary is not removed from financial credits');
has(payroll, 'legacy_finance_payroll_removed', 'legacy finance payroll route is not closed');
has(payroll, 'url.pathname.startsWith("/api/staff/financial-credits/payroll")', 'legacy payroll boundary is missing');
has(payroll, 'const periodKey = normalize(body.periodKey)', 'Persian payroll period digits are not normalized');

has(tools, 'const VERSION = "3.0.1"', 'admin core endpoint is not version 3.0.1');
has(tools, 'const MODULE_CONTRACT_VERSION = "3.0.0"', 'module contract version is not explicit');
has(tools, 'adminCoreModules: VERSION', 'public admin core version field is missing');
has(tools, 'moduleContractVersion: MODULE_CONTRACT_VERSION', 'public module contract field is missing');
has(wrapper, 'const ADMIN_CORE_VERSION = "3.0.1"', 'live HTML header is not version 3.0.1');
has(wrapper, 'x-salamat-admin-core', 'admin core response header is missing');

checkNode('scripts/run-admin-core-production-smoke.mjs');
has(smoke, "const ADMIN_CORE_VERSION = '3.0.1'", 'smoke does not wait for the current admin core version');
has(smoke, 'async function authedUntil', 'authenticated endpoint convergence helper is missing');
has(smoke, 'system settings endpoint did not converge', 'settings version convergence is not enforced');
has(smoke, 'timeoutMs = 120_000', 'authenticated convergence timeout is not bounded');
has(smoke, "['staff.training', 'بانک آموزش']", 'training label is not asserted');
has(smoke, "['staff.financial_credits', 'اعتبارات مالی']", 'finance label is not asserted');
has(smoke, "['staff.payroll', 'حقوق و پرداخت']", 'payroll label is not asserted');
has(smoke, "['staff.settings', 'تنظیمات و لاگ']", 'settings label is not asserted');
has(smoke, "!visible.has('staff.reports')", 'reports removal is not asserted');
has(smoke, "'/api/training/admin'", 'training API is not tested');
has(smoke, "'/api/staff/financial-credits'", 'financial credits API is not tested');
has(smoke, "'/api/staff/payroll?page=1&pageSize=10'", 'payroll API is not tested');
has(smoke, "'/api/staff/system-settings'", 'settings API is not tested');
has(smoke, "'/api/staff/audit-logs?page=1&pageSize=10'", 'audit logs API is not tested');
has(smoke, "'/api/staff/financial-credits/payroll', 410", 'legacy payroll route is not tested');
has(smoke, 'financePayrollSeparated: true', 'finance/payroll separation evidence is missing');
has(smoke, 'authenticatedProductionSmoke: true', 'authenticated evidence marker is missing');

for (const requirement of [
  'workflow_dispatch:',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'Prepare isolated admin identity',
  'prepare-release-smoke-fixtures.mjs',
  'Run authenticated admin core smoke',
  'run-admin-core-production-smoke.mjs',
  'Remove isolated admin identities',
  'cleanup.sql',
  'if: always()',
  'Upload authenticated smoke evidence',
  'retention-days: 90',
  'Report successful authenticated smoke',
  'Report failed authenticated smoke',
]) has(workflow, requirement, `workflow is missing ${requirement}`);

expect(workflow.indexOf('Prepare isolated admin identity') < workflow.indexOf('Run authenticated admin core smoke'),
  'fixture creation must happen before smoke');
expect(workflow.indexOf('Run authenticated admin core smoke') < workflow.indexOf('Remove isolated admin identities'),
  'cleanup must happen after smoke');
expect(workflow.indexOf('Remove isolated admin identities') < workflow.indexOf('Report successful authenticated smoke'),
  'cleanup must happen before success reporting');
lacks(workflow, 'D1_BACKUP_PASSPHRASE', 'smoke must not expose or require the production backup passphrase');

console.log('Authenticated admin core 3.0.1 production proof contract passed.');
