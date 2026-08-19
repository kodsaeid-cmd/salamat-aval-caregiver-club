-- Additive job-ad targeting field. Existing ads remain compatible with NULL.
ALTER TABLE care_job_ads ADD COLUMN required_caregiver_gender TEXT;
