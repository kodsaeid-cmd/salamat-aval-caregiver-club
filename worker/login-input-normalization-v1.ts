import { type Env, hashPassword, normalizeMobile, nowIso, randomId, str } from "./lib";

const ASCII = "0123456789";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

export function normalizeUnicodeDigits(value: unknown) {
  return str(value)
    .replace(/[۰-۹]/g, (digit) => ASCII[PERSIAN.indexOf(digit)] || digit)
    .replace(/[٠-٩]/g, (digit) => ASCII[ARABIC.indexOf(digit)] || digit);
}

function onlyAsciiDigits(value: unknown) {
  return normalizeUnicodeDigits(value).replace(/\D/g, "");
}

function digitScript(value: string, alphabet: string) {
  return value.replace(/\d/g, (digit) => alphabet[Number(digit)] || digit);
}

function variants(value: string) {
  const ascii = normalizeUnicodeDigits(value).toLowerCase();
  return [ascii, digitScript(ascii, PERSIAN), digitScript(ascii, ARABIC)];
}

type LoginResolution = { identifier: string; caregiver: boolean; caregiverId?: string | null };
type LegacyCaregiver = { id: string; fullName: string; mobile: string; nationalId: string | null; active: number | null; recruitmentStage: string | null };

async function resolveLoginIdentifier(env: Env, rawIdentifier: string): Promise<LoginResolution> {
  const [ascii, persian, arabic] = variants(rawIdentifier);
  const username = await env.DB.prepare(`SELECT username,role,caregiver_id AS caregiverId FROM users
    WHERE lower(COALESCE(username,'')) IN (?,?,?) AND upper(status)<>'DELETED'
    ORDER BY CASE WHEN lower(COALESCE(username,''))=? THEN 0 ELSE 1 END,created_at DESC LIMIT 1`)
    .bind(ascii, persian, arabic, ascii)
    .first<{ username: string | null; role: string; caregiverId: string | null }>();
  if (username?.username) return { identifier: username.username, caregiver: String(username.role || "").toUpperCase() === "CAREGIVER", caregiverId: username.caregiverId };

  const normalizedMobile = normalizeMobile(ascii);
  if (normalizedMobile && /^09\d{9}$/.test(normalizedMobile)) {
    const [mobileAscii, mobilePersian, mobileArabic] = variants(normalizedMobile);
    const account = await env.DB.prepare(`SELECT username,mobile,role,caregiver_id AS caregiverId FROM users
      WHERE mobile IN (?,?,?) AND upper(status)<>'DELETED'
      ORDER BY created_at DESC LIMIT 1`)
      .bind(mobileAscii, mobilePersian, mobileArabic)
      .first<{ username: string | null; mobile: string; role: string; caregiverId: string | null }>();
    if (account) return { identifier: account.username || account.mobile || normalizedMobile, caregiver: String(account.role || "").toUpperCase() === "CAREGIVER", caregiverId: account.caregiverId };
  }
  return { identifier: ascii, caregiver: false, caregiverId: null };
}

async function caregiverNationalIdMatches(env: Env, caregiverId: string | null | undefined, nationalId: string) {
  if (!caregiverId || !/^\d{10}$/.test(nationalId)) return false;
  const row = await env.DB.prepare("SELECT national_id AS nationalId FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId).first<{ nationalId: string | null }>();
  return Boolean(row && onlyAsciiDigits(row.nationalId) === nationalId);
}

async function ensureLegacyCaregiverAccount(env: Env, mobile: string, nationalId: string) {
  const [mobileAscii, mobilePersian, mobileArabic] = variants(mobile);
  const result = await env.DB.prepare(`SELECT id,full_name AS fullName,mobile,national_id AS nationalId,active,recruitment_stage AS recruitmentStage
    FROM caregivers WHERE mobile IN (?,?,?) AND COALESCE(cooperation_status,'')<>'حذف‌شده' ORDER BY created_at DESC LIMIT 2`)
    .bind(mobileAscii, mobilePersian, mobileArabic).all<LegacyCaregiver>();
  const rows = (result.results || []).filter((row) => onlyAsciiDigits(row.nationalId) === nationalId);
  if (rows.length !== 1) return null;
  const caregiver = rows[0];
  const account = await env.DB.prepare(`SELECT id,username,password_hash AS passwordHash FROM users
    WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' ORDER BY created_at DESC LIMIT 1`)
    .bind(caregiver.id).first<{ id: string; username: string | null; passwordHash: string | null }>();
  const timestamp = nowIso();
  if (account) {
    if (!account.passwordHash) {
      const username = account.username || mobile;
      await env.DB.prepare("UPDATE users SET username=?,mobile=?,password_hash=?,updated_at=? WHERE id=?")
        .bind(username, mobile, await hashPassword(nationalId), timestamp, account.id).run();
      return { username, caregiverId: caregiver.id };
    }
    return { username: account.username || mobile, caregiverId: caregiver.id };
  }
  const status = Number(caregiver.active || 0) === 1 || String(caregiver.recruitmentStage || "").toUpperCase() === "APPROVED" ? "ACTIVE" : "PENDING";
  const id = randomId("usr_");
  await env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at)
    VALUES(?,?,?,?,?,?,'CAREGIVER',?,'[]',?,?)`)
    .bind(id, caregiver.id, caregiver.fullName, mobile, mobile, await hashPassword(nationalId), status, timestamp, timestamp).run();
  return { username: mobile, caregiverId: caregiver.id };
}

export async function normalizeLoginInputV1(request: Request, env: Env): Promise<Request> {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "POST" || url.pathname !== "/api/auth/login") return request;
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return request;
  const rawIdentifier = str(body.identifier);
  if (!rawIdentifier) return request;
  let resolved = await resolveLoginIdentifier(env, rawIdentifier).catch(() => ({ identifier: normalizeUnicodeDigits(rawIdentifier).toLowerCase(), caregiver: false, caregiverId: null }));
  const normalizedPassword = normalizeUnicodeDigits(body.password);
  let nationalIdPassword = resolved.caregiver && /^\d{10}$/.test(normalizedPassword)
    ? await caregiverNationalIdMatches(env, resolved.caregiverId, normalizedPassword).catch(() => false)
    : false;
  const resolvedMobile = normalizeMobile(normalizeUnicodeDigits(resolved.identifier));
  if (resolvedMobile && /^09\d{9}$/.test(resolvedMobile) && /^\d{10}$/.test(normalizedPassword)) {
    const legacy = await ensureLegacyCaregiverAccount(env, resolvedMobile, normalizedPassword).catch(() => null);
    if (legacy) {
      resolved = { identifier: legacy.username, caregiver: true, caregiverId: legacy.caregiverId };
      nationalIdPassword = true;
    }
  }
  body.identifier = resolved.identifier;
  if (nationalIdPassword) body.password = normalizedPassword;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Request(request, { headers, body: JSON.stringify(body) });
}
