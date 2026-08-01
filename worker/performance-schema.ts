import { type Env } from "./lib";

let ready: Promise<void> | undefined;

export async function ensurePerformanceSchema(env: Env) {
  if (!ready) {
    const statements = [
      "CREATE INDEX IF NOT EXISTS idx_caregivers_membership_code ON caregivers(membership_code)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_full_name ON caregivers(full_name)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_status_created ON caregivers(cooperation_status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_caregivers_stage_active ON caregivers(recruitment_stage,active)",
      "CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_users_role_status_created ON users(role,status,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
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
