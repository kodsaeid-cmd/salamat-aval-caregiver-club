-- Retire training records that do not have usable content.
-- Soft deletion preserves enrollments, engagement and audit history while removing
-- these rows from the active staff training bank and caregiver training surfaces.
UPDATE courses
SET status = 'DELETED',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE UPPER(COALESCE(status,'ACTIVE')) <> 'DELETED'
  AND TRIM(COALESCE(content_url,'')) = '';
