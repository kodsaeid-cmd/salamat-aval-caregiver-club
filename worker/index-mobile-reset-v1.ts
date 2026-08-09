import app from "./index-unified-financial-v4";

const MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js";
const MOBILE_BASELINE_VERSION = "1.1.0";

const RETIRED_MOBILE_ASSETS = [
  "mobile-app-experience.js",
  "mobile-navigation-controller-v4.js",
  "mobile-caregiver-shell-v5.js",
  "mobile-caregiver-navigation-v5-1.js",
  "mobile-unified-panel-v6.js",
  "mobile-role-icon-shell-v7.js",
  "mobile-role-icon-shell-v7-1.js",
  "mobile-caregiver-profile-icon-polish-v7-2.js",
  "mobile-panel-polish-v7-3.js",
  "mobile-functional-fixes-v7-4.js",
  "mobile-reference-dashboard-v8-2.js",
  "mobile-flat-dashboard-v8-3.js",
  "mobile-flat-dashboard-rescue-v1.js",
  "mobile-caregiver-recovery-v1.js",
  "mobile-caregiver-owner-v1.js",
];

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function stripInlineMobileOwners(html: string) {
  return html
    .replace(/<style\b[^>]*data-salamat-mobile[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*data-salamat-mobile[^>]*>[\s\S]*?<\/script>/gi, "");
}

async function resetMobilePresentation(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  let html = await response.text();

  // Remove every later mobile presentation owner. The only mobile runtime left
  // in production is the original responsive baseline.
  for (const asset of RETIRED_MOBILE_ASSETS) html = stripScript(html, asset);
  html = stripScript(html, MOBILE_BASELINE_ASSET);
  html = stripInlineMobileOwners(html);

  const tag = `<script defer src="./${MOBILE_BASELINE_ASSET}?v=${MOBILE_BASELINE_VERSION}" data-salamat-mobile-baseline="${MOBILE_BASELINE_VERSION}"></script>`;
  html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("pragma");
  headers.delete("expires");
  headers.set("cache-control", "private, max-age=0, must-revalidate");
  headers.set("x-salamat-mobile-owner", `responsive-${MOBILE_BASELINE_VERSION}`);
  headers.set("x-salamat-mobile-layer-count", "1");
  headers.set("x-salamat-mobile-reset", "1.0.0");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const response = await app.fetch(request, env, ctx);
    if (new URL(request.url).pathname.startsWith("/api/")) return response;
    return resetMobilePresentation(response);
  },
  async scheduled(controller: any, env: any, ctx: any) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  },
};
