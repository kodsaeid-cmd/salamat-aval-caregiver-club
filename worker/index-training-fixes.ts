import app from "./index-with-benefits";
import { caregiverImportStatus, importCaregiverBatch } from "./caregiver-bulk-import";
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
  ];
  if (!known.includes(pathname)) return null;
  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  if (pathname === "/api/training/caregivers" && method === "GET") return getTrainingCaregivers(env, actor);
  if (pathname === "/api/training/courses/upload" && method === "POST") return uploadTrainingCourse(request, env, actor);
  if (pathname === "/api/admin/caregiver-import/batch" && method === "POST") return importCaregiverBatch(request, env, actor);
  if (pathname === "/api/admin/caregiver-import/status" && method === "GET") return caregiverImportStatus(env, actor);
  return fail("مسیر درخواستی پیدا نشد.", 404, "not_found");
}

async function withRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const scripts: string[] = [];
  if (!html.includes("training-admin-reliability.js")) {
    scripts.push('<script src="./training-admin-reliability.js?v=2.0.0"></script>');
  }
  if (!html.includes("caregiver-bulk-import-runtime.js")) {
    scripts.push('<script src="./caregiver-bulk-import-runtime.js?v=1.0.0"></script>');
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
      return securityHeaders(json({ error: "internal_error", message: "خطای داخلی سرور رخ داد.", detail }, 500));
    }
  },
};
