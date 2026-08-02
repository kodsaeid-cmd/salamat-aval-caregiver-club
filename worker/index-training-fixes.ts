import app from "./index-with-benefits";
import { adminDirectoryLight, invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { adminLightState, prunedAdminStateRequest } from "./admin-light-state";
import { createCaregiverAccount } from "./caregiver-accounts";
import { caregiverLightState } from "./caregiver-light-state";
import { caregiverImportStatus } from "./caregiver-bulk-import";
import { importCaregiverBatchV2 } from "./caregiver-bulk-import-v2";
import { caregiverDirectoryPage, invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { caregiverProfileEditor } from "./caregiver-profile-editor";
import { caregiverRecord } from "./caregiver-record";
import {
  createEvaluationPeriod,
  finalizeEvaluation,
  getCaregiverEvaluation,
  saveIndicatorScores,
} from "./evaluations";
import { uploadProfileImage } from "./profile-images";
import { invalidateRecruiterDirectoryCache, recruiterDirectory } from "./recruiter-directory";
import { getTrainingCaregivers, invalidateTrainingCaregiverCache } from "./training-caregivers";
import { uploadTrainingCourse } from "./training-upload-reliable";
import { type AuthUser, type Env, fail, getUser, json, securityHeaders, str } from "./lib";

const DIAGNOSTIC_HEADERS = [
  "server-timing",
  "x-salamat-db-queries",
  "x-salamat-rows-read",
  "x-salamat-counts-cache",
  "x-salamat-total-cache",
  "x-salamat-directory-scope",
];

type JsonRecord = Record<string, unknown>;

function inheritDiagnosticHeaders(source: Response, target: Response) {
  const headers = new Headers(target.headers);
  for (const name of DIAGNOSTIC_HEADERS) {
    const value = source.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(target.body, {
    status: target.status,
    statusText: target.statusText,
    headers,
  });
}

function withRequestTiming(response: Response, startedAt: number) {
  const headers = new Headers(response.headers);
  const requestMs = performance.now() - startedAt;
  const current = headers.get("server-timing");
  headers.set("server-timing", [current, `request;dur=${requestMs.toFixed(2)}`].filter(Boolean).join(", "));
  headers.set("x-salamat-request-ms", requestMs.toFixed(2));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function invalidateCaregiverCaches() {
  invalidateAdminDirectoryCounts();
  invalidateRecruiterDirectoryCache();
  invalidateCaregiverDirectoryCache();
  invalidateTrainingCaregiverCache();
}

function isDirectoryMutation(pathname: string, method: string) {
  if (!["POST", "PATCH", "DELETE"].includes(method)) return false;
  return pathname === "/api/admin/directory/profile"
    || pathname === "/api/users"
    || pathname === "/api/caregivers"
    || pathname === "/api/caregiver-accounts"
    || pathname === "/api/profile-images"
    || /^\/api\/users\/[^/]+$/.test(pathname)
    || /^\/api\/caregivers\/[^/]+$/.test(pathname)
    || /^\/api\/admin\/caregivers\/[^/]+(?:\/status)?$/.test(pathname);
}

function asAdmin(actor: AuthUser): AuthUser {
  return actor.role.toUpperCase() === "RECRUITER" ? { ...actor, role: "ADMIN" } : actor;
}

function asEvaluator(actor: AuthUser): AuthUser {
  return actor.role.toUpperCase() === "RECRUITER" ? { ...actor, role: "EVALUATOR" } : actor;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function projectEvaluationPeriod(
  period: JsonRecord,
  detailed: JsonRecord | null,
  caregiverId: string,
  membershipCode: string,
) {
  const indicators = rows(detailed?.indicators);
  const status = str(period.status);
  return {
    id: str(period.id),
    caregiverId: membershipCode || caregiverId,
    backendCaregiverId: caregiverId,
    policyVersion: str(period.policyVersion),
    title: str(period.title) || "دوره ارزیابی",
    start: str(period.startDate),
    end: str(period.endDate),
    status: status === "FINAL" ? "نهایی" : "پیش‌نویس",
    assessor: "کارشناس جذب و ارزیابی",
    reviewer: "مسئول ارزیابی",
    criteria: Object.fromEntries(indicators.map((indicator) => [str(indicator.code), {
      code: str(indicator.code),
      title: str(indicator.title),
      score: indicator.complete ? indicator.score : null,
      liveScore: indicator.liveScore ?? null,
      status: indicator.complete
        ? "تکمیل"
        : Number(indicator.scoredCount || 0) > 0
          ? "در حال تکمیل"
          : "نیازمند بررسی تکمیلی",
      notes: `${Number(indicator.scoredCount || 0)} از ${Number(indicator.criteriaCount || 0)} معیار امتیازدهی شده`,
      evidence: [],
      updatedAt: str(period.updatedAt),
    }])),
    createdAt: str(period.createdAt),
    updatedAt: str(period.updatedAt),
    finalizedAt: str(period.finalizedAt),
    finalScore: status === "FINAL"
      ? (period.finalScore ?? null)
      : (detailed?.calculatedFinalScore ?? detailed?.liveOverallScore ?? null),
  };
}

async function caregiverStateWithEvaluations(request: Request, env: Env, actor: AuthUser) {
  const baseResponse = await caregiverLightState(env, actor);
  const payload = await baseResponse.json().catch(() => ({})) as JsonRecord;
  if (!baseResponse.ok || !actor.caregiverId) return json(payload, baseResponse.status);

  const evaluationUrl = new URL("/api/evaluations", request.url);
  evaluationUrl.searchParams.set("caregiverId", actor.caregiverId);
  const evaluationRequest = new Request(evaluationUrl.toString(), {
    method: "GET",
    headers: request.headers,
  });
  const evaluationResponse = await getCaregiverEvaluation(evaluationRequest, env, actor);
  if (!evaluationResponse.ok) return json(payload, baseResponse.status);

  const evaluationPayload = await evaluationResponse.json().catch(() => ({})) as JsonRecord;
  const evaluationData = record(evaluationPayload.data);
  const state = record(record(payload.data).state);
  const evaluationState = record(state.evaluation);
  const caregiver = rows(evaluationState.caregivers)[0] || {};
  const membershipCode = str(caregiver.id || caregiver.membershipCode || actor.caregiverId);
  const detailed = record(evaluationData.evaluation);
  const detailedId = str(detailed.id);
  const projected = rows(evaluationData.periods).map((period) => projectEvaluationPeriod(
    period,
    str(period.id) === detailedId ? detailed : null,
    actor.caregiverId || "",
    membershipCode,
  ));
  const projectedIds = new Set(projected.map((period) => str(period.id)));
  evaluationState.periods = [
    ...projected,
    ...rows(evaluationState.periods).filter((period) => !projectedIds.has(str(period.id))),
  ];
  evaluationState.serverBacked = true;
  state.evaluation = evaluationState;
  record(payload.data).state = state;
  return json(payload, baseResponse.status);
}

async function paginatedUsers(request: Request, env: Env, actor: Parameters<typeof adminDirectoryLight>[2]) {
  const url = new URL(request.url);
  url.searchParams.set("includeCounts", "0");
  const optimizedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
  });
  const response = await adminDirectoryLight(optimizedRequest, env, actor);
  const payload = await response.json().catch(() => ({})) as {
    data?: { accounts?: unknown[]; pagination?: Record<string, unknown>; query?: string };
    message?: string;
  };
  if (!response.ok) return inheritDiagnosticHeaders(response, json(payload, response.status));
  return inheritDiagnosticHeaders(response, json({
    data: payload.data?.accounts || [],
    pagination: payload.data?.pagination || null,
    query: payload.data?.query || "",
  }));
}

async function recruiterCanManageProfileImage(request: Request, env: Env) {
  const url = new URL(request.url);
  const caregiverId = str(url.searchParams.get("caregiverId"));
  const userId = str(url.searchParams.get("userId"));
  if (caregiverId) {
    const row = await env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1")
      .bind(caregiverId)
      .first<{ id: string }>();
    if (row) return true;
  }
  if (userId) {
    const row = await env.DB.prepare(`SELECT caregiver_id AS caregiverId FROM users
      WHERE id=? AND upper(role)='CAREGIVER' AND caregiver_id IS NOT NULL LIMIT 1`)
      .bind(userId)
      .first<{ caregiverId: string }>();
    if (row?.caregiverId) return true;
  }
  return false;
}

async function specialRoute(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  const directoryMutation = isDirectoryMutation(pathname, method);
  const evaluationIndicatorMatch = pathname.match(/^\/api\/evaluations\/([^/]+)\/indicators\/(Q-\d{2})$/);
  const evaluationFinalizeMatch = pathname.match(/^\/api\/evaluations\/([^/]+)\/finalize$/);
  const evaluationRoute = pathname === "/api/evaluations"
    || Boolean(evaluationIndicatorMatch)
    || Boolean(evaluationFinalizeMatch);
  const known = [
    "/api/training/caregivers",
    "/api/training/courses/upload",
    "/api/admin/caregiver-import/batch",
    "/api/admin/caregiver-import/status",
    "/api/admin/caregivers-page",
    "/api/admin/caregiver-record",
    "/api/admin/caregiver-profile",
    "/api/admin/directory",
    "/api/admin/bootstrap",
    "/api/me/bootstrap",
    "/api/users",
    "/api/caregivers",
    "/api/caregiver-accounts",
    "/api/profile-images",
    "/api/state",
    "/api/bootstrap",
  ];
  if (!known.includes(pathname) && !directoryMutation && !evaluationRoute) return null;
  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");

  const role = actor.role.toUpperCase();
  if (["/api/state", "/api/bootstrap", "/api/admin/bootstrap", "/api/me/bootstrap"].includes(pathname) && method === "GET") {
    return role === "CAREGIVER"
      ? caregiverStateWithEvaluations(request, env, actor)
      : adminLightState(env, actor);
  }
  if (pathname === "/api/state" && method === "PUT" && role !== "CAREGIVER") {
    return app.fetch(await prunedAdminStateRequest(request), env);
  }

  if (pathname === "/api/admin/directory" && method === "GET") {
    return role === "RECRUITER"
      ? recruiterDirectory(request, env, actor)
      : adminDirectoryLight(request, env, actor);
  }
  if (pathname === "/api/users" && method === "GET") {
    if (role !== "ADMIN") return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return paginatedUsers(request, env, actor);
  }
  if (pathname === "/api/caregiver-accounts" && method === "POST") {
    if (!["ADMIN", "RECRUITER"].includes(role)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    const response = await createCaregiverAccount(request, env, actor);
    if (response.ok) invalidateCaregiverCaches();
    return response;
  }
  if (pathname === "/api/profile-images" && method === "POST") {
    if (role === "RECRUITER") {
      if (!await recruiterCanManageProfileImage(request, env)) {
        return fail("کارشناس جذب فقط می‌تواند تصویر پروفایل مراقبین را مدیریت کند.", 403, "forbidden");
      }
      const response = await uploadProfileImage(request, env, asAdmin(actor));
      if (response.ok) invalidateCaregiverCaches();
      return response;
    }
    const response = await app.fetch(request, env);
    if (response.ok) invalidateCaregiverCaches();
    return response;
  }

  if (pathname === "/api/evaluations" && method === "GET") {
    return getCaregiverEvaluation(request, env, asEvaluator(actor));
  }
  if (pathname === "/api/evaluations" && method === "POST") {
    return createEvaluationPeriod(request, env, asEvaluator(actor));
  }
  if (evaluationIndicatorMatch && method === "PUT") {
    return saveIndicatorScores(
      request,
      env,
      asEvaluator(actor),
      decodeURIComponent(evaluationIndicatorMatch[1]),
      evaluationIndicatorMatch[2],
    );
  }
  if (evaluationFinalizeMatch && method === "POST") {
    const response = await finalizeEvaluation(
      request,
      env,
      asEvaluator(actor),
      decodeURIComponent(evaluationFinalizeMatch[1]),
    );
    if (response.ok) invalidateCaregiverCaches();
    return response;
  }

  if (pathname === "/api/training/caregivers" && method === "GET") return getTrainingCaregivers(request, env, actor);
  if (pathname === "/api/caregivers" && method === "GET" && ["ADMIN", "RECRUITER", "HR", "EVALUATOR", "EDUCATION"].includes(role)) {
    return getTrainingCaregivers(request, env, actor);
  }
  if (pathname === "/api/training/courses/upload" && method === "POST") return uploadTrainingCourse(request, env, actor);
  if (pathname === "/api/admin/caregiver-import/batch" && method === "POST") {
    const response = await importCaregiverBatchV2(request, env, actor);
    if (response.ok) invalidateCaregiverCaches();
    return response;
  }
  if (pathname === "/api/admin/caregiver-import/status" && method === "GET") return caregiverImportStatus(env, actor);
  if (pathname === "/api/admin/caregivers-page" && method === "GET") {
    return caregiverDirectoryPage(request, env, asAdmin(actor));
  }
  if (pathname === "/api/admin/caregiver-record" && method === "GET") {
    return caregiverRecord(request, env, asAdmin(actor));
  }
  if (pathname === "/api/admin/caregiver-profile" && ["GET", "PATCH"].includes(method)) {
    const response = await caregiverProfileEditor(request, env, asAdmin(actor));
    if (method === "PATCH" && response.ok) invalidateCaregiverCaches();
    return response;
  }
  if (directoryMutation) {
    const response = await app.fetch(request, env);
    if (response.ok) invalidateCaregiverCaches();
    return response;
  }
  return null;
}

async function withRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();

  if (!html.includes("system-performance-recovery.js")) {
    html = html.replace(
      "</head>",
      '<script src="./system-performance-recovery.js?v=1.0.0"></script></head>',
    );
  }

  const scripts: string[] = [];
  if (!html.includes("stable-search-guard.js")) {
    scripts.push('<script src="./stable-search-guard.js?v=2.0.0"></script>');
  }
  if (!html.includes("training-admin-reliability.js")) {
    scripts.push('<script src="./training-admin-reliability.js?v=2.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-pagination.js")) {
    scripts.push('<script src="./caregiver-directory-pagination.js?v=3.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-display-fix.js")) {
    scripts.push('<script src="./caregiver-directory-display-fix.js?v=1.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-router-guard.js")) {
    scripts.push('<script src="./caregiver-directory-router-guard.js?v=1.0.0"></script>');
  }
  if (!html.includes("caregiver-professional-bridge.js")) {
    scripts.push('<script src="./caregiver-professional-bridge.js?v=6.0.0"></script>');
  }
  if (!html.includes("caregiver-crm-link.js")) {
    scripts.push('<script src="./caregiver-crm-link.js?v=2.0.0"></script>');
  }
  if (!html.includes("evaluation-directory-pagination-fix.js")) {
    scripts.push('<script src="./evaluation-directory-pagination-fix.js?v=2.0.0"></script>');
  }
  if (html.includes("account-directory-pagination.js")) {
    html = html.replace(/account-directory-pagination\.js\?v=[^"']+/g, "account-directory-pagination.js?v=4.0.0");
  } else {
    scripts.push('<script src="./account-directory-pagination.js?v=4.0.0"></script>');
  }
  if (html.includes("caregiver-profile-editor.js")) {
    html = html.replace(/caregiver-profile-editor\.js\?v=[^"']+/g, "caregiver-profile-editor.js?v=2.0.0");
  } else {
    scripts.push('<script src="./caregiver-profile-editor.js?v=2.0.0"></script>');
  }
  if (!html.includes("training-recipient-pagination.js")) {
    scripts.push('<script src="./training-recipient-pagination.js?v=2.1.0"></script>');
  }
  if (!html.includes("caregiver-bulk-import-runtime-v2.js")) {
    scripts.push('<script src="./caregiver-bulk-import-runtime-v2.js?v=2.0.0"></script>');
  }
  if (html.includes("professional-evaluation-bridge.js")) {
    html = html.replace(/professional-evaluation-bridge\.js\?v=[^"']+/g, "professional-evaluation-bridge.js?v=2.0.0");
  }
  if (html.includes("recruiter-server-runtime.js")) {
    html = html.replace(/recruiter-server-runtime\.js\?v=[^"']+/g, "recruiter-server-runtime.js?v=1.0.0");
  } else {
    scripts.push('<script src="./recruiter-server-runtime.js?v=1.0.0"></script>');
  }
  if (scripts.length) html = html.replace("</body>", `${scripts.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = performance.now();
    try {
      const response = await specialRoute(request, env);
      if (response) return withRequestTiming(securityHeaders(response), startedAt);
      return withRequestTiming(await withRuntime(await app.fetch(request, env)), startedAt);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      const message = /(quota|daily.*limit|limit.*exceed|exceed.*limit|too many queries)/i.test(detail)
        ? "سقف مصرف روزانه دیتابیس پر شده است."
        : "خطای داخلی سرور رخ داد.";
      return withRequestTiming(securityHeaders(json({ error: "internal_error", message, detail }, 500)), startedAt);
    }
  },
};
