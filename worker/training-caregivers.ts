import {
  type AuthUser,
  type Env,
  fail,
  hasRole,
  json,
  str,
} from "./lib";
import { ensureProfileImageSchema } from "./profile-images";

const STAFF_ROLES = ["ADMIN", "RECRUITER", "HR"];

type TrainingCaregiverRow = {
  id: string;
  membershipCode: string | null;
  fullName: string;
  mobile: string;
  city: string | null;
  primaryType: string | null;
  fileStatus: string | null;
  accountStatus: string | null;
  avatarId: string | null;
};

function publicMobile(value: unknown) {
  const mobile = str(value);
  return /^(internal|legacy|deleted)-/i.test(mobile) ? "" : mobile;
}

export async function getTrainingCaregivers(
  env: Env,
  actor: AuthUser,
) {
  if (!hasRole(actor, STAFF_ROLES)) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  await ensureProfileImageSchema(env);
  const result = await env.DB.prepare(`SELECT
      c.id,
      c.membership_code AS membershipCode,
      c.full_name AS fullName,
      c.mobile,
      c.city,
      c.primary_type AS primaryType,
      c.cooperation_status AS fileStatus,
      u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER'
    WHERE c.active=1
      AND COALESCE(c.recruitment_stage,'')<>'DELETED'
      AND COALESCE(c.cooperation_status,'')<>'حذف‌شده'
      AND COALESCE(u.status,'ACTIVE')<>'DELETED'
    ORDER BY c.full_name COLLATE NOCASE ASC`)
    .all<TrainingCaregiverRow>();

  const data = (result.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId
      ? `/api/profile-images/${encodeURIComponent(row.avatarId)}`
      : null,
  }));

  return json({ data });
}
