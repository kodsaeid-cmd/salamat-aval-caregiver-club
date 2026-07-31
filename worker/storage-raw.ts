import { AwsClient } from "aws4fetch";
import {
  type AuthUser, type Env, audit, ensureSchema, fail, json, nowIso, randomId, str,
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
  "application/octet-stream",
]);
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|srt|vtt|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/i;

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

function safeFilename(value: string) {
  const cleaned = value.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 160);
}

function objectFilename(value: string) {
  return safeFilename(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 100) || "file";
}

function encodeObjectKey(key: string) {
  return key.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
}

function objectUrl(env: Env, key = "") {
  const config = storageConfig(env);
  if (!config) return null;
  const endpoint = new URL(config.endpoint.toString());
  const segments = endpoint.pathname.split("/").filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  if (segments.at(-1) !== config.bucket) segments.push(config.bucket);
  endpoint.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  const base = endpoint.toString().replace(/\/+$/, "");
  return `${base}/${key ? encodeObjectKey(key) : ""}`;
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

async function digestHex(buffer: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeFilename(value: string | null) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

async function putObject(env: Env, objectKey: string, buffer: ArrayBuffer, contentType: string, checksum: string) {
  let response = await s3Fetch(env, objectKey, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "x-amz-meta-sha256": checksum,
    },
    body: buffer,
  });
  if (!response.ok && [400, 403].includes(response.status)) {
    response = await s3Fetch(env, objectKey, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: buffer,
    });
  }
  return response;
}

export async function uploadRawFile(request: Request, env: Env, actor: AuthUser) {
  await ensureSchema(env);
  if (!storageConfig(env)) return fail("فضای ابری هنوز در Worker تنظیم نشده است.", 503, "storage_not_configured");

  const url = new URL(request.url);
  const originalName = safeFilename(decodeFilename(request.headers.get("x-file-name") || url.searchParams.get("filename")));
  const category = str(request.headers.get("x-file-category") || url.searchParams.get("category")).toLowerCase() || "other";
  const contentType = str(request.headers.get("content-type")).split(";")[0].toLowerCase() || "application/octet-stream";
  const claimedSize = Number(request.headers.get("x-file-size") || request.headers.get("content-length") || 0);

  if (!originalName) return fail("نام فایل ارسال نشده است.", 400, "filename_required");
  if (!ALLOWED_CATEGORIES.has(category)) return fail("دسته‌بندی فایل معتبر نیست.", 400, "invalid_category");
  if (claimedSize > MAX_FILE_BYTES) return fail("حداکثر حجم هر فایل ۱۰۰ مگابایت است.", 413, "file_too_large");
  if (!ALLOWED_TYPES.has(contentType) && !ALLOWED_EXTENSIONS.test(originalName)) return fail("نوع این فایل مجاز نیست.", 415, "unsupported_file_type");

  const buffer = await request.arrayBuffer();
  if (!buffer.byteLength) return fail("فایل خالی است.", 400, "empty_file");
  if (buffer.byteLength > MAX_FILE_BYTES) return fail("حداکثر حجم هر فایل ۱۰۰ مگابایت است.", 413, "file_too_large");
  if (claimedSize && claimedSize !== buffer.byteLength) {
    return json({ error: "file_size_mismatch", message: "حجم فایل در انتقال تغییر کرده است.", claimedSize, receivedSize: buffer.byteLength }, 400);
  }

  const checksum = await digestHex(buffer);
  const createdAt = nowIso();
  const datePath = createdAt.slice(0, 10).replaceAll("-", "/");
  const objectKey = `organization/${category}/${datePath}/${randomId("obj_")}-${objectFilename(originalName)}`;
  const uploaded = await putObject(env, objectKey, buffer, contentType, checksum);
  if (!uploaded.ok) {
    const detail = (await uploaded.text().catch(() => "")).slice(0, 800);
    return json({
      error: "storage_upload_failed",
      message: "بارگذاری فایل در فضای ابری انجام نشد.",
      providerStatus: uploaded.status,
      detail,
    }, 502);
  }

  const id = randomId("fil_");
  try {
    await env.DB.prepare(`INSERT INTO stored_files(id,caregiver_id,category,original_name,object_key,content_type,size_bytes,checksum_sha256,uploaded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, null, category, originalName, objectKey, contentType, buffer.byteLength, checksum, actor.id, createdAt).run();
  } catch (error) {
    await s3Fetch(env, objectKey, { method: "DELETE" }).catch(() => undefined);
    const detail = error instanceof Error ? error.message : "database_error";
    return json({ error: "file_metadata_save_failed", message: "فایل ارسال شد اما ثبت مشخصات آن در دیتابیس انجام نشد.", detail }, 500);
  }

  await audit(request, env, actor, "FILE_UPLOAD", "stored_file", id, { category, originalName, sizeBytes: buffer.byteLength, transport: "raw" });
  return json({ data: { id, caregiverId: null, category, originalName, contentType, sizeBytes: buffer.byteLength, checksumSha256: checksum, createdAt } }, 201);
}

export async function storageWriteTest(env: Env) {
  if (!storageConfig(env)) return fail("تنظیمات فضای ابری کامل نیست.", 503, "storage_not_configured");
  const key = `organization/system-tests/${randomId("write-test-")}.txt`;
  const buffer = new TextEncoder().encode(`salamat-aval-storage-test:${nowIso()}`).buffer;
  const checksum = await digestHex(buffer);
  const put = await putObject(env, key, buffer, "text/plain", checksum);
  if (!put.ok) {
    const detail = (await put.text().catch(() => "")).slice(0, 800);
    return json({ status: "error", stage: "put", providerStatus: put.status, detail }, 502);
  }
  const get = await s3Fetch(env, key, { method: "GET" });
  if (!get.ok) {
    const detail = (await get.text().catch(() => "")).slice(0, 800);
    await s3Fetch(env, key, { method: "DELETE" }).catch(() => undefined);
    return json({ status: "error", stage: "get", providerStatus: get.status, detail }, 502);
  }
  const readBack = await get.text();
  const remove = await s3Fetch(env, key, { method: "DELETE" });
  if (!remove.ok && remove.status !== 404) {
    const detail = (await remove.text().catch(() => "")).slice(0, 800);
    return json({ status: "error", stage: "delete", providerStatus: remove.status, detail }, 502);
  }
  return json({ status: "ok", write: true, read: readBack.startsWith("salamat-aval-storage-test:"), delete: true });
}
