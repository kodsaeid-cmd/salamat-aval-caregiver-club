-- Private initial caregiver evaluation. Additive only; existing professional evaluation data is untouched.
CREATE TABLE IF NOT EXISTS caregiver_initial_evaluation_periods (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL')),
  policy_version TEXT NOT NULL DEFAULT 'INITIAL-1405-V1',
  final_score REAL,
  evaluator_comment TEXT,
  analysis_json TEXT,
  created_by_user_id TEXT NOT NULL,
  finalized_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finalized_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_initial_eval_periods_caregiver ON caregiver_initial_evaluation_periods(caregiver_id,created_at DESC);

CREATE TABLE IF NOT EXISTS caregiver_initial_evaluation_axis_scores (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  axis_code TEXT NOT NULL,
  score INTEGER CHECK(score IS NULL OR (score BETWEEN 1 AND 5)),
  selection_json TEXT,
  note TEXT,
  scored_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(evaluation_id,axis_code),
  FOREIGN KEY(evaluation_id) REFERENCES caregiver_initial_evaluation_periods(id) ON DELETE CASCADE,
  FOREIGN KEY(scored_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_initial_eval_axis_evaluation ON caregiver_initial_evaluation_axis_scores(evaluation_id);

CREATE TABLE IF NOT EXISTS caregiver_initial_evaluation_delegates (
  user_id TEXT PRIMARY KEY,
  can_view INTEGER NOT NULL DEFAULT 1 CHECK(can_view IN (0,1)),
  can_create INTEGER NOT NULL DEFAULT 1 CHECK(can_create IN (0,1)),
  can_update INTEGER NOT NULL DEFAULT 1 CHECK(can_update IN (0,1)),
  granted_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(granted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_initial_eval_delegates_granted ON caregiver_initial_evaluation_delegates(granted_by_user_id,updated_at DESC);
