import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";
import { type AuthUser, type Env, ensureSchema, fail, json, str } from "./lib";

const PAGE_SIZE = 50;
const DIRECTORY_ROLES = ["ADMIN", "HR", "EVALUATOR"];
const countCache = new Map<string, { total: number; expiresAt: number }>();

type CacheSource = "hit" | "miss";

function publicMobile(value: unknown) {
  const mobile = str(value);
  return /^(internal|legacy|crm-login|deleted)-/i.test(mobile) ? "" : mobile;
}

function normalizeSearch(value: unknown) {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return str(value)
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function resultRowsRead(result: { meta?: unknown }) {
  const meta = result.meta as { rows_read?: number } | undefined;
  return Number(meta?.rows_read || 0);
}

function cachedTotal(key: string) {
  const entry = countCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    countCache.delete(key);
    return null;
  }
  return entry.total;
}

function storeTotal(key: string, total: number, ttl: number) {
  if (countCache.size >= 100) countCache.delete(countCache.keys().next().value || "");
  countCache.set(key, { total, expiresAt: Date.now() + ttl });
}

function withPerformanceHeaders(
  response: Response,
  metrics: {
    schemaMs: number;
    countMs: number;
    rowsMs: number;
    totalMs: number;
    rowsRead: number;
    dbQueries: number;
    countSource: CacheSource;
  },
) {
  const headers = new Headers(response.headers);
  headers.set(
    "server-timing",
    [
      `schema;dur=${metrics.schemaMs.toFixed(2)}`,
      `count;dur=${metrics.countMs.toFixed(2)}`,
      `rows;dur=${metrics.rowsMs.toFixed(2)}`,
      `handler;dur=${metrics.totalMs.toFixed(2)}`,
    ].join(", "),
  );
  headers.set("x-salamat-db-queries", String(metrics.dbQueries));
  headers.set("x-salamat-rows-read", String(metrics.rowsRead));
  headers.set("x-salamat-total-cache", metrics.countSource);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function invalidateCaregiverDirectoryCache() {
  countCache.clear();
}

export async function caregiverDirectoryPage(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (!DIRECTORY_ROLES.includes(actor.role.toUpperCase())) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  const handlerStarted = performance.now();
  const schemaStarted = performance.now();
  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);
  const schemaMs = performance.now() - schemaStarted;

  const url = new URL(request.url);
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query = normalizeSearch(url.searchParams.get("q"));
  const pattern = `%${query}%`;
  const numeric = /^\d+$/.test(query);
  const normalizedName = `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.full_name,''),'ي','ی'),'ك','ک'),char(8204),' '),char(8205),' ')`;
  const visibleCondition = `
    (c.cooperation_status IS NULL OR c.cooperation_status <> 'حذف‌شده')
    AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')
  `;

  const where = !query
    ? `WHERE ${visibleCondition}`
    : numeric
      ? `WHERE ${visibleCondition} AND (
          COALESCE(c.membership_code,'') LIKE ? OR COALESCE(c.mobile,'') LIKE ? OR
          COALESCE(c.national_id,'') LIKE ? OR ${normalizedName} LIKE ? OR
          COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.cooperation_status,'') LIKE ?
        )`
      : `WHERE ${visibleCondition} AND (
          ${normalizedName} LIKE ? OR COALESCE(c.membership_code,'') LIKE ? OR
          COALESCE(c.mobile,'') LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR
          COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.cooperation_status,'') LIKE ?
        )`;
  const searchArgs = query
    ? [pattern, pattern, pattern, pattern, pattern, pattern]
    : [];

  const cacheKey = `${numeric ? "numeric" : "text"}:${query.toLowerCase()}`;
  const countStarted = performance.now();
  let total = cachedTotal(cacheKey);
  let countSource: CacheSource = "hit";
  let countRowsRead = 0;
  if (total === null) {
    countSource = "miss";
    const totalResult = await env.DB.prepare(`SELECT COUNT(*) AS total FROM caregivers c ${where}`)
      .bind(...searchArgs)
      .all<{ total: number }>();
    total = Number(totalResult.results?.[0]?.total || 0);
    countRowsRead = resultRowsRead(totalResult);
    storeTotal(cacheKey, total, query ? 30_000 : 60_000);
  }
  const countMs = performance.now() - countStarted;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const rowsStarted = performance.now();
  const result = await env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.national_id AS nationalId,
      c.full_name AS fullName,c.mobile,c.city,c.service_region AS address,
      c.birth_date AS birthDate,c.cooperation_status AS fileStatus,
      c.primary_type AS primaryType,c.work_history AS workHistory,
      c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,c.created_at AS createdAt,
      u.id AS userId,u.username,u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    ${where}
    ORDER BY CAST(c.membership_code AS INTEGER) ASC,c.created_at DESC
    LIMIT ? OFFSET ?`)
    .bind(...searchArgs, PAGE_SIZE, offset)
    .all<Record<string, unknown>>();
  const rowsMs = performance.now() - rowsStarted;

  const items = (result.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId
      ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}`
      : null,
    hasAccount: Boolean(row.userId),
  }));

  const response = json({
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

  return withPerformanceHeaders(response, {
    schemaMs,
    countMs,
    rowsMs,
    totalMs: performance.now() - handlerStarted,
    rowsRead: countRowsRead + resultRowsRead(result),
    dbQueries: 1 + (countSource === "miss" ? 1 : 0),
    countSource,
  });
}
