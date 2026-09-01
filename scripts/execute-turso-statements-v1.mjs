import fs from 'node:fs';

const [statementsPath] = process.argv.slice(2);
const platformToken = String(process.env.TURSO_PLATFORM_API_TOKEN || '').trim();
const databaseName = String(process.env.TURSO_DATABASE_NAME || 'salamat-aval-caregiver-club').trim();

if (!statementsPath) throw new Error('Usage: node scripts/execute-turso-statements-v1.mjs <statements.json>');
if (!platformToken) throw new Error('TURSO_PLATFORM_API_TOKEN is required.');
if (!databaseName) throw new Error('TURSO_DATABASE_NAME is required.');

const statements = JSON.parse(fs.readFileSync(statementsPath, 'utf8'));
if (!Array.isArray(statements) || !statements.length || statements.some((sql) => typeof sql !== 'string' || !sql.trim())) {
  throw new Error('Statement file must contain a non-empty JSON array of SQL strings.');
}

async function platform(path, options = {}) {
  const response = await fetch(`https://api.turso.tech/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${platformToken}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) throw new Error(`Turso Platform API ${path} failed with HTTP ${response.status}.`);
  return payload;
}

const organizationsPayload = await platform('/organizations');
const organizations = Array.isArray(organizationsPayload)
  ? organizationsPayload
  : Array.isArray(organizationsPayload?.organizations) ? organizationsPayload.organizations : [];
const organization = organizations.find((item) => item?.type === 'personal') || organizations[0];
const organizationSlug = String(organization?.slug || '').trim();
if (!organizationSlug) throw new Error('No Turso organization is available for the configured platform token.');

const databasePayload = await platform(`/organizations/${encodeURIComponent(organizationSlug)}/databases/${encodeURIComponent(databaseName)}`);
const database = databasePayload?.database || databasePayload || {};
const hostname = String(database.Hostname || database.hostname || database.host || '').trim();
if (!hostname) throw new Error(`Turso database ${databaseName} did not return a hostname.`);

const tokenPayload = await platform(
  `/organizations/${encodeURIComponent(organizationSlug)}/databases/${encodeURIComponent(databaseName)}/auth/tokens?expiration=10m&authorization=full-access`,
  { method: 'POST' },
);
const databaseToken = String(tokenPayload?.jwt || '').trim();
if (!databaseToken) throw new Error('Turso did not return a temporary database auth token.');
console.log(`::add-mask::${databaseToken}`);

const requests = [];
let start = 0;
if (/^\s*PRAGMA\s+/i.test(statements[0])) {
  requests.push({ type: 'execute', stmt: { sql: statements[0] } });
  start = 1;
}
requests.push({ type: 'execute', stmt: { sql: 'BEGIN IMMEDIATE' } });
for (let index = start; index < statements.length; index += 1) {
  requests.push({ type: 'execute', stmt: { sql: statements[index] } });
}
requests.push({ type: 'execute', stmt: { sql: 'COMMIT' } });
requests.push({ type: 'close' });

const response = await fetch(`https://${hostname}/v2/pipeline`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${databaseToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ requests }),
});
const payload = await response.json().catch(() => null);
if (!response.ok) throw new Error(`Turso SQL pipeline failed with HTTP ${response.status}.`);
const results = Array.isArray(payload?.results) ? payload.results : [];
const failure = results.find((item) => item?.type === 'error');
if (failure) throw new Error(`Turso SQL pipeline failed: ${failure.error?.message || failure.error?.code || 'unknown SQL error'}`);

console.log(`Executed ${statements.length} isolated smoke statements against Turso database ${databaseName}.`);
