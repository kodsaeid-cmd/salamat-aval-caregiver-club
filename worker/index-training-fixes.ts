import app from "./index-with-benefits";
import { adminDirectoryLight } from "./admin-directory-light";
import { adminLightState, prunedAdminStateRequest } from "./admin-light-state";
import { caregiverLightState } from "./caregiver-light-state";
import { caregiverImportStatus } from "./caregiver-bulk-import";
import { importCaregiverBatchV2 } from "./caregiver-bulk-import-v2";
import { caregiverDirectoryPage } from "./caregiver-directory-page";
import { caregiverRecord } from "./caregiver-record";
import { getTrainingCaregivers } from "./training-caregivers";
import { uploadTrainingCourse } from "./training-upload-reliable";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

async function specialRoute(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  const known = [
    "/api/training/caregivers",
    "/api/training/courses/upload",
    "/api/admin/caregiver-import/batch",
    "/api/admin/caregiver-import/status",
    "/api/admin/caregivers-page",
    "/api/admin/caregiver-record",
    "/api/admin/directory",
    "/api/caregivers",
    "/api/state",
    "/api/bootstrap",
  ];
  if (!known.includes(pathname)) return null;
  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");

  const role = actor.role.toUpperCase();
  if ((pathname === "/api/state" || pathname === "/api/bootstrap") && method === "GET") {
    return role === "CAREGIVER"
      ? caregiverLightState(env, actor)
      : adminLightState(env, actor);
  }
  if (pathname === "/api/state" && method === "PUT" && role !== "CAREGIVER") {
    return app.fetch(await prunedAdminStateRequest(request), env);
  }

  if (pathname === "/api/admin/directory" && method === "GET") return adminDirectoryLight(request, env, actor);
  if (pathname === "/api/training/caregivers" && method === "GET") return getTrainingCaregivers(request, env, actor);
  if (pathname === "/api/caregivers" && method === "GET" && ["ADMIN", "RECRUITER", "HR"].includes(role)) {
    return getTrainingCaregivers(request, env, actor);
  }
  if (pathname === "/api/training/courses/upload" && method === "POST") return uploadTrainingCourse(request, env, actor);
  if (pathname === "/api/admin/caregiver-import/batch" && method === "POST") return importCaregiverBatchV2(request, env, actor);
  if (pathname === "/api/admin/caregiver-import/status" && method === "GET") return caregiverImportStatus(env, actor);
  if (pathname === "/api/admin/caregivers-page" && method === "GET") return caregiverDirectoryPage(request, env, actor);
  if (pathname === "/api/admin/caregiver-record" && method === "GET") return caregiverRecord(request, env, actor);
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
  if (!html.includes("training-admin-reliability.js")) {
    scripts.push('<script src="./training-admin-reliability.js?v=2.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-pagination.js")) {
    scripts.push('<script src="./caregiver-directory-pagination.js?v=2.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-display-fix.js")) {
    scripts.push('<script src="./caregiver-directory-display-fix.js?v=1.0.0"></script>');
  }
  if (!html.includes("caregiver-directory-router-guard.js")) {
    scripts.push('<script src="./caregiver-directory-router-guard.js?v=1.0.0"></script>');
  }
  if (!html.includes("caregiver-professional-bridge.js")) {
    scripts.push('<script src="./caregiver-professional-bridge.js?v=4.0.0"></script>');
  }
  if (!html.includes("caregiver-crm-link.js")) {
    scripts.push('<script src="./caregiver-crm-link.js?v=1.0.0"></script>');
  }
  if (!html.includes("evaluation-directory-pagination-fix.js")) {
    scripts.push('<script src="./evaluation-directory-pagination-fix.js?v=2.0.0"></script>');
  }
  if (!html.includes("account-directory-pagination.js")) {
    scripts.push('<script src="./account-directory-pagination.js?v=2.0.0"></script>');
  }
  if (!html.includes("training-recipient-pagination.js")) {
    scripts.push('<script src="./training-recipient-pagination.js?v=2.1.0"></script>');
  }
  if (!html.includes("caregiver-bulk-import-runtime-v2.js")) {
    scripts.push('<script src="./caregiver-bulk-import-runtime-v2.js?v=2.0.0"></script>');
  }
  if (scripts.length) html = html.replace("</body>", `${scripts.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await specialRoute(request, env);
      if (response) return securityHeaders(response);
      return withRuntime(await app.fetch(request, env));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      const message = /(quota|daily.*limit|limit.*exceed|exceed.*limit|too many queries)/i.test(detail)
        ? "سقف مصرف روزانه دیتابیس پر شده است."
        : "خطای داخلی سرور رخ داد.";
      return securityHeaders(json({ error: "internal_error", message, detail }, 500));
    }
  },
};
