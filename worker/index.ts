interface Env {
  DB: D1Database;
  CRM_SYNC_API_KEY: string;
  ASSETS: Fetcher;
}

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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const normalizeMobile = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;
  return digits;
};

const isAuthorized = (request: Request, env: Env) => {
  const header = request.headers.get("authorization");
  return Boolean(env.CRM_SYNC_API_KEY && header === `Bearer ${env.CRM_SYNC_API_KEY}`);
};

async function upsertCaregiver(env: Env, item: CaregiverPayload) {
  if (!item.crmRecordId || !item.fullName) {
    throw new Error("crmRecordId and fullName are required");
  }

  const now = new Date().toISOString();
  const mobile = normalizeMobile(item.mobile);
  const membershipCode = item.membershipCode || `CRM-${item.crmRecordId}`;

  await env.DB.prepare(`
    INSERT INTO caregivers (
      id, crm_record_id, membership_code, national_id, full_name, mobile,
      province, city, service_region, cooperation_status, active,
      crm_modified_on, last_synced_at, created_at, updated_at
    ) VALUES (
      lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(crm_record_id) DO UPDATE SET
      membership_code = excluded.membership_code,
      national_id = excluded.national_id,
      full_name = excluded.full_name,
      mobile = excluded.mobile,
      province = excluded.province,
      city = excluded.city,
      service_region = excluded.service_region,
      cooperation_status = excluded.cooperation_status,
      active = excluded.active,
      crm_modified_on = excluded.crm_modified_on,
      last_synced_at = excluded.last_synced_at,
      updated_at = excluded.updated_at
  `).bind(
    item.crmRecordId,
    membershipCode,
    item.nationalId || null,
    item.fullName.trim(),
    mobile,
    item.province || null,
    item.city || null,
    item.serviceRegion || null,
    item.cooperationStatus || null,
    item.active === false ? 0 : 1,
    item.crmModifiedOn || null,
    now,
    now,
    now,
  ).run();
}

async function handleBatchUpsert(request: Request, env: Env) {
  if (!isAuthorized(request, env)) return json({ error: "unauthorized" }, 401);

  const body = await request.json().catch(() => null) as { caregivers?: CaregiverPayload[] } | null;
  const caregivers = body?.caregivers;
  if (!Array.isArray(caregivers) || caregivers.length === 0) {
    return json({ error: "caregivers must be a non-empty array" }, 400);
  }
  if (caregivers.length > 500) {
    return json({ error: "maximum batch size is 500" }, 413);
  }

  const succeeded: string[] = [];
  const failed: Array<{ crmRecordId?: string; error: string }> = [];

  for (const item of caregivers) {
    try {
      await upsertCaregiver(env, item);
      succeeded.push(item.crmRecordId);
    } catch (error) {
      failed.push({
        crmRecordId: item.crmRecordId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  await env.DB.prepare(`
    INSERT INTO sync_runs (id, source, received_count, succeeded_count, failed_count, created_at)
    VALUES (lower(hex(randomblob(16))), 'DYNAMICS_ON_PREM', ?, ?, ?, ?)
  `).bind(caregivers.length, succeeded.length, failed.length, new Date().toISOString()).run();

  return json({ received: caregivers.length, succeeded: succeeded.length, failed });
}

async function handleCaregiverList(request: Request, env: Env) {
  if (!isAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const cursor = url.searchParams.get("cursor") || "";

  const result = await env.DB.prepare(`
    SELECT id, crm_record_id AS crmRecordId, membership_code AS membershipCode,
      national_id AS nationalId, full_name AS fullName, mobile, province, city,
      service_region AS serviceRegion, cooperation_status AS cooperationStatus,
      active, crm_modified_on AS crmModifiedOn, last_synced_at AS lastSyncedAt
    FROM caregivers
    WHERE id > ?
    ORDER BY id
    LIMIT ?
  `).bind(cursor, limit + 1).all<Record<string, unknown>>();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1]?.id || "") : null;
  return json({ items, nextCursor });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const db = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return json({ status: "ok", database: db?.ok === 1 ? "connected" : "unknown" });
    }

    if (request.method === "POST" && url.pathname === "/api/internal/crm/caregivers/upsert") {
      return handleBatchUpsert(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/internal/caregivers") {
      return handleCaregiverList(request, env);
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
