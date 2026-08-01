import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";
import { type AuthUser, type Env, ensureSchema, fail, json, str } from "./lib";

const PAGE_SIZE = 50;
const COUNTS_TTL_MS = 30_000;

type Row = Record<string, unknown>;

let countsCache: { expiresAt: number; value: Row } | null = null;

function publicMobile(value: unknown) {
  const mobile = str(value);
  return /^(internal|legacy|crm-login|deleted)-/i.test(mobile) ? "" : mobile;
}

function parsePermissions(value: unknown) {
  try {
    const parsed = JSON.parse(str(value) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const validCaregiverName = `TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')`;
const visibleUser = `upper(u.status)<>'DELETED' AND (
  upper(u.role)<>'CAREGIVER' OR c.id IS NULL OR ${validCaregiverName}
)`;

async function directoryCounts(env: Env) {
  const now = Date.now();
  if (countsCache && countsCache.expiresAt > now) return countsCache.value;
  const value = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id WHERE ${visibleUser}) AS accounts,
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
        WHERE upper(u.role)='CAREGIVER' AND ${visibleUser}) AS caregiverAccounts,
      (SELECT COUNT(*) FROM caregivers c WHERE
        (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده') AND ${validCaregiverName}) AS caregiverProfiles,
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
        WHERE upper(u.status) IN ('ACTIVE','APPROVED') AND (${visibleUser})) AS activeAccounts,
      (SELECT COUNT(*) FROM caregivers c WHERE
        (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده') AND ${validCaregiverName} AND NOT EXISTS(
          SELECT 1 FROM users u WHERE u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
        )) AS profilesWithoutAccounts,
      (SELECT COUNT(*) FROM users u WHERE upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' AND (
        u.caregiver_id IS NULL OR NOT EXISTS(SELECT 1 FROM caregivers c WHERE c.id=u.caregiver_id)
      )) AS accountsWithoutProfiles`).first<Row>() || {};
  countsCache = { value, expiresAt: now + COUNTS_TTL_MS };
  return value;
}

export function invalidateAdminDirectoryCounts() {
  countsCache = null;
}

export async function adminDirectoryLight(request: Request, env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);

  const url = new URL(request.url);
  const query = str(url.searchParams.get("q")).slice(0, 120);
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pattern = `%${query}%`;
  const numeric = /^\d+$/.test(query);

  const userWhere = !query
    ? `WHERE ${visibleUser}`
    : numeric
      ? `WHERE ${visibleUser} AND (
          COALESCE(u.username,'')=? OR COALESCE(u.mobile,'')=? OR
          COALESCE(c.membership_code,'')=? OR COALESCE(c.national_id,'')=? OR
          u.full_name LIKE ?
        )`
      : `WHERE ${visibleUser} AND (
          u.full_name LIKE ? OR COALESCE(u.username,'') LIKE ? OR COALESCE(u.mobile,'') LIKE ? OR
          COALESCE(c.membership_code,'') LIKE ? OR COALESCE(c.national_id,'') LIKE ?
        )`;
  const userArgs = !query
    ? []
    : numeric
      ? [query, query, query, query, pattern]
      : [pattern, pattern, pattern, pattern, pattern];

  const [countsRow, filteredRow] = await Promise.all([
    directoryCounts(env),
    env.DB.prepare(`SELECT COUNT(*) AS total
      FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id ${userWhere}`)
      .bind(...userArgs)
      .first<{ total: number }>(),
  ]);

  const total = Number(filteredRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const accountResult = await env.DB.prepare(`SELECT
      u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,u.role,u.status,
      u.permissions_json AS permissionsJson,u.last_login_at AS lastLoginAt,u.created_at AS createdAt,
      c.membership_code AS membershipCode,c.full_name AS caregiverFullName,c.mobile AS caregiverMobile,
      c.cooperation_status AS fileStatus,c.national_id AS nationalId,c.city,c.service_region AS address,
      c.birth_date AS birthDate,c.primary_type AS primaryType,c.work_history AS workHistory,
      c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.user_id=u.id OR (u.caregiver_id IS NOT NULL AND pi.caregiver_id=u.caregiver_id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM users u
    LEFT JOIN caregivers c ON c.id=u.caregiver_id
    ${userWhere}
    ORDER BY CASE WHEN upper(u.role)='ADMIN' THEN 0 WHEN upper(u.role)<>'CAREGIVER' THEN 1 ELSE 2 END,
      CAST(COALESCE(c.membership_code,'999999999') AS INTEGER) ASC,u.created_at DESC
    LIMIT ? OFFSET ?`)
    .bind(...userArgs, PAGE_SIZE, offset)
    .all<Row>();

  const accounts = (accountResult.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    caregiverMobile: publicMobile(row.caregiverMobile),
    permissions: parsePermissions(row.permissionsJson),
    permissionsJson: undefined,
    avatarUrl: row.avatarId ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}` : null,
    linked: str(row.role).toUpperCase() !== "CAREGIVER" || Boolean(row.caregiverId && row.membershipCode),
  }));

  const caregivers = accounts
    .filter((row) => row.caregiverId)
    .map((row) => ({
      id: row.caregiverId,
      membershipCode: row.membershipCode,
      nationalId: row.nationalId,
      fullName: row.caregiverFullName || row.fullName,
      mobile: row.caregiverMobile || row.mobile,
      city: row.city,
      address: row.address,
      birthDate: row.birthDate,
      fileStatus: row.fileStatus,
      primaryType: row.primaryType,
      workHistory: row.workHistory,
      professionalLevel: row.professionalLevel,
      professionalScore: row.professionalScore,
      licenseStatus: row.licenseStatus,
      createdAt: row.createdAt,
      userId: row.id,
      username: row.username,
      accountStatus: row.status,
      avatarId: row.avatarId,
      avatarUrl: row.avatarUrl,
      hasAccount: true,
    }));

  const counts = {
    accounts: Number(countsRow?.accounts || 0),
    caregiverAccounts: Number(countsRow?.caregiverAccounts || 0),
    caregiverProfiles: Number(countsRow?.caregiverProfiles || 0),
    activeAccounts: Number(countsRow?.activeAccounts || 0),
    profilesWithoutAccounts: Number(countsRow?.profilesWithoutAccounts || 0),
    accountsWithoutProfiles: Number(countsRow?.accountsWithoutProfiles || 0),
  };

  return json({
    status: "ok",
    data: {
      accounts,
      caregivers,
      counts,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      query,
      migration: { scanned: 0, migrated: 0, mode: "disabled_on_read" },
      reconciliation: { mode: "disabled_on_read" },
    },
  });
}
