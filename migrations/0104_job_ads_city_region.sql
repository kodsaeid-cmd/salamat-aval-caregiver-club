ALTER TABLE care_job_ads ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE care_job_ads ADD COLUMN region TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_care_job_ads_city_region ON care_job_ads(city,region);
