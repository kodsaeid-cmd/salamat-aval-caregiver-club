import fs from 'node:fs';

const [requestedBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
const ALLOWED_BASE_URL = 'https://salamatavalcaregivers.site';
if (!requestedBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-priority-api-smoke.mjs <base-url> <metadata-path>');
}
const normalizedRequestedBaseUrl = requestedBaseUrl.replace(/\/+$/, '');
if (normalizedRequestedBaseUrl !== ALLOWED_BASE_URL) {
  throw new Error(`API smoke target is not allowlisted: ${normalizedRequestedBaseUrl}`);
}

const baseUrl = ALLOWED_BASE_URL;
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
const caregiverUser = metadata.users?.caregiver;
const caregiverProfile = metadata.caregiverProfile;
if (!rootUser?.username || !caregiverUser?.username || !caregiverProfile?.id) {
  throw new Error('Root or isolated caregiver smoke identity is missing.');
}

const PLATFORM = '2.4.0';
const ROUTER = '5.0.0';
const ACCESS = '2.0.0';
const CONTRACTS = '1.0.0';
const CONTRACT_OWNER = '2.0.0';
const EXPECTED_MODULES = [
  'staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll',
  'staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings',
];
const ASSETS = [
  'contract-module-priority-v2.js','staff-module-router-v3.js','access-control-runtime-v2.js',
  'staff-contracts-runtime-v1.js','staff-financial-credits-runtime-v2.js','staff-payroll-runtime-v1.js',
  'staff-support-route-owner-v3.js','staff-support-direct-runtime-v3.js','server-notifications-runtime-v2.js','staff-system-settings-runtime-v1.js',
];
const checks = [];
const expect = (condition, message) => { if (!condition) throw new Error(`Admin priority API smoke failed: ${message}`); };
const passed = (check) => checks.push({ check, status: 'passed' });
const dateOffset = (days) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };

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
  const response = await fetch(`${baseUrl}/${file}?asset=${Date.now()}`, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  const text = await response.text();
  return { status: response.status, type: response.headers.get('content-type') || '', text };
}

function scriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}
function scriptIndex(scripts, file) {
  return scripts.findIndex((src) => {
    const path = src.split('?')[0];
    return path.endsWith(`/${file}`) || path === file || path === `./${file}`;
  });
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
      const scripts = scriptSources(html);
      const contractPriorityIndex = scriptIndex(scripts, 'contract-module-priority-v2.js');
      const routerIndex = scriptIndex(scripts, 'staff-module-router-v3.js');
      const accessIndex = scriptIndex(scripts, 'access-control-runtime-v2.js');
      const legacyContractIndex = scriptIndex(scripts, 'contract-module-priority-v1.js');
      const firstLegacyIndex = scripts.findIndex((src) => /(?:app\.js|backend-integration\.js|staff-role-bridge\.js|staff-platform-runtime\.js)(?:\?|$)/.test(src));
      const criticalOrder = contractPriorityIndex >= 0
        && routerIndex > contractPriorityIndex
        && accessIndex > routerIndex
        && legacyContractIndex < 0
        && (firstLegacyIndex < 0 || accessIndex < firstLegacyIndex);
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
        && htmlResponse.headers.get('x-salamat-contracts') === CONTRACTS
        && htmlResponse.headers.get('x-salamat-contract-route-owner') === CONTRACT_OWNER
        && scriptIndex(scripts, 'staff-contracts-runtime-v1.js') >= 0
        && criticalOrder && assetsReady;
      if (ready) return { version: version.body, assets, criticalScriptOrder: { contractPriorityIndex, routerIndex, accessIndex, firstLegacyIndex } };
      last = JSON.stringify({
        version: version.body,
        headers: {
          platform: htmlResponse.headers.get('x-salamat-caregiver-platform'),
          router: htmlResponse.headers.get('x-salamat-admin-router'),
          priority: htmlResponse.headers.get('x-salamat-router-priority'),
          access: htmlResponse.headers.get('x-salamat-access-control'),
          contracts: htmlResponse.headers.get('x-salamat-contracts'),
          contractOwner: htmlResponse.headers.get('x-salamat-contract-route-owner'),
        }, criticalOrder, criticalScriptOrder: { contractPriorityIndex, routerIndex, accessIndex, firstLegacyIndex, legacyContractIndex },
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
async function login(identifier) {
  const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  expect(result.response.status === 200, `login returned ${result.response.status}: ${JSON.stringify(result.body)}`);
  const cookie = sessionCookie(result.response);
  expect(cookie.startsWith('salamat_session='), 'session cookie missing');
  return { cookie, body: result.body };
}
async function authedRequest(cookie, path, options = {}, expected = 200) {
  const result = await request(path, { ...options, headers: { ...(options.headers || {}), cookie } });
  expect(result.response.status === expected, `${options.method || 'GET'} ${path} returned ${result.response.status}; expected ${expected}: ${JSON.stringify(result.body)}`);
  return result.body;
}

const release = await waitForRelease();
passed('release.head-first-assets');
const rootSession = await login(rootUser.username);
expect(rootSession.body?.data?.role === 'ADMIN', 'root smoke account did not login as admin');
const rootCookie = rootSession.cookie;
passed('root.login');
const access = await authedRequest(rootCookie, '/api/access/me');
const moduleKeys = (access?.data?.modules || []).map((module) => module.key);
expect(JSON.stringify(moduleKeys) === JSON.stringify(EXPECTED_MODULES), `module order differs: ${JSON.stringify(moduleKeys)}`);
passed('root.ten-module-contract');
const users = await authedRequest(rootCookie, '/api/users?page=1'); expect(Array.isArray(users?.data), 'users endpoint invalid'); passed('root.users');
const caregiverDirectory = await authedRequest(rootCookie, `/api/staff/contracts/caregivers?q=${encodeURIComponent(caregiverProfile.membershipCode)}&page=1&pageSize=10`);
expect(Array.isArray(caregiverDirectory?.data?.caregivers), 'contracts caregiver search endpoint invalid');
expect(caregiverDirectory.data.caregivers.some((item) => item.id === caregiverProfile.id), 'isolated caregiver profile was not searchable');
passed('root.contract-caregivers');
const initialContracts = await authedRequest(rootCookie, `/api/staff/contracts?caregiverId=${encodeURIComponent(caregiverProfile.id)}&page=1&pageSize=10`);
expect(Array.isArray(initialContracts?.data?.contracts), 'contracts list endpoint invalid');
passed('root.contracts-list');

const startsAt = dateOffset(0);
const endsAt = dateOffset(21);
const contractPayload = {
  caregiverId: caregiverProfile.id,
  contractNumber: `RC-CONTRACT-${metadata.runId}`,
  serviceType: 'مراقبت سالمند آزمون انتشار',
  status: 'ACTIVE', startsAt, endsAt,
  workDays: ['SATURDAY','SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'],
  subscriberFirstName: 'مشترک', subscriberLastName: 'آزمایشی',
  subscriberPhonePrimary: '09120000000', subscriberPhoneSecondary: '02100000000',
  subscriberNationalId: '0012345678', subscriberBirthDate: '1950-01-01',
  recipientSameAsSubscriber: true,
  recipientFirstName: '', recipientLastName: '', recipientPhonePrimary: '', recipientPhoneSecondary: '',
  recipientNationalId: '', recipientBirthDate: '', subscriberRelationToRecipient: '',
  notes: 'قرارداد موقت Smoke؛ باید در Cleanup حذف شود.',
};
const created = await authedRequest(rootCookie, '/api/staff/contracts', { method: 'POST', body: JSON.stringify(contractPayload) }, 201);
const contractId = created?.data?.id;
expect(contractId, 'contract create did not return an id');
passed('root.contract-create');
const createdList = await authedRequest(rootCookie, `/api/staff/contracts?caregiverId=${encodeURIComponent(caregiverProfile.id)}&page=1&pageSize=20`);
const createdRow = (createdList?.data?.contracts || []).find((item) => item.id === contractId);
expect(createdRow, 'created contract was not returned by list');
expect(createdRow.recipientSameAsSubscriber === true, 'same-as-subscriber flag was not persisted');
expect(createdRow.recipientFirstName === contractPayload.subscriberFirstName && createdRow.recipientLastName === contractPayload.subscriberLastName, 'recipient identity was not copied from subscriber');
expect(createdRow.recipientNationalId === contractPayload.subscriberNationalId && createdRow.subscriberRelationToRecipient === 'خود', 'same-as-subscriber protected fields were not copied');
passed('root.contract-same-subscriber');
const updated = await authedRequest(rootCookie, `/api/staff/contracts/${encodeURIComponent(contractId)}`, {
  method: 'PATCH', body: JSON.stringify({ serviceType: 'مراقبت سالمند و همراهی آزمون', notes: 'ویرایش Smoke' }),
});
expect(updated?.data?.id === contractId, 'contract patch did not return the contract id');
const updatedList = await authedRequest(rootCookie, `/api/staff/contracts?caregiverId=${encodeURIComponent(caregiverProfile.id)}&page=1&pageSize=20`);
const updatedRow = (updatedList?.data?.contracts || []).find((item) => item.id === contractId);
expect(updatedRow?.serviceType === 'مراقبت سالمند و همراهی آزمون', 'contract patch was not persisted');
passed('root.contract-update');

const caregiverSession = await login(caregiverUser.username);
expect(caregiverSession.body?.data?.role === 'CAREGIVER', 'isolated caregiver account did not login as caregiver');
const caregiverCookie = caregiverSession.cookie;
const calendar = await authedRequest(caregiverCookie, `/api/calendar?start=${startsAt}&end=${endsAt}`);
const contractEvents = (calendar?.data?.events || []).filter((event) => event.contractId === contractId && event.source === 'CONTRACT');
expect(contractEvents.length === 7, `caregiver calendar returned ${contractEvents.length} contract weekday events instead of 7`);
expect(contractEvents.every((event) => event.readOnly === true && event.recurrence === 'WEEKLY' && event.repeatUntil === endsAt), 'contract calendar events are not protected weekly events');
expect(calendar?.data?.contractCalendar?.source === 'contracts', 'calendar contract source metadata is missing');
passed('caregiver.contract-calendar-feed');

await authedRequest(rootCookie, `/api/staff/contracts/${encodeURIComponent(contractId)}`, { method: 'DELETE' });
const calendarAfterDelete = await authedRequest(caregiverCookie, `/api/calendar?start=${startsAt}&end=${endsAt}`);
expect(!(calendarAfterDelete?.data?.events || []).some((event) => event.contractId === contractId), 'deleted contract remained in caregiver calendar');
passed('root.contract-delete-calendar-removal');

const training = await authedRequest(rootCookie, '/api/training/admin'); expect(Array.isArray(training?.data?.courses), 'training endpoint invalid'); passed('root.training');
const finance = await authedRequest(rootCookie, '/api/staff/financial-credits'); expect(finance?.data && !Object.hasOwn(finance.data, 'payroll'), 'finance endpoint invalid'); passed('root.finance');
const payroll = await authedRequest(rootCookie, '/api/staff/payroll?page=1&pageSize=10'); expect(Array.isArray(payroll?.data?.slips), 'payroll endpoint invalid'); passed('root.payroll');
const settings = await authedRequest(rootCookie, '/api/staff/system-settings'); expect(settings?.data?.settings?.systemName, 'settings endpoint invalid'); passed('root.settings');
const logs = await authedRequest(rootCookie, '/api/staff/audit-logs?page=1&pageSize=20');
expect(Array.isArray(logs?.data?.logs), 'audit endpoint invalid');
expect(logs.data.logs.some((item) => item.entityId === contractId && item.action === 'DELETE_CONTRACT'), 'contract lifecycle audit log is missing');
passed('root.contract-audit');
await authedRequest(caregiverCookie, '/api/auth/logout', { method: 'POST' });
await authedRequest(rootCookie, '/api/auth/logout', { method: 'POST' });
passed('sessions.logout');

fs.mkdirSync('.admin-core-smoke', { recursive: true, mode: 0o700 });
fs.writeFileSync('.admin-core-smoke/priority-api-result.json', JSON.stringify({
  platform: PLATFORM, router: ROUTER, routerPriority: 'head-first', accessControl: ACCESS, contracts: CONTRACTS, contractOwner: CONTRACT_OWNER,
  visibleModules: EXPECTED_MODULES, assets: ASSETS, criticalScriptOrder: release.criticalScriptOrder, contractLifecycle: {
    caregiverId: caregiverProfile.id, created: true, sameSubscriberCopied: true, updated: true,
    calendarWeekdayEvents: contractEvents.length, deletedAndRemovedFromCalendar: true, audited: true,
  }, checks, verifiedAt: new Date().toISOString(),
}, null, 2), { mode: 0o600 });
console.log(`Admin priority API smoke passed with ${checks.length} checks.`);
