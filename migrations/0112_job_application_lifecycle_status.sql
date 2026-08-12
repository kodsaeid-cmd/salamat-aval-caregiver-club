-- Additive compatibility for contract lifecycle states.
-- care_job_applications.status was originally created with a CHECK that accepts only
-- PENDING_CONSULTANT/TRIAL_DISPATCH/REJECTED/IN_CONTRACT. WITHDRAWN and COMPLETED must
-- therefore live in an unconstrained additive column; the legacy status remains a shadow.
ALTER TABLE care_job_applications ADD COLUMN lifecycle_status TEXT;
UPDATE care_job_applications
SET lifecycle_status=status
WHERE lifecycle_status IS NULL OR lifecycle_status='';
CREATE INDEX IF NOT EXISTS idx_care_job_applications_lifecycle_status
ON care_job_applications(lifecycle_status,updated_at DESC);
