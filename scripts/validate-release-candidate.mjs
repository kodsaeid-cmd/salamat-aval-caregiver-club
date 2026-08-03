import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(`Release candidate validation failed: ${message}`);
};

const pkg = JSON.parse(read('package.json'));
const entry = read('worker/index-data-protection.ts');
const workflow = read('.github/workflows/release-candidate.yml');
const manifest = read('releases/v0.1.0-rc.1.yml');
const fixtureScript = read('scripts/prepare-release-smoke-fixtures.mjs');
const smokeScript = read('scripts/run-release-role-smoke.mjs');

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

console.log('v0.1.0-rc.1 release, migration, encrypted backup, restore drill and five-role production gates are valid.');
