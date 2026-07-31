CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  category TEXT NOT NULL,
  original_name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT,
  uploaded_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stored_files_caregiver_created
  ON stored_files(caregiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stored_files_category_created
  ON stored_files(category, created_at DESC);
