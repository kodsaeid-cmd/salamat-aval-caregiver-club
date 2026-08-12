-- Multi-period administrator contract history.
--
-- contract_cases_v2 intentionally remains untouched because its job_ad_id UNIQUE
-- constraint is referenced by the existing v2 child tables.  V3 is an additive,
-- data-preserving projection whose canonical unique identity is job_contract_id.
-- One advertisement may therefore have any number of historical contract periods.

CREATE TABLE IF NOT EXISTS contract_cases_v3 (
  id TEXT PRIMARY KEY,
  job_contract_id TEXT NOT NULL UNIQUE,
  job_ad_id TEXT NOT NULL,
  source_application_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_status_end ON contract_cases_v3(status,ends_at);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_caregiver ON contract_cases_v3(primary_caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v3_ad_history ON contract_cases_v3(job_ad_id,starts_at DESC);

INSERT OR IGNORE INTO contract_cases_v3(
  id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,
  primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,
  renewal_state,supervisor_user_id,supervision_note,settlement_method,
  caregiver_settlement_status,caregiver_bad_debt,franchise_toman,franchise_status,
  franchise_paid_at,franchise_reference,created_at,updated_at
)
SELECT
  id,job_contract_id,job_ad_id,source_application_id,contract_number,contract_title,
  primary_caregiver_id,caregiver_salary_rial,duration_days,starts_at,ends_at,status,
  renewal_state,supervisor_user_id,supervision_note,settlement_method,
  caregiver_settlement_status,caregiver_bad_debt,franchise_toman,franchise_status,
  franchise_paid_at,franchise_reference,created_at,updated_at
FROM contract_cases_v2;

CREATE TABLE IF NOT EXISTS contract_service_providers_v3 (
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
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v3(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_service_providers_v3_case ON contract_service_providers_v3(contract_case_id,started_at);

INSERT OR IGNORE INTO contract_service_providers_v3(
  id,contract_case_id,caregiver_id,source_application_id,started_at,ended_at,status,
  rank_code_snapshot,stars_snapshot,created_at,updated_at
)
SELECT
  p.id,p.contract_case_id,p.caregiver_id,p.source_application_id,p.started_at,p.ended_at,p.status,
  p.rank_code_snapshot,p.stars_snapshot,p.created_at,p.updated_at
FROM contract_service_providers_v2 p
JOIN contract_cases_v3 c ON c.id=p.contract_case_id;

CREATE TABLE IF NOT EXISTS contract_note_revisions_v3 (
  id TEXT PRIMARY KEY,
  contract_case_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v3(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_note_revisions_v3_case ON contract_note_revisions_v3(contract_case_id,created_at DESC);
INSERT OR IGNORE INTO contract_note_revisions_v3(id,contract_case_id,note_text,actor_user_id,created_at)
SELECT n.id,n.contract_case_id,n.note_text,n.actor_user_id,n.created_at
FROM contract_note_revisions_v2 n
JOIN contract_cases_v3 c ON c.id=n.contract_case_id;

CREATE TABLE IF NOT EXISTS contract_financial_revisions_v3 (
  id TEXT PRIMARY KEY,
  contract_case_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(contract_case_id) REFERENCES contract_cases_v3(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_contract_financial_revisions_v3_case ON contract_financial_revisions_v3(contract_case_id,created_at DESC);
INSERT OR IGNORE INTO contract_financial_revisions_v3(id,contract_case_id,snapshot_json,actor_user_id,created_at)
SELECT f.id,f.contract_case_id,f.snapshot_json,f.actor_user_id,f.created_at
FROM contract_financial_revisions_v2 f
JOIN contract_cases_v3 c ON c.id=f.contract_case_id;
