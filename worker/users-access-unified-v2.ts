import { individualRequireAccess } from "./individual-access-v2";
import { type AuthUser, type Env, ensureSchema, fail, getUser, json, securityHeaders, str } from "./lib";

const PAGE_SIZE = 50;
const PROFILE_PREFIX = "profile:";

type Row = Record<string, unknown>;

function normalizedIso(value: string) {
  if (!value) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

async function unifiedUsersV2(request: Request, env: Env, actor: AuthUser) {
  const denied = await individualRequireAccess(env, actor, "staff.users", "view");
  if (denied) return denied;
  await ensureSchema(env);

  const url = new URL(request.url);
  const q = str(url.searchParams.get("q")).slice(0, 120);
  const statusFilter = str(url.searchParams.get("status")).toUpperCase();
  const roleFilter = str(url.searchParams.get("role")).toUpperCase();
  const registrationFilter = str(url.searchParams.get("registration")).toUpperCase();
  const createdFrom = normalizedIso(str(url.searchParams.get("createdFrom")));
  const createdTo = normalizedIso(str(url.searchParams.get("createdTo")));
  const sort = str(url.searchParams.get("sort")).toUpperCase() === "OLDEST" ? "OLDEST" : "NEWEST";
  const direction = sort === "OLDEST" ? "ASC" : "DESC";
  const requested = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pattern = `%${q}%`;

  const filters: string[] = ["1=1"];
  const args: unknown[] = [];
  if (q) {
    filters.push("(fullName LIKE ? OR COALESCE(mobile,'') LIKE ? OR COALESCE(username,'') LIKE ? OR COALESCE(membershipCode,'') LIKE ? OR COALESCE(nationalId,'') LIKE ?)");
    args.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (statusFilter) {
    filters.push("upper(COALESCE(status,''))=?");
    args.push(statusFilter);
  }
  if (roleFilter) {
    filters.push("upper(trim(COALESCE(role,'')))=?");
    args.push(roleFilter);
  }
  if (registrationFilter) {
    filters.push("upper(COALESCE(recruitmentStage,''))=?");
    args.push(registrationFilter);
  }
  if (createdFrom) {
    filters.push("createdAt>=?");
    args.push(createdFrom);
  }
  if (createdTo) {
    filters.push("createdAt<?");
    args.push(createdTo);
  }

  const where = `WHERE ${filters.join(" AND ")}`;
  const cte = `WITH directory AS (
    SELECT
      u.id AS id,
      u.caregiver_id AS caregiverId,
      u.full_name AS fullName,
      CASE WHEN u.mobile LIKE 'internal-%' OR u.mobile LIKE 'deleted-%' THEN '' ELSE u.mobile END AS mobile,
      u.username AS username,
      u.role AS role,
      u.status AS status,
      u.last_login_at AS lastLoginAt,
      CASE
        WHEN upper(u.role)='CAREGIVER' AND c.id IS NOT NULL THEN COALESCE(c.created_at,u.created_at)
        ELSE u.created_at
      END AS createdAt,
      COALESCE(c.membership_code,'') AS membershipCode,
      COALESCE(c.national_id,'') AS nationalId,
      COALESCE(c.recruitment_stage,'') AS recruitmentStage,
      0 AS profileOnly
    FROM users u
    LEFT JOIN caregivers c ON c.id=u.caregiver_id
    WHERE upper(u.status)<>'DELETED'

    UNION ALL

    SELECT
      '${PROFILE_PREFIX}'||c.id AS id,
      c.id AS caregiverId,
      c.full_name AS fullName,
      c.mobile AS mobile,
      NULL AS username,
      'CAREGIVER' AS role,
      'PENDING' AS status,
      NULL AS lastLoginAt,
      c.created_at AS createdAt,
      COALESCE(c.membership_code,'') AS membershipCode,
      COALESCE(c.national_id,'') AS nationalId,
      COALESCE(c.recruitment_stage,'') AS recruitmentStage,
      1 AS profileOnly
    FROM caregivers c
    WHERE COALESCE(c.cooperation_status,'')<>'حذف‌شده'
      AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')
      AND NOT EXISTS(
        SELECT 1 FROM users u
        WHERE u.caregiver_id=c.id
          AND upper(u.role)='CAREGIVER'
          AND upper(u.status)<>'DELETED'
      )
  )`;

  if (url.searchParams.get("export") === "mobiles") {
    const mobileRow = await env.DB.prepare(`${cte} SELECT COUNT(DISTINCT mobile) AS count,GROUP_CONCAT(DISTINCT mobile) AS mobilesCsv FROM directory ${where} AND TRIM(COALESCE(mobile,''))<>''`)
      .bind(...args)
      .first<{ count: number; mobilesCsv: string | null }>();
    return json({
      data: { mobilesCsv: String(mobileRow?.mobilesCsv || ""), count: Number(mobileRow?.count || 0) },
      query: q,
      filters: { status: statusFilter, role: roleFilter, registration: registrationFilter, createdFrom, createdTo, sort },
    });
  }

  const totalRow = await env.DB.prepare(`${cte} SELECT COUNT(*) AS total FROM directory ${where}`)
    .bind(...args)
    .first<{ total: number }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await env.DB.prepare(`${cte} SELECT * FROM directory ${where}
    ORDER BY createdAt ${direction}, id ${direction}
    LIMIT ? OFFSET ?`)
    .bind(...args, PAGE_SIZE, offset)
    .all<Row>();

  const rows = (result.results || []).map((row) => {
    const profileOnly = Boolean(row.profileOnly);
    const selfRegistered = String(row.recruitmentStage || "").toUpperCase() === "SELF_REGISTERED";
    const pendingApproval = selfRegistered && String(row.status || "").toUpperCase() === "PENDING";
    return {
      ...row,
      profileOnly,
      pendingAccount: profileOnly,
      linked: !profileOnly,
      selfRegistered,
      pendingApproval,
    };
  });

  return json({
    data: rows,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    query: q,
    filters: {
      status: statusFilter,
      role: roleFilter,
      registration: registrationFilter,
      createdFrom,
      createdTo,
      sort,
    },
  });
}

export async function routeUsersAccessUnifiedV2(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "GET" || url.pathname !== "/api/users") return null;
  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  return securityHeaders(await unifiedUsersV2(request, env, actor));
}
