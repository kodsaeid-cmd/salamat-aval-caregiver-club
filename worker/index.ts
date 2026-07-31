import { login, logout, me, registerCaregiver, requestOtp, setupAdmin, setupStatus, verifyOtp } from "./auth";
import { batchUpsert, caregiverList } from "./crm";
import {
  bootstrap, caregivers, createCaregiver, createUser, deleteUser, getState,
  putState, updateCaregiver, updateUser, users,
} from "./data";
import {
  type Env, ensureSchema, fail, getUser, hasRole, json, securityHeaders, staffRoles,
} from "./lib";

async function serveAsset(request: Request, env: Env) {
  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const scripts: string[] = [];
  if (!html.includes("backend-auth-override.js")) {
    scripts.push('<script src="./backend-auth-override.js?v=1.1.0"></script>');
  }
  if (!html.includes("backend-integration.js")) {
    scripts.push('<script src="./backend-integration.js?v=1.0.2"></script>');
  }
  if (scripts.length) html = html.replace("</body>", `${scripts.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-cache");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/health") {
    await ensureSchema(env);
    const db = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    const tables = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first<{ count: number }>();
    return json({ status: "ok", database: db?.ok === 1 ? "connected" : "unknown", applicationTables: Number(tables?.count || 0) });
  }
  if (method === "GET" && path === "/api/setup/status") return setupStatus(env);
  if (method === "POST" && path === "/api/setup/admin") return setupAdmin(request, env);
  if (method === "POST" && path === "/api/auth/login") return login(request, env);
  if (method === "POST" && path === "/api/auth/logout") return logout(request, env);
  if (method === "GET" && path === "/api/auth/me") return me(request, env);
  if (method === "POST" && path === "/api/auth/request-otp") return requestOtp(request, env);
  if (method === "POST" && path === "/api/auth/verify-otp") return verifyOtp(request, env);
  if (method === "POST" && path === "/api/public/caregivers/register") return registerCaregiver(request, env);
  if (method === "POST" && path === "/api/internal/crm/caregivers/upsert") return batchUpsert(request, env);
  if (method === "GET" && path === "/api/internal/caregivers") return caregiverList(request, env);

  if (!path.startsWith("/api/")) return serveAsset(request, env);
  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");

  if (method === "GET" && ["/api/state", "/api/admin/bootstrap", "/api/me/bootstrap"].includes(path)) return getState(env, actor);
  if (method === "PUT" && path === "/api/state") return putState(request, env, actor);

  if (method === "GET" && path === "/api/users") {
    if (!hasRole(actor, ["ADMIN"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return json({ data: await users(env) });
  }
  if (method === "POST" && path === "/api/users") {
    if (!hasRole(actor, ["ADMIN"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return createUser(request, env, actor);
  }
  const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && method === "PATCH") {
    if (!hasRole(actor, ["ADMIN"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return updateUser(request, env, actor, decodeURIComponent(userMatch[1]));
  }
  if (userMatch && method === "DELETE") {
    if (!hasRole(actor, ["ADMIN"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return deleteUser(request, env, actor, decodeURIComponent(userMatch[1]));
  }

  if (method === "GET" && path === "/api/caregivers") {
    if (!hasRole(actor, staffRoles)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return json({ data: await caregivers(env) });
  }
  if (method === "POST" && path === "/api/caregivers") {
    if (!hasRole(actor, ["ADMIN", "RECRUITER", "HR"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return createCaregiver(request, env, actor);
  }
  const caregiverMatch = path.match(/^\/api\/caregivers\/([^/]+)$/);
  if (caregiverMatch && method === "PATCH") {
    if (!hasRole(actor, ["ADMIN", "RECRUITER", "HR", "EVALUATOR"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
    return updateCaregiver(request, env, actor, decodeURIComponent(caregiverMatch[1]));
  }

  if (method === "GET" && path === "/api/bootstrap") return json({ data: await bootstrap(env, actor) });
  return fail("مسیر پیدا نشد.", 404, "not_found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return securityHeaders(await route(request, env));
    } catch (error) {
      console.error("Worker request failed", error);
      const detail = error instanceof Error ? error.message : "unknown error";
      return securityHeaders(json({ error: "internal_error", message: "خطای داخلی سرور رخ داد.", detail }, 500));
    }
  },
};
