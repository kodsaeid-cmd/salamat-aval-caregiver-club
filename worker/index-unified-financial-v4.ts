import app from "./index-referral-rewards";
import { routeCaregiverFinancialProfileV4 } from "./caregiver-financial-profile-v4";
import { type Env } from "./lib";

const FINANCIAL_PROFILE_VERSION = "4.0.0";
const ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1";
const FINANCIAL_UI_HOTFIX_VERSION = "4.0.1";
const FINANCIAL_REFERRAL_CONTINUITY_VERSION = "5.0.1";
const BACKEND_INTEGRATION_VERSION = "1.3.0";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

async function cacheBustFinancialAssets(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  html = html.replace(
    /staff-financial-credits-runtime-v2\.js(?:\?v=[^"']+)?/g,
    `staff-financial-credits-runtime-v2.js?v=${ADMIN_FINANCIAL_ASSET_VERSION}`,
  );
  html = html.replace(
    /staff-financial-credits-route-owner-v3\.js(?:\?v=[^"']+)?/g,
    `staff-financial-credits-route-owner-v3.js?v=${ADMIN_FINANCIAL_ASSET_VERSION}`,
  );
  html = html.replace(
    /backend-integration\.js(?:\?v=[^"']+)?/g,
    `backend-integration.js?v=${BACKEND_INTEGRATION_VERSION}`,
  );
  const hotfixAsset = `financial-ui-hotfix-v4.js?v=${FINANCIAL_UI_HOTFIX_VERSION}`;
  if (!html.includes("financial-ui-hotfix-v4.js")) {
    const tag = `<script defer src="./${hotfixAsset}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  } else {
    html = html.replace(/financial-ui-hotfix-v4\.js(?:\?v=[^"']+)?/g, hotfixAsset);
  }
  const continuityAsset = `financial-referral-continuity-v5.js?v=${FINANCIAL_REFERRAL_CONTINUITY_VERSION}`;
  if (!html.includes("financial-referral-continuity-v5.js")) {
    const tag = `<script defer src="./${continuityAsset}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  } else {
    html = html.replace(/financial-referral-continuity-v5\.js(?:\?v=[^"']+)?/g, continuityAsset);
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-financial-profile", FINANCIAL_PROFILE_VERSION);
  headers.set("x-salamat-financial-admin-assets", ADMIN_FINANCIAL_ASSET_VERSION);
  headers.set("x-salamat-financial-ui-hotfix", FINANCIAL_UI_HOTFIX_VERSION);
  headers.set("x-salamat-financial-referral-continuity", FINANCIAL_REFERRAL_CONTINUITY_VERSION);
  headers.set("x-salamat-backend-integration", BACKEND_INTEGRATION_VERSION);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const financialProfile = await routeCaregiverFinancialProfileV4(request, env);
    if (financialProfile) return financialProfile;
    const response = await app.fetch(request, env, context);
    return new URL(request.url).pathname.startsWith("/api/") ? response : cacheBustFinancialAssets(response);
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
