import app from "./index-login-hotfix";
import { requireAccess, type AccessAction } from "./access-control";
import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import {
  createEvaluationPeriodV2,
  finalizeEvaluationV2,
  getCaregiverEvaluationV2,
  saveIndicatorScoresV2,
} from "./evaluations-v2";
import { invalidateRecruiterDirectoryCache } from "./recruiter-directory";
import { invalidateTrainingCaregiverCache } from "./training-caregivers";
import { type AuthUser, type Env, fail, getUser, securityHeaders } from "./lib";

type EvaluationRoute = {
  action: AccessAction;
  kind: "get" | "create" | "save" | "finalize";
  evaluationId?: string;
  indicatorCode?: string;
};

function evaluationRoute(pathname: string, method: string): EvaluationRoute | null {
  if (pathname === "/api/evaluations" && method === "GET") {
    return { action: "view", kind: "get" };
  }
  if (pathname === "/api/evaluations" && method === "POST") {
    return { action: "create", kind: "create" };
  }
  const indicator = pathname.match(/^\/api\/evaluations\/([^/]+)\/indicators\/(Q-\d{2})$/);
  if (indicator && method === "PUT") {
    return {
      action: "update",
      kind: "save",
      evaluationId: decodeURIComponent(indicator[1]),
      indicatorCode: indicator[2],
    };
  }
  const finalize = pathname.match(/^\/api\/evaluations\/([^/]+)\/finalize$/);
  if (finalize && method === "POST") {
    return {
      action: "update",
      kind: "finalize",
      evaluationId: decodeURIComponent(finalize[1]),
    };
  }
  return null;
}

function invalidateEvaluationConsumers() {
  invalidateAdminDirectoryCounts();
  invalidateCaregiverDirectoryCache();
  invalidateRecruiterDirectoryCache();
  invalidateTrainingCaregiverCache();
}

async function handleEvaluationRoute(
  request: Request,
  env: Env,
  actor: AuthUser,
  route: EvaluationRoute,
) {
  if (actor.role.toUpperCase() === "CAREGIVER") {
    return null;
  }
  const denied = await requireAccess(env, actor, "staff.evaluations", route.action);
  if (denied) return denied;

  if (route.kind === "get") return getCaregiverEvaluationV2(request, env, actor);
  if (route.kind === "create") {
    const response = await createEvaluationPeriodV2(request, env, actor);
    if (response.ok) invalidateEvaluationConsumers();
    return response;
  }
  if (route.kind === "save" && route.evaluationId && route.indicatorCode) {
    const response = await saveIndicatorScoresV2(
      request,
      env,
      actor,
      route.evaluationId,
      route.indicatorCode,
    );
    if (response.ok) invalidateEvaluationConsumers();
    return response;
  }
  if (route.kind === "finalize" && route.evaluationId) {
    const response = await finalizeEvaluationV2(request, env, actor, route.evaluationId);
    if (response.ok) invalidateEvaluationConsumers();
    return response;
  }
  return fail("مسیر ارزیابی معتبر نیست.", 404, "evaluation_route_not_found");
}

const CONFLICTING_RUNTIME_NAMES = [
  "evaluation-directory-pagination-fix.js",
  "evaluation-search-canonical-runtime.js",
  "server-evaluation-runtime.js",
  "server-evaluation-runtime-v2.js",
  "evaluation-live-score-runtime.js",
  "evaluation-finalization-recovery.js",
  "recruiter-server-runtime.js",
  "recruiter-live-runtime-loader.js",
  "evaluation-module-controller.js",
];

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script[^>]+src=["'][^"']*${escaped}[^"']*["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

async function stabilizeHtml(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  for (const fileName of CONFLICTING_RUNTIME_NAMES) html = stripScript(html, fileName);

  const controller = '<script src="./evaluation-module-controller-v2.js?v=1.0.0"></script>';
  if (!html.includes("evaluation-module-controller-v2.js")) {
    const staffScript = /<script[^>]+src=["'][^"']*staff-platform-runtime\.js[^"']*["'][^>]*>\s*<\/script>/i;
    if (staffScript.test(html)) html = html.replace(staffScript, `${controller}$&`);
    else html = html.replace("</head>", `${controller}</head>`);
  } else {
    html = html.replace(
      /evaluation-module-controller-v2\.js\?v=[^"']+/g,
      "evaluation-module-controller-v2.js?v=1.0.0",
    );
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = evaluationRoute(url.pathname, request.method.toUpperCase());
    if (route) {
      const actor = await getUser(request, env);
      if (!actor) {
        return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      }
      const response = await handleEvaluationRoute(request, env, actor, route);
      if (response) return securityHeaders(response);
    }

    const response = await app.fetch(request, env);
    return url.pathname.startsWith("/api/") ? response : stabilizeHtml(response);
  },
};
