-- Evaluation data protection v1
-- This migration is additive: it does not alter existing frontend contracts or delete data.

CREATE TABLE IF NOT EXISTS evaluation_indicator_definitions (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_criterion_definitions (
  code TEXT PRIMARY KEY,
  indicator_code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(indicator_code) REFERENCES evaluation_indicator_definitions(code)
);

CREATE TABLE IF NOT EXISTS caregiver_evaluation_periods (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  policy_version TEXT NOT NULL,
  final_score REAL,
  created_by_user_id TEXT NOT NULL,
  finalized_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finalized_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id),
  FOREIGN KEY(finalized_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS caregiver_evaluation_scores (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  criterion_code TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  note TEXT,
  scored_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(evaluation_id,criterion_code),
  FOREIGN KEY(evaluation_id) REFERENCES caregiver_evaluation_periods(id) ON DELETE CASCADE,
  FOREIGN KEY(criterion_code) REFERENCES evaluation_criterion_definitions(code),
  FOREIGN KEY(scored_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS evaluation_score_revisions (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  indicator_code TEXT NOT NULL,
  criterion_code TEXT NOT NULL,
  previous_score INTEGER,
  new_score INTEGER NOT NULL,
  previous_note TEXT,
  new_note TEXT,
  change_kind TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_by_name TEXT,
  changed_by_role TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_final_snapshots (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  final_score REAL NOT NULL,
  professional_level TEXT NOT NULL,
  caregiver_identity_json TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  finalized_by_user_id TEXT,
  finalized_by_name TEXT,
  finalized_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(evaluation_id,snapshot_version),
  UNIQUE(snapshot_sha256)
);

CREATE TABLE IF NOT EXISTS evaluation_archival_events (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caregiver_archival_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  evaluation_count INTEGER NOT NULL DEFAULT 0,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_data_protection_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_revisions_evaluation_created
  ON evaluation_score_revisions(evaluation_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_revisions_caregiver_created
  ON evaluation_score_revisions(caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_snapshots_evaluation_version
  ON evaluation_final_snapshots(evaluation_id,snapshot_version DESC);
CREATE INDEX IF NOT EXISTS idx_eval_snapshots_caregiver_created
  ON evaluation_final_snapshots(caregiver_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_eval_revision_after_insert_v1
AFTER INSERT ON caregiver_evaluation_scores
BEGIN
  INSERT OR IGNORE INTO evaluation_score_revisions(
    id,evaluation_id,caregiver_id,indicator_code,criterion_code,
    previous_score,new_score,previous_note,new_note,change_kind,change_reason,
    changed_by_user_id,changed_by_name,changed_by_role,created_at
  )
  SELECT
    'rev_create_' || NEW.id,NEW.evaluation_id,p.caregiver_id,d.indicator_code,NEW.criterion_code,
    NULL,NEW.score,NULL,NEW.note,'CREATE','ثبت اولیه امتیاز',NEW.scored_by_user_id,
    u.full_name,u.role,NEW.created_at
  FROM caregiver_evaluation_periods p
  JOIN evaluation_criterion_definitions d ON d.code=NEW.criterion_code
  LEFT JOIN users u ON u.id=NEW.scored_by_user_id
  WHERE p.id=NEW.evaluation_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_revision_after_update_v1
AFTER UPDATE OF score,note,scored_by_user_id ON caregiver_evaluation_scores
WHEN OLD.score IS NOT NEW.score OR OLD.note IS NOT NEW.note OR OLD.scored_by_user_id IS NOT NEW.scored_by_user_id
BEGIN
  INSERT INTO evaluation_score_revisions(
    id,evaluation_id,caregiver_id,indicator_code,criterion_code,
    previous_score,new_score,previous_note,new_note,change_kind,change_reason,
    changed_by_user_id,changed_by_name,changed_by_role,created_at
  )
  SELECT
    'rev_' || lower(hex(randomblob(16))),NEW.evaluation_id,p.caregiver_id,d.indicator_code,NEW.criterion_code,
    OLD.score,NEW.score,OLD.note,NEW.note,'UPDATE','اصلاح امتیاز ارزیابی',NEW.scored_by_user_id,
    u.full_name,u.role,NEW.updated_at
  FROM caregiver_evaluation_periods p
  JOIN evaluation_criterion_definitions d ON d.code=NEW.criterion_code
  LEFT JOIN users u ON u.id=NEW.scored_by_user_id
  WHERE p.id=NEW.evaluation_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_revision_no_update_v1
BEFORE UPDATE ON evaluation_score_revisions
BEGIN SELECT RAISE(ABORT,'evaluation_revision_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_revision_no_delete_v1
BEFORE DELETE ON evaluation_score_revisions
BEGIN SELECT RAISE(ABORT,'evaluation_revision_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_snapshot_no_update_v1
BEFORE UPDATE ON evaluation_final_snapshots
BEGIN SELECT RAISE(ABORT,'evaluation_snapshot_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_snapshot_no_delete_v1
BEFORE DELETE ON evaluation_final_snapshots
BEGIN SELECT RAISE(ABORT,'evaluation_snapshot_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_archive_event_no_update_v1
BEFORE UPDATE ON evaluation_archival_events
BEGIN SELECT RAISE(ABORT,'evaluation_archive_event_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_archive_event_no_delete_v1
BEFORE DELETE ON evaluation_archival_events
BEGIN SELECT RAISE(ABORT,'evaluation_archive_event_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_caregiver_archive_event_no_update_v1
BEFORE UPDATE ON caregiver_archival_events
BEGIN SELECT RAISE(ABORT,'caregiver_archive_event_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_caregiver_archive_event_no_delete_v1
BEFORE DELETE ON caregiver_archival_events
BEGIN SELECT RAISE(ABORT,'caregiver_archive_event_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_period_no_delete_v1
BEFORE DELETE ON caregiver_evaluation_periods
BEGIN SELECT RAISE(ABORT,'evaluation_period_delete_forbidden'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_score_no_delete_v1
BEFORE DELETE ON caregiver_evaluation_scores
BEGIN SELECT RAISE(ABORT,'evaluation_score_delete_forbidden'); END;

CREATE TRIGGER IF NOT EXISTS trg_caregiver_no_hard_delete_v1
BEFORE DELETE ON caregivers
BEGIN SELECT RAISE(ABORT,'caregiver_hard_delete_forbidden'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_final_score_no_insert_v1
BEFORE INSERT ON caregiver_evaluation_scores
WHEN EXISTS(
  SELECT 1 FROM caregiver_evaluation_periods p
  WHERE p.id=NEW.evaluation_id AND p.status='FINAL'
)
BEGIN SELECT RAISE(ABORT,'final_evaluation_is_locked'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_final_score_no_update_v1
BEFORE UPDATE ON caregiver_evaluation_scores
WHEN EXISTS(
  SELECT 1 FROM caregiver_evaluation_periods p
  WHERE p.id=NEW.evaluation_id AND p.status='FINAL'
)
BEGIN SELECT RAISE(ABORT,'final_evaluation_is_locked'); END;

CREATE TRIGGER IF NOT EXISTS trg_eval_final_period_immutable_v1
BEFORE UPDATE ON caregiver_evaluation_periods
WHEN OLD.status='FINAL' AND (
  NEW.caregiver_id IS NOT OLD.caregiver_id OR
  NEW.title IS NOT OLD.title OR
  NEW.start_date IS NOT OLD.start_date OR
  NEW.end_date IS NOT OLD.end_date OR
  NEW.status IS NOT OLD.status OR
  NEW.policy_version IS NOT OLD.policy_version OR
  NEW.final_score IS NOT OLD.final_score OR
  NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
  NEW.finalized_by_user_id IS NOT OLD.finalized_by_user_id OR
  NEW.finalized_at IS NOT OLD.finalized_at
)
BEGIN SELECT RAISE(ABORT,'final_evaluation_is_immutable'); END;

INSERT OR IGNORE INTO evaluation_score_revisions(
  id,evaluation_id,caregiver_id,indicator_code,criterion_code,
  previous_score,new_score,previous_note,new_note,change_kind,change_reason,
  changed_by_user_id,changed_by_name,changed_by_role,created_at
)
SELECT
  'rev_baseline_' || s.id,s.evaluation_id,p.caregiver_id,d.indicator_code,s.criterion_code,
  NULL,s.score,NULL,s.note,'BASELINE','ثبت وضعیت موجود هنگام فعال‌سازی حفاظت داده',
  s.scored_by_user_id,u.full_name,u.role,s.created_at
FROM caregiver_evaluation_scores s
JOIN caregiver_evaluation_periods p ON p.id=s.evaluation_id
JOIN evaluation_criterion_definitions d ON d.code=s.criterion_code
LEFT JOIN users u ON u.id=s.scored_by_user_id
WHERE NOT EXISTS(
  SELECT 1 FROM evaluation_score_revisions r
  WHERE r.evaluation_id=s.evaluation_id AND r.criterion_code=s.criterion_code
);

INSERT INTO evaluation_data_protection_meta(key,value,updated_at)
VALUES('schema_version','EVAL-PROTECT-1.0.0',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
