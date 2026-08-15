CREATE TABLE IF NOT EXISTS contract_admin_deletions_v1 (
  contract_case_id TEXT PRIMARY KEY,
  job_contract_id TEXT NOT NULL UNIQUE,
  job_ad_id TEXT NOT NULL,
  contract_number TEXT,
  contract_title TEXT,
  deleted_by_user_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_contract_admin_deletions_v1_job_ad
  ON contract_admin_deletions_v1(job_ad_id, deleted_at DESC);
