-- Compatibility guard for legacy contract-progress writes.
--
-- care_job_applications.status was originally created with a CHECK constraint that only
-- accepts PENDING_CONSULTANT/TRIAL_DISPATCH/REJECTED/IN_CONTRACT. Contract lifecycle
-- later introduced COMPLETED and WITHDRAWN in the additive canonical lifecycle_status
-- column (migration 0112). Some older contract-progress paths still write those values
-- directly to status while reconciling an active/expired contract during caregiver job
-- bank load, which can abort the entire GET /api/caregiver/job-ads request with HTTP 500.
--
-- Keep the original table and CHECK constraint intact. Intercept only the two lifecycle
-- values that are invalid for the legacy shadow, store the canonical value in
-- lifecycle_status, and keep the backwards-compatible status shadow as REJECTED.

CREATE TRIGGER IF NOT EXISTS trg_care_job_applications_lifecycle_legacy_write_guard
BEFORE UPDATE OF status ON care_job_applications
WHEN NEW.status IN ('COMPLETED','WITHDRAWN')
BEGIN
  UPDATE care_job_applications
  SET status='REJECTED',
      lifecycle_status=NEW.status,
      updated_at=NEW.updated_at
  WHERE id=OLD.id;

  SELECT RAISE(IGNORE);
END;
