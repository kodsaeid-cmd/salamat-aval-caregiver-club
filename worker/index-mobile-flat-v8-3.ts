import app from "./index-unified-financial-v4";

const MOBILE_FLAT_DASHBOARD_VERSION = "8.3.0";
const MOBILE_FLAT_DASHBOARD_ASSET = "mobile-flat-dashboard-v8-3.js";

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
  html = stripScript(html, MOBILE_FLAT_DASHBOARD_ASSET);
  const tag = `<script defer src="./${MOBILE_FLAT_DASHBOARD_ASSET}?v=${MOBILE_FLAT_DASHBOARD_VERSION}" data-salamat-mobile-flat-dashboard="${MOBILE_FLAT_DASHBOARD_VERSION}"></script>`;
  html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-mobile-flat-dashboard", MOBILE_FLAT_DASHBOARD_VERSION);
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
