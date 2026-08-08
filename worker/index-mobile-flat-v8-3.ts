import app from "./index-unified-financial-v4";

const MOBILE_FLAT_DASHBOARD_VERSION = "8.3.0";
const MOBILE_FLAT_DASHBOARD_CACHE_KEY = "8.3.1";
const MOBILE_FLAT_DASHBOARD_ASSET = "mobile-flat-dashboard-v8-3.js";
const RETIRED_PHOTO_DASHBOARD_ASSET = "mobile-reference-dashboard-v8-2.js";

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

async function injectFlatMobileDashboard(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  let html = await response.text();

  // V8.2 is the old photo-tile presentation owner. It must not coexist with
  // the approved V8.3 flat-icon dashboard because both target the same V7.1 DOM.
  html = stripScript(html, RETIRED_PHOTO_DASHBOARD_ASSET);
  html = stripScript(html, MOBILE_FLAT_DASHBOARD_ASSET);

  const preboot = `<script data-salamat-mobile-flat-preboot="${MOBILE_FLAT_DASHBOARD_CACHE_KEY}">if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches){window.__salamatMobileReferenceDashboardV82=true;}</script>`;
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${preboot}`);
  } else {
    html = `${preboot}${html}`;
  }

  const tag = `<script defer src="./${MOBILE_FLAT_DASHBOARD_ASSET}?v=${MOBILE_FLAT_DASHBOARD_CACHE_KEY}" data-salamat-mobile-flat-dashboard="${MOBILE_FLAT_DASHBOARD_VERSION}"></script>`;
  html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-mobile-flat-dashboard", MOBILE_FLAT_DASHBOARD_VERSION);
  headers.set("x-salamat-mobile-flat-dashboard-cache", MOBILE_FLAT_DASHBOARD_CACHE_KEY);
  headers.set("x-salamat-mobile-photo-dashboard-retired", "8.2.0");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const response = await app.fetch(request, env, ctx);
    return injectFlatMobileDashboard(response);
  },
  async scheduled(controller: any, env: any, ctx: any) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  },
};
