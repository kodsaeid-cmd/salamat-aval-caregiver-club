import { createCourse } from "./training";
import { uploadRawFile } from "./storage-raw";
import { deleteFile } from "./storage";
import {
  type AuthUser,
  type Env,
  fail,
  hasRole,
  json,
  str,
} from "./lib";

const STAFF_ROLES = ["ADMIN", "RECRUITER", "HR"];

function decodedHeader(request: Request, name: string) {
  const value = request.headers.get(name);
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function integerHeader(request: Request, name: string) {
  const value = Number(decodedHeader(request, name) || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export async function uploadTrainingCourse(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (!hasRole(actor, STAFF_ROLES)) {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }

  const title = str(decodedHeader(request, "x-training-title"));
  if (!title) return fail("عنوان آموزش الزامی است.", 400, "title_required");

  const filename = decodedHeader(request, "x-file-name");
  if (!filename) return fail("فایل آموزشی انتخاب نشده است.", 400, "file_required");

  const uploadHeaders = new Headers(request.headers);
  uploadHeaders.set("x-file-name", encodeURIComponent(filename));
  uploadHeaders.set("x-file-category", "training");
  const uploadRequest = new Request(request.url, {
    method: "POST",
    headers: uploadHeaders,
    body: request.body,
    // Required by the Fetch implementation when streaming a request body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const uploadedResponse = await uploadRawFile(uploadRequest, env, actor);
  const uploadedPayload = await uploadedResponse.clone().json<Record<string, any>>().catch(() => ({}));
  if (!uploadedResponse.ok) {
    return json({
      error: uploadedPayload.error || "training_file_upload_failed",
      message: uploadedPayload.message || "بارگذاری فایل آموزشی انجام نشد.",
      stage: "file_upload",
    }, uploadedResponse.status);
  }

  const fileId = str(uploadedPayload?.data?.id);
  if (!fileId) {
    return fail("ثبت فایل آموزشی کامل نشد.", 500, "uploaded_file_id_missing");
  }

  const contentUrl = `/api/files/${encodeURIComponent(fileId)}/download?inline=1`;
  const createRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      category: str(decodedHeader(request, "x-training-category")) || "عمومی",
      description: str(decodedHeader(request, "x-training-description")) || null,
      durationMinutes: integerHeader(request, "x-training-duration"),
      credit: integerHeader(request, "x-training-credit"),
      mandatory: decodedHeader(request, "x-training-mandatory") === "1",
      contentUrl,
    }),
  });

  const courseResponse = await createCourse(createRequest, env, actor);
  const coursePayload = await courseResponse.clone().json<Record<string, any>>().catch(() => ({}));
  if (!courseResponse.ok) {
    const cleanupRequest = new Request(request.url, { method: "DELETE" });
    await deleteFile(cleanupRequest, env, actor, fileId).catch(() => undefined);
    return json({
      error: coursePayload.error || "training_course_save_failed",
      message: coursePayload.message || "ثبت مشخصات آموزش انجام نشد.",
      stage: "course_save",
    }, courseResponse.status);
  }

  return json({
    data: {
      course: coursePayload.data,
      file: uploadedPayload.data,
    },
  }, 201);
}
