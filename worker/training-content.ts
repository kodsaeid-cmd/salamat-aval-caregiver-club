import { AwsClient } from "aws4fetch";
import { type AuthUser, type Env, audit, ensureSchema, fail, nowIso, str } from "./lib";

type ContentRow = {
  fileId: string;
  originalName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
};

function storageConfig(env: Env) {
  const endpointRaw = str(env.PARSPACK_S3_ENDPOINT);
  const bucket = str(env.PARSPACK_S3_BUCKET);
  const accessKeyId = str(env.PARSPACK_S3_ACCESS_KEY);
  const secretAccessKey = str(env.PARSPACK_S3_SECRET_KEY);
  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: new URL(/^https?:\/\//i.test(endpointRaw) ? endpointRaw : `https://${endpointRaw}`),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: str(env.PARSPACK_S3_REGION) || "us-east-1",
  };
}

function objectUrl(env: Env, key: string) {
  const config = storageConfig(env);
  if (!config) return null;
  const endpoint = new URL(config.endpoint.toString());
  const segments = endpoint.pathname.split("/").filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  if (segments.at(-1) !== config.bucket) segments.push(config.bucket);
  endpoint.pathname = `/${segments.map(encodeURIComponent).join("/")}/${key.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function getAssignedTrainingContent(request: Request, env: Env, actor: AuthUser, enrollmentId: string) {
  await ensureSchema(env);
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر مخصوص مراقب است.", 403, "forbidden");
  }
  const enrollment = await env.DB.prepare(`SELECT c.content_url AS contentUrl
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    JOIN users u ON u.id=e.assigned_by_user_id AND UPPER(u.role) IN ('ADMIN','RECRUITER','HR')
    WHERE e.id=? AND e.caregiver_id=? AND c.status='ACTIVE' LIMIT 1`)
    .bind(enrollmentId, actor.caregiverId).first<{ contentUrl: string | null }>();
  if (!enrollment) return fail("این آموزش برای شما ارسال نشده است.", 404, "assignment_not_found");
  const match = String(enrollment.contentUrl || "").match(/^\/api\/files\/([^/?]+)\/download(?:\?.*)?$/);
  if (!match) return fail("محتوای داخلی برای این آموزش ثبت نشده است.", 404, "training_content_not_internal");
  const fileId = decodeURIComponent(match[1]);
  const row = await env.DB.prepare(`SELECT id AS fileId,original_name AS originalName,object_key AS objectKey,
    content_type AS contentType,size_bytes AS sizeBytes FROM stored_files
    WHERE id=? AND category='training' AND deleted_at IS NULL LIMIT 1`)
    .bind(fileId).first<ContentRow>();
  if (!row) return fail("فایل آموزش پیدا نشد.", 404, "file_not_found");
  const config = storageConfig(env);
  const url = objectUrl(env, row.objectKey);
  if (!config || !url) return fail("فضای ابری تنظیم نشده است.", 503, "storage_not_configured");
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region,
  });
  const stored = await client.fetch(url, { method: "GET" });
  if (stored.status === 404) return fail("فایل آموزش در فضای ابری پیدا نشد.", 404, "object_not_found");
  if (!stored.ok) return fail("دریافت فایل آموزش انجام نشد.", 502, "storage_download_failed");
  await audit(request, env, actor, "TRAINING_CONTENT_VIEW", "training_enrollment", enrollmentId, { fileId, at: nowIso() });
  const headers = new Headers();
  headers.set("content-type", row.contentType || stored.headers.get("content-type") || "application/octet-stream");
  headers.set("content-disposition", contentDisposition(row.originalName));
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; media-src 'self' blob:; img-src 'self' data: blob:");
  if (stored.headers.get("content-length")) headers.set("content-length", stored.headers.get("content-length") as string);
  return new Response(stored.body, { status: 200, headers });
}
