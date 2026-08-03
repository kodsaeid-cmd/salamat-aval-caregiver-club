import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const database = process.env.DB_NAME || 'salamat-aval-caregiver-club';
const config = process.env.WRANGLER_CONFIG || 'wrangler.backend.jsonc';
const evidencePath = process.env.D1_BASELINE_EVIDENCE || 'release-evidence/reports/d1-migration-baseline.json';
const baselineRunRevision = 2;

const historicalMigrations = [
  '0001_backend_foundation.sql',
  '0002_complete_club_schema.sql',
  '0003_auth_sessions_and_operational_gaps.sql',
  '0004_private_file_storage.sql',
  '0005_profile_images.sql',
  '0006_backend_evaluations.sql',
  '0007_caregiver_calendar.sql',
  '0008_credit_insurance.sql',
  '0010_training_engagement.sql',
];
const protectedMigration = '0099_evaluation_data_protection.sql';

const requiredTablesByMigration = {
  '0001_backend_foundation.sql': ['caregivers', 'sync_runs'],
  '0002_complete_club_schema.sql': [
    'users', 'otp_challenges', 'caregiver_documents', 'evaluation_periods', 'evaluations',
    'evaluation_evidence', 'courses', 'enrollments', 'service_cases', 'case_assignments',
    'shifts', 'payroll_periods', 'payroll_statements', 'support_tickets', 'ticket_messages',
    'notifications', 'point_transactions', 'sync_cursors', 'audit_logs',
  ],
  '0003_auth_sessions_and_operational_gaps.sql': [
    'sessions', 'contracts', 'security_reports', 'organization_settings',
    'caregiver_professional_meta', 'ui_state',
  ],
  '0004_private_file_storage.sql': ['stored_files'],
  '0005_profile_images.sql': ['profile_images'],
  '0006_backend_evaluations.sql': [
    'evaluation_indicator_definitions', 'evaluation_criterion_definitions',
    'caregiver_evaluation_periods', 'caregiver_evaluation_scores',
  ],
  '0007_caregiver_calendar.sql': [
    'caregiver_support_assignments', 'caregiver_calendar_events',
    'caregiver_leave_requests', 'system_notifications',
  ],
  '0008_credit_insurance.sql': ['contract_insurance_records'],
  '0010_training_engagement.sql': [
    'training_assignment_meta', 'training_engagement', 'training_view_sessions',
  ],
};

const requiredColumns = {
  caregivers: [
    'id', 'crm_record_id', 'membership_code', 'full_name', 'last_synced_at',
    'birth_date', 'gender', 'professional_level', 'professional_score',
    'club_points', 'license_status', 'profile_completed',
  ],
  users: ['id', 'caregiver_id', 'mobile', 'role', 'status', 'permissions_json'],
  sessions: ['id', 'user_id', 'token_hash', 'expires_at', 'last_seen_at'],
  stored_files: ['id', 'object_key', 'content_type', 'checksum_sha256', 'uploaded_by_user_id'],
  profile_images: ['id', 'user_id', 'caregiver_id', 'file_id'],
  caregiver_evaluation_periods: [
    'id', 'caregiver_id', 'status', 'policy_version', 'final_score', 'finalized_at',
  ],
  caregiver_evaluation_scores: [
    'id', 'evaluation_id', 'criterion_code', 'score', 'scored_by_user_id',
  ],
  caregiver_calendar_events: [
    'id', 'caregiver_id', 'event_type', 'event_date', 'recurrence', 'created_by_user_id',
  ],
  contract_insurance_records: [
    'contract_id', 'caregiver_id', 'insurance_enabled', 'registration_status', 'updated_at',
  ],
  training_engagement: [
    'enrollment_id', 'open_count', 'total_view_seconds', 'updated_at',
  ],
};

function runWrangler(command) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', database, '--remote', '--config', config, '--command', command, '--json'],
    { encoding: 'utf8', env: process.env, maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`D1 command failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`D1 returned invalid JSON: ${error.message}`);
  }
}

function collectRows(value, rows = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRows(item, rows);
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  if (Array.isArray(value.results)) {
    for (const row of value.results) {
      if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row);
    }
    return rows;
  }
  for (const child of Object.values(value)) collectRows(child, rows);
  return rows;
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeSql(sql) {
  return String(sql || '').toLowerCase().replace(/\s+/g, ' ');
}

function hasColumn(schema, column) {
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(schema);
}

const schemaRows = collectRows(runWrangler(
  "SELECT name, sql FROM sqlite_schema WHERE type='table' ORDER BY name",
));
const schemas = new Map(
  schemaRows
    .filter((row) => typeof row.name === 'string')
    .map((row) => [row.name, normalizeSql(row.sql)]),
);

const migrationTableInfo = collectRows(runWrangler('PRAGMA table_info(d1_migrations)'));
const migrationColumns = new Set(
  migrationTableInfo.map((row) => String(row.name || '')).filter(Boolean),
);
if (!migrationColumns.has('name')) {
  throw new Error('The Wrangler migration history table does not expose the required name column.');
}

const missingTables = [];
for (const [migration, tables] of Object.entries(requiredTablesByMigration)) {
  for (const table of tables) {
    if (!schemas.has(table)) missingTables.push(`${migration}:${table}`);
  }
}

const missingColumns = [];
for (const [table, columns] of Object.entries(requiredColumns)) {
  const schema = schemas.get(table);
  if (!schema) continue;
  for (const column of columns) {
    if (!hasColumn(schema, column)) missingColumns.push(`${table}.${column}`);
  }
}

if (missingTables.length || missingColumns.length) {
  throw new Error(
    `Historical migration baseline refused. Missing tables: ${missingTables.join(', ') || 'none'}; ` +
    `missing columns: ${missingColumns.join(', ') || 'none'}.`,
  );
}

const historyBefore = new Set(
  collectRows(runWrangler('SELECT name FROM d1_migrations ORDER BY name'))
    .map((row) => String(row.name || ''))
    .filter(Boolean),
);
if (historyBefore.has(protectedMigration)) {
  throw new Error(`${protectedMigration} is already recorded before the protected release gate.`);
}

const insertSql = historicalMigrations
  .map((name) => `INSERT OR IGNORE INTO d1_migrations(name) VALUES(${quote(name)})`)
  .join('; ');
runWrangler(`${insertSql};`);

const historyAfter = new Set(
  collectRows(runWrangler('SELECT name FROM d1_migrations ORDER BY name'))
    .map((row) => String(row.name || ''))
    .filter(Boolean),
);
const notRecorded = historicalMigrations.filter((name) => !historyAfter.has(name));
if (notRecorded.length) {
  throw new Error(`Historical migration baseline was incomplete: ${notRecorded.join(', ')}`);
}
if (historyAfter.has(protectedMigration)) {
  throw new Error(`${protectedMigration} was incorrectly baselined instead of being executed.`);
}

fs.mkdirSync(path.dirname(evidencePath), { recursive: true, mode: 0o700 });
fs.writeFileSync(evidencePath, JSON.stringify({
  status: 'passed',
  database,
  baselineRunRevision,
  historicalMigrationsVerified: historicalMigrations,
  alreadyRecorded: historicalMigrations.filter((name) => historyBefore.has(name)),
  newlyRecorded: historicalMigrations.filter((name) => !historyBefore.has(name)),
  protectedMigrationPending: protectedMigration,
  verifiedAt: new Date().toISOString(),
}, null, 2), { mode: 0o600 });

console.log(`Verified and baselined ${historicalMigrations.length} historical migrations; ${protectedMigration} remains pending.`);
