CREATE TABLE IF NOT EXISTS care_job_ads(
  id TEXT PRIMARY KEY,
  customer_full_name TEXT NOT NULL,
  sales_consultant_user_id TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  caregiver_salary_rial INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  contract_points INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by_user_id TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(sales_consultant_user_id) REFERENCES users(id),
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);
ALTER TABLE care_job_ads ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE care_job_ads ADD COLUMN region TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_care_job_ads_city_region ON care_job_ads(city,region);
