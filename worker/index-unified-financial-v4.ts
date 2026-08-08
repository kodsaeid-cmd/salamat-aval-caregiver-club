import app from "./index-referral-rewards";
import { routeCaregiverFinancialProfileV4 } from "./caregiver-financial-profile-v4";
import { type Env } from "./lib";

const FINANCIAL_PROFILE_VERSION = "4.1.0";
const ADMIN_FINANCIAL_ASSET_VERSION = "3.2.1";
const FINANCIAL_UI_HOTFIX_VERSION = "4.2.0";
const FINANCIAL_REFERRAL_CONTINUITY_VERSION = "5.1.0";
const BACKEND_INTEGRATION_VERSION = "1.3.0";
const STAFF_SHELL_BOOTSTRAP_VERSION = "1.2.0";
const STAFF_DASHBOARD_ENTRY_VERSION = "1.3.0";
const STAFF_MODULE_ROUTER_VERSION = "5.1.0";
const PANEL_ROUTE_BOOTSTRAP_VERSION = "1.3.0";
const SINGLE_OWNER_RUNTIME_VERSION = "8.0.0";
const MOBILE_CAREGIVER_SHELL_VERSION = "5.0.1";
const MOBILE_UNIFIED_PANEL_VERSION = "7.1.0";
const MOBILE_CAREGIVER_POLISH_VERSION = "7.2.0";
const MOBILE_PANEL_POLISH_VERSION = "7.3.0";
const MOBILE_FUNCTIONAL_FIX_VERSION = "7.4.2";
const LEGACY_FINANCIAL_RUNTIME = "server-financial-benefits-runtime.js";
const LEGACY_FINANCIAL_RETIREMENT_VERSION = "9.0.0";
const MOBILE_CAREGIVER_SHELL_ASSET = "mobile-caregiver-shell-v5.js";
const MOBILE_SUPERSEDED_NAV_ASSET = "mobile-caregiver-navigation-v5-1.js";
const MOBILE_RETIRED_UNIFIED_PANEL_ASSET = "mobile-unified-panel-v6.js";
const MOBILE_RETIRED_ROLE_ICON_ASSET = "mobile-role-icon-shell-v7.js";
const MOBILE_UNIFIED_PANEL_ASSET = "mobile-role-icon-shell-v7-1.js";
const MOBILE_CAREGIVER_POLISH_ASSET = "mobile-caregiver-profile-icon-polish-v7-2.js";
const MOBILE_PANEL_POLISH_ASSET = "mobile-panel-polish-v7-3.js";
const MOBILE_FUNCTIONAL_FIX_ASSET = "mobile-functional-fixes-v7-4.js";
const RETIRED_EVALUATION_SEARCH_ASSETS = [
  "evaluation-search-submit-owner-v1.js",
  "evaluation-search-canonical-runtime.js",
];

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

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function injectLegacyFinancialKillSwitch(html: string) {
  const marker = `data-salamat-retire-financial-v4="${LEGACY_FINANCIAL_RETIREMENT_VERSION}"`;
  if (html.includes(marker)) return html;
  const tag = `<script ${marker}>window.__salamatUnifiedFinancialV4=true;</script>`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${tag}`);
  }
  return `${tag}${html}`;
}

function injectMobilePanelKillSwitch(html: string) {
  const marker = `data-salamat-mobile-panel-owner="${MOBILE_UNIFIED_PANEL_VERSION}"`;
  if (html.includes(marker)) return html;
  const code = `if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches){window.__salamatMobilePanelSingleOwnerV71=true;window.__salamatMobileRoleIconShellV7=true;window.__salamatMobileUnifiedPanelV6=true;window.__salamatMobilePanelSingleOwnerV7=true;window.__salamatMobilePanelSingleOwnerV6=true;window.__salamatInternalHistoryRuntimeV2=true;window.__salamatInternalHistoryRuntime=true;window.__salamatMobileAppExperience=true;window.__salamatMobileNavControllerV4=true;window.__salamatMobileAppStabilityRuntime=true;window.__salamatMobileIntegrityV3=true;window.__salamatMobileShellRecoveryV2=true;}`;
  const tag = `<script ${marker}>${code}</script>`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${tag}`);
  }
  return `${tag}${html}`;
}

function injectMobileFunctionalPreboot(html: string) {
  const marker = `data-salamat-mobile-critical="${MOBILE_FUNCTIONAL_FIX_VERSION}"`;
  if (html.includes(marker)) return html;

  const style = `<style ${marker}>
#loginView .join-network-action,.mc5-login .join-network-action{width:100%!important;min-height:64px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:11px!important;border:0!important;border-radius:17px!important;padding:14px 18px!important;background:linear-gradient(135deg,#087a45,#0b9658)!important;color:#fff!important;box-shadow:0 13px 28px rgba(8,122,69,.24)!important;font:inherit!important;cursor:pointer!important;touch-action:manipulation!important}
#loginView .join-network-action strong,.mc5-login .join-network-action strong{display:block!important;color:#fff!important;font-size:13px!important;font-weight:900!important;line-height:1.8!important;text-align:center!important}
#loginView .join-network-action small,.mc5-login .join-network-action small,#loginView .join-network-block>small,.mc5-login .join-network-block>small{display:none!important}
#loginView .join-network-block,.mc5-login .join-network-block{margin:14px 0 0!important;padding:0!important}
#loginView .join-network-action [data-icon],.mc5-login .join-network-action [data-icon]{color:#fff!important;flex:0 0 auto!important}
#mc5SoundButton,.mc5-sound{display:none!important}
@media(max-width:760px){
 html.salamat-mobile-preboot-v74 #appView{visibility:hidden!important}
 html.salamat-mobile-preboot-v74 body{background:#f4f8f6!important}
 .sev4-root,.sev4-panel,.sev4-search-form,.sev4-list,.sev4-care{position:relative!important;pointer-events:auto!important}
 .sev4-search-form,.sev4-list{z-index:3!important}
 .sev4-care{z-index:4!important;touch-action:manipulation!important}
 .sev4-search{font-size:16px!important;touch-action:manipulation!important}
 .cgt3-card footer{display:flex!important;visibility:visible!important;opacity:1!important}
 .cgt3-card [data-cgt3-open]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
}
</style>`;

  const code = `if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches){document.documentElement.classList.add("salamat-mobile-preboot-v74");window.__salamatEvaluationSearchSubmitOwnerV1=true;window.__salamatEvaluationSearchCanonicalV1=true;window.__salamatServerEvaluationRuntime=true;window.__salamatServerEvaluationRuntimeV2=true;window.__salamatServerEvaluationRuntimeV3=true;}`;
  const script = `<script data-salamat-mobile-preboot="${MOBILE_FUNCTIONAL_FIX_VERSION}">${code}</script>`;
  const tags = `${style}${script}`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${tags}`);
  }
  return `${tags}${html}`;
}

function injectMobileCaregiverShell(html: string) {
  html = stripScript(html, MOBILE_CAREGIVER_SHELL_ASSET);
  const tag = `<script defer src="./${MOBILE_CAREGIVER_SHELL_ASSET}?v=${MOBILE_CAREGIVER_SHELL_VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

function injectMobileUnifiedPanel(html: string) {
  html = stripScript(html, MOBILE_SUPERSEDED_NAV_ASSET);
  html = stripScript(html, MOBILE_RETIRED_UNIFIED_PANEL_ASSET);
  html = stripScript(html, MOBILE_RETIRED_ROLE_ICON_ASSET);
  html = stripScript(html, MOBILE_UNIFIED_PANEL_ASSET);
  const tag = `<script defer src="./${MOBILE_UNIFIED_PANEL_ASSET}?v=${MOBILE_UNIFIED_PANEL_VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

function injectMobileCaregiverPolish(html: string) {
  html = stripScript(html, MOBILE_CAREGIVER_POLISH_ASSET);
  const tag = `<script defer src="./${MOBILE_CAREGIVER_POLISH_ASSET}?v=${MOBILE_CAREGIVER_POLISH_VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

function injectMobilePanelPolish(html: string) {
  html = stripScript(html, MOBILE_PANEL_POLISH_ASSET);
  const tag = `<script defer src="./${MOBILE_PANEL_POLISH_ASSET}?v=${MOBILE_PANEL_POLISH_VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

function injectMobileFunctionalFixes(html: string) {
  html = stripScript(html, MOBILE_FUNCTIONAL_FIX_ASSET);
  const tag = `<script defer src="./${MOBILE_FUNCTIONAL_FIX_ASSET}?v=${MOBILE_FUNCTIONAL_FIX_VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

async function cacheBustFinancialAssets(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();

  html = stripScript(html, LEGACY_FINANCIAL_RUNTIME);
  html = injectLegacyFinancialKillSwitch(html);

  // One authenticated mobile shell owns launcher, module navigation and history.
  // Older mobile owners are stopped in <head> and stripped from final HTML.
  // V5 is retained only so the approved mobile login splash/video remains intact.
  html = injectMobilePanelKillSwitch(html);
  html = injectMobileFunctionalPreboot(html);
  for (const asset of RETIRED_EVALUATION_SEARCH_ASSETS) html = stripScript(html, asset);

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
  const singleOwnerAsset = `runtime-single-owner-v8.js?v=${SINGLE_OWNER_RUNTIME_VERSION}`;
  if (!html.includes("runtime-single-owner-v8.js")) {
    const tag = `<script defer src="./${singleOwnerAsset}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  } else {
    html = replaceAssetVersion(html, "runtime-single-owner-v8.js", SINGLE_OWNER_RUNTIME_VERSION);
  }

  html = injectMobileCaregiverShell(html);
  html = injectMobileUnifiedPanel(html);
  html = injectMobileCaregiverPolish(html);
  html = injectMobilePanelPolish(html);
  html = injectMobileFunctionalFixes(html);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("x-salamat-mobile-caregiver-navigation");
  headers.set("x-salamat-financial-profile", FINANCIAL_PROFILE_VERSION);
  headers.set("x-salamat-financial-admin-assets", ADMIN_FINANCIAL_ASSET_VERSION);
  headers.set("x-salamat-financial-ui-hotfix", FINANCIAL_UI_HOTFIX_VERSION);
  headers.set("x-salamat-financial-referral-continuity", FINANCIAL_REFERRAL_CONTINUITY_VERSION);
  headers.set("x-salamat-backend-integration", BACKEND_INTEGRATION_VERSION);
  headers.set("x-salamat-staff-shell-bootstrap", STAFF_SHELL_BOOTSTRAP_VERSION);
  headers.set("x-salamat-staff-dashboard-entry", STAFF_DASHBOARD_ENTRY_VERSION);
  headers.set("x-salamat-staff-module-router", STAFF_MODULE_ROUTER_VERSION);
  headers.set("x-salamat-panel-route-bootstrap", PANEL_ROUTE_BOOTSTRAP_VERSION);
  headers.set("x-salamat-single-owner-runtime", SINGLE_OWNER_RUNTIME_VERSION);
  headers.set("x-salamat-mobile-caregiver-shell", MOBILE_CAREGIVER_SHELL_VERSION);
  headers.set("x-salamat-mobile-panel", MOBILE_UNIFIED_PANEL_VERSION);
  headers.set("x-salamat-mobile-history-owner", MOBILE_UNIFIED_PANEL_VERSION);
  headers.set("x-salamat-mobile-role-icon-shell", MOBILE_UNIFIED_PANEL_VERSION);
  headers.set("x-salamat-mobile-caregiver-polish", MOBILE_CAREGIVER_POLISH_VERSION);
  headers.set("x-salamat-mobile-panel-polish", MOBILE_PANEL_POLISH_VERSION);
  headers.set("x-salamat-mobile-functional-fixes", MOBILE_FUNCTIONAL_FIX_VERSION);
  headers.set("x-salamat-mobile-preboot", MOBILE_FUNCTIONAL_FIX_VERSION);
  headers.set("x-salamat-evaluation-mobile-owner", MOBILE_FUNCTIONAL_FIX_VERSION);
  headers.set("x-salamat-training-mobile-owner", MOBILE_FUNCTIONAL_FIX_VERSION);
  headers.set("x-salamat-login-cta", MOBILE_FUNCTIONAL_FIX_VERSION);
  headers.set("x-salamat-legacy-financial-retired", LEGACY_FINANCIAL_RETIREMENT_VERSION);
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