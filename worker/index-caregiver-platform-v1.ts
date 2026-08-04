import "./caregiver-platform-catalog";
import app from "./index-caregiver-click-stability";
import { routeAdminSystemToolsV1 } from "./admin-system-tools-v1";
import { routeCaregiverPlatform } from "./caregiver-platform-v1";
import { routeCaregiverPlatformOverrides } from "./caregiver-platform-overrides";
import { routeCaregiverPlatformStaffTools } from "./caregiver-platform-staff-tools";
import { routePanelAccessContractV2 } from "./panel-access-contract-v2";
import { routeStaffPayrollV1 } from "./staff-payroll-v1";
import { type Env } from "./lib";

const PLATFORM_VERSION = "2.1.0";
const ADMIN_CORE_VERSION = "3.1.0";
const RUNTIMES = [
  "caregiver-signup-jalali-v1.js",
  "caregiver-platform-runtime-v1.js",
  "caregiver-urgent-gate-v1.js",
  "staff-financial-credits-runtime-v2.js",
  "staff-payroll-runtime-v1.js",
  "staff-system-settings-runtime-v1.js",
  "staff-support-runtime-v1.js",
  // The file name is retained for cache-compatible deployment; its content is Router v4.
  "staff-module-router-v3.js",
];

function runtimeTag(file: string) {
  return `<script src="./${file}?v=${PLATFORM_VERSION}"></script>`;
}

async function injectPlatform(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const tags = RUNTIMES.filter((file) => !html.includes(file)).map(runtimeTag);
  if (tags.length) html = html.replace("</body>", `${tags.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
  headers.set("permissions-policy", "camera=(), microphone=(self), geolocation=()");
  headers.set("x-salamat-caregiver-platform", PLATFORM_VERSION);
  headers.set("x-salamat-admin-core", ADMIN_CORE_VERSION);
  headers.set("x-salamat-admin-router", "4.0.0");
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const accessResponse = await routePanelAccessContractV2(request, env);
    if (accessResponse) return accessResponse;
    const adminToolsResponse = await routeAdminSystemToolsV1(request, env);
    if (adminToolsResponse) return adminToolsResponse;
    const payrollResponse = await routeStaffPayrollV1(request, env);
    if (payrollResponse) return payrollResponse;
    const overrideResponse = await routeCaregiverPlatformOverrides(request, env);
    if (overrideResponse) return overrideResponse;
    const staffToolsResponse = await routeCaregiverPlatformStaffTools(request, env);
    if (staffToolsResponse) return staffToolsResponse;
    const platformResponse = await routeCaregiverPlatform(request, env);
    if (platformResponse) return platformResponse;
    const response = await app.fetch(request, env);
    return new URL(request.url).pathname.startsWith("/api/")
      ? response
      : injectPlatform(response);
  },
};
