import fs from 'node:fs';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.RELEASE_SMOKE_PASSWORD || '';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: RELEASE_SMOKE_PASSWORD=... node scripts/run-release-role-smoke.mjs <base-url> <metadata-path>');
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const results = [];

function expect(condition, message) {
  if (!condition) throw new Error(`Production role smoke test failed: ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
  return { response, body };
}

async function login(key) {
  const user = metadata.users[key];
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: user.username, password }),
  });
  expect(response.status === 200, `${key} login returned ${response.status}: ${JSON.stringify(body)}`);
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  const rawCookie = setCookies[0] || response.headers.get('set-cookie') || '';
  const cookie = rawCookie.split(';')[0];
  expect(cookie.startsWith('salamat_session='), `${key} login did not return a secure session cookie`);
  expect(body?.data?.role === user.role, `${key} login returned role ${body?.data?.role} instead of ${user.role}`);
  results.push({ check: `${key}.login`, status: 'passed' });
  return { user, cookie };
}

async function authed(session, path, expectedStatus = 200, method = 'GET') {
  const result = await request(path, { method, headers: { cookie: session.cookie } });
  expect(result.response.status === expectedStatus,
    `${session.user.role} ${method} ${path} returned ${result.response.status}; expected ${expectedStatus}: ${JSON.stringify(result.body)}`);
  return result.body;
}

function moduleKeys(access) {
  return new Set((access?.data?.modules || []).map((module) => module.key));
}

async function logout(key, session) {
  const result = await request('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: session.cookie },
  });
  expect(result.response.status === 200, `${key} logout returned ${result.response.status}`);
  const after = await request('/api/auth/me', { headers: { cookie: session.cookie } });
  expect(after.response.status === 401, `${key} session remained valid after logout`);
  results.push({ check: `${key}.logout`, status: 'passed' });
}

const version = await request('/api/system/version');
expect(version.response.status === 200, `release endpoint returned ${version.response.status}`);
expect(version.body?.release === '0.1.0-rc.1', `deployed release is ${version.body?.release || 'unknown'}`);
expect(version.body?.evaluationProtectionSchema === 'EVAL-PROTECT-1.0.0', 'deployed evaluation protection schema is incorrect');
results.push({ check: 'release.version', status: 'passed' });

const sessions = {};
for (const key of ['root', 'limitedAdmin', 'evaluator', 'recruiter', 'caregiver']) {
  sessions[key] = await login(key);
}

const rootAccess = await authed(sessions.root, '/api/access/me');
expect(rootAccess?.data?.user?.protectedRoot === true, 'root account is not protected');
expect(rootAccess?.data?.panel === 'STAFF', 'root account did not enter the staff panel');
expect(moduleKeys(rootAccess).has('staff.users'), 'root account cannot view users and permissions');

let protectionHealth = await authed(sessions.root, '/api/admin/evaluation-protection/health');
for (let attempt = 0; attempt < 10 && protectionHealth?.data?.status !== 'healthy'; attempt += 1) {
  await authed(sessions.root, '/api/admin/evaluation-protection/backfill?limit=200', 200, 'POST');
  protectionHealth = await authed(sessions.root, '/api/admin/evaluation-protection/health');
}
expect(protectionHealth?.status === 'ok', 'evaluation protection health endpoint did not return ok');
expect(protectionHealth?.data?.status === 'healthy', `evaluation protection requires attention: ${JSON.stringify(protectionHealth?.data)}`);
expect(Number(protectionHealth?.data?.counts?.finalWithoutSnapshot || 0) === 0, 'a finalized evaluation has no immutable snapshot');
expect(Number(protectionHealth?.data?.counts?.scoresWithoutRevision || 0) === 0, 'an evaluation score has no revision history');
expect(Number(protectionHealth?.data?.counts?.orphanScores || 0) === 0, 'an orphan evaluation score exists');
expect((protectionHealth?.data?.snapshotHashes?.mismatches || []).length === 0, 'a scorecard snapshot hash mismatch exists');
results.push({ check: 'root.protection-health', status: 'passed' });

const limitedAccess = await authed(sessions.limitedAdmin, '/api/access/me');
const limitedModules = moduleKeys(limitedAccess);
expect(limitedModules.has('staff.dashboard'), 'limited admin cannot view dashboard');
expect(limitedModules.has('staff.caregivers'), 'limited admin cannot view caregiver records');
expect(!limitedModules.has('staff.users'), 'limited admin unexpectedly retains user administration');
expect(!limitedModules.has('staff.evaluations'), 'limited admin unexpectedly retains evaluation administration');
await authed(sessions.limitedAdmin, '/api/users', 403);
await authed(sessions.limitedAdmin, '/api/admin/evaluation-protection/health', 403);
await authed(sessions.limitedAdmin, '/api/admin/caregivers-page?page=1');
results.push({ check: 'limited-admin.boundary', status: 'passed' });

const evaluatorAccess = await authed(sessions.evaluator, '/api/access/me');
const evaluatorModules = moduleKeys(evaluatorAccess);
expect(evaluatorModules.has('staff.evaluations'), 'evaluator cannot view evaluation module');
expect(evaluatorModules.has('staff.caregivers'), 'evaluator cannot view caregiver records');
expect(!evaluatorModules.has('staff.users'), 'evaluator unexpectedly has user administration');
await authed(sessions.evaluator, '/api/admin/caregivers-page?page=1');
results.push({ check: 'evaluator.access', status: 'passed' });

const recruiterAccess = await authed(sessions.recruiter, '/api/access/me');
const recruiterModules = moduleKeys(recruiterAccess);
expect(recruiterModules.has('staff.caregivers'), 'recruiter cannot view caregiver records');
expect(recruiterModules.has('staff.users'), 'recruiter cannot view account workflow');
expect(recruiterModules.has('staff.evaluations'), 'recruiter cannot view evaluation workflow');
expect(!recruiterModules.has('staff.payroll'), 'recruiter unexpectedly has payroll access');
results.push({ check: 'recruiter.access', status: 'passed' });

const caregiverAccess = await authed(sessions.caregiver, '/api/access/me');
const caregiverModules = moduleKeys(caregiverAccess);
expect(caregiverAccess?.data?.panel === 'CAREGIVER', 'caregiver did not enter the caregiver panel');
expect(caregiverModules.has('caregiver.dashboard'), 'caregiver dashboard is missing');
expect(caregiverModules.has('caregiver.scorecard'), 'caregiver scorecard is missing');
expect(!caregiverModules.has('staff.caregivers'), 'caregiver unexpectedly sees the staff caregiver directory');
await authed(sessions.caregiver, '/api/admin/evaluation-protection/health', 403);
results.push({ check: 'caregiver.panel', status: 'passed' });

for (const key of ['root', 'limitedAdmin', 'evaluator', 'recruiter', 'caregiver']) {
  await logout(key, sessions[key]);
}

fs.writeFileSync('.release-smoke/result.json', JSON.stringify({
  release: version.body,
  evaluationProtection: protectionHealth.data,
  verifiedAt: new Date().toISOString(),
  checks: results,
}, null, 2));
console.log(`Production role smoke test passed with ${results.length} checks.`);
