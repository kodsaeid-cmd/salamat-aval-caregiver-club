export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CRM_SYNC_API_KEY?: string;
  ADMIN_SETUP_KEY?: string;
  OTP_DEBUG?: string;
  DATABASE_BACKEND?: string;
  PARSPACK_S3_ENDPOINT?: string;
  PARSPACK_S3_BUCKET?: string;
  PARSPACK_S3_ACCESS_KEY?: string;
  PARSPACK_S3_SECRET_KEY?: string;
  PARSPACK_S3_REGION?: string;
}

export type AuthUser = {
  id: string;
  caregiverId: string | null;
  fullName: string;
  mobile: string;
  username: string | null;
  role: string;
  status: string;
  permissionsJson: string;
};

export type JsonObject = Record<string, unknown>;
export const SESSION_COOKIE = "salamat_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000;
const SESSION_TOUCH_CACHE_LIMIT = 5000;
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();
const sessionTouchCache = new Map<string, number>();
let schemaReady: Promise<void> | undefined;

export const json = (data: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  h.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers: h });
};
export const fail = (message: string, status = 400, code = "request_failed") => json({ error: code, message }, status);
export const nowIso = () => new Date().toISOString();
export const randomId = (prefix = "") => `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
export const str = (value: unknown) => String(value ?? "").trim();
export const nullable = (value: unknown) => str(value) || null;
export const int = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
export const normalizeMobile = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;
  return digits;
};
export const STAFF_ROLE_KEYS = ["ADMIN", "RECRUITER", "HR", "SUPPORT", "EVALUATOR", "EDUCATION", "OPERATIONS", "SALES_CONSULTANT", "SALES_SUPERVISOR"] as const;
export const USER_ROLE_KEYS = ["CAREGIVER", ...STAFF_ROLE_KEYS] as const;
export const normalizeRole = (value: unknown) => {
  const role = str(value).toUpperCase();
  return (USER_ROLE_KEYS as readonly string[]).includes(role) ? role : "CAREGIVER";
};
export const normalizeStatus = (value: unknown, fallback = "PENDING") => {
  const valueUpper = str(value).toUpperCase();
  const map: Record<string, string> = { APPROVED: "ACTIVE", ACTIVE: "ACTIVE", PENDING: "PENDING", INACTIVE: "INACTIVE", SUSPENDED: "SUSPENDED" };
  return map[valueUpper] || fallback;
};

export async function readBody(request: Request): Promise<JsonObject | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as JsonObject : null;
}

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
export async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, iterationText, saltHex, expectedHex] = stored.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !saltHex || !expectedHex || iterations < 50_000 || iterations > PBKDF2_ITERATIONS) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations }, key, 256));
  const expected = hexToBytes(expectedHex);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) mismatch |= actual[i] ^ expected[i];
  return mismatch === 0;
}

export function cookies(request: Request) {
  const result: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const split = part.indexOf("=");
    if (split > 0) result[part.slice(0, split).trim()] = decodeURIComponent(part.slice(split + 1).trim());
  }
  return result;
}
export const sessionCookie = (token: string, maxAge = SESSION_TTL_SECONDS) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function ensureSchema(env: Env) {
  if (String(env.DATABASE_BACKEND || "").trim().toLowerCase() === "turso") return;
  if (!schemaReady) {
    const statements = [
      `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,ip_address TEXT,user_agent TEXT,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id,expires_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`,
      `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,contract_number TEXT NOT NULL UNIQUE,family_name TEXT NOT NULL,service_type TEXT,status TEXT NOT NULL DEFAULT 'DRAFT',starts_at TEXT,ends_at TEXT,work_days TEXT,monthly_hours INTEGER NOT NULL DEFAULT 0,logged_hours INTEGER NOT NULL DEFAULT 0,overtime_hours INTEGER NOT NULL DEFAULT 0,absent_hours INTEGER NOT NULL DEFAULT 0,payment_type TEXT,payment_rate INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_contracts_caregiver_status ON contracts(caregiver_id,status)`,
      `CREATE TABLE IF NOT EXISTS security_reports (id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,subject TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'MEDIUM',description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN',created_by_user_id TEXT,closed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS organization_settings (key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_by_user_id TEXT,updated_at TEXT NOT NULL,FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS caregiver_professional_meta (caregiver_id TEXT PRIMARY KEY,rank_code TEXT,rank_title TEXT,rank_stars INTEGER NOT NULL DEFAULT 0,pri_score INTEGER,rank_decision_ref TEXT,rank_valid_from TEXT,rank_valid_to TEXT,license_number TEXT,license_status TEXT NOT NULL DEFAULT 'NOT_ISSUED',license_expires_at TEXT,license_decision_ref TEXT,updated_by_user_id TEXT,updated_at TEXT NOT NULL,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS ui_state (scope TEXT PRIMARY KEY,state_json TEXT NOT NULL,updated_by_user_id TEXT,updated_at TEXT NOT NULL,FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS stored_files (id TEXT PRIMARY KEY,caregiver_id TEXT,category TEXT NOT NULL,original_name TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,content_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,checksum_sha256 TEXT,uploaded_by_user_id TEXT NOT NULL,created_at TEXT NOT NULL,deleted_at TEXT,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT)`,
      `CREATE INDEX IF NOT EXISTS idx_stored_files_caregiver_created ON stored_files(caregiver_id,created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_stored_files_category_created ON stored_files(category,created_at DESC)`,
    ];
    schemaReady = env.DB.batch(statements.map((sql) => env.DB.prepare(sql))).then(() => undefined).catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

export async function createSession(request: Request, env: Env, userId: string) {
  await ensureSchema(env);
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at,ip_address,user_agent) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(randomId("ses_"), userId, tokenHash, expiresAt, createdAt, createdAt, request.headers.get("cf-connecting-ip"), request.headers.get("user-agent")).run();
  return { token, expiresAt };
}

export async function getUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = cookies(request)[SESSION_COOKIE];
  if (!token) return null;
  await ensureSchema(env);
  const hash = await sha256(token);
  const timestamp = nowIso();
  const user = await env.DB.prepare(`SELECT
      u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,
      u.role,u.status,u.permissions_json AS permissionsJson,s.last_seen_at AS lastSeenAt
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`)
    .bind(hash, timestamp)
    .first<AuthUser & { lastSeenAt?: string }>();
  if (!user || !["ACTIVE", "APPROVED"].includes(user.status.toUpperCase())) return null;

  const now = Date.now();
  const cachedTouch = sessionTouchCache.get(hash) || 0;
  const databaseTouch = Date.parse(user.lastSeenAt || "") || 0;
  const lastTouch = Math.max(cachedTouch, databaseTouch);
  if (now - lastTouch >= SESSION_TOUCH_INTERVAL_MS) {
    sessionTouchCache.set(hash, now);
    if (sessionTouchCache.size > SESSION_TOUCH_CACHE_LIMIT) {
      sessionTouchCache.delete(sessionTouchCache.keys().next().value || "");
    }
    const cutoff = new Date(now - SESSION_TOUCH_INTERVAL_MS).toISOString();
    await env.DB.prepare("UPDATE sessions SET last_seen_at=? WHERE token_hash=? AND last_seen_at<?")
      .bind(new Date(now).toISOString(), hash, cutoff)
      .run()
      .catch(() => undefined);
  }

  const { lastSeenAt: _lastSeenAt, ...authUser } = user;
  return authUser;
}

export const staffRoles = [...STAFF_ROLE_KEYS];
export const hasRole = (user: AuthUser | null, roles: string[]) => Boolean(user && roles.includes(user.role.toUpperCase()));
export async function findCaregiverId(env: Env, value: unknown) {
  const id = str(value);
  if (!id) return null;
  const row = await env.DB.prepare("SELECT id FROM caregivers WHERE id=? OR membership_code=? LIMIT 1").bind(id, id).first<{ id: string }>();
  return row?.id || null;
}

export async function audit(request: Request, env: Env, actor: AuthUser | null, action: string, entityType: string, entityId: string | null, after?: unknown) {
  await env.DB.prepare(`INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,before_json,after_json,ip_address,created_at) VALUES(?,?,?,?,?,NULL,?,?,?)`)
    .bind(randomId("aud_"), actor?.id || null, action, entityType, entityId, after === undefined ? null : JSON.stringify(after), request.headers.get("cf-connecting-ip"), nowIso()).run().catch(() => undefined);
}

export function securityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("content-security-policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}