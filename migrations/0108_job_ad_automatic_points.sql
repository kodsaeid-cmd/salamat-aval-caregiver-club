-- Additive metadata for automatic job-ad reward points.
-- The legacy contract_points column is intentionally preserved because its original CHECK
-- only accepts 20/100/200/300. New calculations live in reward_points so existing rows
-- and immutable awarded ledgers remain untouched.
ALTER TABLE care_job_ads ADD COLUMN recipient_condition TEXT;
ALTER TABLE care_job_ads ADD COLUMN auto_contract_points INTEGER;
ALTER TABLE care_job_ads ADD COLUMN reward_points INTEGER;
ALTER TABLE care_job_ads ADD COLUMN points_mode TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE care_job_ads ADD COLUMN points_basis_days INTEGER;
ALTER TABLE care_job_ads ADD COLUMN points_base_value INTEGER;
