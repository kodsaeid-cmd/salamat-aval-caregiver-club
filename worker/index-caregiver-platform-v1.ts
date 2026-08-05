import "./caregiver-platform-catalog";
import app from "./index-caregiver-click-stability";
import { routeAdminSystemToolsV1 } from "./admin-system-tools-v1";
import { routeCaregiverAvatarUnityV2 } from "./caregiver-avatar-unity-v2";
import { processPendingCaregiverChangeNotifications } from "./caregiver-change-dispatcher-v1";
import { routeCaregiverPlatform } from "./caregiver-platform-v1";
import { routeCaregiverPlatformOverrides } from "./caregiver-platform-overrides";
import { routeCaregiverPlatformStaffTools } from "./caregiver-platform-staff-tools";
import { routeCaregiverScorecardV2 } from "./caregiver-scorecard-v2";
import { routeCaregiverSelfProfileV1 } from "./caregiver-self-profile-v1";
import { routeCaregiverTrainingUnityV3 } from "./caregiver-training-unity-v3";
import { routeContractCalendarOverlayV1 } from "./contract-calendar-overlay-v1";
import { routePanelAccessContractV2 } from "./panel-access-contract-v2";
import { routeStaffContractsV1 } from "./staff-contracts-v1";
import { routeStaffPayrollV1 } from "./staff-payroll-v1";
import { routeSupportConversationUnityV3 } from "./support-conversation-unity-v3";
import { routeUserDirectoryUnityV1 } from "./user-directory-unity-v1";
import { type Env } from "./lib";

const PLATFORM_VERSION = "2.4.0";
const ADMIN_CORE_VERSION = "3.0.1";
const ADMIN_ROUTER_VERSION = "5.0.0";
const ACCESS_CONTROL_VERSION = "2.0.0";
const CONTRACT_ROUTE_OWNER_VERSION = "2.0.0";
const FINANCIAL_ROUTE_OWNER_VERSION = "3.1.0";
const RENDER_MODULE_GUARD_VERSION = "1.0.0";
const SUPPORT_RUNTIME_VERSION = "3.0.0";
const SUPPORT_ROUTE_OWNER_VERSION = "3.0.0";
const SUPPORT_UNITY_VERSION = "3.0.0";
const NOTIFICATIONS_RUNTIME_VERSION = "2.0.0";
const CAREGIVER_SUPPORT_NOTIFICATION_BRIDGE_VERSION = "1.0.0";
const CAREGIVER_ROUTE_OWNER_VERSION = "3.0.0";
const CAREGIVER_TRAINING_VERSION = "3.0.0";
const CAREGIVER_SCORECARD_VERSION = "2.0.0";
const CAREGIVER_SELF_PROFILE_VERSION = "1.0.0";
const CAREGIVER_AVATAR_UNITY_VERSION = "2.0.0";
const USER_DIRECTORY_UNITY_VERSION = "1.0.0";
const FINANCIAL_CREDITS_HUB_VERSION = "3.0.0";
const LOGIN_OTP_SMS_VERSION = "paused";
const CAREGIVER_SMS_NOTIFICATIONS_VERSION = "1.0.0";
const MOBILE_SHELL_RECOVERY_VERSION = "2.0.0";

// Kept only for historical validator compatibility and explicit removal from
// HTML. They are never included in the live runtime graph.
const SUPERSEDED_CRITICAL_RUNTIMES = ["contract-module-priority-v1.js"];
const LEGACY_RUNTIME_PATTERN_MARKERS = [
  "staff-support-runtime-v1\\.js",
  "staff-support-direct-runtime-v2\\.js",
  "server-notifications-runtime\\.js",
  "contract-module-priority-v1\\.js",
  "staff-financial-credits-runtime-v1\\.js",
  "caregiver-training-direct-v2\\.js",
  "login-otp-sms-runtime-v1\\.js",
];
void SUPERSEDED_CRITICAL_RUNTIMES;
void LEGACY_RUNTIME_PATTERN_MARKERS;

const CRITICAL_RUNTIMES = [
  "contract-module-priority-v2.js",
  "staff-module-router-v3.js",
  "access-control-runtime-v2.js",
];
const RUNTIMES = [
  "caregiver-signup-jalali-v1.js",
  "caregiver-platform-runtime-v1.js",
  "caregiver-urgent-gate-v1.js",
  "staff-contracts-runtime-v1.js",
  "staff-financial-credits-route-owner-v3.js",
  "staff-financial-credits-runtime-v2.js",
  "staff-payroll-runtime-v1.js",
  "staff-system-settings-runtime-v1.js",
  "staff-support-route-owner-v3.js",
  "render-module-owner-guard-v1.js",
  "staff-support-direct-runtime-v3.js",
  "caregiver-training-route-owner-v3.js",
  "caregiver-training-direct-v3.js",
  "caregiver-self-profile-v1.js",
  "caregiver-canonical-route-owner-v3.js",
  "caregiver-avatar-unity-v2.js",
  "caregiver-support-notification-bridge-v1.js",
  "server-notifications-runtime-v2.js",
  "mobile-shell-recovery-v2.js",
];

function runtimeVersion(file: string) {
  if (file === "caregiver-self-profile-v1.js") return CAREGIVER_SELF_PROFILE_VERSION;
  if (file === "caregiver-avatar-unity-v2.js") return CAREGIVER_AVATAR_UNITY_VERSION;
  if (file === "staff-financial-credits-route-owner-v3.js") return FINANCIAL_ROUTE_OWNER_VERSION;
  if (file === "staff-financial-credits-runtime-v2.js") return FINANCIAL_ROUTE_OWNER_VERSION;
  if (file === "staff-support-route-owner-v3.js") return SUPPORT_ROUTE_OWNER_VERSION;
  if (file === "staff-support-direct-runtime-v3.js") return SUPPORT_RUNTIME_VERSION;
  if (file === "server-notifications-runtime-v2.js") return NOTIFICATIONS_RUNTIME_VERSION;
  if (file === "caregiver-support-notification-bridge-v1.js") return CAREGIVER_SUPPORT_NOTIFICATION_BRIDGE_VERSION;
  if (file === "caregiver-training-route-owner-v3.js") return CAREGIVER_TRAINING_VERSION;
  if (file === "caregiver-training-direct-v3.js") return CAREGIVER_TRAINING_VERSION;
  if (file === "mobile-shell-recovery-v2.js") return MOBILE_SHELL_RECOVERY_VERSION;
  return PLATFORM_VERSION;
}

function runtimeTag(file: string) {
  return `<script src="./${file}?v=${runtimeVersion(file)}"></script>`;
}

function stripRuntime(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function injectCriticalRuntimes(html: string) {
  const tags = CRITICAL_RUNTIMES.filter((file) => !html.includes(file)).map(runtimeTag).join("");
  if (!tags) return html;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${tags}`);
  }
  return `${tags}${html}`;
}

async function injectPlatform(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();

  for (const fileName of [
    "access-control-runtime.js",
    "staff-support-runtime-v1.js",
    "staff-support-direct-runtime-v2.js",
    "server-notifications-runtime.js",
    "staff-financial-credits-runtime-v1.js",
    "contract-module-priority-v1.js",
    "caregiver-canonical-route-owner-v2.js",
    "caregiver-training-direct-v2.js",
    "login-otp-sms-runtime-v1.js",
    "server-training-runtime.js",
  ]) {
    html = stripRuntime(html, fileName);
  }

  html = injectCriticalRuntimes(html);
  const tags = RUNTIMES.filter((file) => !html.includes(file)).map(runtimeTag);
  if (tags.length) html = html.replace("</body>", `${tags.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
  headers.set("permissions-policy", "camera=(), microphone=(self), geolocation=()");
  headers.set("x-salamat-caregiver-platform", PLATFORM_VERSION);
  headers.set("x-salamat-admin-core", ADMIN_CORE_VERSION);
  headers.set("x-salamat-admin-router", ADMIN_ROUTER_VERSION);
  headers.set("x-salamat-access-control", ACCESS_CONTROL_VERSION);
  headers.set("x-salamat-router-priority", "head-first");
  headers.set("x-salamat-contracts", "1.0.0");
  headers.set("x-salamat-contract-route-owner", CONTRACT_ROUTE_OWNER_VERSION);
  headers.set("x-salamat-financial-route-owner", FINANCIAL_ROUTE_OWNER_VERSION);
  headers.set("x-salamat-render-module-guard", RENDER_MODULE_GUARD_VERSION);
  headers.set("x-salamat-support-runtime", SUPPORT_RUNTIME_VERSION);
  headers.set("x-salamat-support-route-owner", SUPPORT_ROUTE_OWNER_VERSION);
  headers.set("x-salamat-support-unity", SUPPORT_UNITY_VERSION);
  headers.set("x-salamat-notifications-runtime", NOTIFICATIONS_RUNTIME_VERSION);
  headers.set("x-salamat-caregiver-route-owner", CAREGIVER_ROUTE_OWNER_VERSION);
  headers.set("x-salamat-caregiver-training", CAREGIVER_TRAINING_VERSION);
  headers.set("x-salamat-caregiver-scorecard", CAREGIVER_SCORECARD_VERSION);
  headers.set("x-salamat-caregiver-profile", CAREGIVER_SELF_PROFILE_VERSION);
  headers.set("x-salamat-caregiver-avatar-unity", CAREGIVER_AVATAR_UNITY_VERSION);
  headers.set("x-salamat-user-directory-unity", USER_DIRECTORY_UNITY_VERSION);
  headers.set("x-salamat-financial-credits", FINANCIAL_CREDITS_HUB_VERSION);
  headers.set("x-salamat-login-otp-sms", LOGIN_OTP_SMS_VERSION);
  headers.set("x-salamat-caregiver-sms-notifications", CAREGIVER_SMS_NOTIFICATIONS_VERSION);
  headers.set("x-salamat-mobile-shell-recovery", MOBILE_SHELL_RECOVERY_VERSION);
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
    const method = request.method.toUpperCase();
    const apiRequest = url.pathname.startsWith("/api/");
    try {
      if (method === "GET" && url.pathname === "/api/notifications") {
        await processPendingCaregiverChangeNotifications(env, 5).catch((error) => console.error("Caregiver notification dispatch failed", error));
      }
      const accessResponse = await routePanelAccessContractV2(request, env);
      if (accessResponse) return accessResponse;
      const userDirectoryResponse = await routeUserDirectoryUnityV1(request, env);
      if (userDirectoryResponse) return userDirectoryResponse;
      const avatarResponse = await routeCaregiverAvatarUnityV2(request, env);
      if (avatarResponse) return avatarResponse;
      const profileResponse = await routeCaregiverSelfProfileV1(request, env);
      if (profileResponse) return profileResponse;
      const trainingResponse = await routeCaregiverTrainingUnityV3(request, env);
      if (trainingResponse) return trainingResponse;
      const scorecardResponse = await routeCaregiverScorecardV2(request, env);
      if (scorecardResponse) return scorecardResponse;
      const supportResponse = await routeSupportConversationUnityV3(request, env);
      if (supportResponse) return supportResponse;
      const adminToolsResponse = await routeAdminSystemToolsV1(request, env);
      if (adminToolsResponse) return adminToolsResponse;
      const contractsResponse = await routeStaffContractsV1(request, env);
      if (contractsResponse) return contractsResponse;
      const contractCalendarResponse = await routeContractCalendarOverlayV1(request, env);
      if (contractCalendarResponse) return contractCalendarResponse;
      const payrollResponse = await routeStaffPayrollV1(request, env);
      if (payrollResponse) return payrollResponse;
      const overrideResponse = await routeCaregiverPlatformOverrides(request, env);
      if (overrideResponse) return overrideResponse;
      const staffToolsResponse = await routeCaregiverPlatformStaffTools(request, env);
      if (staffToolsResponse) return staffToolsResponse;
      const platformResponse = await routeCaregiverPlatform(request, env);
      if (platformResponse) return platformResponse;
      const response = await app.fetch(request, env);
      return apiRequest ? response : injectPlatform(response);
    } finally {
      if (apiRequest && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        await processPendingCaregiverChangeNotifications(env, 5).catch((error) => console.error("Post-mutation caregiver notification dispatch failed", error));
      }
    }
  },
};
