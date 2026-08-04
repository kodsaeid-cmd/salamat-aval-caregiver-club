import { requireAccess } from "./access-control";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  getUser,
  json,
  nowIso,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const MODULE_KEY = "staff.settings";
const SETTINGS_KEY = "admin_ui_profile_v1";
const VERSION = "3.0.1";
const MODULE_CONTRACT_VERSION = "3.0.0";
const DEFAULT_SETTINGS = {
  systemName: "باشگاه مراقبین سلامت اول",
  organizationName: "سلامت اول",
  supportPhone: "1527",
  supportAvailability: "پشتیبانی ۲۴/۷",
  supportDescription: "تماس با مرکز پاسخگویی",
};

type Settings = typeof DEFAULT_SETTINGS;
type JsonRow = Record<string, unknown>;
let schemaReady: Promise<void> | undefined;

async function ensureToolsSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureSchema(env);
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS organization_settings (
          key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_by_user_id TEXT,updated_at TEXT NOT NULL,
          FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,actor_user_id TEXT,action TEXT NOT NULL,entity_type TEXT NOT NULL,
          entity_id TEXT,after_json TEXT,ip_address TEXT,created_at TEXT NOT NULL,
          FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action,created_at DESC)"),
      ]);
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

async function actorFor(request: Request, env: Env, action: "view" | "update") {
  const actor = await getUser(request, env);
  if (!actor) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  const denied = await requireAccess(env, actor, MODULE_KEY, action);
  return denied ? { response: securityHeaders(denied) } : { actor };
}

function clean(value: unknown, fallback: string, max = 120) {
  const text = str(value).replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, max);
}

function normalizeSettings(value: unknown): Settings {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const phone = str(row.supportPhone).replace(/[^0-9+]/g, "").slice(0, 20) || DEFAULT_SETTINGS.supportPhone;
  return {
    systemName: clean(row.systemName, DEFAULT_SETTINGS.systemName, 100),
    organizationName: clean(row.organizationName, DEFAULT_SETTINGS.organizationName, 100),
    supportPhone: phone,
    supportAvailability: clean(row.supportAvailability, DEFAULT_SETTINGS.supportAvailability, 80),
    supportDescription: clean(row.supportDescription, DEFAULT_SETTINGS.supportDescription, 160),
  };
}

async function readSettings(env: Env) {
  await ensureToolsSchema(env);
  const row = await env.DB.prepare(`SELECT value_json AS valueJson,updated_at AS updatedAt,
    updated_by_user_id AS updatedByUserId FROM organization_settings WHERE key=? LIMIT 1`)
    .bind(SETTINGS_KEY).first<{ valueJson: string; updatedAt: string; updatedByUserId: string | null }>();
  if (!row) return { settings: DEFAULT_SETTINGS, updatedAt: null, updatedByUserId: null };
  let parsed: unknown = {};
  try { parsed = JSON.parse(row.valueJson); } catch { parsed = {}; }
  return { settings: normalizeSettings(parsed), updatedAt: row.updatedAt, updatedByUserId: row.updatedByUserId };
}

async function getSettings(request: Request, env: Env) {
  const auth = await actorFor(request, env, "view");
  if (auth.response) return auth.response;
  const data = await readSettings(env);
  return securityHeaders(json({ data: { ...data, version: VERSION } }));
}

async function updateSettings(request: Request, env: Env, actor: AuthUser) {
  await ensureToolsSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات تنظیمات معتبر نیست."));
  const settings = normalizeSettings(body.settings || body);
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO organization_settings(key,value_json,updated_by_user_id,updated_at)
    VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,
    updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
    .bind(SETTINGS_KEY, JSON.stringify(settings), actor.id, timestamp).run();
  await audit(request, env, actor, "UPDATE_SYSTEM_SETTINGS", "organization_settings", SETTINGS_KEY, settings);
  return securityHeaders(json({ data: { settings, updatedAt: timestamp, updatedByUserId: actor.id, version: VERSION } }));
}

function parseAfter(value: unknown) {
  if (!value) return null;
  try { return JSON.parse(String(value)); } catch { return String(value); }
}

async function listAuditLogs(request: Request, env: Env) {
  const auth = await actorFor(request, env, "view");
  if (auth.response) return auth.response;
  await ensureToolsSchema(env);
  const url = new URL(request.url);
  const query = str(url.searchParams.get("q")).slice(0, 120);
  const action = str(url.searchParams.get("action")).slice(0, 100);
  const entityType = str(url.searchParams.get("entityType")).slice(0, 100);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get("pageSize") || "50", 10) || 50));
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (query) {
    const like = `%${query}%`;
    clauses.push(`(a.action LIKE ? OR a.entity_type LIKE ? OR a.entity_id LIKE ? OR u.full_name LIKE ? OR a.ip_address LIKE ?)`);
    bindings.push(like, like, like, like, like);
  }
  if (action) { clauses.push("a.action=?"); bindings.push(action); }
  if (entityType) { clauses.push("a.entity_type=?"); bindings.push(entityType); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const [count, rows, facets] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ${where}`)
      .bind(...bindings).first<{ total: number }>(),
    env.DB.prepare(`SELECT a.id,a.actor_user_id AS actorUserId,u.full_name AS actorName,u.role AS actorRole,
      a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.after_json AS afterJson,
      a.ip_address AS ipAddress,a.created_at AS createdAt FROM audit_logs a
      LEFT JOIN users u ON u.id=a.actor_user_id ${where}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all<JsonRow>(),
    env.DB.prepare(`SELECT action,COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 30`)
      .all<{ action: string; count: number }>(),
  ]);
  const total = Number(count?.total || 0);
  return securityHeaders(json({
    data: {
      logs: (rows.results || []).map((row) => ({ ...row, after: parseAfter(row.afterJson), afterJson: undefined })),
      actions: facets.results || [],
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      filters: { query, action, entityType },
    },
  }));
}

export async function routeAdminSystemToolsV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (url.pathname === "/api/system/admin-core-version" && method === "GET") {
    return securityHeaders(json({
      status: "ok",
      adminCoreModules: VERSION,
      moduleContractVersion: MODULE_CONTRACT_VERSION,
      features: ["training", "financial_credits", "payroll", "settings", "audit_logs"],
    }));
  }
  if (url.pathname === "/api/staff/system-settings" && method === "GET") return getSettings(request, env);
  if (url.pathname === "/api/staff/system-settings" && method === "PUT") {
    const auth = await actorFor(request, env, "update");
    if (auth.response) return auth.response;
    return updateSettings(request, env, auth.actor!);
  }
  if (url.pathname === "/api/staff/audit-logs" && method === "GET") return listAuditLogs(request, env);
  return null;
}
