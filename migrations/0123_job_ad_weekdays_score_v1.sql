-- Additive weekly schedule metadata for job ads.
-- Existing rows inherit the current full-score baseline: Saturday through Thursday.
ALTER TABLE care_job_ads ADD COLUMN work_weekdays_json TEXT NOT NULL DEFAULT '["SAT","SUN","MON","TUE","WED","THU"]';
ALTER TABLE care_job_ads ADD COLUMN weekday_score_factor REAL NOT NULL DEFAULT 1.0 CHECK(weekday_score_factor > 0 AND weekday_score_factor <= 1.0);
