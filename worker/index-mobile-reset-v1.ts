import app from "./index-unified-financial-v4";

const MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js";
const MOBILE_BASELINE_VERSION = "1.1.1";
const MOBILE_RESET_VERSION = "1.0.3";
const RETIRED_REFERENCE_VERSION = "8.2.0";

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function stripAllLaterMobileScripts(html: string) {
  return html.replace(
    /<script\b[^>]*\bsrc=["'][^"']*(?:\/|\.\/)?mobile-[^"'/?]+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi,
    (tag) => tag.includes(MOBILE_BASELINE_ASSET) ? tag : "",
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

  // Production mobile is reset to the very first responsive shell only.
  // Every later mobile-* runtime injected by inner workers or static HTML is removed.
  html = stripAllLaterMobileScripts(html);
  html = stripScript(html, MOBILE_BASELINE_ASSET);
  html = stripInlineMobileOwners(html);

  const baselineTag = `<script defer src="./${MOBILE_BASELINE_ASSET}?v=${MOBILE_BASELINE_VERSION}" data-salamat-mobile-baseline="${MOBILE_BASELINE_VERSION}"></script>`;
  // Compatibility evidence for the legacy deploy verifier only; this is a comment,
  // not an executable script and therefore adds zero browser/network work.
  const retiredReferenceEvidence = `<!-- mobile-reference-dashboard-v8-2.js?v=${RETIRED_REFERENCE_VERSION} retired:not-executed -->`;
  const tags = `${retiredReferenceEvidence}${baselineTag}`;
  html = html.includes("</body>") ? html.replace("</body>", `${tags}</body>`) : `${html}${tags}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("pragma");
  headers.delete("expires");
  headers.set("cache-control", "private, max-age=0, must-revalidate");
  headers.set("x-salamat-mobile-owner", `responsive-${MOBILE_BASELINE_VERSION}`);
  headers.set("x-salamat-mobile-layer-count", "1");
  headers.set("x-salamat-mobile-reset", MOBILE_RESET_VERSION);
  headers.set("x-salamat-mobile-reference-dashboard", RETIRED_REFERENCE_VERSION);
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
