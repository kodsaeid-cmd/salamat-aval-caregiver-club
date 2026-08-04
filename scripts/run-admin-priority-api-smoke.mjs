import fs from 'node:fs';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-priority-api-smoke.mjs <base-url> <metadata-path>');
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing.');

const PLATFORM = '2.4.0';
const ROUTER = '5.0.0';
const ACCESS = '2.0.0';
const EXPECTED_MODULES = [
  'staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll',
  'staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings',
];
const ASSETS = [
  'staff-module-router-v3.js','access-control-runtime-v2.js','staff-financial-credits-runtime-v2.js',
  'staff-payroll-runtime-v1.js','staff-support-runtime-v1.js','staff-system-settings-runtime-v1.js',
];
const checks = [];
const expect = (condition, message) => { if (!condition) throw new Error(`Admin priority API smoke failed: ${message}`); };
const passed = (check) => checks.push({ check, status: 'passed' });

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual', cache: 'no-store', ...options,
    headers: { accept: 'application/json', 'cache-control': 'no-cache', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
  return { response, body, text };
}

async function asset(file) {
  const response = await fetch(`${baseUrl}/${file}?v=${PLATFORM}&asset=${Date.now()}`, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  const text = await response.text();
  return { status: response.status, type: response.headers.get('content-type') || '', text };
}

async function waitForRelease() {
  const deadline = Date.now() + 240_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const version = await request(`/api/system/version?priority=${Date.now()}`);
      const htmlResponse = await fetch(`${baseUrl}/?priority=${Date.now()}`, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
      const html = await htmlResponse.text();
      const assets = Object.fromEntries(await Promise.all(ASSETS.map(async (file) => [file, await asset(file)])));
      const routerTag = `staff-module-router-v3.js?v=${PLATFORM}`;
      const accessTag = `access-control-runtime-v2.js?v=${PLATFORM}`;
      const firstLegacy = Math.min(...['app.js','backend-integration.js','staff-role-bridge.js','staff-platform-runtime.js']
        .map((name) => html.indexOf(name)).filter((index) => index >= 0));
      const criticalOrder = html.indexOf(routerTag) >= 0 && html.indexOf(accessTag) > html.indexOf(routerTag)
        && (firstLegacy === Infinity || html.indexOf(accessTag) < firstLegacy);
      const assetsReady = ASSETS.every((file) => assets[file].status === 200
        && /javascript|text\/plain/.test(assets[file].type)
        && !/<html/i.test(assets[file].text.slice(0, 160)));
      const ready = version.response.status === 200
        && version.body?.caregiverPlatform === PLATFORM
        && version.body?.adminRouter === ROUTER
        && version.body?.routerPriority === 'head-first'
        && version.body?.accessControl === ACCESS
        && version.body?.frontendContract === 'caregiver-platform-v2-router-v5-head-first'
        && htmlResponse.status === 200
        && htmlResponse.headers.get('x-salamat-caregiver-platform') === PLATFORM
        && htmlResponse.headers.get('x-salamat-admin-router') === ROUTER
        && htmlResponse.headers.get('x-salamat-router-priority') === 'head-first'
        && htmlResponse.headers.get('x-salamat-access-control') === ACCESS
        && criticalOrder && assetsReady;
      if (ready) return { version: version.body, assets };
      last = JSON.stringify({
        version: version.body,
        headers: {
          platform: htmlResponse.headers.get('x-salamat-caregiver-platform'),
          router: htmlResponse.headers.get('x-salamat-admin-router'),
          priority: htmlResponse.headers.get('x-salamat-router-priority'),
          access: htmlResponse.headers.get('x-salamat-access-control'),
        }, criticalOrder,
        assets: Object.fromEntries(ASSETS.map((file) => [file, { status: assets[file].status, type: assets[file].type }])),
      });
    } catch (error) { last = String(error); }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Admin priority API smoke failed: release did not converge: ${last}`);
}

function sessionCookie(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return (values[0] || response.headers.get('set-cookie') || '').split(';')[0];
}
async function authed(cookie, path, expected = 200) {
  const result = await request(path, { headers: { cookie } });
  expect(result.response.status === expected, `${path} returned ${result.response.status}; expected ${expected}: ${JSON.stringify(result.body)}`);
  return result.body;
}

await waitForRelease();
passed('release.head-first-assets');
const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: rootUser.username, password }) });
expect(login.response.status === 200, `login returned ${login.response.status}: ${JSON.stringify(login.body)}`);
const cookie = sessionCookie(login.response);
expect(cookie.startsWith('salamat_session='), 'session cookie missing');
passed('root.login');
const access = await authed(cookie, '/api/access/me');
const moduleKeys = (access?.data?.modules || []).map((module) => module.key);
expect(JSON.stringify(moduleKeys) === JSON.stringify(EXPECTED_MODULES), `module order differs: ${JSON.stringify(moduleKeys)}`);
passed('root.ten-module-contract');
const users = await authed(cookie, '/api/users?page=1'); expect(Array.isArray(users?.data), 'users endpoint invalid'); passed('root.users');
const training = await authed(cookie, '/api/training/admin'); expect(Array.isArray(training?.data?.courses), 'training endpoint invalid'); passed('root.training');
const finance = await authed(cookie, '/api/staff/financial-credits'); expect(finance?.data && !Object.hasOwn(finance.data, 'payroll'), 'finance endpoint invalid'); passed('root.finance');
const payroll = await authed(cookie, '/api/staff/payroll?page=1&pageSize=10'); expect(Array.isArray(payroll?.data?.slips), 'payroll endpoint invalid'); passed('root.payroll');
const settings = await authed(cookie, '/api/staff/system-settings'); expect(settings?.data?.settings?.systemName, 'settings endpoint invalid'); passed('root.settings');
const logs = await authed(cookie, '/api/staff/audit-logs?page=1&pageSize=10'); expect(Array.isArray(logs?.data?.logs), 'audit endpoint invalid'); passed('root.audit');
const logout = await request('/api/auth/logout', { method: 'POST', headers: { cookie } }); expect(logout.response.status === 200, 'logout failed'); passed('root.logout');

fs.mkdirSync('.admin-core-smoke', { recursive: true, mode: 0o700 });
fs.writeFileSync('.admin-core-smoke/priority-api-result.json', JSON.stringify({
  platform: PLATFORM, router: ROUTER, routerPriority: 'head-first', accessControl: ACCESS,
  visibleModules: EXPECTED_MODULES, assets: ASSETS, checks, verifiedAt: new Date().toISOString(),
}, null, 2), { mode: 0o600 });
console.log(`Admin priority API smoke passed with ${checks.length} checks.`);
