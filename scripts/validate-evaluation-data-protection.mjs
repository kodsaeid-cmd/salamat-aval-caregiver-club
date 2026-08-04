import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
};

const protection = read('worker/evaluation-data-protection.ts');
const entry = read('worker/index-data-protection.ts');
const platformEntry = read('worker/index-caregiver-platform-v1.ts');
const evaluations = read('worker/evaluations-v2.ts');
const migration = read('migrations/0099_evaluation_data_protection.sql');
const wrangler = read('wrangler.backend.jsonc');

requireText(wrangler, 'index-data-protection.ts', 'protected worker entrypoint');
requireText(wrangler, '"crons"', 'scheduled protection maintenance');
requireText(entry, 'app from "./index-caregiver-platform-v1"', 'caregiver platform delegation');
requireText(platformEntry, 'app from "./index-caregiver-click-stability"', 'preserved frontend delegation');
requireText(entry, 'softDeleteCaregiver', 'caregiver soft-delete interception');
requireText(entry, 'evaluation-protection/health', 'protection health endpoint');
requireText(entry, 'evaluation-protection/backfill', 'snapshot backfill endpoint');
requireText(entry, 'runEvaluationProtectionMaintenance', 'scheduled maintenance');

requireText(protection, 'evaluation_score_revisions', 'append-only score revisions');
requireText(protection, 'evaluation_final_snapshots', 'immutable final snapshots');
requireText(protection, 'trg_eval_revision_no_update_v1', 'revision update guard');
requireText(protection, 'trg_eval_revision_no_delete_v1', 'revision delete guard');
requireText(protection, 'trg_eval_snapshot_no_update_v1', 'snapshot update guard');
requireText(protection, 'trg_eval_snapshot_no_delete_v1', 'snapshot delete guard');
requireText(protection, 'trg_eval_period_no_delete_v1', 'period delete guard');
requireText(protection, 'trg_eval_score_no_delete_v1', 'score delete guard');
requireText(protection, 'trg_caregiver_no_hard_delete_v1', 'caregiver hard-delete guard');
requireText(protection, 'trg_eval_final_period_immutable_v1', 'final period immutability');
requireText(protection, 'deleted_at', 'caregiver soft-delete timestamp');
requireText(protection, 'snapshot_sha256', 'snapshot integrity hash');
requireText(protection, 'seedRevisionBaseline', 'existing score baseline protection');
requireText(protection, 'verifySnapshotHashes', 'snapshot integrity verification');
requireText(protection, "cooperation_status='حذف‌شده'", 'existing frontend-compatible archive status');

requireText(evaluations, 'ensureEvaluationDataProtection(env)', 'protection before evaluation reads and writes');
requireText(evaluations, 'prepareFinalEvaluationSnapshot', 'snapshot before finalization');
requireText(evaluations, 'snapshot_creation_failed', 'fail-closed finalization');
requireText(evaluations, 'snapshot.statement', 'atomic snapshot finalization batch');
requireText(evaluations, 'revisionHistory: "append_only_database_trigger"', 'audit revision marker');

for (const needle of [
  'evaluation_score_revisions',
  'evaluation_final_snapshots',
  'trg_eval_period_no_delete_v1',
  'trg_eval_score_no_delete_v1',
  'trg_caregiver_no_hard_delete_v1',
  'trg_eval_final_period_immutable_v1',
]) requireText(migration, needle, `migration contract ${needle}`);

if (/preview\//.test(entry) || /innerHTML|document\.|window\./.test(protection)) {
  throw new Error('Backend data protection must not modify frontend assets or DOM behavior.');
}
if (protection.includes('DELETE FROM caregiver_evaluation_periods') || protection.includes('DELETE FROM caregiver_evaluation_scores')) {
  throw new Error('Protected evaluation records must never be physically deleted.');
}

console.log('Evaluation data protection contracts are valid: soft delete, append-only revisions, immutable snapshots, fail-closed finalization, scheduled backfill, caregiver platform delegation, and no frontend mutation.');
