import { type Env, fail, getUser, json, normalizeRole, nowIso, randomId, readBody, securityHeaders, str } from "./lib";

/**
 * Standards-based Web Push for caregiver browsers/PWAs.
 * Cryptographic helpers are adapted from the MIT-licensed @block65/webcrypto-web-push v1.0.2
 * implementation, reduced to the aesgcm + VAPID path needed by this Worker.
 * Existing SMS delivery is intentionally independent and remains unchanged.
 */

export const CAREGIVER_WEB_PUSH_VERSION = "1.0.0";
const encoder = new TextEncoder();
const MAX_BODY = 500;
const MAX_TITLE = 90;

type PushEnv = Env & {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

type BrowserSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

type StoredSubscription = BrowserSubscription & {
  id: string;
  userId: string;
  caregiverId: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: string;
};

let schemaReady: Promise<void> | undefined;

function configured(env: PushEnv) {
  return Boolean(str(env.VAPID_PUBLIC_KEY) && str(env.VAPID_PRIVATE_KEY) && str(env.VAPID_SUBJECT));
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function base64UrlEncode(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeLength(value: number) {
  return new Uint8Array([0, value]);
}

function createInfo(clientPublic: Uint8Array, serverPublic: Uint8Array, type: "aesgcm" | "nonce") {
  return new Uint8Array([
    ...encoder.encode(`Content-Encoding: ${type}\0`),
    ...encoder.encode("P-256\0"),
    ...encodeLength(clientPublic.byteLength),
    ...clientPublic,
    ...encodeLength(serverPublic.byteLength),
    ...serverPublic,
  ]);
}

function createAuthInfo() {
  return encoder.encode("Content-Encoding: auth\0");
}

async function hmac(keyBytes: ArrayBuffer | Uint8Array, input: ArrayBuffer | Uint8Array) {
  const source = keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes);
  if (!source.byteLength) return new ArrayBuffer(32);
  const key = await crypto.subtle.importKey("raw", source, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, input instanceof Uint8Array ? input : new Uint8Array(input));
}

async function hkdfExtract(salt: ArrayBuffer | Uint8Array, ikm: ArrayBuffer | Uint8Array, info: ArrayBuffer | Uint8Array, length: number) {
  const prk = await hmac(salt, ikm);
  const infoBytes = info instanceof Uint8Array ? info : new Uint8Array(info);
  const block = new Uint8Array([...infoBytes, 1]);
  return (await hmac(prk, block)).slice(0, length);
}

function ecPointFromJwk(jwk: JsonWebKey) {
  if (!jwk.x || !jwk.y) throw new Error("web_push_ephemeral_key_invalid");
  return new Uint8Array([0x04, ...base64UrlDecode(jwk.x), ...base64UrlDecode(jwk.y)]);
}

function nonceFor(base: Uint8Array, index: number) {
  const nonce = base.slice(0, 12);
  for (let i = 0; i < 6; i += 1) nonce[nonce.length - 1 - i] ^= (index / 256 ** i) & 0xff;
  return nonce;
}

async function encryptPayload(subscription: BrowserSubscription, plaintext: Uint8Array) {
  const clientPublicBytes = base64UrlDecode(subscription.keys.p256dh);
  if (clientPublicBytes.length !== 65 || clientPublicBytes[0] !== 0x04) throw new Error("web_push_p256dh_invalid");
  const clientPublicKey = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256",
    x: base64UrlEncode(clientPublicBytes.slice(1, 33)),
    y: base64UrlEncode(clientPublicBytes.slice(33, 65)),
    ext: true,
  }, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localJwk = await crypto.subtle.exportKey("jwk", localKeys.publicKey);
  const localPublicBytes = ecPointFromJwk(localJwk);
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, localKeys.privateKey, 256);
  const authSecret = base64UrlDecode(subscription.keys.auth);
  const ikm = await hkdfExtract(authSecret, sharedSecret, createAuthInfo(), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdfExtract(salt, ikm, createInfo(clientPublicBytes, localPublicBytes, "aesgcm"), 16);
  const nonce = new Uint8Array(await hkdfExtract(salt, ikm, createInfo(clientPublicBytes, localPublicBytes, "nonce"), 12));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM", length: 128 }, false, ["encrypt"]);
  const chunks: Uint8Array[] = [];
  for (let offset = 0, index = 0; offset < plaintext.length || (plaintext.length === 0 && index === 0); offset += 4095, index += 1) {
    const chunk = plaintext.slice(offset, offset + 4095);
    const padded = new Uint8Array([0, 0, ...chunk]);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceFor(nonce, index) }, aesKey, padded);
    chunks.push(new Uint8Array(encrypted));
    if (!plaintext.length) break;
  }
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const ciphertext = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { ciphertext.set(chunk, cursor); cursor += chunk.byteLength; }
  return { ciphertext, salt, localPublicBytes };
}

async function vapidHeaders(subscription: BrowserSubscription, env: PushEnv) {
  const publicValue = str(env.VAPID_PUBLIC_KEY), privateValue = str(env.VAPID_PRIVATE_KEY), subject = str(env.VAPID_SUBJECT);
  if (!publicValue || !privateValue || !subject) throw new Error("web_push_vapid_not_configured");
  const publicBytes = base64UrlDecode(publicValue);
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) throw new Error("web_push_vapid_public_key_invalid");
  const signingKey = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256",
    x: base64UrlEncode(publicBytes.slice(1, 33)),
    y: base64UrlEncode(publicBytes.slice(33, 65)),
    d: privateValue,
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({ aud: new URL(subscription.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject })));
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, encoder.encode(signingInput));
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  return { authorization: `WebPush ${jwt}`, cryptoKey: `p256ecdsa=${publicValue}` };
}

async function buildPushRequest(subscription: BrowserSubscription, payload: PushPayload, env: PushEnv) {
  const message = encoder.encode(JSON.stringify({
    title: str(payload.title).slice(0, MAX_TITLE) || "باشگاه مراقبین سلامت اول",
    body: str(payload.body).slice(0, MAX_BODY),
    url: str(payload.url) || "/mobile/notifications",
    tag: str(payload.tag) || "salamat-caregiver",
    kind: str(payload.kind) || "CAREGIVER_NOTIFICATION",
    icon: "/logo-salamat-aval.svg",
    badge: "/logo-salamat-aval.svg",
  }));
  const [encrypted, vapid] = await Promise.all([encryptPayload(subscription, message), vapidHeaders(subscription, env)]);
  return new Request(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization: vapid.authorization,
      "crypto-key": `dh=${base64UrlEncode(encrypted.localPublicBytes)};${vapid.cryptoKey}`,
      encryption: `salt=${base64UrlEncode(encrypted.salt)}`,
      ttl: "3600",
      "content-encoding": "aesgcm",
      "content-type": "application/octet-stream",
    },
    body: encrypted.ciphertext,
  });
}

export async function ensureCaregiverWebPushSchema(env: PushEnv) {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_push_subscriptions(
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,endpoint TEXT NOT NULL,endpoint_hash TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,auth TEXT NOT NULL,expiration_time TEXT,user_agent TEXT,platform TEXT,enabled INTEGER NOT NULL DEFAULT 1,
      failure_count INTEGER NOT NULL DEFAULT 0,last_success_at TEXT,last_failure_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_caregiver_push_user_enabled ON caregiver_push_subscriptions(user_id,enabled,updated_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_caregiver_push_caregiver_enabled ON caregiver_push_subscriptions(caregiver_id,enabled,updated_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_push_delivery_log(
      id TEXT PRIMARY KEY,subscription_id TEXT,recipient_user_id TEXT,caregiver_id TEXT,kind TEXT NOT NULL,status TEXT NOT NULL,
      http_status INTEGER,error_code TEXT,created_at TEXT NOT NULL,
      FOREIGN KEY(subscription_id) REFERENCES caregiver_push_subscriptions(id) ON DELETE SET NULL,
      FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_caregiver_push_delivery_recipient ON caregiver_push_delivery_log(recipient_user_id,created_at DESC)"),
  ]).then(() => undefined).catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

async function subscriptionsForCaregiver(env: PushEnv, caregiverId: string) {
  await ensureCaregiverWebPushSchema(env);
  const result = await env.DB.prepare(`SELECT id,user_id AS userId,caregiver_id AS caregiverId,endpoint,p256dh,auth,expiration_time AS expirationTime
    FROM caregiver_push_subscriptions WHERE caregiver_id=? AND enabled=1 ORDER BY updated_at DESC LIMIT 10`).bind(caregiverId).all<any>();
  return (result.results || []).map((row) => ({ ...row, keys: { p256dh: row.p256dh, auth: row.auth } })) as StoredSubscription[];
}

async function logDelivery(env: PushEnv, sub: StoredSubscription, kind: string, status: string, httpStatus?: number, error?: unknown) {
  await env.DB.prepare(`INSERT INTO caregiver_push_delivery_log(id,subscription_id,recipient_user_id,caregiver_id,kind,status,http_status,error_code,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(randomId("psh_"), sub.id, sub.userId, sub.caregiverId, kind, status, httpStatus || null, str(error instanceof Error ? error.message : error).slice(0, 500) || null, nowIso()).run().catch(() => undefined);
}

export async function sendCaregiverWebPush(env: PushEnv, caregiverId: string, payload: PushPayload) {
  if (!configured(env) || !caregiverId) return { attempted: 0, sent: 0, configured: configured(env), skipped: true };
  const subscriptions = await subscriptionsForCaregiver(env, caregiverId);
  let sent = 0, failed = 0, expired = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      const response = await fetch(await buildPushRequest(sub, payload, env));
      if (response.ok) {
        sent += 1;
        await env.DB.prepare("UPDATE caregiver_push_subscriptions SET failure_count=0,last_success_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), sub.id).run().catch(() => undefined);
        await logDelivery(env, sub, str(payload.kind) || "CAREGIVER_NOTIFICATION", "SENT", response.status);
        return;
      }
      if (response.status === 404 || response.status === 410) {
        expired += 1;
        await env.DB.prepare("UPDATE caregiver_push_subscriptions SET enabled=0,last_failure_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), sub.id).run().catch(() => undefined);
        await logDelivery(env, sub, str(payload.kind) || "CAREGIVER_NOTIFICATION", "EXPIRED", response.status);
        return;
      }
      failed += 1;
      await env.DB.prepare("UPDATE caregiver_push_subscriptions SET failure_count=failure_count+1,last_failure_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), sub.id).run().catch(() => undefined);
      await logDelivery(env, sub, str(payload.kind) || "CAREGIVER_NOTIFICATION", "FAILED", response.status, `push_http_${response.status}`);
    } catch (error) {
      failed += 1;
      await env.DB.prepare("UPDATE caregiver_push_subscriptions SET failure_count=failure_count+1,last_failure_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), sub.id).run().catch(() => undefined);
      await logDelivery(env, sub, str(payload.kind) || "CAREGIVER_NOTIFICATION", "FAILED", undefined, error);
    }
  }));
  return { attempted: subscriptions.length, sent, failed, expired, configured: true };
}

function routeUrl(value: unknown) {
  const route = str(value).toLowerCase();
  if (route.includes("wallet") || route.includes("financ")) return "/mobile/wallet";
  if (route.includes("training")) return "/mobile/training";
  if (route.includes("score") || route.includes("evaluation") || route.includes("rank")) return "/mobile/scorecard";
  if (route.includes("support")) return "/mobile/support";
  if (route.includes("job")) return "/mobile/jobs";
  if (route.includes("shift") || route.includes("calendar")) return "/mobile/shifts";
  if (route.includes("benefit") || route.includes("credit")) return "/mobile/benefits";
  return "/mobile/notifications";
}

export async function processPendingCaregiverWebPushV1(env: PushEnv, limit = 30) {
  if (!configured(env)) return { processed: 0, sent: 0, configured: false };
  await ensureCaregiverWebPushSchema(env);
  // system_notifications is owned by the existing SMS/in-app notification layer. We only fan it out; we never delete or alter SMS state.
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit) || 30));
  const rows = await env.DB.prepare(`SELECT n.id,n.caregiver_id AS caregiverId,n.title,n.message,n.route,n.category
    FROM system_notifications n
    WHERE n.caregiver_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM caregiver_push_delivery_log d WHERE d.kind=('SYSTEM_NOTIFICATION:'||n.id)
    ) ORDER BY n.created_at ASC LIMIT ?`).bind(bounded).all<any>().catch(() => ({ results: [] as any[] }));
  let processed = 0, sent = 0;
  for (const row of rows.results || []) {
    const result = await sendCaregiverWebPush(env, str(row.caregiverId), {
      title: str(row.title), body: str(row.message), url: routeUrl(row.route), tag: `system-${str(row.id)}`, kind: `SYSTEM_NOTIFICATION:${str(row.id)}`,
    });
    processed += 1;
    sent += Number(result.sent || 0);
  }
  return { processed, sent, configured: true };
}

async function caregiverActor(request: Request, env: PushEnv) {
  const user = await getUser(request, env);
  if (!user) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  if (normalizeRole(user.role) !== "CAREGIVER" || !user.caregiverId) return { response: securityHeaders(fail("این قابلیت فقط برای مراقب فعال است.", 403, "caregiver_only")) };
  return { user };
}

export async function routeCaregiverWebPushV1(request: Request, env: PushEnv) {
  const url = new URL(request.url), method = request.method.toUpperCase();
  if (!url.pathname.startsWith("/api/caregiver/push/")) return null;
  const auth = await caregiverActor(request, env);
  if ("response" in auth) return auth.response;
  const user = auth.user!;
  await ensureCaregiverWebPushSchema(env);

  if (url.pathname === "/api/caregiver/push/config" && method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM caregiver_push_subscriptions WHERE user_id=? AND enabled=1").bind(user.id).first<{ total: number }>();
    return securityHeaders(json({ data: { version: CAREGIVER_WEB_PUSH_VERSION, configured: configured(env), publicKey: configured(env) ? str(env.VAPID_PUBLIC_KEY) : "", activeSubscriptions: Number(row?.total || 0) } }));
  }

  if (url.pathname === "/api/caregiver/push/subscriptions" && method === "POST") {
    if (!configured(env)) return securityHeaders(fail("کلیدهای Web Push هنوز روی سرور تنظیم نشده‌اند.", 503, "web_push_not_configured"));
    const body = await readBody(request), endpoint = str(body?.endpoint), keys = body?.keys && typeof body.keys === "object" && !Array.isArray(body.keys) ? body.keys as Record<string, unknown> : {};
    const p256dh = str(keys.p256dh), authKey = str(keys.auth);
    if (!endpoint.startsWith("https://") || endpoint.length > 2500 || p256dh.length < 40 || authKey.length < 10) return securityHeaders(fail("اشتراک اعلان مرورگر معتبر نیست.", 400, "invalid_push_subscription"));
    const hash = await sha256(endpoint), ts = nowIso(), expiration = body?.expirationTime == null ? null : new Date(Number(body.expirationTime)).toISOString();
    await env.DB.prepare(`INSERT INTO caregiver_push_subscriptions(id,user_id,caregiver_id,endpoint,endpoint_hash,p256dh,auth,expiration_time,user_agent,platform,enabled,failure_count,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,1,0,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=excluded.user_id,caregiver_id=excluded.caregiver_id,p256dh=excluded.p256dh,auth=excluded.auth,expiration_time=excluded.expiration_time,user_agent=excluded.user_agent,platform=excluded.platform,enabled=1,failure_count=0,updated_at=excluded.updated_at`).bind(
      randomId("sub_"), user.id, user.caregiverId, endpoint, hash, p256dh, authKey, expiration, str(request.headers.get("user-agent")).slice(0, 500), str(body?.platform).slice(0, 80), ts, ts,
    ).run();
    return securityHeaders(json({ ok: true, data: { enabled: true } }, 201));
  }

  if (url.pathname === "/api/caregiver/push/subscriptions" && method === "DELETE") {
    const body = await readBody(request), endpoint = str(body?.endpoint);
    if (!endpoint) return securityHeaders(fail("آدرس اشتراک اعلان ارسال نشده است.", 400, "push_endpoint_required"));
    const hash = await sha256(endpoint);
    await env.DB.prepare("UPDATE caregiver_push_subscriptions SET enabled=0,updated_at=? WHERE user_id=? AND endpoint_hash=?").bind(nowIso(), user.id, hash).run();
    return securityHeaders(json({ ok: true, data: { enabled: false } }));
  }

  if (url.pathname === "/api/caregiver/push/test" && method === "POST") {
    const result = await sendCaregiverWebPush(env, user.caregiverId, { title: "اعلان‌های سلامت اول فعال شد", body: "از این پس اطلاع‌رسانی‌های باشگاه را روی همین دستگاه دریافت می‌کنید. پیامک‌های فعلی نیز همچنان فعال می‌مانند.", url: "/mobile/notifications", tag: "push-test", kind: "PUSH_TEST" });
    if (!result.sent) return securityHeaders(fail(result.attempted ? "ارسال اعلان آزمایشی انجام نشد." : "اشتراک فعالی برای این دستگاه ثبت نشده است.", 503, "push_test_failed"));
    return securityHeaders(json({ ok: true, data: result }));
  }

  return securityHeaders(fail("مسیر Web Push پیدا نشد.", 404, "push_route_not_found"));
}
