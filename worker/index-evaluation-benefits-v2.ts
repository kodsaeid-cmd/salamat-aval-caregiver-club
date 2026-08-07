import app from "./index-login-intro-media";
import { getFinancialBenefitsV2 } from "./evaluation-benefits-v2";
import { syncContractsForBenefits } from "./benefits-sync";
import { type Env, fail, getUser, securityHeaders } from "./lib";

const FINANCIAL_BENEFITS_RUNTIME = "server-financial-profile-v4.js";
const FINANCIAL_BENEFITS_VERSION = "4.0.0";
const LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js";
const CONTRACT_SYNC_TTL_MS = 5 * 60_000;
let lastContractSyncAt = 0;
let contractSyncPromise: Promise<unknown> | null = null;

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

async function boundedContractSync(env: Env) {
  const now = Date.now();
  if (now - lastContractSyncAt < CONTRACT_SYNC_TTL_MS) return;
  if (!contractSyncPromise) {
    contractSyncPromise = syncContractsForBenefits(env)
      .catch((error) => console.warn("Benefits contract synchronization skipped", error))
      .finally(() => {
        lastContractSyncAt = Date.now();
        contractSyncPromise = null;
      });
  }
  await contractSyncPromise;
}

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script[^>]+src=["'][^"']*${escaped}[^"']*["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

async function injectBenefitsRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  html = stripScript(html, LEGACY_FINANCIAL_RUNTIME);
  const matcher = /server-financial-profile-v4\.js(?:\?v=[^"']+)?/g;
  if (html.includes(FINANCIAL_BENEFITS_RUNTIME)) {
    html = html.replace(matcher, `${FINANCIAL_BENEFITS_RUNTIME}?v=${FINANCIAL_BENEFITS_VERSION}`);
  } else {
    const tag = `<script defer src="./${FINANCIAL_BENEFITS_RUNTIME}?v=${FINANCIAL_BENEFITS_VERSION}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-evaluation-benefits", FINANCIAL_BENEFITS_VERSION);
  headers.set("x-salamat-financial-profile", FINANCIAL_BENEFITS_VERSION);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === "GET" && url.pathname === "/api/benefits/summary") {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      await boundedContractSync(env);
      return securityHeaders(await getFinancialBenefitsV2(request, env, actor));
    }
    const response = await app.fetch(request, env, context);
    return url.pathname.startsWith("/api/") ? response : injectBenefitsRuntime(response);
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
