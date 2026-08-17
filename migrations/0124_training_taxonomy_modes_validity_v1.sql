-- Additive training metadata for the new training-bank taxonomy and course attributes.
-- Existing rows remain untouched; legacy category text and credit values are preserved.
ALTER TABLE courses ADD COLUMN validity_months INTEGER;
ALTER TABLE courses ADD COLUMN delivery_mode TEXT;
ALTER TABLE courses ADD COLUMN learning_nature TEXT;
ALTER TABLE courses ADD COLUMN category_group TEXT;
ALTER TABLE courses ADD COLUMN category_audience TEXT;
ALTER TABLE courses ADD COLUMN category_stage TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_training_taxonomy_v2
ON courses(category_group,category_audience,category_stage,status);
