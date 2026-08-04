import "./caregiver-platform-catalog";
import app from "./index-caregiver-click-stability";
import { routeCaregiverPlatform } from "./caregiver-platform-v1";
import { routeCaregiverPlatformOverrides } from "./caregiver-platform-overrides";
import { type Env } from "./lib";

const PLATFORM_VERSION = "1.0.0";
const RUNTIMES = [
  "caregiver-signup-jalali-v1.js",
  "caregiver-platform-runtime-v1.js",
  "staff-financial-credits-runtime-v1.js",
  "staff-support-runtime-v1.js",
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
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const overrideResponse = await routeCaregiverPlatformOverrides(request, env);
    if (overrideResponse) return overrideResponse;
    const platformResponse = await routeCaregiverPlatform(request, env);
    if (platformResponse) return platformResponse;
    const response = await app.fetch(request, env);
    return new URL(request.url).pathname.startsWith("/api/")
      ? response
      : injectPlatform(response);
  },
};
