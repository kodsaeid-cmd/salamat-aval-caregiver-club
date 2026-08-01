import { type AuthUser, type Env, fail, json, randomId, readBody, str } from "./lib";
import { importCaregiverBatch } from "./caregiver-bulk-import";

const SAFE_CHUNK_SIZE = 35;
const MAX_REQUEST_ROWS = 100;

type ImportResult = {
  importId?: string;
  received?: number;
  createdProfiles?: number;
  updatedProfiles?: number;
  createdAccounts?: number;
  updatedAccounts?: number;
  failed?: number;
};

export async function importCaregiverBatchSafe(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (actor.role.toUpperCase() !== "ADMIN") return fail("دسترسی کافی ندارید.", 403, "forbidden");

  const body = await readBody(request);
  if (!body) return fail("اطلاعات واردسازی معتبر نیست.");

  const rows = Array.isArray(body.caregivers) ? body.caregivers : [];
  if (!rows.length) return fail("فهرست مراقبین خالی است.");
  if (rows.length > MAX_REQUEST_ROWS) {
    return fail(`حداکثر ${MAX_REQUEST_ROWS} پرونده در هر درخواست قابل ثبت است.`, 413, "batch_too_large");
  }

  const importId = str(body.importId) || randomId("imp_");
  const totals: Required<ImportResult> = {
    importId,
    received: 0,
    createdProfiles: 0,
    updatedProfiles: 0,
    createdAccounts: 0,
    updatedAccounts: 0,
    failed: 0,
  };

  for (let index = 0; index < rows.length; index += SAFE_CHUNK_SIZE) {
    const caregivers = rows.slice(index, index + SAFE_CHUNK_SIZE);
    const chunkRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, importId, caregivers }),
    });

    let response: Response;
    try {
      response = await importCaregiverBatch(chunkRequest, env, actor);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "database_error";
      return json({
        error: "caregiver_import_failed",
        message: "ثبت این بخش از پرونده‌ها کامل نشد.",
        detail,
        processed: totals.received,
      }, 500);
    }

    const payload = await response.json().catch(() => ({})) as {
      data?: ImportResult;
      message?: string;
      detail?: string;
      error?: string;
    };

    if (!response.ok) {
      return json({
        error: payload.error || "caregiver_import_failed",
        message: payload.message || "ثبت این بخش از پرونده‌ها کامل نشد.",
        detail: payload.detail || null,
        processed: totals.received,
      }, response.status);
    }

    const data = payload.data || {};
    totals.received += Number(data.received || 0);
    totals.createdProfiles += Number(data.createdProfiles || 0);
    totals.updatedProfiles += Number(data.updatedProfiles || 0);
    totals.createdAccounts += Number(data.createdAccounts || 0);
    totals.updatedAccounts += Number(data.updatedAccounts || 0);
    totals.failed += Number(data.failed || 0);
  }

  return json({ data: totals });
}
