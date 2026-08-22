import { type Env, normalizeMobile, str } from "./lib";

const ASCII = "0123456789";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

export function normalizeUnicodeDigits(value: unknown) {
  return str(value)
    .replace(/[۰-۹]/g, (digit) => ASCII[PERSIAN.indexOf(digit)] || digit)
    .replace(/[٠-٩]/g, (digit) => ASCII[ARABIC.indexOf(digit)] || digit);
}

function digitScript(value: string, alphabet: string) {
  return value.replace(/\d/g, (digit) => alphabet[Number(digit)] || digit);
}

function variants(value: string) {
  const ascii = normalizeUnicodeDigits(value).toLowerCase();
  return [ascii, digitScript(ascii, PERSIAN), digitScript(ascii, ARABIC)];
}

type LoginResolution = { identifier: string; caregiver: boolean };

async function resolveLoginIdentifier(env: Env, rawIdentifier: string): Promise<LoginResolution> {
  const [ascii, persian, arabic] = variants(rawIdentifier);
  const username = await env.DB.prepare(`SELECT username,role FROM users
    WHERE lower(COALESCE(username,'')) IN (?,?,?) AND upper(status)<>'DELETED'
    ORDER BY CASE WHEN lower(COALESCE(username,''))=? THEN 0 ELSE 1 END,created_at DESC LIMIT 1`)
    .bind(ascii, persian, arabic, ascii)
    .first<{ username: string | null; role: string }>();
  if (username?.username) return { identifier: username.username, caregiver: String(username.role || "").toUpperCase() === "CAREGIVER" };

  const normalizedMobile = normalizeMobile(ascii);
  if (normalizedMobile && /^09\d{9}$/.test(normalizedMobile)) {
    const [mobileAscii, mobilePersian, mobileArabic] = variants(normalizedMobile);
    const account = await env.DB.prepare(`SELECT username,mobile,role FROM users
      WHERE mobile IN (?,?,?) AND upper(status)<>'DELETED'
      ORDER BY created_at DESC LIMIT 1`)
      .bind(mobileAscii, mobilePersian, mobileArabic)
      .first<{ username: string | null; mobile: string; role: string }>();
    if (account) return { identifier: account.username || account.mobile || normalizedMobile, caregiver: String(account.role || "").toUpperCase() === "CAREGIVER" };
  }

  if (/^\d{10}$/.test(ascii)) {
    const [nationalAscii, nationalPersian, nationalArabic] = variants(ascii);
    const result = await env.DB.prepare(`SELECT c.id AS caregiverId,c.mobile AS mobile,
        (SELECT u.username FROM users u WHERE u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' ORDER BY u.created_at DESC LIMIT 1) AS username
      FROM caregivers c
      WHERE c.national_id IN (?,?,?) AND COALESCE(c.cooperation_status,'')<>'حذف‌شده'
      ORDER BY c.created_at DESC LIMIT 2`)
      .bind(nationalAscii, nationalPersian, nationalArabic)
      .all<{ caregiverId: string; mobile: string; username: string | null }>();
    const rows = result.results || [];
    if (rows.length === 1) {
      const row = rows[0];
      return { identifier: row.username || normalizeMobile(normalizeUnicodeDigits(row.mobile)) || row.mobile, caregiver: true };
    }
  }
  return { identifier: ascii, caregiver: false };
}

export async function normalizeLoginInputV1(request: Request, env: Env): Promise<Request> {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "POST" || url.pathname !== "/api/auth/login") return request;
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return request;
  const rawIdentifier = str(body.identifier);
  if (!rawIdentifier) return request;
  const resolved = await resolveLoginIdentifier(env, rawIdentifier).catch(() => ({ identifier: normalizeUnicodeDigits(rawIdentifier).toLowerCase(), caregiver: false }));
  body.identifier = resolved.identifier;
  const normalizedPassword = normalizeUnicodeDigits(body.password);
  if ((resolved.caregiver || /^09\d{9}$/.test(normalizeMobile(normalizeUnicodeDigits(rawIdentifier)) || "")) && /^\d{10}$/.test(normalizedPassword)) body.password = normalizedPassword;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Request(request, { headers, body: JSON.stringify(body) });
}
