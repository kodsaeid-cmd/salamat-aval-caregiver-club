import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Release candidate validation failed: ${message}`);
};

const pkg = JSON.parse(read('package.json'));
const entry = read('worker/index-data-protection.ts');
const workflow = read('.github/workflows/release-candidate.yml');
const baselineWorkflow = read('.github/workflows/d1-migration-baseline.yml');
const baselineScript = read('scripts/baseline-d1-migrations.mjs');
const manifest = read('releases/v0.1.0-rc.1.yml');
const fixtureScript = read('scripts/prepare-release-smoke-fixtures.mjs');
const smokeScript = read('scripts/run-release-role-smoke.mjs');

const baselineSyntax = spawnSync(process.execPath, ['--check', 'scripts/baseline-d1-migrations.mjs'], {
  encoding: 'utf8',
});
expect(baselineSyntax.status === 0, `D1 baseline script has invalid syntax: ${baselineSyntax.stderr}`);

expect(pkg.version === '0.1.0-rc.1', 'package version is not v0.1.0-rc.1');
expect(entry.includes('const RELEASE_VERSION = "0.1.0-rc.1"'), 'release version is not exposed by the Worker');
expect(entry.includes('pathname === "/api/system/version"'), 'public release verification endpoint is missing');
expect(entry.includes('EVALUATION_PROTECTION_SCHEMA_VERSION'), 'data-protection schema is not reported');
expect(manifest.includes('version: v0.1.0-rc.1'), 'release manifest version is missing');
expect(manifest.includes('migration: 0099_evaluation_data_protection.sql'), 'release migration is not pinned');

expect(workflow.includes('Pre-migration encrypted D1 backup'), 'pre-migration backup gate is missing');
expect(workflow.indexOf('Pre-migration encrypted D1 backup') < workflow.indexOf('Apply production D1 migrations'), 'migration can run before the protected backup');
expect(workflow.includes('gpg --batch --yes --pinentry-mode loopback'), 'backup encryption is missing');
expect(workflow.includes('--cipher-algo AES256'), 'AES-256 backup encryption is missing');
expect(workflow.includes('Apply production D1 migrations'), 'production migration step is missing');
expect(workflow.includes('Deploy release candidate Worker'), 'production Worker deployment step is missing');
expect(workflow.includes('/api/system/version'), 'deployed release verification is missing');
expect(workflow.includes('Run five-role production smoke test'), 'production role smoke test is missing');
expect(workflow.includes('Import post-deploy export into isolated D1'), 'isolated restore drill is missing');
expect(workflow.includes('Compare protected evaluation counts'), 'restore integrity comparison is missing');
expect(workflow.includes('gh release create'), 'immutable GitHub release creation is missing');
expect(workflow.includes("find \"$artifact_dir\" -type f"), 'unencrypted artifact guard is missing');

expect(baselineWorkflow.includes('Create encrypted backup before migration-history baseline'), 'baseline pre-change backup is missing');
expect(baselineWorkflow.indexOf('Create encrypted backup before migration-history baseline') < baselineWorkflow.indexOf('Verify schema and baseline historical migration records'), 'baseline can mutate history before its backup');
expect(baselineWorkflow.includes('gpg --batch --yes --pinentry-mode loopback'), 'baseline backup encryption is missing');
expect(baselineWorkflow.includes('--cipher-algo AES256'), 'baseline backup is not AES-256');
expect(baselineWorkflow.includes('Assert only evaluation protection migration remains'), 'post-baseline pending-migration assertion is missing');
expect(baselineWorkflow.includes('gh workflow run release-candidate.yml'), 'protected release is not restarted after baseline');
expect(baselineWorkflow.includes("find \"$artifact_dir\" -type f"), 'baseline unencrypted artifact guard is missing');

for (const migration of [
  '0001_backend_foundation.sql', '0002_complete_club_schema.sql',
  '0003_auth_sessions_and_operational_gaps.sql', '0004_private_file_storage.sql',
  '0005_profile_images.sql', '0006_backend_evaluations.sql',
  '0007_caregiver_calendar.sql', '0008_credit_insurance.sql',
  '0010_training_engagement.sql',
]) {
  expect(baselineScript.includes(migration), `historical migration is not covered by baseline: ${migration}`);
}
expect(baselineScript.includes("const protectedMigration = '0099_evaluation_data_protection.sql'"), 'protected migration is not isolated from historical baseline');
expect(baselineScript.includes('Historical migration baseline refused'), 'baseline does not fail closed on schema mismatch');
expect(baselineScript.includes("PRAGMA table_info(d1_migrations)"), 'Wrangler history schema is not verified before mutation');
expect(baselineScript.includes("if (historyBefore.has(protectedMigration))"), 'pre-existing protected migration state is not guarded');
expect(baselineScript.includes("if (historyAfter.has(protectedMigration))"), 'protected migration could be incorrectly baselined');
expect(!baselineScript.includes('historicalMigrations.push(protectedMigration)'), '0099 must never be part of historical baseline');

expect(fixtureScript.includes("role: 'ADMIN'"), 'root and limited admin fixtures are missing');
expect(fixtureScript.includes("role: 'EVALUATOR'"), 'evaluator fixture is missing');
expect(fixtureScript.includes("role: 'RECRUITER'"), 'recruiter fixture is missing');
expect(fixtureScript.includes("role: 'CAREGIVER'"), 'caregiver fixture is missing');
expect(fixtureScript.includes('pbkdf2Sync'), 'temporary smoke passwords do not use the production password format');
expect(smokeScript.includes('/api/auth/login'), 'real login is not exercised');
expect(smokeScript.includes('/api/auth/logout'), 'real logout is not exercised');
expect(smokeScript.includes('/api/admin/evaluation-protection/health'), 'root protection health is not exercised');
expect(smokeScript.includes('/api/admin/caregivers-page?page=1'), 'server caregiver directory is not exercised');
expect(smokeScript.includes("panel === 'CAREGIVER'"), 'caregiver panel contract is not checked');

console.log('v0.1.0-rc.1 release, safe historical D1 baseline, encrypted backup, restore drill and five-role production gates are valid.');
