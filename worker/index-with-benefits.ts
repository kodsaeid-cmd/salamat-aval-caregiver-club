import application from "./index";
import { getFinancialBenefits, updateContractInsurance } from "./benefits";
import { syncContractsForBenefits } from "./benefits-sync";
import { getTrainingAdminDashboard } from "./training-admin";
import { getAssignedTrainingContent } from "./training-content";
import { getAssignedTrainingFile } from "./training-file-access";
import {
  assignCourse, closeTraining, completeTraining, createCourse, getMyTraining,
  heartbeatTraining, openTraining, updateCourse,
} from "./training";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

async function benefitRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/benefits/")) return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/benefits/summary") {
    await syncContractsForBenefits(env);
    return getFinancialBenefits(request, env, actor);
  }
  const insuranceMatch = path.match(/^\/api\/benefits\/contracts\/([^/]+)\/insurance$/);
  if (insuranceMatch && method === "PUT") {
    return updateContractInsurance(request, env, actor, decodeURIComponent(insuranceMatch[1]));
  }
  return fail("مسیر مزایا پیدا نشد.", 404, "not_found");
}

async function trainingRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/training/")) return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/training/my") return getMyTraining(request, env, actor);
  if (method === "GET" && path === "/api/training/admin") return getTrainingAdminDashboard(env, actor);
  if (method === "POST" && path === "/api/training/courses") return createCourse(request, env, actor);
  if (method === "POST" && path === "/api/training/assignments") return assignCourse(request, env, actor);

  const courseMatch = path.match(/^\/api\/training\/courses\/([^/]+)$/);
  if (courseMatch && method === "PATCH") return updateCourse(request, env, actor, decodeURIComponent(courseMatch[1]));
  const enrollmentContentMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/content$/);
  if (enrollmentContentMatch && method === "GET") return getAssignedTrainingContent(request, env, actor, decodeURIComponent(enrollmentContentMatch[1]));
  const enrollmentOpenMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/open$/);
  if (enrollmentOpenMatch && method === "POST") return openTraining(request, env, actor, decodeURIComponent(enrollmentOpenMatch[1]));
  const enrollmentCompleteMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/complete$/);
  if (enrollmentCompleteMatch && method === "POST") return completeTraining(request, env, actor, decodeURIComponent(enrollmentCompleteMatch[1]));
  const heartbeatMatch = path.match(/^\/api\/training\/sessions\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && method === "POST") return heartbeatTraining(env, actor, decodeURIComponent(heartbeatMatch[1]));
  const closeMatch = path.match(/^\/api\/training\/sessions\/([^/]+)\/close$/);
  if (closeMatch && method === "POST") return closeTraining(request, env, actor, decodeURIComponent(closeMatch[1]));
  return fail("مسیر آموزش پیدا نشد.", 404, "not_found");
}

async function assignedTrainingFileRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/files\/([^/]+)\/download$/);
  if (!match || request.method.toUpperCase() !== "GET") return null;
  const actor = await getUser(request, env);
  if (!actor || actor.role.toUpperCase() !== "CAREGIVER") return null;
  return getAssignedTrainingFile(request, env, actor, decodeURIComponent(match[1]));
}

async function injectRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  if (!html.includes("server-training-runtime.js")) {
    html = html.replace("</body>", '<script src="./server-training-runtime.js?v=1.0.0"></script></body>');
  }
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const trainingResponse = await trainingRoute(request, env);
      if (trainingResponse) return securityHeaders(trainingResponse);
      const assignedFileResponse = await assignedTrainingFileRoute(request, env);
      if (assignedFileResponse) return securityHeaders(assignedFileResponse);
      const benefitResponse = await benefitRoute(request, env);
      if (benefitResponse) return securityHeaders(benefitResponse);
      return injectRuntime(await application.fetch(request, env));
    } catch (error) {
      console.error("Extended worker request failed", error);
      const detail = error instanceof Error ? error.message : "unknown error";
      return securityHeaders(json({ error: "internal_error", message: "خطای داخلی سرور رخ داد.", detail }, 500));
    }
  },
};
