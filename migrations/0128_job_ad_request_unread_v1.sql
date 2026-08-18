-- Job-ad request unread state v1
-- Additive only. Existing ads/applications/history remain unchanged.
-- Read state is per staff user so opening an ad does not clear another manager's notifications.

CREATE TABLE IF NOT EXISTS care_job_ad_request_reads (
  user_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  last_seen_application_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, ad_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_ad_request_reads_ad
  ON care_job_ad_request_reads(ad_id, user_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_ad_applied
  ON care_job_applications(ad_id, applied_at DESC);
