import { ensureProfileImageSchema } from "./profile-images";
import { type AuthUser, type Env, ensureSchema, fail, json, str } from "./lib";

const CRM_360_CAREGIVERS_URL = "http://91.92.122.86:9000/Salamat/main.aspx#324188475";

function publicMobile(value: unknown) {
  const mobile = str(value);
  return /^(internal|legacy|crm-login)-/i.test(mobile) ? "" : mobile;
}

export async function caregiverRecord(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }
  await ensureSchema(env);
  await ensureProfileImageSchema(env);

  const id = str(new URL(request.url).searchParams.get("id"));
  if (!id) return fail("شناسه پرونده ارسال نشده است.", 400, "caregiver_id_required");

  const row = await env.DB.prepare(`SELECT
      c.id,c.crm_record_id AS crmRecordId,c.membership_code AS membershipCode,
      c.national_id AS nationalId,c.full_name AS fullName,c.mobile,c.city,
      c.service_region AS address,c.birth_date AS birthDate,
      c.cooperation_status AS fileStatus,c.primary_type AS primaryType,
      c.work_history AS workHistory,c.professional_level AS professionalLevel,
      c.professional_score AS professionalScore,c.license_status AS licenseStatus,
      c.created_at AS createdAt,u.id AS userId,u.username,u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    WHERE c.id=? AND (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده')
    LIMIT 1`)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  return json({
    status: "ok",
    data: {
      ...row,
      mobile: publicMobile(row.mobile),
      crmUrl: CRM_360_CAREGIVERS_URL,
      crmSearchValue: str(row.membershipCode),
      avatarUrl: row.avatarId
        ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}`
        : null,
      hasAccount: Boolean(row.userId),
    },
  });
}
