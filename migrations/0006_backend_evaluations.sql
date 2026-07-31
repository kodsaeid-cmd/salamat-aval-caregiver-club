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
  UNIQUE(evaluation_id, criterion_code),
  FOREIGN KEY(evaluation_id) REFERENCES caregiver_evaluation_periods(id) ON DELETE CASCADE,
  FOREIGN KEY(criterion_code) REFERENCES evaluation_criterion_definitions(code),
  FOREIGN KEY(scored_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_eval_periods_caregiver ON caregiver_evaluation_periods(caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_scores_period ON caregiver_evaluation_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_criteria_indicator ON evaluation_criterion_definitions(indicator_code,sort_order);
