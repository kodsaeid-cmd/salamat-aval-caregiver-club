import fs from 'node:fs';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
const ADMIN_CORE_VERSION = '3.0.1';
const MODULE_CONTRACT_VERSION = '3.0.0';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-core-production-smoke.mjs <base-url> <metadata-path>');
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing from fixture metadata.');

const checks = [];
function expect(condition, message) {
  if (!condition) throw new Error(`Admin core production smoke failed: ${message}`);
}
function passed(check) {
  checks.push({ check, status: 'passed' });
}
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    cache: 'no-store',
    ...options,
    headers: {
      accept: options.accept || 'application/json',
      'cache-control': 'no-cache',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if ((response.headers.get('content-type') || '').includes('application/json')) {
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  }
  return { response, body, text };
}
async function waitForCurrentAdminCore() {
  const deadline = Date.now() + 240_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const core = await request(`/api/system/admin-core-version?smoke=${Date.now()}`);
      const html = await request(`/?smoke=${Date.now()}`, { accept: 'text/html' });
      const ready = core.response.status === 200
        && core.body?.adminCoreModules === ADMIN_CORE_VERSION
        && core.body?.moduleContractVersion === MODULE_CONTRACT_VERSION
        && html.response.status === 200
        && html.response.headers.get('x-salamat-admin-core') === ADMIN_CORE_VERSION
        && html.text.includes('staff-module-router-v3.js?v=2.0.0');
      if (ready) return { core, html };
      last = JSON.stringify({
        coreStatus: core.response.status,
        core: core.body,
        htmlStatus: html.response.status,
        adminHeader: html.response.headers.get('x-salamat-admin-core'),
        routerPresent: html.text.includes('staff-module-router-v3.js?v=2.0.0'),
      });
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Admin core ${ADMIN_CORE_VERSION} did not become ready: ${last}`);
}
function cookieFrom(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  const raw = setCookies[0] || response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}
function moduleMap(access) {
  return new Map((access?.data?.modules || []).map((module) => [module.key, module]));
}
async function authed(cookie, path, expectedStatus = 200, method = 'GET') {
  const result = await request(path, { method, headers: { cookie } });
  expect(result.response.status === expectedStatus,
    `${method} ${path} returned ${result.response.status}; expected ${expectedStatus}: ${JSON.stringify(result.body)}`);
  return result;
}
async function authedUntil(cookie, path, predicate, description, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'no response';
  while (Date.now() < deadline) {
    const separator = path.includes('?') ? '&' : '?';
    try {
      const result = await request(`${path}${separator}smoke=${Date.now()}`, {
        headers: { cookie },
      });
      if (result.response.status === 200 && predicate(result)) return result;
      last = JSON.stringify({ status: result.response.status, body: result.body });
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Admin core production smoke failed: ${description}: ${last}`);
}

const { core, html } = await waitForCurrentAdminCore();
expect(Array.isArray(core.body?.features), 'admin core feature list is missing');
for (const feature of ['training', 'financial_credits', 'payroll', 'settings', 'audit_logs']) {
  expect(core.body.features.includes(feature), `admin core feature ${feature} is missing`);
}
for (const runtime of [
  'staff-module-router-v3.js?v=2.0.0',
  'staff-financial-credits-runtime-v2.js?v=2.0.0',
  'staff-payroll-runtime-v1.js?v=2.0.0',
  'staff-system-settings-runtime-v1.js?v=2.0.0',
]) {
  expect(html.text.includes(runtime), `live HTML is missing ${runtime}`);
}
passed('public.admin-core-current');
passed('public.runtime-bundle');

const login = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ identifier: rootUser.username, password }),
});
expect(login.response.status === 200, `root login returned ${login.response.status}: ${JSON.stringify(login.body)}`);
const cookie = cookieFrom(login.response);
expect(cookie.startsWith('salamat_session='), 'root login did not return the session cookie');
expect(login.body?.data?.role === 'ADMIN', `root login returned role ${login.body?.data?.role || 'unknown'}`);
passed('root.login');

const accessResult = await authed(cookie, '/api/access/me');
const access = accessResult.body;
expect(access?.data?.panel === 'STAFF', 'root account did not enter staff panel');
expect(access?.data?.moduleContractVersion === MODULE_CONTRACT_VERSION,
  `module contract is ${access?.data?.moduleContractVersion || 'unknown'}`);
const visible = moduleMap(access);
const expectedLabels = new Map([
  ['staff.payroll', 'حقوق و پرداخت'],
  ['staff.financial_credits', 'اعتبارات مالی'],
  ['staff.training', 'بانک آموزش'],
  ['staff.settings', 'تنظیمات و لاگ'],
]);
for (const [key, label] of expectedLabels) {
  expect(visible.has(key), `admin menu is missing ${key}`);
  expect(visible.get(key)?.label === label, `${key} label is ${visible.get(key)?.label || 'missing'} instead of ${label}`);
}
expect(!visible.has('staff.reports'), 'staff.reports is still visible to root admin');
const orderedKeys = (access?.data?.modules || []).map((module) => module.key);
const payrollIndex = orderedKeys.indexOf('staff.payroll');
const financeIndex = orderedKeys.indexOf('staff.financial_credits');
const trainingIndex = orderedKeys.indexOf('staff.training');
expect(payrollIndex >= 0 && financeIndex === payrollIndex + 1, 'financial credits is not immediately after payroll');
expect(trainingIndex > financeIndex, 'training bank is not a separate module after financial credits');
passed('root.menu-contract');

const configuration = (await authed(cookie, '/api/access/configuration')).body;
const configurationKeys = new Set((configuration?.data?.modules || []).map((module) => module.key));
expect(configuration?.data?.moduleContractVersion === MODULE_CONTRACT_VERSION, 'access configuration contract is incorrect');
expect(configurationKeys.has('staff.financial_credits'), 'permissions matrix is missing financial credits');
expect(!configurationKeys.has('staff.reports'), 'permissions matrix still contains reports');
passed('root.permissions-matrix');

const training = await authed(cookie, '/api/training/admin');
expect(Array.isArray(training.body?.data?.courses), 'training bank did not return courses');
expect(Array.isArray(training.body?.data?.assignments), 'training bank did not return assignments');
passed('root.training-bank');

const finance = await authed(cookie, '/api/staff/financial-credits');
expect(finance.body?.data && !Object.prototype.hasOwnProperty.call(finance.body.data, 'payroll'),
  'financial credits still contains payroll data');
expect(!Object.prototype.hasOwnProperty.call(finance.body?.data?.summary || {}, 'payrollIssued'),
  'financial credits summary still contains payroll counts');
passed('root.financial-credits');

const payroll = await authed(cookie, '/api/staff/payroll?page=1&pageSize=10');
expect(Array.isArray(payroll.body?.data?.slips), 'payroll module did not return slips');
expect(payroll.body?.data?.pagination, 'payroll module did not return pagination');
passed('root.payroll');

const legacyPayroll = await authed(cookie, '/api/staff/financial-credits/payroll', 410);
expect(legacyPayroll.body?.error === 'legacy_finance_payroll_removed',
  'legacy finance payroll route did not return the removal code');
passed('root.legacy-payroll-closed');

const settings = await authedUntil(
  cookie,
  '/api/staff/system-settings',
  (result) => result.body?.data?.settings?.systemName
    && result.body?.data?.version === ADMIN_CORE_VERSION,
  `system settings endpoint did not converge to ${ADMIN_CORE_VERSION}`,
);
expect(settings.body?.data?.settings?.systemName, 'persistent system settings are missing');
expect(settings.body?.data?.version === ADMIN_CORE_VERSION, 'system settings endpoint version is incorrect');
passed('root.system-settings');

const logs = await authed(cookie, '/api/staff/audit-logs?page=1&pageSize=10');
expect(Array.isArray(logs.body?.data?.logs), 'audit logs endpoint did not return a log list');
expect(logs.body?.data?.pagination, 'audit logs endpoint did not return pagination');
passed('root.audit-logs');

const logout = await request('/api/auth/logout', { method: 'POST', headers: { cookie } });
expect(logout.response.status === 200, `root logout returned ${logout.response.status}`);
const afterLogout = await request('/api/auth/me', { headers: { cookie } });
expect(afterLogout.response.status === 401, 'root smoke session remained valid after logout');
passed('root.logout');

const evidence = {
  adminCoreModules: ADMIN_CORE_VERSION,
  moduleContractVersion: MODULE_CONTRACT_VERSION,
  liveHeader: ADMIN_CORE_VERSION,
  visibleModules: [...expectedLabels.keys()],
  reportsRemoved: true,
  financePayrollSeparated: true,
  authenticatedProductionSmoke: true,
  checks,
  verifiedAt: new Date().toISOString(),
};
fs.mkdirSync('.admin-core-smoke', { recursive: true, mode: 0o700 });
fs.writeFileSync('.admin-core-smoke/result.json', JSON.stringify(evidence, null, 2), { mode: 0o600 });
console.log(`Authenticated admin core ${ADMIN_CORE_VERSION} production smoke passed with ${checks.length} checks.`);
