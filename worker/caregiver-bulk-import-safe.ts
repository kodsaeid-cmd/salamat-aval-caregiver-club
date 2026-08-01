import { type AuthUser, type Env, fail, json, randomId, readBody, str } from "./lib";
import { importCaregiverBatch } from "./caregiver-bulk-import";

const PRIMARY_CHUNK_SIZE = 50;
const MAX_REQUEST_ROWS = 100;

type ImportResult = {
  importId?: string;
  received?: number;
  createdProfiles?: number;
  updatedProfiles?: number;
  createdAccounts?: number;
  updatedAccounts?: number;
  failed?: number;
  failures?: Array<{ membershipCode: string; message: string; detail?: string | null }>;
};

type ImportPayload = Record<string, unknown> & {
  importId: string;
  caregivers: unknown[];
};

function emptyTotals(importId: string): Required<Omit<ImportResult, "failures">> & { failures: NonNullable<ImportResult["failures"]> } {
  return {
    importId,
    received: 0,
    createdProfiles: 0,
    updatedProfiles: 0,
    createdAccounts: 0,
    updatedAccounts: 0,
    failed: 0,
    failures: [],
  };
}

function mergeTotals(target: ReturnType<typeof emptyTotals>, source: ImportResult) {
  target.received += Number(source.received || 0);
  target.createdProfiles += Number(source.createdProfiles || 0);
  target.updatedProfiles += Number(source.updatedProfiles || 0);
  target.createdAccounts += Number(source.createdAccounts || 0);
  target.updatedAccounts += Number(source.updatedAccounts || 0);
  target.failed += Number(source.failed || 0);
  if (Array.isArray(source.failures)) target.failures.push(...source.failures.slice(0, 100));
}

async function callImporter(
  request: Request,
  env: Env,
  actor: AuthUser,
  body: ImportPayload,
  caregivers: unknown[],
) {
  const chunkRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, caregivers }),
  });
  const response = await importCaregiverBatch(chunkRequest, env, actor);
  const payload = await response.json().catch(() => ({})) as {
    data?: ImportResult;
    message?: string;
    detail?: string;
    error?: string;
  };
  return { response, payload };
}

async function processResilient(
  request: Request,
  env: Env,
  actor: AuthUser,
  body: ImportPayload,
  caregivers: unknown[],
  totals: ReturnType<typeof emptyTotals>,
): Promise<void> {
  let result: Awaited<ReturnType<typeof callImporter>>;
  try {
    result = await callImporter(request, env, actor, body, caregivers);
  } catch (error) {
    result = {
      response: new Response(null, { status: 500 }),
      payload: {
        error: "caregiver_import_failed",
        message: "ثبت این بخش از پرونده‌ها کامل نشد.",
        detail: error instanceof Error ? error.message : "database_error",
      },
    };
  }

  if (result.response.ok) {
    mergeTotals(totals, result.payload.data || {});
    return;
  }

  if (caregivers.length > 1) {
    const middle = Math.ceil(caregivers.length / 2);
    await processResilient(request, env, actor, body, caregivers.slice(0, middle), totals);
    await processResilient(request, env, actor, body, caregivers.slice(middle), totals);
    return;
  }

  const row = caregivers[0] as Record<string, unknown> | undefined;
  totals.failed += 1;
  totals.failures.push({
    membershipCode: str(row?.membershipCode) || "نامشخص",
    message: result.payload.message || "این پرونده ثبت نشد.",
    detail: result.payload.detail || null,
  });
}

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
  const payload = { ...body, importId, caregivers: rows } as ImportPayload;
  const totals = emptyTotals(importId);

  for (let index = 0; index < rows.length; index += PRIMARY_CHUNK_SIZE) {
    await processResilient(
      request,
      env,
      actor,
      payload,
      rows.slice(index, index + PRIMARY_CHUNK_SIZE),
      totals,
    );
  }

  if (totals.failed) {
    await env.DB.prepare(`UPDATE caregiver_import_runs
      SET failed_count=failed_count+?,updated_at=datetime('now') WHERE id=?`)
      .bind(totals.failed, importId)
      .run()
      .catch(() => undefined);
  }

  return json({ data: totals });
}
