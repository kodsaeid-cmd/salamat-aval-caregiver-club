import { type Env } from "./lib";

let ready: Promise<void> | undefined;

export async function ensurePerformanceSchema(env: Env) {
  if (!ready) {
    const statements = [
      "CREATE INDEX IF NOT EXISTS idx_caregivers_membership_code ON caregivers(membership_code)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_membership_numeric ON caregivers(CAST(membership_code AS INTEGER))",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_crm_record_id ON caregivers(crm_record_id)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_national_id ON caregivers(national_id)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_mobile ON caregivers(mobile)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_full_name ON caregivers(full_name)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_status_created ON caregivers(cooperation_status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_stage_active ON caregivers(recruitment_stage,active)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_active_name ON caregivers(active,full_name)",
      "CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_users_role_status_created ON users(role,status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
      "CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile)",
      "CREATE INDEX IF NOT EXISTS idx_users_caregiver_id ON users(caregiver_id)",
      "CREATE INDEX IF NOT EXISTS idx_profile_images_caregiver_updated ON profile_images(caregiver_id,updated_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_profile_images_user_updated ON profile_images(user_id,updated_at DESC)",
    ];
    ready = env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
      .then(() => undefined)
      .catch((error) => {
        ready = undefined;
        throw error;
      });
  }
  return ready;
}
