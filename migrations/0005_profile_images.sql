CREATE TABLE IF NOT EXISTS profile_images (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  caregiver_id TEXT UNIQUE,
  file_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(file_id) REFERENCES stored_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_images_user ON profile_images(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_images_caregiver ON profile_images(caregiver_id);
