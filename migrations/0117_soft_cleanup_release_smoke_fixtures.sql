PRAGMA foreign_keys = ON;

-- One-time cleanup for deterministic release-smoke identities created by
-- scripts/prepare-release-smoke-fixtures.mjs. Real users are not matched.
UPDATE users
SET status='DELETED',
    full_name='حساب آزمایشی حذف‌شده',
    username='deleted-smoke-' || id || '@invalid.local',
    mobile='deleted-smoke-' || id,
    permissions_json='[]',
    updated_at=datetime('now')
WHERE id LIKE 'RC-%'
  AND upper(status)<>'DELETED';

UPDATE caregivers
SET full_name='آزمون انتشار پاک‌شده',
    mobile='deleted-smoke-' || id,
    cooperation_status='حذف‌شده',
    active=0,
    work_history='پرونده آزمایشی Release Smoke به‌صورت نرم پاک‌سازی شد',
    updated_at=datetime('now')
WHERE id LIKE 'RC-%-CARE-PROFILE'
   OR id LIKE 'RC-%-PENDING-PROFILE';
