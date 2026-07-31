PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS training_assignment_meta (
  enrollment_id TEXT PRIMARY KEY,
  due_at TEXT,
  assignment_note TEXT,
  assigned_from_role TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_engagement (
  enrollment_id TEXT PRIMARY KEY,
  open_count INTEGER NOT NULL DEFAULT 0,
  total_view_seconds INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  last_viewed_at TEXT,
  last_completed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_view_sessions (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  client_session_key TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  closed_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  UNIQUE (enrollment_id, client_session_key)
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_enrollment
  ON training_view_sessions(enrollment_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_sessions_caregiver
  ON training_view_sessions(caregiver_id, opened_at DESC);
