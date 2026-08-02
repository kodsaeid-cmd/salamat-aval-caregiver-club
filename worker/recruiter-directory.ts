import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";
import { type AuthUser, type Env, ensureSchema, fail, json, str } from "./lib";

const PAGE_SIZE = 50;
const COUNTS_TTL_MS = 60_000;
const TOTAL_TTL_MS = 30_000;
const TOTAL_CACHE_LIMIT = 100;

type Row = Record<string, unknown>;
type CacheSource = "hit" | "miss" | "skipped";

type CountsResult = {
  value: Row;
  source: CacheSource;
  rowsRead: number;
};

type TotalResult = {
  total: number;
  source: CacheSource;
  rowsRead: number;
};

let countsCache: { expiresAt: number; value: Row } | null = null;
const totalCache = new Map<string, { expiresAt: number; total: number }>();

const validCaregiverName = `TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')`;
const visibleCaregiverAccount = `upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' AND (
  c.id IS NULL OR ${validCaregiverName}
)`;

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

function resultRowsRead(result: { meta?: unknown }) {
  const meta = result.meta as { rows_read?: number } | undefined;
  return Number(meta?.rows_read || 0);
}

function cachedTotal(key: string) {
  const entry = totalCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    totalCache.delete(key);
    return null;
  }
  return entry.total;
}

function storeTotal(key: string, total: number) {
  if (totalCache.size >= TOTAL_CACHE_LIMIT) {
    totalCache.delete(totalCache.keys().next().value || "");
  }
  totalCache.set(key, { total, expiresAt: Date.now() + TOTAL_TTL_MS });
}

function withPerformanceHeaders(
  response: Response,
  metrics: {
    schemaMs: number;
    summaryMs: number;
    rowsMs: number;
    totalMs: number;
    rowsRead: number;
    dbQueries: number;
    countsSource: CacheSource;
    totalSource: CacheSource;
  },
) {
  const headers = new Headers(response.headers);
  headers.set(
    "server-timing",
    [
      `schema;dur=${metrics.schemaMs.toFixed(2)}`,
      `summary;dur=${metrics.summaryMs.toFixed(2)}`,
      `rows;dur=${metrics.rowsMs.toFixed(2)}`,
      `handler;dur=${metrics.totalMs.toFixed(2)}`,
    ].join(", "),
  );
  headers.set("x-salamat-db-queries", String(metrics.dbQueries));
  headers.set("x-salamat-rows-read", String(metrics.rowsRead));
  headers.set("x-salamat-counts-cache", metrics.countsSource);
  headers.set("x-salamat-total-cache", metrics.totalSource);
  headers.set("x-salamat-directory-scope", "recruiter-caregivers");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function directoryCounts(env: Env): Promise<CountsResult> {
  const now = Date.now();
  if (countsCache && countsCache.expiresAt > now) {
    return { value: countsCache.value, source: "hit", rowsRead: 0 };
  }

  const result = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
        WHERE ${visibleCaregiverAccount}) AS accounts,
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
        WHERE ${visibleCaregiverAccount}) AS caregiverAccounts,
      (SELECT COUNT(*) FROM caregivers c WHERE
        (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده') AND ${validCaregiverName}) AS caregiverProfiles,
      (SELECT COUNT(*) FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
        WHERE upper(u.status) IN ('ACTIVE','APPROVED') AND (${visibleCaregiverAccount})) AS activeAccounts,
      (SELECT COUNT(*) FROM caregivers c WHERE
        (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده') AND ${validCaregiverName} AND NOT EXISTS(
          SELECT 1 FROM users u WHERE u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
        )) AS profilesWithoutAccounts,
      (SELECT COUNT(*) FROM users u WHERE upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' AND (
        u.caregiver_id IS NULL OR NOT EXISTS(SELECT 1 FROM caregivers c WHERE c.id=u.caregiver_id)
      )) AS accountsWithoutProfiles`).all<Row>();

  const value = result.results?.[0] || {};
  countsCache = { value, expiresAt: now + COUNTS_TTL_MS };
  return { value, source: "miss", rowsRead: resultRowsRead(result) };
}

async function filteredTotal(
  env: Env,
  cacheKey: string,
  sql: string,
  args: unknown[],
): Promise<TotalResult> {
  const cached = cachedTotal(cacheKey);
  if (cached !== null) return { total: cached, source: "hit", rowsRead: 0 };

  const result = await env.DB.prepare(sql).bind(...args).all<{ total: number }>();
  const total = Number(result.results?.[0]?.total || 0);
  storeTotal(cacheKey, total);
  return { total, source: "miss", rowsRead: resultRowsRead(result) };
}

export function invalidateRecruiterDirectoryCache() {
  countsCache = null;
  totalCache.clear();
}

export async function recruiterDirectory(request: Request, env: Env, actor: AuthUser) {
  if (!["RECRUITER", "ADMIN"].includes(actor.role.toUpperCase())) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  const handlerStarted = performance.now();
  const schemaStarted = performance.now();
  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);
  const schemaMs = performance.now() - schemaStarted;

  const url = new URL(request.url);
  const query = str(url.searchParams.get("q")).slice(0, 120);
  const includeCounts = url.searchParams.get("includeCounts") !== "0";
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pattern = `%${query}%`;
  const numeric = /^\d+$/.test(query);

  const userWhere = !query
    ? `WHERE ${visibleCaregiverAccount}`
    : numeric
      ? `WHERE ${visibleCaregiverAccount} AND (
          COALESCE(u.username,'')=? OR COALESCE(u.mobile,'')=? OR
          COALESCE(c.membership_code,'')=? OR COALESCE(c.national_id,'')=? OR
          u.full_name LIKE ?
        )`
      : `WHERE ${visibleCaregiverAccount} AND (
          u.full_name LIKE ? OR COALESCE(u.username,'') LIKE ? OR COALESCE(u.mobile,'') LIKE ? OR
          COALESCE(c.membership_code,'') LIKE ? OR COALESCE(c.national_id,'') LIKE ?
        )`;
  const userArgs = !query
    ? []
    : numeric
      ? [query, query, query, query, pattern]
      : [pattern, pattern, pattern, pattern, pattern];

  const summaryStarted = performance.now();
  const countsPromise = includeCounts
    ? directoryCounts(env)
    : Promise.resolve<CountsResult>({ value: {}, source: "skipped", rowsRead: 0 });
  const totalPromise = filteredTotal(
    env,
    `${numeric ? "numeric" : "text"}:${query.toLowerCase()}`,
    `SELECT COUNT(*) AS total FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id ${userWhere}`,
    userArgs,
  );
  const [countsResult, totalResult] = await Promise.all([countsPromise, totalPromise]);
  const summaryMs = performance.now() - summaryStarted;

  const total = totalResult.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const rowsStarted = performance.now();
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
    ORDER BY CAST(COALESCE(c.membership_code,'999999999') AS INTEGER) ASC,u.created_at DESC
    LIMIT ? OFFSET ?`)
    .bind(...userArgs, PAGE_SIZE, offset)
    .all<Row>();
  const rowsMs = performance.now() - rowsStarted;

  const accounts = (accountResult.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    caregiverMobile: publicMobile(row.caregiverMobile),
    permissions: parsePermissions(row.permissionsJson),
    permissionsJson: undefined,
    avatarUrl: row.avatarId ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}` : null,
    linked: Boolean(row.caregiverId && row.membershipCode),
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

  const counts = includeCounts
    ? {
        accounts: Number(countsResult.value?.accounts || 0),
        caregiverAccounts: Number(countsResult.value?.caregiverAccounts || 0),
        caregiverProfiles: Number(countsResult.value?.caregiverProfiles || 0),
        activeAccounts: Number(countsResult.value?.activeAccounts || 0),
        profilesWithoutAccounts: Number(countsResult.value?.profilesWithoutAccounts || 0),
        accountsWithoutProfiles: Number(countsResult.value?.accountsWithoutProfiles || 0),
      }
    : null;

  const response = json({
    status: "ok",
    data: {
      accounts,
      caregivers,
      counts,
      countsIncluded: includeCounts,
      scope: "RECRUITER_CAREGIVERS",
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

  const rowsRead = countsResult.rowsRead + totalResult.rowsRead + resultRowsRead(accountResult);
  const dbQueries = 1
    + (countsResult.source === "miss" ? 1 : 0)
    + (totalResult.source === "miss" ? 1 : 0);

  return withPerformanceHeaders(response, {
    schemaMs,
    summaryMs,
    rowsMs,
    totalMs: performance.now() - handlerStarted,
    rowsRead,
    dbQueries,
    countsSource: countsResult.source,
    totalSource: totalResult.source,
  });
}
