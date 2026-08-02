import app from "./index-stability";
import { type AccessAction } from "./access-control";
import { updateAccountV2, deleteAccountV2 } from "./account-management-v2";
import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { invalidateRecruiterDirectoryCache } from "./recruiter-directory";
import {
  strictAccessMe,
  strictRequireAccess,
} from "./strict-access";
import {
  type AuthUser,
  type Env,
  fail,
  getUser,
  securityHeaders,
} from "./lib";

type Requirement = { module: string; action: AccessAction };

function requirement(pathname: string, method: string): Requirement | null {
  if (pathname === "/api/users") {
    if (method === "GET") return { module: "staff.users", action: "view" };
    if (method === "POST") return { module: "staff.users", action: "create" };
  }
  if (/^\/api\/users\/[^/]+$/.test(pathname)) {
    if (method === "PATCH") return { module: "staff.users", action: "update" };
    if (method === "DELETE") return { module: "staff.users", action: "delete" };
  }
  if (pathname === "/api/caregiver-accounts" && method === "POST") {
    return { module: "staff.users", action: "create" };
  }
  if (["/api/admin/directory", "/api/admin/caregivers-page", "/api/admin/caregiver-record"].includes(pathname)) {
    return { module: "staff.caregivers", action: "view" };
  }
  if (pathname === "/api/admin/caregiver-profile") {
    return { module: "staff.caregivers", action: method === "GET" ? "view" : "update" };
  }
  if (pathname === "/api/caregivers") {
    if (method === "GET") return { module: "staff.caregivers", action: "view" };
    if (method === "POST") return { module: "staff.caregivers", action: "create" };
  }
  if (/^\/api\/caregivers\/[^/]+$/.test(pathname)) {
    if (method === "PATCH") return { module: "staff.caregivers", action: "update" };
    if (method === "DELETE") return { module: "staff.caregivers", action: "delete" };
  }
  if (pathname === "/api/profile-images" && method === "POST") {
    return { module: "staff.caregivers", action: "update" };
  }
  if (pathname === "/api/evaluations") {
    return { module: "staff.evaluations", action: method === "GET" ? "view" : "create" };
  }
  if (/^\/api\/evaluations\/[^/]+\/indicators\/Q-\d{2}$/.test(pathname)) {
    return { module: "staff.evaluations", action: "update" };
  }
  if (/^\/api\/evaluations\/[^/]+\/finalize$/.test(pathname)) {
    return { module: "staff.evaluations", action: "update" };
  }
  if (pathname === "/api/training/caregivers" && method === "GET") {
    return { module: "staff.training", action: "view" };
  }
  if (pathname === "/api/training/courses/upload" && method === "POST") {
    return { module: "staff.training", action: "create" };
  }
  if (/^\/api\/calendar/.test(pathname)) {
    return { module: "staff.contracts", action: method === "GET" ? "view" : "update" };
  }
  if (/^\/api\/files/.test(pathname)) {
    return {
      module: "staff.training",
      action: method === "GET" ? "view" : method === "DELETE" ? "delete" : "create",
    };
  }
  return null;
}

function invalidateAccountConsumers() {
  invalidateAdminDirectoryCounts();
  invalidateCaregiverDirectoryCache();
  invalidateRecruiterDirectoryCache();
}

async function actorOrUnauthorized(request: Request, env: Env) {
  const actor = await getUser(request, env);
  return actor || null;
}

async function handleAccountMutation(
  request: Request,
  env: Env,
  actor: AuthUser,
  pathname: string,
  method: string,
) {
  const match = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (!match || !["PATCH", "DELETE"].includes(method)) return null;
  const action: AccessAction = method === "DELETE" ? "delete" : "update";
  const denied = await strictRequireAccess(env, actor, "staff.users", action);
  if (denied) return denied;
  const userId = decodeURIComponent(match[1]);
  const response = method === "DELETE"
    ? await deleteAccountV2(request, env, actor, userId)
    : await updateAccountV2(request, env, actor, userId);
  if (response.ok) invalidateAccountConsumers();
  return response;
}

async function clearLegacyPermissionGrants(
  request: Request,
  env: Env,
  actor: AuthUser,
  pathname: string,
  method: string,
) {
  const match = pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
  if (!match || method !== "PUT") return null;
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("فقط مدیر سامانه می‌تواند دسترسی کاربران را تغییر دهد.", 403, "forbidden");
  }
  const response = await app.fetch(request, env);
  if (response.ok) {
    const userId = decodeURIComponent(match[1]);
    await env.DB.prepare("UPDATE users SET permissions_json='[]' WHERE id=?")
      .bind(userId)
      .run();
    invalidateAccountConsumers();
  }
  return response;
}

async function injectStrictModuleGuard(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const tag = '<script src="./staff-permission-guard.js?v=1.0.0"></script>';
  if (!html.includes("staff-permission-guard.js")) {
    const staffRuntime = /<script[^>]+src=["'][^"']*staff-platform-runtime\.js[^"']*["'][^>]*>\s*<\/script>/i;
    if (staffRuntime.test(html)) html = html.replace(staffRuntime, `$&${tag}`);
    else html = html.replace("</head>", `${tag}</head>`);
  } else {
    html = html.replace(/staff-permission-guard\.js\?v=[^"']+/g, "staff-permission-guard.js?v=1.0.0");
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
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    if (pathname === "/api/access/me" && method === "GET") {
      const actor = await actorOrUnauthorized(request, env);
      return securityHeaders(actor
        ? await strictAccessMe(env, actor)
        : fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
    }

    const userMutation = /^\/api\/users\/[^/]+$/.test(pathname)
      && ["PATCH", "DELETE"].includes(method);
    const permissionMutation = /^\/api\/admin\/access\/users\/[^/]+$/.test(pathname)
      && method === "PUT";

    if (userMutation || permissionMutation) {
      const actor = await actorOrUnauthorized(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const response = userMutation
        ? await handleAccountMutation(request, env, actor, pathname, method)
        : await clearLegacyPermissionGrants(request, env, actor, pathname, method);
      return securityHeaders(response || fail("مسیر حساب پیدا نشد.", 404, "not_found"));
    }

    const needed = pathname.startsWith("/api/") ? requirement(pathname, method) : null;
    if (needed) {
      const actor = await actorOrUnauthorized(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      // The caregiver panel keeps its own independent permission model.
      if (actor.role.toUpperCase() !== "CAREGIVER") {
        const denied = await strictRequireAccess(env, actor, needed.module, needed.action);
        if (denied) return securityHeaders(denied);
      }
    }

    const response = await app.fetch(request, env);
    return pathname.startsWith("/api/") ? response : injectStrictModuleGuard(response);
  },
};
