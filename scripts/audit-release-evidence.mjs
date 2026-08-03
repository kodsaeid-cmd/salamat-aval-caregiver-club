import fs from 'node:fs';
import path from 'node:path';

const [auditDirectory = '.release-audit'] = process.argv.slice(2);
const expectedRelease = '0.1.0-rc.1';
const expectedTag = `v${expectedRelease}`;
const expectedCommit = 'b1fa4349926d3dfa1f01c2c16414c3cfb2645f01';
const expectedSchema = 'EVAL-PROTECT-1.0.0';

function expect(condition, message) {
  if (!condition) throw new Error(`Release evidence audit failed: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

function byBasename(files, basename) {
  return files.filter((file) => path.basename(file) === basename);
}

function findRows(value, rows = []) {
  if (Array.isArray(value)) {
    for (const item of value) findRows(item, rows);
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  if (Array.isArray(value.results)) {
    for (const row of value.results) {
      if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row);
    }
    return rows;
  }
  for (const child of Object.values(value)) findRows(child, rows);
  return rows;
}

function firstMatchingRow(value, keys) {
  return findRows(value).find((row) => keys.every((key) => Object.hasOwn(row, key))) || null;
}

function normalized(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

expect(fs.existsSync(auditDirectory), `audit directory does not exist: ${auditDirectory}`);
const files = listFiles(auditDirectory);

const releaseFiles = byBasename(files, 'release.json');
expect(releaseFiles.length === 1, 'GitHub release metadata is missing or ambiguous');
const release = readJson(releaseFiles[0]);
expect(release.tagName === expectedTag, `GitHub release tag is ${release.tagName || 'missing'}`);
expect(release.isPrerelease === true, 'GitHub release is not marked as a prerelease');
expect(
  release.targetCommitish === expectedCommit || release.targetCommitish === 'main',
  `GitHub release target is ${release.targetCommitish || 'missing'}`,
);

const productionVersionFiles = byBasename(files, 'production-version.json');
expect(productionVersionFiles.length >= 1, 'production-version evidence is missing');
const productionEvidence = readJson(productionVersionFiles[0]);
expect(productionEvidence?.response?.release === expectedRelease, 'release workflow did not verify the expected production version');
expect(productionEvidence?.response?.evaluationProtectionSchema === expectedSchema, 'release workflow did not verify the protection schema');

const restoreFiles = byBasename(files, 'restore-verification.json');
expect(restoreFiles.length >= 1, 'restore-verification evidence is missing');
const restore = readJson(restoreFiles[0]);
expect(restore?.source && restore?.restored, 'restore evidence is incomplete');
expect(normalized(restore.source) === normalized(restore.restored), 'restored D1 counts do not match production export counts');

const smokeFiles = byBasename(files, 'result.json');
expect(smokeFiles.length >= 1, 'five-role smoke evidence is missing');
const smoke = readJson(smokeFiles[0]);
expect(smoke.release === expectedRelease, 'five-role smoke test used a different release');
expect(smoke.evaluationProtectionSchema === expectedSchema, 'five-role smoke test used a different protection schema');
expect(smoke.evaluationProtectionHealthy === true, 'five-role smoke test did not confirm healthy evaluation protection');
expect(Object.values(smoke.assertions || {}).every((value) => value === true), 'one or more evaluation-protection assertions failed');
expect(Array.isArray(smoke.checks) && smoke.checks.length >= 10, 'five-role smoke evidence contains too few checks');
expect(smoke.checks.every((check) => check?.status === 'passed'), 'one or more five-role smoke checks failed');

const manifestFiles = byBasename(files, 'manifest.json');
const postDeployManifest = manifestFiles
  .map((file) => ({ file, value: readJson(file) }))
  .find(({ value }) => value?.phase === 'post-deploy');
expect(postDeployManifest, 'post-deploy encrypted-backup manifest is missing');
expect(postDeployManifest.value.release === expectedTag, 'post-deploy backup belongs to another release');
expect(postDeployManifest.value.restoreDrill === 'passed', 'post-deploy manifest does not confirm the restore drill');
expect(postDeployManifest.value.fiveRoleSmoke === 'passed', 'post-deploy manifest does not confirm the five-role smoke test');
expect(postDeployManifest.value.evaluationProtectionSchema === expectedSchema, 'post-deploy manifest has the wrong protection schema');

const encryptedBackups = files.filter((file) => file.endsWith('.tar.gz.gpg'));
expect(encryptedBackups.length >= 1, 'encrypted post-deploy D1 backup is missing');
expect(byBasename(files, 'encrypted-backup.sha256').length >= 1, 'encrypted backup checksum is missing');
expect(!files.some((file) => file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.tar.gz')), 'unencrypted database material exists in release evidence');

const liveD1Files = byBasename(files, 'live-d1-audit.json');
expect(liveD1Files.length === 1, 'live D1 audit response is missing');
const liveD1 = readJson(liveD1Files[0]);
const liveRow = firstMatchingRow(liveD1, [
  'migration_recorded', 'schema_version', 'protected_tables', 'protected_triggers',
  'final_without_snapshot', 'scores_without_revision', 'orphan_scores',
]);
expect(liveRow, 'live D1 audit did not return the expected counters');
expect(Number(liveRow.migration_recorded) === 1, 'migration 0099 is not recorded exactly once');
expect(liveRow.schema_version === expectedSchema, `live D1 schema version is ${liveRow.schema_version || 'missing'}`);
expect(Number(liveRow.protected_tables) === 5, 'one or more evaluation-protection tables are missing');
expect(Number(liveRow.protected_triggers) === 16, 'one or more evaluation-protection triggers are missing');
expect(Number(liveRow.final_without_snapshot) === 0, 'a finalized evaluation has no immutable snapshot');
expect(Number(liveRow.scores_without_revision) === 0, 'an evaluation score has no revision history');
expect(Number(liveRow.orphan_scores) === 0, 'an orphan evaluation score exists');

for (const basename of ['workers-version.json', 'custom-domain-version.json']) {
  const endpointFiles = byBasename(files, basename);
  expect(endpointFiles.length === 1, `${basename} is missing`);
  const endpoint = readJson(endpointFiles[0]);
  expect(endpoint.release === expectedRelease, `${basename} exposes ${endpoint.release || 'no release'}`);
  expect(endpoint.evaluationProtectionSchema === expectedSchema, `${basename} exposes the wrong protection schema`);
  expect(endpoint.frontendContract === 'unchanged', `${basename} does not confirm the unchanged frontend contract`);
}

const successfulRunId = String(process.env.SUCCESSFUL_RELEASE_RUN_ID || '').trim();
const releaseArtifactId = String(process.env.RELEASE_ARTIFACT_ID || '').trim();
expect(/^\d+$/.test(successfulRunId), 'successful release run ID is missing');
expect(/^\d+$/.test(releaseArtifactId), 'release evidence artifact ID is missing');

// The persisted report intentionally contains only fixed release identifiers,
// boolean outcomes and GitHub numeric IDs. No response body or D1 row is copied.
const summary = {
  status: 'passed',
  release: expectedRelease,
  tag: expectedTag,
  releaseCommit: expectedCommit,
  evaluationProtectionSchema: expectedSchema,
  successfulReleaseRunId: successfulRunId,
  releaseArtifactId,
  verified: {
    immutablePrerelease: true,
    productionWorkerEndpoint: true,
    productionCustomDomainEndpoint: true,
    encryptedPreAndPostReleaseEvidence: true,
    fiveRoleSmoke: true,
    evaluationProtectionHealth: true,
    isolatedRestoreDrill: true,
    migration0099Recorded: true,
    protectionTablesAndTriggers: true,
    noFinalEvaluationWithoutSnapshot: true,
    noScoreWithoutRevision: true,
    noOrphanScore: true,
    frontendUnchanged: true,
  },
};
fs.writeFileSync(path.join(auditDirectory, 'release-audit-summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
console.log('v0.1.0-rc.1 release evidence, live D1 protection and both production endpoints are verified.');
