import {
  type Env, fail, getUser, hasRole, json, normalizeMobile, nowIso, randomId,
  readBody, staffRoles, str,
} from "./lib";

type CaregiverPayload = {
  crmRecordId: string;
  membershipCode?: string;
  nationalId?: string | null;
  fullName: string;
  mobile?: string | null;
  province?: string | null;
  city?: string | null;
  serviceRegion?: string | null;
  cooperationStatus?: string | null;
  crmModifiedOn?: string | null;
  active?: boolean;
};

const crmAuthorized = (request: Request, env: Env) => {
  const header = request.headers.get("authorization");
  return Boolean(env.CRM_SYNC_API_KEY && header === `Bearer ${env.CRM_SYNC_API_KEY}`);
};

async function upsertCaregiver(env: Env, item: CaregiverPayload) {
  if (!item.crmRecordId || !item.fullName) throw new Error("crmRecordId and fullName are required");
  const timestamp = nowIso();
  const mobile = normalizeMobile(item.mobile);
  const membershipCode = str(item.membershipCode) || `CRM-${item.crmRecordId}`;
  await env.DB.prepare(`
    INSERT INTO caregivers (
      id, crm_record_id, membership_code, national_id, full_name, mobile,
      province, city, service_region, cooperation_status, active,
      crm_modified_on, last_synced_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(crm_record_id) DO UPDATE SET
      membership_code=excluded.membership_code,
      national_id=excluded.national_id,
      full_name=excluded.full_name,
      mobile=excluded.mobile,
      province=excluded.province,
      city=excluded.city,
      service_region=excluded.service_region,
      cooperation_status=excluded.cooperation_status,
      active=excluded.active,
      crm_modified_on=excluded.crm_modified_on,
      last_synced_at=excluded.last_synced_at,
      updated_at=excluded.updated_at
  `).bind(
    randomId("care_"), item.crmRecordId, membershipCode, item.nationalId || null,
    item.fullName.trim(), mobile, item.province || null, item.city || null,
    item.serviceRegion || null, item.cooperationStatus || null,
    item.active === false ? 0 : 1, item.crmModifiedOn || null,
    timestamp, timestamp, timestamp,
  ).run();
}

export async function batchUpsert(request: Request, env: Env) {
  if (!crmAuthorized(request, env)) return fail("دسترسی غیرمجاز است.", 401, "unauthorized");
  const body = await readBody(request);
  const items = body?.caregivers;
  if (!Array.isArray(items) || items.length === 0) return fail("caregivers must be a non-empty array");
  if (items.length > 500) return fail("maximum batch size is 500", 413);

  const succeeded: string[] = [];
  const failed: Array<{ crmRecordId?: string; error: string }> = [];
  for (const value of items) {
    const item = value as CaregiverPayload;
    try {
      await upsertCaregiver(env, item);
      succeeded.push(item.crmRecordId);
    } catch (error) {
      failed.push({ crmRecordId: item?.crmRecordId, error: error instanceof Error ? error.message : "unknown error" });
    }
  }
  await env.DB.prepare(`INSERT INTO sync_runs(id,source,received_count,succeeded_count,failed_count,created_at) VALUES(?,'DYNAMICS_ON_PREM',?,?,?,?)`)
    .bind(randomId("sync_"), items.length, succeeded.length, failed.length, nowIso()).run();
  return json({ received: items.length, succeeded: succeeded.length, failed });
}

export async function caregiverList(request: Request, env: Env) {
  const user = await getUser(request, env);
  if (!crmAuthorized(request, env) && !hasRole(user, staffRoles)) return fail("دسترسی غیرمجاز است.", 401, "unauthorized");
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const cursor = url.searchParams.get("cursor") || "";
  const result = await env.DB.prepare(`
    SELECT id,crm_record_id AS crmRecordId,membership_code AS membershipCode,
      national_id AS nationalId,full_name AS fullName,mobile,province,city,
      service_region AS serviceRegion,cooperation_status AS cooperationStatus,
      active,crm_modified_on AS crmModifiedOn,last_synced_at AS lastSyncedAt
    FROM caregivers WHERE id>? ORDER BY id LIMIT ?
  `).bind(cursor, limit + 1).all<Record<string, unknown>>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return json({ items, nextCursor: hasMore ? String(items[items.length - 1]?.id || "") : null });
}
