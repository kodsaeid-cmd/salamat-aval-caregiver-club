import app from "./index-training-fixes";
import {
  accessConfiguration,
  accessMe,
  getUserPermissions,
  requireAccess,
  updateRolePermissions,
  updateUserPermissions,
  type AccessAction,
} from "./access-control";
import { adminDirectoryLight } from "./admin-directory-light";
import { caregiverDirectoryPage } from "./caregiver-directory-page";
import { caregiverProfileEditor } from "./caregiver-profile-editor";
import { caregiverRecord } from "./caregiver-record";
import { createCaregiverAccount } from "./caregiver-accounts";
import {
  createCaregiver,
  createUser,
  deleteUser,
  updateCaregiver,
  updateUser,
} from "./data";
import {
  createEvaluationPeriod,
  finalizeEvaluation,
  getCaregiverEvaluation,
  saveIndicatorScores,
} from "./evaluations";
import { uploadProfileImage } from "./profile-images";
import {
  type AuthUser,
  type Env,
  fail,
  getUser,
  json,
  normalizeRole,
  securityHeaders,
} from "./lib";

type PermissionRequirement = {
  module: string;
  action: AccessAction;
};

type DecisionEntry = {
  allowed: boolean;
  expiresAt: number;
};

const permissionDecisionCache = new Map<string, DecisionEntry>();
const PERMISSION_CACHE_TTL_MS = 15_000;
const PERMISSION_CACHE_MAX = 1_000;

function decisionKey(actor: AuthUser, needed: PermissionRequirement) {
  return `${actor.id}|${normalizeRole(actor.role)}|${needed.module}|${needed.action}`;
}

function invalidatePermissionDecisions(userId?: string) {
  if (!userId) {
    permissionDecisionCache.clear();
    return;
  }
  for (const key of permissionDecisionCache.keys()) {
    if (key.startsWith(`${userId}|`)) permissionDecisionCache.delete(key);
  }
}

async function cachedPermissionCheck(
  env: Env,
  actor: AuthUser,
  needed: PermissionRequirement,
) {
  if (actor.role.toUpperCase() === "ADMIN") return null;
  const key = decisionKey(actor, needed);
  const cached = permissionDecisionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed
      ? null
      : fail("برای این عملیات دسترسی ندارید.", 403, "forbidden");
  }
  permissionDecisionCache.delete(key);
  const denied = await requireAccess(env, actor, needed.module, needed.action);
  if (permissionDecisionCache.size >= PERMISSION_CACHE_MAX) {
    permissionDecisionCache.delete(permissionDecisionCache.keys().next().value || "");
  }
  permissionDecisionCache.set(key, {
    allowed: !denied,
    expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
  });
  return denied;
}

function asAdmin(actor: AuthUser): AuthUser {
  return { ...actor, role: "ADMIN" };
}

function asEvaluator(actor: AuthUser): AuthUser {
  return { ...actor, role: "EVALUATOR" };
}

function requirement(pathname: string, method: string): PermissionRequirement | null {
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
  if (pathname === "/api/admin/directory" && method === "GET") {
    return { module: "staff.caregivers", action: "view" };
  }
  if (pathname === "/api/admin/caregivers-page" && method === "GET") {
    return { module: "staff.caregivers", action: "view" };
  }
  if (["/api/admin/caregiver-record", "/api/admin/caregiver-profile"].includes(pathname)) {
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

async function paginatedUsers(request: Request, env: Env, actor: AuthUser) {
  const url = new URL(request.url);
  url.searchParams.set("includeCounts", "0");
  const forwarded = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });
  const response = await adminDirectoryLight(forwarded, env, asAdmin(actor));
  const payload = await response.json().catch(() => ({})) as {
    data?: { accounts?: unknown[]; pagination?: Record<string, unknown>; query?: string };
    message?: string;
  };
  if (!response.ok) return json(payload, response.status);
  return json({
    data: payload.data?.accounts || [],
    pagination: payload.data?.pagination || null,
    query: payload.data?.query || "",
  });
}

async function targetAccount(env: Env, userId: string) {
  return env.DB.prepare("SELECT id,role FROM users WHERE id=? LIMIT 1")
    .bind(userId)
    .first<{ id: string; role: string }>();
}

async function nonAdminCanManageAccount(request: Request, env: Env, actor: AuthUser, targetId?: string) {
  if (actor.role.toUpperCase() === "ADMIN") return null;
  if (request.method.toUpperCase() === "POST") {
    const body = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
    if (normalizeRole(body.role) !== "CAREGIVER") {
      return fail("ایجاد حساب سازمانی و تخصیص نقش فقط در اختیار مدیر سامانه است.", 403, "admin_role_required");
    }
    return null;
  }
  if (!targetId) return fail("حساب کاربری مشخص نشده است.", 400);
  const target = await targetAccount(env, targetId);
  if (!target) return fail("حساب کاربری پیدا نشد.", 404, "user_not_found");
  if (target.role.toUpperCase() !== "CAREGIVER") {
    return fail("کاربران سازمانی فقط توسط مدیر سامانه قابل تغییر هستند.", 403, "admin_role_required");
  }
  const body = request.method.toUpperCase() === "PATCH"
    ? await request.clone().json().catch(() => ({})) as Record<string, unknown>
    : {};
  if (body.role !== undefined && normalizeRole(body.role) !== "CAREGIVER") {
    return fail("تغییر نقش سازمانی فقط در اختیار مدیر سامانه است.", 403, "admin_role_required");
  }
  return null;
}

async function handleAccessRoutes(request: Request, env: Env, actor: AuthUser) {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (pathname === "/api/access/me" && method === "GET") return accessMe(env, actor);
  if (pathname === "/api/admin/access/config" && method === "GET") return accessConfiguration(env, actor);

  const roleMatch = pathname.match(/^\/api\/admin\/access\/roles\/([^/]+)$/);
  if (roleMatch && method === "PUT") {
    const response = await updateRolePermissions(request, env, actor, decodeURIComponent(roleMatch[1]));
    if (response.ok) invalidatePermissionDecisions();
    return response;
  }

  const userMatch = pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
  if (userMatch && method === "GET") {
    return getUserPermissions(env, actor, decodeURIComponent(userMatch[1]));
  }
  if (userMatch && method === "PUT") {
    const userId = decodeURIComponent(userMatch[1]);
    const response = await updateUserPermissions(request, env, actor, userId);
    if (response.ok) invalidatePermissionDecisions(userId);
    return response;
  }
  return null;
}

async function handlePermissionAwareRoutes(request: Request, env: Env, actor: AuthUser) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();
  const needed = requirement(pathname, method);
  if (!needed) return null;
  const denied = await cachedPermissionCheck(env, actor, needed);
  if (denied) return denied;

  if (pathname === "/api/users" && method === "GET") return paginatedUsers(request, env, actor);
  if (pathname === "/api/users" && method === "POST") {
    const restricted = await nonAdminCanManageAccount(request, env, actor);
    return restricted || createUser(request, env, actor);
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && method === "PATCH") {
    const userId = decodeURIComponent(userMatch[1]);
    const restricted = await nonAdminCanManageAccount(request, env, actor, userId);
    if (restricted) return restricted;
    const response = await updateUser(request, env, actor, userId);
    if (response.ok) invalidatePermissionDecisions(userId);
    return response;
  }
  if (userMatch && method === "DELETE") {
    const userId = decodeURIComponent(userMatch[1]);
    if (actor.role.toUpperCase() !== "ADMIN") {
      return fail("حذف حساب فقط در اختیار مدیر سامانه است.", 403, "admin_role_required");
    }
    const response = await deleteUser(request, env, actor, userId);
    if (response.ok) invalidatePermissionDecisions(userId);
    return response;
  }

  if (pathname === "/api/caregiver-accounts" && method === "POST") {
    return createCaregiverAccount(request, env, actor);
  }
  if (pathname === "/api/admin/directory" && method === "GET") {
    return adminDirectoryLight(request, env, asAdmin(actor));
  }
  if (pathname === "/api/admin/caregivers-page" && method === "GET") {
    return caregiverDirectoryPage(request, env, asAdmin(actor));
  }
  if (pathname === "/api/admin/caregiver-record" && method === "GET") {
    return caregiverRecord(request, env, asAdmin(actor));
  }
  if (pathname === "/api/admin/caregiver-profile" && ["GET", "PATCH"].includes(method)) {
    return caregiverProfileEditor(request, env, asAdmin(actor));
  }
  if (pathname === "/api/caregivers" && method === "POST") {
    return createCaregiver(request, env, actor);
  }
  const caregiverMatch = pathname.match(/^\/api\/caregivers\/([^/]+)$/);
  if (caregiverMatch && method === "PATCH") {
    return updateCaregiver(request, env, actor, decodeURIComponent(caregiverMatch[1]));
  }
  if (pathname === "/api/profile-images" && method === "POST") {
    return uploadProfileImage(request, env, asAdmin(actor));
  }

  if (pathname === "/api/evaluations" && method === "GET") {
    return getCaregiverEvaluation(request, env, asEvaluator(actor));
  }
  if (pathname === "/api/evaluations" && method === "POST") {
    return createEvaluationPeriod(request, env, asEvaluator(actor));
  }
  const indicatorMatch = pathname.match(/^\/api\/evaluations\/([^/]+)\/indicators\/(Q-\d{2})$/);
  if (indicatorMatch && method === "PUT") {
    return saveIndicatorScores(
      request,
      env,
      asEvaluator(actor),
      decodeURIComponent(indicatorMatch[1]),
      indicatorMatch[2],
    );
  }
  const finalizeMatch = pathname.match(/^\/api\/evaluations\/([^/]+)\/finalize$/);
  if (finalizeMatch && method === "POST") {
    return finalizeEvaluation(request, env, asEvaluator(actor), decodeURIComponent(finalizeMatch[1]));
  }

  // The access decision has already been made. Existing handlers continue to own
  // storage, training, payroll and calendar business rules.
  return app.fetch(request, env);
}

function injectAccessRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return response.text().then((source) => {
    let html = source;
    const headPayload = [
      '<style id="salamat-roleless-login-style">.role-section,#roleOptions{display:none!important}.login-heading p{max-width:560px}</style>',
      '<script src="./staff-platform-runtime.js?v=2.0.0"></script>',
    ].join("");
    if (!html.includes("staff-platform-runtime.js")) {
      html = html.replace("</head>", `${headPayload}</head>`);
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.delete("content-length");
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/access/") || path.startsWith("/api/admin/access/")) {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const response = await handleAccessRoutes(request, env, actor);
      return securityHeaders(response || fail("مسیر دسترسی پیدا نشد.", 404, "not_found"));
    }

    const needed = path.startsWith("/api/") ? requirement(path, request.method.toUpperCase()) : null;
    if (needed) {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const response = await handlePermissionAwareRoutes(request, env, actor);
      if (response) return securityHeaders(response);
    }

    const response = await app.fetch(request, env);
    return path.startsWith("/api/") ? response : injectAccessRuntime(response);
  },
};
