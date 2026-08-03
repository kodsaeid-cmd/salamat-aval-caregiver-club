import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [outputDirectory, rawRunId, password] = process.argv.slice(2);
if (!outputDirectory || !rawRunId || !password) {
  throw new Error('Usage: node scripts/prepare-release-smoke-fixtures.mjs <output-directory> <run-id> <password>');
}
if (password.length < 20) throw new Error('The ephemeral smoke-test password must be at least 20 characters.');

const runId = rawRunId.replace(/[^a-zA-Z0-9]/g, '').slice(-32) || crypto.randomUUID().replaceAll('-', '');
const timestamp = new Date().toISOString();
const salt = crypto.randomBytes(16);
const digest = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
const passwordHash = `pbkdf2-sha256$100000$${salt.toString('hex')}$${digest.toString('hex')}`;
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const users = [
  {
    key: 'root',
    id: `RC-${runId}-ROOT`,
    fullName: 'آزمون انتشار مدیر اصلی',
    username: `rc-root-${runId}@invalid.local`,
    mobile: `internal-rc-${runId}-root`,
    role: 'ADMIN',
    permissionsJson: '["*"]',
  },
  {
    key: 'limitedAdmin',
    id: `RC-${runId}-LIMITED`,
    fullName: 'آزمون انتشار مدیر محدود',
    username: `rc-limited-${runId}@invalid.local`,
    mobile: `internal-rc-${runId}-limited`,
    role: 'ADMIN',
    permissionsJson: '[]',
  },
  {
    key: 'evaluator',
    id: `RC-${runId}-EVALUATOR`,
    fullName: 'آزمون انتشار ارزیاب',
    username: `rc-evaluator-${runId}@invalid.local`,
    mobile: `internal-rc-${runId}-evaluator`,
    role: 'EVALUATOR',
    permissionsJson: '[]',
  },
  {
    key: 'recruiter',
    id: `RC-${runId}-RECRUITER`,
    fullName: 'آزمون انتشار کارشناس جذب',
    username: `rc-recruiter-${runId}@invalid.local`,
    mobile: `internal-rc-${runId}-recruiter`,
    role: 'RECRUITER',
    permissionsJson: '[]',
  },
  {
    key: 'caregiver',
    id: `RC-${runId}-CAREGIVER`,
    fullName: 'آزمون انتشار مراقب',
    username: `rc-caregiver-${runId}@invalid.local`,
    mobile: `internal-rc-${runId}-caregiver`,
    role: 'CAREGIVER',
    permissionsJson: '[]',
  },
];

const moduleKeys = [
  'staff.dashboard', 'staff.users', 'staff.caregivers', 'staff.contracts', 'staff.payroll',
  'staff.training', 'staff.evaluations', 'staff.support', 'staff.reports', 'staff.settings',
  'caregiver.dashboard', 'caregiver.scorecard', 'caregiver.rank', 'caregiver.wallet',
  'caregiver.payroll', 'caregiver.contracts', 'caregiver.training', 'caregiver.support',
  'caregiver.security', 'caregiver.calendar',
];

const fixtureStatements = [
  'PRAGMA foreign_keys=ON',
  `CREATE TABLE IF NOT EXISTS user_module_permissions (
    user_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    can_view INTEGER,
    can_create INTEGER,
    can_update INTEGER,
    can_delete INTEGER,
    updated_by_user_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,module_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
];

for (const user of users) {
  fixtureStatements.push(`INSERT INTO users(
    id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at
  ) VALUES(
    ${sql(user.id)},NULL,${sql(user.fullName)},${sql(user.mobile)},${sql(user.username)},
    ${sql(passwordHash)},${sql(user.role)},'ACTIVE',${sql(user.permissionsJson)},${sql(timestamp)},${sql(timestamp)}
  )`);
}

const limited = users.find((user) => user.key === 'limitedAdmin');
for (const moduleKey of moduleKeys) {
  const canView = ['staff.dashboard', 'staff.caregivers'].includes(moduleKey) ? 1 : 0;
  fixtureStatements.push(`INSERT OR REPLACE INTO user_module_permissions(
    user_id,module_key,can_view,can_create,can_update,can_delete,updated_by_user_id,updated_at
  ) VALUES(
    ${sql(limited.id)},${sql(moduleKey)},${canView},0,0,0,${sql(users[0].id)},${sql(timestamp)}
  )`);
}

const ids = users.map((user) => sql(user.id)).join(',');
const cleanupStatements = [
  'PRAGMA foreign_keys=ON',
  `DELETE FROM sessions WHERE user_id IN (${ids})`,
  `DELETE FROM user_module_permissions WHERE user_id IN (${ids}) OR updated_by_user_id IN (${ids})`,
  `UPDATE users SET status='DELETED',username='deleted-' || id,mobile='deleted-' || id,updated_at=${sql(timestamp)} WHERE id IN (${ids})`,
  `DELETE FROM users WHERE id IN (${ids})`,
];

fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(outputDirectory, 'fixtures.sql'), `${fixtureStatements.join(';\n')};\n`, { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'cleanup.sql'), `${cleanupStatements.join(';\n')};\n`, { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'meta.json'), JSON.stringify({
  runId,
  createdAt: timestamp,
  users: Object.fromEntries(users.map((user) => [user.key, {
    id: user.id,
    username: user.username,
    role: user.role,
  }])),
}, null, 2), { mode: 0o600 });

console.log(`Prepared ${users.length} isolated release-smoke identities for run ${runId}.`);
