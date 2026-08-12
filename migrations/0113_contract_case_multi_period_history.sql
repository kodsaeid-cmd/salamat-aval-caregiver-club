-- Preserve every service period as an independent administrator contract case.
-- The previous schema made job_ad_id UNIQUE, so reusing one advertisement for a
-- replacement/new service period overwrote the old administrator projection.
-- job_contract_id is the canonical one-to-one identity; job_ad_id is historical grouping only.

CREATE TABLE contract_cases_v2_multi_period (
  id TEXT PRIMARY KEY,
  job_contract_id TEXT NOT NULL,
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
  updated_at TEXT NOT NULL
);

INSERT INTO contract_cases_v2_multi_period(
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

DROP TABLE contract_cases_v2;
ALTER TABLE contract_cases_v2_multi_period RENAME TO contract_cases_v2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_cases_v2_job_contract_unique
  ON contract_cases_v2(job_contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_ad_history
  ON contract_cases_v2(job_ad_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_status_end
  ON contract_cases_v2(status,ends_at);
CREATE INDEX IF NOT EXISTS idx_contract_cases_v2_caregiver
  ON contract_cases_v2(primary_caregiver_id,created_at DESC);
