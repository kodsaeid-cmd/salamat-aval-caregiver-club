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
const numericSeed = BigInt(`0x${crypto.createHash('sha256').update(runId).digest('hex').slice(0, 15)}`).toString();
const caregiverProfile = {
  id: `RC-${runId}-CARE-PROFILE`,
  crmRecordId: `RC-CRM-${runId}`,
  membershipCode: `RC-CARE-${runId}`,
  nationalId: numericSeed.slice(0, 10).padEnd(10, '7'),
  fullName: 'آزمون انتشار مراقب قرارداد',
  mobile: `09${numericSeed.slice(0, 9).padEnd(9, '4')}`,
  birthDate: '1990-01-01',
};
const pendingRegistrationProfile = {
  id: `RC-${runId}-PENDING-PROFILE`,
  crmRecordId: `RC-PENDING-CRM-${runId}`,
  membershipCode: `RC-PENDING-${runId}`,
  nationalId: numericSeed.slice(-10).padStart(10, '6'),
  fullName: 'آزمون انتشار ثبت نام مستقیم',
  mobile: `09${numericSeed.slice(-9).padStart(9, '5')}`,
  birthDate: '1992-02-02',
};

const users = [
  { key: 'root', id: `RC-${runId}-ROOT`, caregiverId: null, fullName: 'آزمون انتشار مدیر اصلی', username: `rc-root-${runId}@invalid.local`, mobile: `internal-rc-${runId}-root`, role: 'ADMIN', status: 'ACTIVE', permissionsJson: '["*"]' },
  { key: 'limitedAdmin', id: `RC-${runId}-LIMITED`, caregiverId: null, fullName: 'آزمون انتشار مدیر محدود', username: `rc-limited-${runId}@invalid.local`, mobile: `internal-rc-${runId}-limited`, role: 'ADMIN', status: 'ACTIVE', permissionsJson: '[]' },
  { key: 'evaluator', id: `RC-${runId}-EVALUATOR`, caregiverId: null, fullName: 'آزمون انتشار ارزیاب', username: `rc-evaluator-${runId}@invalid.local`, mobile: `internal-rc-${runId}-evaluator`, role: 'EVALUATOR', status: 'ACTIVE', permissionsJson: '[]' },
  { key: 'recruiter', id: `RC-${runId}-RECRUITER`, caregiverId: null, fullName: 'آزمون انتشار کارشناس جذب', username: `rc-recruiter-${runId}@invalid.local`, mobile: `internal-rc-${runId}-recruiter`, role: 'RECRUITER', status: 'ACTIVE', permissionsJson: '[]' },
  { key: 'caregiver', id: `RC-${runId}-CAREGIVER`, caregiverId: caregiverProfile.id, fullName: 'آزمون انتشار مراقب', username: `rc-caregiver-${runId}@invalid.local`, mobile: `internal-rc-${runId}-caregiver`, role: 'CAREGIVER', status: 'ACTIVE', permissionsJson: '[]' },
  { key: 'pendingCaregiver', id: `RC-${runId}-PENDING-CAREGIVER`, caregiverId: pendingRegistrationProfile.id, fullName: pendingRegistrationProfile.fullName, username: `rc-pending-${runId}@invalid.local`, mobile: pendingRegistrationProfile.mobile, role: 'CAREGIVER', status: 'PENDING', permissionsJson: '[]' },
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
  `INSERT INTO caregivers(
    id,crm_record_id,membership_code,national_id,full_name,mobile,birth_date,city,service_region,
    cooperation_status,active,primary_type,skills_json,work_history,recruitment_stage,
    professional_level,profile_completed,last_synced_at,created_at,updated_at
  ) VALUES(
    ${sql(caregiverProfile.id)},${sql(caregiverProfile.crmRecordId)},${sql(caregiverProfile.membershipCode)},
    ${sql(caregiverProfile.nationalId)},${sql(caregiverProfile.fullName)},${sql(caregiverProfile.mobile)},
    ${sql(caregiverProfile.birthDate)},'تهران','آزمون انتشار','ACTIVE',1,'مراقبت سالمند','[]',
    'پرونده موقت Smoke','APPROVED','LEVEL_1',1,${sql(timestamp)},${sql(timestamp)},${sql(timestamp)}
  )`,
  `INSERT INTO caregivers(
    id,crm_record_id,membership_code,national_id,full_name,mobile,birth_date,city,service_region,
    cooperation_status,active,primary_type,skills_json,work_history,recruitment_stage,
    professional_level,profile_completed,last_synced_at,created_at,updated_at
  ) VALUES(
    ${sql(pendingRegistrationProfile.id)},${sql(pendingRegistrationProfile.crmRecordId)},${sql(pendingRegistrationProfile.membershipCode)},
    ${sql(pendingRegistrationProfile.nationalId)},${sql(pendingRegistrationProfile.fullName)},${sql(pendingRegistrationProfile.mobile)},
    ${sql(pendingRegistrationProfile.birthDate)},'تهران','آزمون ثبت نام مستقیم','مراقبت سالمند',1,'مراقبت سالمند','[]',
    'پرونده موقت ثبت نام مستقیم Smoke','SELF_REGISTERED','NEW',1,${sql(timestamp)},${sql(timestamp)},${sql(timestamp)}
  )`,
];

for (const user of users) {
  fixtureStatements.push(`INSERT INTO users(
    id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at
  ) VALUES(
    ${sql(user.id)},${user.caregiverId ? sql(user.caregiverId) : 'NULL'},${sql(user.fullName)},${sql(user.mobile)},${sql(user.username)},
    ${sql(passwordHash)},${sql(user.role)},${sql(user.status)},${sql(user.permissionsJson)},${sql(timestamp)},${sql(timestamp)}
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
const deletedUsername = (user) => sql(`deleted-smoke-${runId}-${user.key}@invalid.local`);
const deletedMobile = (user) => sql(`deleted-smoke-${runId}-${user.key}`);
const cleanupStatements = [
  'PRAGMA foreign_keys=ON',
  `DELETE FROM sessions WHERE user_id IN (${ids})`,
  `DELETE FROM user_module_permissions WHERE user_id IN (${ids}) OR updated_by_user_id IN (${ids})`,
  `DELETE FROM contracts WHERE caregiver_id IN (${sql(caregiverProfile.id)},${sql(pendingRegistrationProfile.id)})`,
  ...users.map((user) => `UPDATE users SET
    status='DELETED',
    full_name='حساب آزمایشی حذف‌شده',
    username=${deletedUsername(user)},
    mobile=${deletedMobile(user)},
    permissions_json='[]',
    updated_at=${sql(timestamp)}
    WHERE id=${sql(user.id)}`),
  ...[caregiverProfile,pendingRegistrationProfile].map((profile,index)=>`UPDATE caregivers SET
    full_name='آزمون انتشار پاک‌شده',
    mobile=${sql(`deleted-smoke-${runId}-caregiver-profile-${index}`)},
    cooperation_status='حذف‌شده',
    active=0,
    work_history='پرونده آزمایشی Smoke به‌صورت نرم پاک‌سازی شد',
    updated_at=${sql(timestamp)}
    WHERE id=${sql(profile.id)}`),
];

fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(outputDirectory, 'fixtures.sql'), `${fixtureStatements.join(';\n')};\n`, { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'cleanup.sql'), `${cleanupStatements.join(';\n')};\n`, { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'fixtures.json'), JSON.stringify(fixtureStatements), { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'cleanup.json'), JSON.stringify(cleanupStatements), { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'meta.json'), JSON.stringify({
  runId,
  createdAt: timestamp,
  caregiverProfile,
  pendingRegistrationProfile,
  users: Object.fromEntries(users.map((user) => [user.key, {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    caregiverId: user.caregiverId,
  }])),
}, null, 2), { mode: 0o600 });

console.log(`Prepared ${users.length} isolated release-smoke identities, one active caregiver profile and one linked pending self-registration for run ${runId}.`);
