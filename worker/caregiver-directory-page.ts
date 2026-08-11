import { requireAccess } from "./access-control";
import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";
import { type AuthUser, type Env, ensureSchema, json, str } from "./lib";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const countCache = new Map<string, { total: number; expiresAt: number }>();

type CacheSource = "hit" | "miss";
type SortKey = "evaluation_due" | "evaluation_recent" | "created_desc" | "created_asc" | "age_asc" | "age_desc" | "score_desc" | "name_asc";

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

function intParam(value: string | null, min: number, max: number) {
  if (!value) return null;
  const normalized = normalizeSearch(value);
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : null;
}

function normalizeGender(value: string | null) {
  const normalized = normalizeSearch(value).toLowerCase();
  if (["male", "m", "مرد", "آقا", "مذکر"].includes(normalized)) return "male";
  if (["female", "f", "زن", "خانم", "مونث", "مؤنث"].includes(normalized)) return "female";
  if (normalized === "unknown" || normalized === "نامشخص") return "unknown";
  return "";
}

function normalizeSort(value: string | null): SortKey {
  const allowed: SortKey[] = ["evaluation_due", "evaluation_recent", "created_desc", "created_asc", "age_asc", "age_desc", "score_desc", "name_asc"];
  return allowed.includes(value as SortKey) ? value as SortKey : "evaluation_due";
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
  const denied = await requireAccess(env, actor, "staff.caregivers", "view");
  if (denied) return denied;

  const handlerStarted = performance.now();
  const schemaStarted = performance.now();
  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);
  const schemaMs = performance.now() - schemaStarted;

  const url = new URL(request.url);
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = intParam(url.searchParams.get("pageSize"), 10, MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const query = normalizeSearch(url.searchParams.get("q"));
  const gender = normalizeGender(url.searchParams.get("gender"));
  const ageMin = intParam(url.searchParams.get("ageMin"), 15, 100);
  const ageMaxRaw = intParam(url.searchParams.get("ageMax"), 15, 100);
  const ageMax = ageMin !== null && ageMaxRaw !== null && ageMaxRaw < ageMin ? ageMin : ageMaxRaw;
  const specialty = normalizeSearch(url.searchParams.get("specialty"));
  const sort = normalizeSort(url.searchParams.get("sort"));
  const pattern = `%${query}%`;
  const specialtyPattern = `%${specialty}%`;
  const numeric = /^\d+$/.test(query);
  const normalizedName = `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.full_name,''),'ي','ی'),'ك','ک'),char(8204),' '),char(8205),' ')`;
  const ageSql = `CASE
    WHEN CAST(substr(COALESCE(c.birth_date,''),1,4) AS INTEGER) BETWEEN 1900 AND CAST(strftime('%Y','now') AS INTEGER)
      THEN CAST((julianday('now') - julianday(REPLACE(substr(c.birth_date,1,10),'/','-'))) / 365.2425 AS INTEGER)
    WHEN CAST(substr(COALESCE(c.birth_date,''),1,4) AS INTEGER) BETWEEN 1300 AND 1499
      THEN CAST(strftime('%Y','now') AS INTEGER) - 621 - CAST(substr(c.birth_date,1,4) AS INTEGER)
    ELSE NULL END`;
  const lastEvaluationAtSql = `(SELECT COALESCE(p.finalized_at,p.updated_at,p.created_at)
    FROM caregiver_evaluation_periods p WHERE p.caregiver_id=c.id
    ORDER BY p.created_at DESC LIMIT 1)`;
  const lastEvaluationStatusSql = `(SELECT p.status FROM caregiver_evaluation_periods p
    WHERE p.caregiver_id=c.id ORDER BY p.created_at DESC LIMIT 1)`;
  const lastEvaluationScoreSql = `(SELECT p.final_score FROM caregiver_evaluation_periods p
    WHERE p.caregiver_id=c.id ORDER BY p.created_at DESC LIMIT 1)`;
  const visibleCondition = `
    (c.cooperation_status IS NULL OR c.cooperation_status <> 'حذف‌شده')
    AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')
  `;

  const conditions = [visibleCondition];
  const args: unknown[] = [];
  if (query) {
    conditions.push(numeric
      ? `(COALESCE(c.membership_code,'') LIKE ? OR COALESCE(c.mobile,'') LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR ${normalizedName} LIKE ? OR COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.cooperation_status,'') LIKE ?)`
      : `(${normalizedName} LIKE ? OR COALESCE(c.membership_code,'') LIKE ? OR COALESCE(c.mobile,'') LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.cooperation_status,'') LIKE ?)`);
    args.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (gender === "male") {
    conditions.push(`LOWER(TRIM(COALESCE(c.gender,''))) IN ('male','m','مرد','آقا','مذکر')`);
  } else if (gender === "female") {
    conditions.push(`LOWER(TRIM(COALESCE(c.gender,''))) IN ('female','f','زن','خانم','مونث','مؤنث')`);
  } else if (gender === "unknown") {
    conditions.push(`TRIM(COALESCE(c.gender,''))=''`);
  }
  if (ageMin !== null) {
    conditions.push(`${ageSql} >= ?`);
    args.push(ageMin);
  }
  if (ageMax !== null) {
    conditions.push(`${ageSql} <= ?`);
    args.push(ageMax);
  }
  if (specialty) {
    conditions.push(`(COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.skills_json,'') LIKE ?)`);
    args.push(specialtyPattern, specialtyPattern);
  }
  const where = `WHERE ${conditions.map(condition => `(${condition})`).join(" AND ")}`;

  const orderBy: Record<SortKey, string> = {
    evaluation_due: `CASE WHEN ${lastEvaluationAtSql} IS NULL THEN 0 ELSE 1 END ASC, ${lastEvaluationAtSql} ASC, c.created_at ASC`,
    evaluation_recent: `CASE WHEN ${lastEvaluationAtSql} IS NULL THEN 1 ELSE 0 END ASC, ${lastEvaluationAtSql} DESC, c.created_at DESC`,
    created_desc: `c.created_at DESC, CAST(c.membership_code AS INTEGER) DESC`,
    created_asc: `c.created_at ASC, CAST(c.membership_code AS INTEGER) ASC`,
    age_asc: `CASE WHEN ${ageSql} IS NULL THEN 1 ELSE 0 END ASC, ${ageSql} ASC, c.created_at DESC`,
    age_desc: `CASE WHEN ${ageSql} IS NULL THEN 1 ELSE 0 END ASC, ${ageSql} DESC, c.created_at DESC`,
    score_desc: `COALESCE(c.professional_score,0) DESC, c.created_at DESC`,
    name_asc: `${normalizedName} COLLATE NOCASE ASC, c.created_at DESC`,
  };

  const cacheKey = JSON.stringify({ numeric, query: query.toLowerCase(), gender, ageMin, ageMax, specialty: specialty.toLowerCase() });
  const countStarted = performance.now();
  let total = cachedTotal(cacheKey);
  let countSource: CacheSource = "hit";
  let countRowsRead = 0;
  if (total === null) {
    countSource = "miss";
    const totalResult = await env.DB.prepare(`SELECT COUNT(*) AS total FROM caregivers c ${where}`)
      .bind(...args)
      .all<{ total: number }>();
    total = Number(totalResult.results?.[0]?.total || 0);
    countRowsRead = resultRowsRead(totalResult);
    storeTotal(cacheKey, total, query || gender || specialty || ageMin !== null || ageMax !== null ? 30_000 : 60_000);
  }
  const countMs = performance.now() - countStarted;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * pageSize;

  const rowsStarted = performance.now();
  const result = await env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.national_id AS nationalId,
      c.full_name AS fullName,c.mobile,c.city,c.service_region AS address,
      c.birth_date AS birthDate,c.gender,${ageSql} AS age,c.cooperation_status AS fileStatus,
      c.primary_type AS primaryType,c.skills_json AS skillsJson,c.work_history AS workHistory,
      c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,c.created_at AS createdAt,
      ${lastEvaluationAtSql} AS lastEvaluationAt,
      ${lastEvaluationStatusSql} AS lastEvaluationStatus,
      ${lastEvaluationScoreSql} AS lastEvaluationScore,
      u.id AS userId,u.username,u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    ${where}
    ORDER BY ${orderBy[sort]}
    LIMIT ? OFFSET ?`)
    .bind(...args, pageSize, offset)
    .all<Record<string, unknown>>();
  const rowsMs = performance.now() - rowsStarted;

  const items = (result.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}` : null,
    hasAccount: Boolean(row.userId),
  }));

  const response = json({
    status: "ok",
    data: {
      items,
      pagination: { page, pageSize, total, totalPages, hasPrevious: page > 1, hasNext: page < totalPages },
      query,
      filters: { gender, ageMin, ageMax, specialty, sort },
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
