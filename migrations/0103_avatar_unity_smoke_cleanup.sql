-- Canonical avatar ownership and safe cleanup of release-smoke identities.
-- Additive/idempotent: financial and professional records are never deleted.

PRAGMA foreign_keys=ON;

-- A caregiver account and its caregiver file must resolve the same image row.
UPDATE profile_images
SET user_id = (
  SELECT u.id
  FROM users u
  WHERE u.caregiver_id = profile_images.caregiver_id
    AND upper(u.role) = 'CAREGIVER'
    AND upper(COALESCE(u.status,'')) <> 'DELETED'
  ORDER BY u.updated_at DESC, u.created_at DESC
  LIMIT 1
)
WHERE caregiver_id IS NOT NULL
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.caregiver_id = profile_images.caregiver_id
      AND upper(u.role) = 'CAREGIVER'
      AND upper(COALESCE(u.status,'')) <> 'DELETED'
  )
  AND NOT EXISTS (
    SELECT 1 FROM profile_images other
    WHERE other.id <> profile_images.id
      AND other.user_id = (
        SELECT u.id
        FROM users u
        WHERE u.caregiver_id = profile_images.caregiver_id
          AND upper(u.role) = 'CAREGIVER'
          AND upper(COALESCE(u.status,'')) <> 'DELETED'
        ORDER BY u.updated_at DESC, u.created_at DESC
        LIMIT 1
      )
  );

-- Smoke identities are operational fixtures, not real users. Remove active
-- sessions and individual permissions, then anonymize/soft-delete them. Hard
-- deletion is intentionally avoided because audit and protected data may refer
-- to these actors.
DELETE FROM sessions
WHERE user_id IN (
  SELECT id FROM users
  WHERE id LIKE 'RC-%'
     OR lower(COALESCE(username,'')) LIKE 'rc-%@invalid.local'
     OR COALESCE(full_name,'') LIKE 'آزمون انتشار%'
);

DELETE FROM user_module_permissions
WHERE user_id IN (
    SELECT id FROM users
    WHERE id LIKE 'RC-%'
       OR lower(COALESCE(username,'')) LIKE 'rc-%@invalid.local'
       OR COALESCE(full_name,'') LIKE 'آزمون انتشار%'
  )
  OR updated_by_user_id IN (
    SELECT id FROM users
    WHERE id LIKE 'RC-%'
       OR lower(COALESCE(username,'')) LIKE 'rc-%@invalid.local'
       OR COALESCE(full_name,'') LIKE 'آزمون انتشار%'
  );

UPDATE users
SET status='DELETED',
    full_name='حساب آزمایشی حذف‌شده',
    username='deleted-smoke-' || lower(hex(randomblob(12))) || '@invalid.local',
    mobile='deleted-smoke-' || lower(hex(randomblob(12))),
    permissions_json='[]',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id LIKE 'RC-%'
   OR lower(COALESCE(username,'')) LIKE 'rc-%@invalid.local'
   OR COALESCE(full_name,'') LIKE 'آزمون انتشار%';

UPDATE caregivers
SET full_name='پرونده آزمایشی حذف‌شده',
    mobile='deleted-smoke-' || lower(hex(randomblob(12))),
    cooperation_status='حذف‌شده',
    active=0,
    work_history='پرونده موقت آزمون انتشار به‌صورت ایمن غیرفعال شد.',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id LIKE 'RC-%-CARE-PROFILE'
   OR COALESCE(full_name,'') LIKE 'آزمون انتشار مراقب%';
