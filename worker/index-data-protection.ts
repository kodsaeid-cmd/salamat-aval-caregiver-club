import app from "./index-caregiver-click-stability";
import {
  archiveEvaluationPeriod,
  backfillFinalEvaluationSnapshots,
  ensureEvaluationDataProtection,
  evaluationProtectionHealth,
  runEvaluationProtectionMaintenance,
  softDeleteCaregiver,
} from "./evaluation-data-protection";
import { individualRequireAccess, isProtectedRootAccount } from "./individual-access-v2";
import {
  type Env,
  fail,
  getUser,
  json,
  securityHeaders,
} from "./lib";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

async function authenticated(request: Request, env: Env) {
  const actor = await getUser(request, env);
  return actor || null;
}

function scheduleProtectionMaintenance(env: Env, context: WorkerLifecycleContext) {
  context.waitUntil(
    ensureEvaluationDataProtection(env)
      .then(() => runEvaluationProtectionMaintenance(env, { limit: 5 }))
      .catch((error) => console.error("Evaluation protection maintenance failed", error)),
  );
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    // Existing login, dashboard and module APIs are never delayed by protection
    // schema maintenance. Evaluation writes and safe-delete functions below call
    // ensureEvaluationDataProtection themselves and therefore remain fail-closed.
    if (pathname.startsWith("/api/")) scheduleProtectionMaintenance(env, context);

    const caregiverDelete = pathname.match(/^\/api\/caregivers\/([^/]+)$/);
    if (caregiverDelete && method === "DELETE") {
      const actor = await authenticated(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const denied = await individualRequireAccess(env, actor, "staff.caregivers", "delete");
      if (denied) return securityHeaders(denied);
      return securityHeaders(await softDeleteCaregiver(
        request,
        env,
        actor,
        decodeURIComponent(caregiverDelete[1]),
      ));
    }

    const evaluationArchive = pathname.match(/^\/api\/evaluations\/([^/]+)\/archive$/);
    if (evaluationArchive && method === "POST") {
      const actor = await authenticated(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const denied = await individualRequireAccess(env, actor, "staff.evaluations", "update");
      if (denied) return securityHeaders(denied);
      return securityHeaders(await archiveEvaluationPeriod(
        request,
        env,
        actor,
        decodeURIComponent(evaluationArchive[1]),
      ));
    }

    if (pathname === "/api/admin/evaluation-protection/health" && method === "GET") {
      const actor = await authenticated(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      if (!isProtectedRootAccount(actor)) {
        return securityHeaders(fail("این گزارش فقط در اختیار مدیر اصلی سامانه است.", 403, "root_admin_required"));
      }
      return securityHeaders(json({ status: "ok", data: await evaluationProtectionHealth(env) }));
    }

    if (pathname === "/api/admin/evaluation-protection/backfill" && method === "POST") {
      const actor = await authenticated(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      if (!isProtectedRootAccount(actor)) {
        return securityHeaders(fail("این عملیات فقط در اختیار مدیر اصلی سامانه است.", 403, "root_admin_required"));
      }
      const limitText = url.searchParams.get("limit") || "100";
      const limit = Math.max(1, Math.min(200, Number.parseInt(limitText, 10) || 100));
      const result = await backfillFinalEvaluationSnapshots(env, limit);
      return securityHeaders(json({
        status: "ok",
        data: {
          backfill: result,
          health: await evaluationProtectionHealth(env),
        },
      }));
    }

    return app.fetch(request, env);
  },

  async scheduled(
    _controller: WorkerScheduledController,
    env: Env,
    context: WorkerLifecycleContext,
  ) {
    context.waitUntil(
      runEvaluationProtectionMaintenance(env, { limit: 200, force: true })
        .catch((error) => console.error("Scheduled evaluation protection maintenance failed", error)),
    );
  },
};
