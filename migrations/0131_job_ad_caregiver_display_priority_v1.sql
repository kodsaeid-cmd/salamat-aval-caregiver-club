ALTER TABLE care_job_ads ADD COLUMN caregiver_display_priority INTEGER NOT NULL DEFAULT 50;

CREATE INDEX IF NOT EXISTS idx_care_job_ads_caregiver_display_priority
ON care_job_ads(status, caregiver_display_priority DESC, published_at DESC, created_at DESC);
