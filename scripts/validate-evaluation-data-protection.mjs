import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
};

const protection = read('worker/evaluation-data-protection.ts');
const entry = read('worker/index-data-protection.ts');
const platformEntry = read('worker/index-caregiver-platform-v1.ts');
const evaluations = read('worker/evaluations-v2.ts');
const scorecard = read('worker/caregiver-scorecard-v2.ts');
const mobileCaregivers = read('mobile-react/admin-caregivers-v3.tsx');
const mobileEvaluations = read('mobile-react/admin-evaluations-v3.tsx');
const mobileScorecard = read('mobile-react/caregiver-scorecard-v2.tsx');
const desktopEvaluations = read('desktop-react/evaluations-v3.tsx');
const desktopScorecard = read('desktop-react/caregiver-activity-scorecard.tsx');
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
requireText(evaluations, 'isAdmin(actor)', 'admin-only evaluation audit projection');
requireText(evaluations, '...(includeAudit && saved', 'criterion audit conditional projection');
requireText(evaluations, 'scoredBy:', 'criterion scorer audit object');
if (/note:\s*saved\?\.note[\s\S]{0,120}updatedAt:\s*saved\?\.updatedAt/.test(evaluations)) {
  throw new Error('Criterion score timestamp must not be projected outside the admin-only audit object.');
}

requireText(scorecard, 'function rankFor', 'canonical professional star ranking');
requireText(scorecard, 'stars: 5', 'five-star top professional rank');
requireText(scorecard, 'stars: 1', 'one-star minimum professional rank');
requireText(scorecard, 'function scoreAnalysis', 'score-based strengths and weaknesses analysis');
requireText(scorecard, 'basis: "evaluation_scores"', 'analysis source declaration');
requireText(scorecard, 'analysis,', 'scorecard analysis response');
if (scorecard.includes('scored_by_user_id') || scorecard.includes('scoredByUserId')) {
  throw new Error('General caregiver scorecard must never expose evaluator identity.');
}
if (/caregiver_evaluation_scores[\s\S]{0,180}updated_at\s+AS\s+updatedAt/i.test(scorecard)) {
  throw new Error('General caregiver scorecard must never expose criterion entry timestamps.');
}

requireText(mobileCaregivers, '/api/admin/caregiver-scorecard-v2?caregiverId=', 'mobile caregiver row scorecard fetch');
requireText(mobileCaregivers, '<GoldStars stars={rank.stars}', 'mobile staff gold star scorecard');
requireText(mobileCaregivers, '<EvaluationAnalysis analysis={analysis}', 'mobile staff score analysis');
requireText(mobileScorecard, '<GoldStars stars={rank.stars}', 'caregiver self gold star scorecard');
requireText(mobileScorecard, '<EvaluationAnalysis analysis={analysis}', 'caregiver self score analysis');
requireText(desktopScorecard, '<GoldStars stars={rank.stars}', 'desktop staff gold star scorecard');
requireText(desktopScorecard, '<EvaluationAnalysis analysis={analysis}', 'desktop staff score analysis');
requireText(mobileEvaluations, 'auditVisible=Boolean(data.auditVisible)', 'mobile admin-only audit UI gate');
requireText(mobileEvaluations, 'cr.scoredBy&&<CriterionAudit', 'mobile criterion audit rendering');
requireText(desktopEvaluations, 'auditVisible=Boolean(data.auditVisible)', 'desktop admin-only audit UI gate');
requireText(desktopEvaluations, 'cr.scoredBy&&<CriterionAudit', 'desktop criterion audit rendering');

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

console.log('Evaluation contracts are valid: immutable data protection, ADMIN-only scorer audit, private criterion timestamps, canonical 1-5 star ranking, score-based strengths analysis, and mobile/desktop scorecard rendering.');
