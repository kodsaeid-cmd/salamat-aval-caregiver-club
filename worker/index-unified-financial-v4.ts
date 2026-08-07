import app from "./index-referral-rewards";
import { routeCaregiverFinancialProfileV4 } from "./caregiver-financial-profile-v4";
import { type Env } from "./lib";

const FINANCIAL_PROFILE_VERSION = "4.1.0";
const ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1";
const FINANCIAL_UI_HOTFIX_VERSION = "4.1.0";
const FINANCIAL_REFERRAL_CONTINUITY_VERSION = "5.1.0";
const BACKEND_INTEGRATION_VERSION = "1.3.0";
const STAFF_SHELL_BOOTSTRAP_VERSION = "1.2.0";
const STAFF_DASHBOARD_ENTRY_VERSION = "1.2.0";
const STAFF_MODULE_ROUTER_VERSION = "5.1.0";
const PANEL_ROUTE_BOOTSTRAP_VERSION = "1.3.0";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

function replaceAssetVersion(html: string, file: string, version: string) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`${escaped}(?:\\?v=[^\"']+)?`, "g"), `${file}?v=${version}`);
}

async function cacheBustFinancialAssets(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  html = replaceAssetVersion(html, "server-financial-profile-v4.js", FINANCIAL_PROFILE_VERSION);
  html = replaceAssetVersion(html, "staff-financial-credits-runtime-v2.js", ADMIN_FINANCIAL_ASSET_VERSION);
  html = replaceAssetVersion(html, "staff-financial-credits-route-owner-v3.js", ADMIN_FINANCIAL_ASSET_VERSION);
  html = replaceAssetVersion(html, "backend-integration.js", BACKEND_INTEGRATION_VERSION);
  html = replaceAssetVersion(html, "staff-shell-bootstrap-v3.js", STAFF_SHELL_BOOTSTRAP_VERSION);
  html = replaceAssetVersion(html, "staff-dashboard-entry-fix-v1.js", STAFF_DASHBOARD_ENTRY_VERSION);
  html = replaceAssetVersion(html, "staff-module-router-v3.js", STAFF_MODULE_ROUTER_VERSION);
  html = replaceAssetVersion(html, "panel-route-bootstrap-v1.js", PANEL_ROUTE_BOOTSTRAP_VERSION);

  const hotfixAsset = `financial-ui-hotfix-v4.js?v=${FINANCIAL_UI_HOTFIX_VERSION}`;
  if (!html.includes("financial-ui-hotfix-v4.js")) {
    const tag = `<script defer src="./${hotfixAsset}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  } else {
    html = replaceAssetVersion(html, "financial-ui-hotfix-v4.js", FINANCIAL_UI_HOTFIX_VERSION);
  }
  const continuityAsset = `financial-referral-continuity-v5.js?v=${FINANCIAL_REFERRAL_CONTINUITY_VERSION}`;
  if (!html.includes("financial-referral-continuity-v5.js")) {
    const tag = `<script defer src="./${continuityAsset}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  } else {
    html = replaceAssetVersion(html, "financial-referral-continuity-v5.js", FINANCIAL_REFERRAL_CONTINUITY_VERSION);
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-financial-profile", FINANCIAL_PROFILE_VERSION);
  headers.set("x-salamat-financial-admin-assets", ADMIN_FINANCIAL_ASSET_VERSION);
  headers.set("x-salamat-financial-ui-hotfix", FINANCIAL_UI_HOTFIX_VERSION);
  headers.set("x-salamat-financial-referral-continuity", FINANCIAL_REFERRAL_CONTINUITY_VERSION);
  headers.set("x-salamat-backend-integration", BACKEND_INTEGRATION_VERSION);
  headers.set("x-salamat-staff-shell-bootstrap", STAFF_SHELL_BOOTSTRAP_VERSION);
  headers.set("x-salamat-staff-dashboard-entry", STAFF_DASHBOARD_ENTRY_VERSION);
  headers.set("x-salamat-staff-module-router", STAFF_MODULE_ROUTER_VERSION);
  headers.set("x-salamat-panel-route-bootstrap", PANEL_ROUTE_BOOTSTRAP_VERSION);
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
