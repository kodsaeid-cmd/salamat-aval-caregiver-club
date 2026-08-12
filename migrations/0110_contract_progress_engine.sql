-- Contract Progress Engine v1
-- Contract ad points are potential points. New contracts earn them only after completed service days.
-- Historical caregiver_contract_point_ledger rows remain immutable and are never rewritten.

CREATE TABLE IF NOT EXISTS caregiver_job_contracts (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  application_id TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  scheduled_end_at TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK(duration_days > 0),
  total_points_units INTEGER NOT NULL CHECK(total_points_units >= 0),
  earned_points_units INTEGER NOT NULL DEFAULT 0 CHECK(earned_points_units >= 0),
  last_reconciled_day INTEGER NOT NULL DEFAULT 0 CHECK(last_reconciled_day >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED','ENDED_EARLY')),
  points_model TEXT NOT NULL DEFAULT 'DAILY_V1' CHECK(points_model IN ('DAILY_V1','LEGACY_PREPAID')),
  started_by_user_id TEXT,
  ended_at TEXT,
  ended_by_user_id TEXT,
  end_reason_code TEXT,
  end_reason_text TEXT,
  welcome_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id),
  FOREIGN KEY(application_id) REFERENCES care_job_applications(id),
  FOREIGN KEY(started_by_user_id) REFERENCES users(id),
  FOREIGN KEY(ended_by_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caregiver_one_active_job_contract
ON caregiver_job_contracts(caregiver_id) WHERE status='ACTIVE';

CREATE INDEX IF NOT EXISTS idx_job_contracts_status_end
ON caregiver_job_contracts(status,scheduled_end_at);

CREATE INDEX IF NOT EXISTS idx_job_contracts_application
ON caregiver_job_contracts(application_id);

CREATE TABLE IF NOT EXISTS caregiver_contract_point_daily_ledger (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  service_day INTEGER NOT NULL CHECK(service_day > 0),
  points_units INTEGER NOT NULL CHECK(points_units >= 0),
  earned_at TEXT NOT NULL,
  UNIQUE(contract_id,service_day),
  FOREIGN KEY(contract_id) REFERENCES caregiver_job_contracts(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id),
  FOREIGN KEY(application_id) REFERENCES care_job_applications(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_contract_points_caregiver
ON caregiver_contract_point_daily_ledger(caregiver_id,earned_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_daily_contract_points_no_update
BEFORE UPDATE ON caregiver_contract_point_daily_ledger
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: daily contract point ledger entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_daily_contract_points_no_delete
BEFORE DELETE ON caregiver_contract_point_daily_ledger
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: daily contract point ledger entries cannot be deleted');
END;
