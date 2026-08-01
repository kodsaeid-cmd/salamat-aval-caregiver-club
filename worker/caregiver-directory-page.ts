import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";
import { type AuthUser, type Env, ensureSchema, fail, json, str } from "./lib";

const PAGE_SIZE = 50;

function publicMobile(value: unknown) {
  const mobile = str(value);
  return /^(internal|legacy|crm-login|deleted)-/i.test(mobile) ? "" : mobile;
}

export async function caregiverDirectoryPage(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);

  const url = new URL(request.url);
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query = str(url.searchParams.get("q")).slice(0, 120);
  const pattern = `%${query}%`;
  const visibleCondition = `
    (c.cooperation_status IS NULL OR c.cooperation_status <> 'حذف‌شده')
    AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')
  `;

  const where = query
    ? `WHERE ${visibleCondition} AND (
        c.full_name LIKE ? OR
        c.membership_code LIKE ? OR
        COALESCE(c.mobile,'') LIKE ? OR
        COALESCE(c.national_id,'') LIKE ? OR
        COALESCE(c.primary_type,'') LIKE ? OR
        COALESCE(c.cooperation_status,'') LIKE ?
      )`
    : `WHERE ${visibleCondition}`;
  const searchArgs = query ? [pattern, pattern, pattern, pattern, pattern, pattern] : [];

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM caregivers c ${where}`)
    .bind(...searchArgs)
    .first<{ total: number }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await env.DB.prepare(`SELECT
      c.id,
      c.membership_code AS membershipCode,
      c.national_id AS nationalId,
      c.full_name AS fullName,
      c.mobile,
      c.city,
      c.service_region AS address,
      c.birth_date AS birthDate,
      c.cooperation_status AS fileStatus,
      c.primary_type AS primaryType,
      c.work_history AS workHistory,
      c.professional_level AS professionalLevel,
      c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,
      c.created_at AS createdAt,
      u.id AS userId,
      u.username,
      u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    ${where}
    ORDER BY CAST(c.membership_code AS INTEGER) ASC, c.created_at DESC
    LIMIT ? OFFSET ?`)
    .bind(...searchArgs, PAGE_SIZE, offset)
    .all<Record<string, unknown>>();

  const items = (result.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId
      ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}`
      : null,
    hasAccount: Boolean(row.userId),
  }));

  return json({
    status: "ok",
    data: {
      items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      query,
    },
  });
}
