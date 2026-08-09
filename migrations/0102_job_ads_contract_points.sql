CREATE TABLE IF NOT EXISTS care_job_ads (
  id TEXT PRIMARY KEY,
  customer_full_name TEXT NOT NULL,
  sales_consultant_user_id TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK(contract_type IN ('ELDERLY','CHILD','PATIENT','HOUSEKEEPING')),
  shift_type TEXT NOT NULL CHECK(shift_type IN ('DAY','NIGHT','LIVE_IN','TEMPORARY')),
  caregiver_salary_rial INTEGER NOT NULL CHECK(caregiver_salary_rial >= 0),
  duration_days INTEGER NOT NULL CHECK(duration_days > 0),
  contract_points INTEGER NOT NULL CHECK(contract_points IN (20,100,200,300)),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','CLOSED')),
  created_by_user_id TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(sales_consultant_user_id) REFERENCES users(id),
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS care_job_applications (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CONSULTANT' CHECK(status IN ('PENDING_CONSULTANT','TRIAL_DISPATCH','REJECTED','IN_CONTRACT')),
  applied_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(ad_id, caregiver_id),
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS caregiver_contract_point_ledger (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  application_id TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL CHECK(points > 0),
  awarded_by_user_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id),
  FOREIGN KEY(application_id) REFERENCES care_job_applications(id),
  FOREIGN KEY(awarded_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_care_job_ads_status_created ON care_job_ads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_job_ads_consultant ON care_job_ads(sales_consultant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_job_applications_ad ON care_job_applications(ad_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_job_applications_caregiver ON care_job_applications(caregiver_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_contract_points_caregiver ON caregiver_contract_point_ledger(caregiver_id, awarded_at DESC);
