import app from "./index-with-benefits";
import { getTrainingCaregivers } from "./training-caregivers";
import { uploadTrainingCourse } from "./training-upload-reliable";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

async function specialRoute(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  if (pathname !== "/api/training/caregivers" && pathname !== "/api/training/courses/upload") return null;
  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  if (pathname === "/api/training/caregivers" && method === "GET") return getTrainingCaregivers(env, actor);
  if (pathname === "/api/training/courses/upload" && method === "POST") return uploadTrainingCourse(request, env, actor);
  return fail("مسیر آموزش پیدا نشد.", 404, "not_found");
}

async function withRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  if (!html.includes("training-admin-reliability.js")) {
    html = html.replace("</body>", '<script src="./training-admin-reliability.js?v=2.0.0"></script></body>');
  }
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
