-- Additive tombstone metadata for auditable job-ad deletion.
-- The physical status remains inside the legacy CHECK set (DRAFT/PUBLISHED/CLOSED).
ALTER TABLE care_job_ads ADD COLUMN deleted_at TEXT;
ALTER TABLE care_job_ads ADD COLUMN deleted_by_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_care_job_ads_deleted_at ON care_job_ads(deleted_at);

-- Patient contracts now have a fixed recipient condition and a 180-day / 130-point basis.
-- Preserve administrator SPECIAL overrides, but normalize every non-special patient ad to AUTO.
UPDATE care_job_ads
SET recipient_condition='PATIENT',
    auto_contract_points=CAST(MAX(1, ROUND(130.0 * duration_days / 180.0)) AS INTEGER),
    reward_points=CASE
      WHEN points_mode='SPECIAL' AND COALESCE(reward_points,0)>0 THEN reward_points
      ELSE CAST(MAX(1, ROUND(130.0 * duration_days / 180.0)) AS INTEGER)
    END,
    points_mode=CASE WHEN points_mode='SPECIAL' AND COALESCE(reward_points,0)>0 THEN 'SPECIAL' ELSE 'AUTO' END,
    points_basis_days=180,
    points_base_value=130
WHERE contract_type='PATIENT';
