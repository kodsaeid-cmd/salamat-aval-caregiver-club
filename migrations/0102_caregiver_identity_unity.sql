-- Canonical identity unity for linked caregiver profiles and login accounts.
-- Caregiver professional data remains in caregivers; login identity remains in users.
-- These triggers keep the shared name/mobile projection synchronized regardless
-- of whether the change originates from the caregiver panel or an admin screen.

UPDATE users
SET
  full_name = COALESCE(
    NULLIF(TRIM((SELECT c.full_name FROM caregivers c WHERE c.id=users.caregiver_id)), ''),
    full_name
  ),
  mobile = CASE
    WHEN (SELECT c.mobile FROM caregivers c WHERE c.id=users.caregiver_id) GLOB '09?????????'
      AND (
        SELECT COUNT(*) FROM caregivers cx
        WHERE cx.mobile=(SELECT c.mobile FROM caregivers c WHERE c.id=users.caregiver_id)
      )=1
      AND NOT EXISTS(
        SELECT 1 FROM users ux
        WHERE ux.id<>users.id
          AND ux.mobile=(SELECT c.mobile FROM caregivers c WHERE c.id=users.caregiver_id)
      )
      THEN (SELECT c.mobile FROM caregivers c WHERE c.id=users.caregiver_id)
    ELSE mobile
  END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE upper(role)='CAREGIVER'
  AND upper(status)<>'DELETED'
  AND caregiver_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM caregivers c WHERE c.id=users.caregiver_id);

CREATE TRIGGER IF NOT EXISTS trg_caregiver_identity_to_user_v1
AFTER UPDATE OF full_name,mobile ON caregivers
WHEN EXISTS(
  SELECT 1 FROM users u
  WHERE u.caregiver_id=NEW.id
    AND upper(u.role)='CAREGIVER'
    AND upper(u.status)<>'DELETED'
    AND (
      COALESCE(TRIM(u.full_name),'') IS NOT COALESCE(TRIM(NEW.full_name),'')
      OR (
        NEW.mobile GLOB '09?????????'
        AND COALESCE(u.mobile,'') IS NOT COALESCE(NEW.mobile,'')
      )
    )
)
BEGIN
  UPDATE users
  SET
    full_name=CASE WHEN TRIM(COALESCE(NEW.full_name,''))<>'' THEN NEW.full_name ELSE full_name END,
    mobile=CASE WHEN NEW.mobile GLOB '09?????????' THEN NEW.mobile ELSE mobile END,
    updated_at=COALESCE(NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE caregiver_id=NEW.id
    AND upper(role)='CAREGIVER'
    AND upper(status)<>'DELETED';
END;

CREATE TRIGGER IF NOT EXISTS trg_user_identity_to_caregiver_v1
AFTER UPDATE OF full_name,mobile ON users
WHEN upper(NEW.role)='CAREGIVER'
  AND upper(NEW.status)<>'DELETED'
  AND NEW.caregiver_id IS NOT NULL
  AND EXISTS(
    SELECT 1 FROM caregivers c
    WHERE c.id=NEW.caregiver_id
      AND (
        COALESCE(TRIM(c.full_name),'') IS NOT COALESCE(TRIM(NEW.full_name),'')
        OR (
          NEW.mobile GLOB '09?????????'
          AND COALESCE(c.mobile,'') IS NOT COALESCE(NEW.mobile,'')
        )
      )
  )
BEGIN
  UPDATE caregivers
  SET
    full_name=CASE WHEN TRIM(COALESCE(NEW.full_name,''))<>'' THEN NEW.full_name ELSE full_name END,
    mobile=CASE WHEN NEW.mobile GLOB '09?????????' THEN NEW.mobile ELSE mobile END,
    last_synced_at=COALESCE(NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at=COALESCE(NEW.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE id=NEW.caregiver_id;
END;
