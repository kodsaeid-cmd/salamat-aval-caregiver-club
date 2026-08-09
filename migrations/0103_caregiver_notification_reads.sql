CREATE TABLE IF NOT EXISTS caregiver_module_reads (
  caregiver_id TEXT NOT NULL,
  module_key TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(caregiver_id,module_key),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_caregiver_module_reads_caregiver
  ON caregiver_module_reads(caregiver_id,updated_at DESC);
