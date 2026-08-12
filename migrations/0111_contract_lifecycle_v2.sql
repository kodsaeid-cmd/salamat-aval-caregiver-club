-- Contract lifecycle v2: additive, auditable case layer over job contracts.
CREATE TABLE IF NOT EXISTS contract_cases_v2 (
  id TEXT PRIMARY KEY,
  job_contract_id TEXT NOT NULL UNIQUE,
  job_ad_id TEXT NOT NULL,
  source_application_id TEXT NOT NULL UNIQUE,
  contract_number TEXT NOT NULL UNIQUE,
  contract_title TEXT NOT NULL,
  primary_caregiver_id TEXT NOT NULL,
  caregiver_salary_rial INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  renewal_state TEXT NOT NULL DEFAULT 'CURRENT',
  supervisor_user_id TEXT,
  supervision_note TEXT NOT NULL DEFAULT '',
  settlement_method TEXT NOT NULL DEFAULT 'MONTHLY',
  caregiver_settlement_status TEXT NOT NULL DEFAULT 'PENDING',
  caregiver_bad_debt INTEGER NOT NULL DEFAULT 0,
  franchise_toman INTEGER NOT NULL DEFAULT 0,
  franchise_status TEXT NOT NULL DEFAULT 'UNPAID',
  franchise_paid_at TEXT,
  franchise_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(primary_caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(supervisor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_status_end ON contract_cases_v2(status,ends_at);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_caregiver ON contract_cases_v2(primary_caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_ad ON contract_cases_v2(job_ad_id,created_at DESC);

CREATE TABLE IF NOT EXISTS contract_service_providers_v2 (
  id TEXT PRIMARY KEY,
  contract_case_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  source_application_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  rank_code_snapshot TEXT,
  stars_snapshot INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(contract_case_id,caregiver_id,started_at),
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v2(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_service_providers_v2_case ON contract_service_providers_v2(contract_case_id,started_at);

CREATE TABLE IF NOT EXISTS contract_note_revisions_v2 (
  id TEXT PRIMARY KEY,
  contract_case_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v2(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_note_revisions_v2_case ON contract_note_revisions_v2(contract_case_id,created_at DESC);

CREATE TABLE IF NOT EXISTS contract_financial_revisions_v2 (
  id TEXT PRIMARY KEY,
  contract_case_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v2(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_financial_revisions_v2_case ON contract_financial_revisions_v2(contract_case_id,created_at DESC);
