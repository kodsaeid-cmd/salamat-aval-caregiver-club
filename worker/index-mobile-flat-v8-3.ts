import app from "./index-unified-financial-v4";

const MOBILE_FLAT_DASHBOARD_VERSION = "8.3.0";
const MOBILE_FLAT_DASHBOARD_CACHE_KEY = "8.3.4";
const MOBILE_FLAT_DASHBOARD_ASSET = "mobile-flat-dashboard-v8-3.js";
const MOBILE_FLAT_RESCUE_ASSET = "mobile-flat-dashboard-rescue-v1.js";
const MOBILE_FLAT_RESCUE_VERSION = "1.0.0";
const RETIRED_PHOTO_DASHBOARD_ASSET = "mobile-reference-dashboard-v8-2.js";
const RETIRED_PHOTO_DASHBOARD_VERSION = "8.2.0";

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
  html = stripScript(html, RETIRED_PHOTO_DASHBOARD_ASSET);
  html = stripScript(html, MOBILE_FLAT_DASHBOARD_ASSET);
  html = stripScript(html, MOBILE_FLAT_RESCUE_ASSET);

  const emergencyStyle = `<style data-salamat-mobile-flat-guard="${MOBILE_FLAT_DASHBOARD_CACHE_KEY}">@media(max-width:760px){
html body #salamatMobileRoleLauncherV71 .m71-module[data-m82-photo],html body #salamatMobileRoleLauncherV71.m82-reference-home .m71-module{background:linear-gradient(145deg,#fff,#f8fbf9)!important;background-image:none!important;border:1px solid rgba(255,255,255,.98)!important;border-radius:24px!important;min-height:112px!important;padding:15px 6px 11px!important;box-shadow:0 10px 24px rgba(25,64,46,.08)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important}
html body #salamatMobileRoleLauncherV71 .m71-module[data-m82-photo]::before,html body #salamatMobileRoleLauncherV71 .m71-module[data-m82-photo]::after{background-image:none!important}
html body #salamatMobileRoleLauncherV71 .m71-module-icon,html body #salamatMobileRoleLauncherV71 .m73-admin-icon{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important;border:0!important;border-radius:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:#0B7A46!important;display:flex!important;align-items:center!important;justify-content:center!important}
html body #salamatMobileRoleLauncherV71 .m71-module-icon>svg,html body #salamatMobileRoleLauncherV71 .m73-admin-icon>svg{display:block!important;width:39px!important;height:39px!important;opacity:1!important;visibility:visible!important;fill:none!important;stroke:currentColor!important}
html body #salamatMobileRoleLauncherV71 .m72-photo-glyph,html body #salamatMobileRoleLauncherV71 [class*="photo"] .m72-photo-glyph{display:none!important}
html body #salamatMobileRoleLauncherV71 .m71-label{position:static!important;width:100%!important;min-height:auto!important;margin:0!important;padding:0 2px!important;background:transparent!important;color:#1C3128!important;font-size:10.5px!important;line-height:1.5!important;font-weight:950!important;text-align:center!important;box-shadow:none!important}
}</style>`;
  const preboot = `<script data-salamat-mobile-flat-preboot="${MOBILE_FLAT_DASHBOARD_CACHE_KEY}">if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches){window.__salamatMobileReferenceDashboardV82=true;}</script>`;
  const headPayload = `${emergencyStyle}${preboot}`;
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${headPayload}`);
  } else {
    html = `${headPayload}${html}`;
  }

  const compatTag = `<script defer src="./${RETIRED_PHOTO_DASHBOARD_ASSET}?v=${RETIRED_PHOTO_DASHBOARD_VERSION}" data-salamat-mobile-reference-dashboard="${RETIRED_PHOTO_DASHBOARD_VERSION}"></script>`;
  const flatTag = `<script defer src="./${MOBILE_FLAT_DASHBOARD_ASSET}?v=${MOBILE_FLAT_DASHBOARD_CACHE_KEY}" data-salamat-mobile-flat-dashboard="${MOBILE_FLAT_DASHBOARD_VERSION}"></script>`;
  const rescueTag = `<script defer src="./${MOBILE_FLAT_RESCUE_ASSET}?v=${MOBILE_FLAT_RESCUE_VERSION}-${MOBILE_FLAT_DASHBOARD_CACHE_KEY}" data-salamat-mobile-flat-rescue="${MOBILE_FLAT_RESCUE_VERSION}"></script>`;
  const tags = `${compatTag}${flatTag}${rescueTag}`;
  html = html.includes("</body>") ? html.replace("</body>", `${tags}</body>`) : `${html}${tags}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-salamat-mobile-reference-dashboard", RETIRED_PHOTO_DASHBOARD_VERSION);
  headers.set("x-salamat-mobile-flat-dashboard", MOBILE_FLAT_DASHBOARD_VERSION);
  headers.set("x-salamat-mobile-flat-dashboard-cache", MOBILE_FLAT_DASHBOARD_CACHE_KEY);
  headers.set("x-salamat-mobile-flat-rescue", MOBILE_FLAT_RESCUE_VERSION);
  headers.set("x-salamat-mobile-photo-dashboard-retired", RETIRED_PHOTO_DASHBOARD_VERSION);
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
