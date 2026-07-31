import { AwsClient } from "aws4fetch";
import {
  type AuthUser, type Env, audit, ensureSchema, fail, hasRole, json, nowIso, randomId, staffRoles, str,
} from "./lib";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(["identity", "contract", "payroll", "training", "profile", "report", "support", "other"]);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "text/plain",
  "text/markdown",
  "text/vtt",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
]);
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|srt|vtt|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/i;

interface StoredFileRow {
  id: string;
  caregiverId: string | null;
  category: string;
  originalName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  uploadedByUserId: string;
  createdAt: string;
  deletedAt: string | null;
}

function storageConfig(env: Env) {
  const endpointRaw = str(env.PARSPACK_S3_ENDPOINT);
  const bucket = str(env.PARSPACK_S3_BUCKET);
  const accessKeyId = str(env.PARSPACK_S3_ACCESS_KEY);
  const secretAccessKey = str(env.PARSPACK_S3_SECRET_KEY);
  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) return null;
  const endpoint = new URL(/^https?:\/\//i.test(endpointRaw) ? endpointRaw : `https://${endpointRaw}`);
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: str(env.PARSPACK_S3_REGION) || "us-east-1",
  };
}

function encodeObjectKey(key: string) {
  return key.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
}

function objectUrl(env: Env, key = "") {
  const config = storageConfig(env);
  if (!config) return null;
  const base = config.endpoint.toString().replace(/\/+$/, "");
  const bucketIsHost = config.endpoint.hostname === config.bucket || config.endpoint.hostname.startsWith(`${config.bucket}.`);
  const bucketPath = bucketIsHost ? "" : `${encodeURIComponent(config.bucket)}/`;
  const objectPath = key ? encodeObjectKey(key) : "";
  return `${base}/${bucketPath}${objectPath}`;
}

function s3Client(env: Env) {
  const config = storageConfig(env);
  if (!config) return null;
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region,
  });
}

async function s3Fetch(env: Env, key: string, init: RequestInit) {
  const client = s3Client(env);
  const url = objectUrl(env, key);
  if (!client || !url) throw new Error("storage_not_configured");
  return client.fetch(url, init);
}

function safeFilename(value: string) {
  const cleaned = value.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 160);
}

function objectFilename(value: string) {
  return safeFilename(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 100) || "file";
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function digestHex(buffer: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canAccessFile(actor: AuthUser, row: StoredFileRow) {
  if (hasRole(actor, staffRoles)) return true;
  return actor.role.toUpperCase() === "CAREGIVER" && Boolean(actor.caregiverId) && row.caregiverId === actor.caregiverId;
}

function resolveCaregiverId(actor: AuthUser, requested: unknown) {
  const requestedId = str(requested) || null;
  if (actor.role.toUpperCase() === "CAREGIVER") {
    if (!actor.caregiverId) throw new Error("caregiver_profile_missing");
    if (requestedId && requestedId !== actor.caregiverId) throw new Error("forbidden_caregiver_scope");
    return actor.caregiverId;
  }
  if (!hasRole(actor, staffRoles)) throw new Error("forbidden");
  return requestedId;
}

export async function storageHealth(env: Env) {
  const config = storageConfig(env);
  if (!config) return fail("تنظیمات فضای ابری پارس‌پک کامل نیست.", 503, "storage_not_configured");
  const client = s3Client(env);
  const base = objectUrl(env);
  if (!client || !base) return fail("تنظیمات فضای ابری پارس‌پک کامل نیست.", 503, "storage_not_configured");
  const separator = base.includes("?") ? "&" : "?";
  const response = await client.fetch(`${base}${separator}list-type=2&max-keys=1`, { method: "GET" });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    return json({ status: "error", providerStatus: response.status, detail }, 502);
  }
  return json({ status: "ok", provider: "parspack-s3", bucket: config.bucket, endpoint: config.endpoint.hostname });
}

export async function uploadFile(request: Request, env: Env, actor: AuthUser) {
  await ensureSchema(env);
  if (!storageConfig(env)) return fail("فضای ابری هنوز در Worker تنظیم نشده است.", 503, "storage_not_configured");
  const form = await request.formData().catch(() => null);
  if (!form) return fail("فرم آپلود معتبر نیست.", 400, "invalid_multipart");
  const part = form.get("file");
  if (!(part instanceof File)) return fail("فایل انتخاب نشده است.", 400, "file_required");
  if (part.size <= 0) return fail("فایل خالی است.", 400, "empty_file");
  if (part.size > MAX_FILE_BYTES) return fail("حداکثر حجم هر فایل ۱۰۰ مگابایت است.", 413, "file_too_large");
  const contentType = (part.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_TYPES.has(contentType) && !ALLOWED_EXTENSIONS.test(part.name)) return fail("نوع این فایل مجاز نیست.", 415, "unsupported_file_type");
  const category = str(form.get("category")).toLowerCase() || "other";
  if (!ALLOWED_CATEGORIES.has(category)) return fail("دسته‌بندی فایل معتبر نیست.", 400, "invalid_category");

  let caregiverId: string | null;
  try {
    caregiverId = resolveCaregiverId(actor, form.get("caregiverId"));
  } catch (error) {
    const code = error instanceof Error ? error.message : "forbidden";
    if (code === "caregiver_profile_missing") return fail("حساب مراقب به پرونده حرفه‌ای متصل نیست.", 409, code);
    return fail("اجازه ثبت فایل برای این پرونده را ندارید.", 403, code);
  }

  const originalName = safeFilename(part.name);
  const buffer = await part.arrayBuffer();
  const checksum = await digestHex(buffer);
  const createdAt = nowIso();
  const datePath = createdAt.slice(0, 10).replaceAll("-", "/");
  const scope = caregiverId ? `caregivers/${caregiverId}` : "organization";
  const objectKey = `${scope}/${category}/${datePath}/${randomId("obj_")}-${objectFilename(originalName)}`;

  const uploaded = await s3Fetch(env, objectKey, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "x-amz-meta-sha256": checksum,
    },
    body: buffer,
  });
  if (!uploaded.ok) {
    const detail = (await uploaded.text().catch(() => "")).slice(0, 400);
    return json({ error: "storage_upload_failed", message: "بارگذاری فایل در فضای ابری انجام نشد.", providerStatus: uploaded.status, detail }, 502);
  }

  const id = randomId("fil_");
  try {
    await env.DB.prepare(`INSERT INTO stored_files(id,caregiver_id,category,original_name,object_key,content_type,size_bytes,checksum_sha256,uploaded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, caregiverId, category, originalName, objectKey, contentType, part.size, checksum, actor.id, createdAt).run();
  } catch (error) {
    await s3Fetch(env, objectKey, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
  await audit(request, env, actor, "FILE_UPLOAD", "stored_file", id, { caregiverId, category, originalName, sizeBytes: part.size });
  return json({ data: { id, caregiverId, category, originalName, contentType, sizeBytes: part.size, checksumSha256: checksum, createdAt } }, 201);
}

export async function listFiles(request: Request, env: Env, actor: AuthUser) {
  await ensureSchema(env);
  const url = new URL(request.url);
  const category = str(url.searchParams.get("category")).toLowerCase();
  let caregiverId = str(url.searchParams.get("caregiverId")) || null;
  if (actor.role.toUpperCase() === "CAREGIVER") {
    if (!actor.caregiverId) return fail("حساب مراقب به پرونده حرفه‌ای متصل نیست.", 409, "caregiver_profile_missing");
    caregiverId = actor.caregiverId;
  } else if (!hasRole(actor, staffRoles)) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  const clauses = ["f.deleted_at IS NULL"];
  const bindings: unknown[] = [];
  if (caregiverId) { clauses.push("f.caregiver_id=?"); bindings.push(caregiverId); }
  if (category) { clauses.push("f.category=?"); bindings.push(category); }
  const query = `SELECT f.id,f.caregiver_id AS caregiverId,f.category,f.original_name AS originalName,f.content_type AS contentType,f.size_bytes AS sizeBytes,f.checksum_sha256 AS checksumSha256,f.uploaded_by_user_id AS uploadedByUserId,f.created_at AS createdAt FROM stored_files f WHERE ${clauses.join(" AND ")} ORDER BY f.created_at DESC LIMIT 200`;
  const result = await env.DB.prepare(query).bind(...bindings).all();
  return json({ data: result.results || [] });
}

async function getFileRow(env: Env, id: string) {
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,category,original_name AS originalName,object_key AS objectKey,content_type AS contentType,size_bytes AS sizeBytes,checksum_sha256 AS checksumSha256,uploaded_by_user_id AS uploadedByUserId,created_at AS createdAt,deleted_at AS deletedAt FROM stored_files WHERE id=? LIMIT 1`)
    .bind(id).first<StoredFileRow>();
}

export async function downloadFile(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureSchema(env);
  const row = await getFileRow(env, id);
  if (!row || row.deletedAt) return fail("فایل پیدا نشد.", 404, "file_not_found");
  if (!canAccessFile(actor, row)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const stored = await s3Fetch(env, row.objectKey, { method: "GET" });
  if (stored.status === 404) return fail("فایل در فضای ابری پیدا نشد.", 404, "object_not_found");
  if (!stored.ok) return fail("دریافت فایل از فضای ابری انجام نشد.", 502, "storage_download_failed");
  await audit(request, env, actor, "FILE_DOWNLOAD", "stored_file", id);
  const headers = new Headers();
  headers.set("content-type", row.contentType || stored.headers.get("content-type") || "application/octet-stream");
  headers.set("content-disposition", contentDisposition(row.originalName));
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  if (stored.headers.get("content-length")) headers.set("content-length", stored.headers.get("content-length") as string);
  return new Response(stored.body, { status: 200, headers });
}

export async function deleteFile(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureSchema(env);
  if (!hasRole(actor, ["ADMIN", "HR", "RECRUITER"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const row = await getFileRow(env, id);
  if (!row || row.deletedAt) return fail("فایل پیدا نشد.", 404, "file_not_found");
  const removed = await s3Fetch(env, row.objectKey, { method: "DELETE" });
  if (!removed.ok && removed.status !== 404) return fail("حذف فایل از فضای ابری انجام نشد.", 502, "storage_delete_failed");
  const deletedAt = nowIso();
  await env.DB.prepare("UPDATE stored_files SET deleted_at=? WHERE id=?").bind(deletedAt, id).run();
  await audit(request, env, actor, "FILE_DELETE", "stored_file", id, { deletedAt });
  return json({ data: { id, deletedAt } });
}
