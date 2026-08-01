import {
  type AuthUser,
  type Env,
  fail,
  hasRole,
  json,
  str,
} from "./lib";
import { ensureProfileImageSchema } from "./profile-images";
import { ensurePerformanceSchema } from "./performance-schema";

const STAFF_ROLES = ["ADMIN", "RECRUITER", "HR", "EVALUATOR", "EDUCATION"];
const PAGE_SIZE = 50;
const countCache = new Map<string, { total: number; expiresAt: number }>();

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
  return /^(internal|legacy|deleted|crm-login)-/i.test(mobile) ? "" : mobile;
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

export function invalidateTrainingCaregiverCache() {
  countCache.clear();
}

export async function getTrainingCaregivers(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (!hasRole(actor, STAFF_ROLES)) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  await ensureProfileImageSchema(env);
  await ensurePerformanceSchema(env);

  const url = new URL(request.url);
  const query = str(url.searchParams.get("q")).slice(0, 120);
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pattern = `%${query}%`;
  const numeric = /^\d+$/.test(query);
  const visible = `c.active=1
      AND COALESCE(c.recruitment_stage,'')<>'DELETED'
      AND COALESCE(c.cooperation_status,'')<>'حذف‌شده'
      AND COALESCE(u.status,'ACTIVE')<>'DELETED'
      AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')`;
  const where = !query
    ? visible
    : numeric
      ? `${visible} AND (
          c.membership_code=? OR COALESCE(c.mobile,'')=? OR
          c.full_name LIKE ? OR COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.city,'') LIKE ?
        )`
      : `${visible} AND (
          c.full_name LIKE ? OR c.membership_code LIKE ? OR COALESCE(c.mobile,'') LIKE ? OR
          COALESCE(c.primary_type,'') LIKE ? OR COALESCE(c.city,'') LIKE ?
        )`;
  const args = !query
    ? []
    : numeric
      ? [query, query, pattern, pattern, pattern]
      : [pattern, pattern, pattern, pattern, pattern];

  const cacheKey = query.toLowerCase();
  let total = cachedTotal(cacheKey);
  if (total === null) {
    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total
        FROM caregivers c
        LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER'
        WHERE ${where}`)
      .bind(...args)
      .first<{ total: number }>();
    total = Number(countRow?.total || 0);
    storeTotal(cacheKey, total, query ? 10_000 : 30_000);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.full_name AS fullName,c.mobile,
      c.city,c.primary_type AS primaryType,c.cooperation_status AS fileStatus,
      u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER'
    WHERE ${where}
    ORDER BY c.full_name COLLATE NOCASE ASC,CAST(c.membership_code AS INTEGER) ASC
    LIMIT ? OFFSET ?`)
    .bind(...args, PAGE_SIZE, offset)
    .all<TrainingCaregiverRow>();

  const data = (result.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId
      ? `/api/profile-images/${encodeURIComponent(row.avatarId)}`
      : null,
  }));

  return json({
    data,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    query,
  });
}
