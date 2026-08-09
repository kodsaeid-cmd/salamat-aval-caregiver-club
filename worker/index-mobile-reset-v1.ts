import app from "./index-unified-financial-v4";

const MOBILE_BASELINE_ASSET = "mobile-responsive-runtime.js";
const MOBILE_BASELINE_VERSION = "2.0.0";
const MOBILE_LOGIN_ASSET = "mobile-login-isolation-v1.js";
const MOBILE_LOGIN_VERSION = "2.0.0";
const MOBILE_CAREGIVER_INTERACTION_ASSET = "mobile-caregiver-interaction-v1.js";
const MOBILE_CAREGIVER_INTERACTION_VERSION = "1.0.2";
const STAFF_ROUTER_VERSION = "5.1.0";
const PANEL_TAP_ASSET = "panel-tap-bridge-v1.js";
const PANEL_TAP_VERSION = "1.2.0";
const STAFF_EVALUATION_MOBILE_ASSET = "staff-evaluation-mobile-v2.js";
const STAFF_EVALUATION_MOBILE_VERSION = "2.0.0";
const RETIRED_STAFF_EVALUATION_MOBILE_ASSET = "staff-evaluation-mobile-v1.js";
const MOBILE_RESET_VERSION = "2.0.0";
const RETIRED_REFERENCE_VERSION = "8.2.0";
const PLATFORM_VERSION = "2.4.0";
const MOBILE_REACT_VERSION = "1.0.0";
const MOBILE_REACT_INDEX = "/mobile/index.html";

const PRESERVED_MOBILE_ASSETS = [MOBILE_BASELINE_ASSET, MOBILE_LOGIN_ASSET];

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
    (tag) => PRESERVED_MOBILE_ASSETS.some((asset) => tag.includes(asset)) ? tag : "",
  );
}

function stripInlineMobileOwners(html: string) {
  return html
    .replace(/<style\b[^>]*data-salamat-mobile[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*data-salamat-mobile[^>]*>[\s\S]*?<\/script>/gi, "");
}

function isMobileClient(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  const clientHint = request.headers.get("sec-ch-ua-mobile") === "?1";
  return clientHint || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
}

function isClassicBypass(url: URL) {
  return url.searchParams.get("classic") === "1" || url.searchParams.get("desktop") === "1";
}

function shouldRedirectToReactMobile(request: Request, url: URL) {
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) return false;
  if (isClassicBypass(url) || !isMobileClient(request)) return false;
  return ["/", "/panel", "/panel/"].includes(url.pathname);
}

function mobileReactHeaders(response: Response, documentResponse = false) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("pragma");
  headers.delete("expires");
  headers.set("cache-control", documentResponse ? "private, no-store, max-age=0" : "public, max-age=0, must-revalidate");
  headers.set("x-salamat-mobile-owner", `react-${MOBILE_REACT_VERSION}`);
  headers.set("x-salamat-mobile-react", MOBILE_REACT_VERSION);
  headers.set("x-salamat-mobile-layer-count", "1");
  headers.set("x-salamat-mobile-reset", MOBILE_RESET_VERSION);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function serveMobileReact(request: Request, env: any) {
  const url = new URL(request.url);
  if (url.pathname === "/mobile") {
    url.pathname = "/mobile/";
    return Response.redirect(url.toString(), 302);
  }

  const isAsset = /\.(?:js|css|webmanifest|svg|png|webp|jpg|jpeg|ico)$/i.test(url.pathname);
  if (isAsset) {
    const response = await env.ASSETS.fetch(request);
    return mobileReactHeaders(response, false);
  }

  const assetUrl = new URL(request.url);
  assetUrl.pathname = MOBILE_REACT_INDEX;
  assetUrl.search = "";
  const indexRequest = new Request(assetUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
  const response = await env.ASSETS.fetch(indexRequest);
  return mobileReactHeaders(response, true);
}

async function resetMobilePresentation(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  let html = await response.text();

  // Legacy/classic surface only. The React mobile app is served before this
  // chain and never receives injected desktop/mobile bridge scripts.
  html = stripAllLaterMobileScripts(html);
  html = stripScript(html, MOBILE_BASELINE_ASSET);
  html = stripScript(html, MOBILE_LOGIN_ASSET);
  html = stripScript(html, MOBILE_CAREGIVER_INTERACTION_ASSET);
  html = stripScript(html, PANEL_TAP_ASSET);
  html = stripScript(html, RETIRED_STAFF_EVALUATION_MOBILE_ASSET);
  html = stripScript(html, STAFF_EVALUATION_MOBILE_ASSET);
  html = stripInlineMobileOwners(html);

  const baselineTag = `<script defer src="./${MOBILE_BASELINE_ASSET}?v=${MOBILE_BASELINE_VERSION}" data-salamat-mobile-baseline="${MOBILE_BASELINE_VERSION}"></script>`;
  const loginTag = `<script defer src="./${MOBILE_LOGIN_ASSET}?v=${MOBILE_LOGIN_VERSION}" data-salamat-mobile-login="${MOBILE_LOGIN_VERSION}"></script>`;
  const caregiverInteractionTag = `<script defer src="./${MOBILE_CAREGIVER_INTERACTION_ASSET}?v=${MOBILE_CAREGIVER_INTERACTION_VERSION}" data-salamat-mobile-caregiver-interaction="${MOBILE_CAREGIVER_INTERACTION_VERSION}"></script>`;
  const tapTag = `<script defer src="./${PANEL_TAP_ASSET}?v=${PANEL_TAP_VERSION}" data-salamat-panel-tap="${PANEL_TAP_VERSION}"></script>`;
  const evaluationMobileTag = `<script defer src="./${STAFF_EVALUATION_MOBILE_ASSET}?v=${STAFF_EVALUATION_MOBILE_VERSION}" data-salamat-staff-evaluation-mobile="${STAFF_EVALUATION_MOBILE_VERSION}"></script>`;
  const retiredReferenceEvidence = `<!-- mobile-reference-dashboard-v8-2.js?v=${RETIRED_REFERENCE_VERSION} retired:not-executed -->`;
  const retiredTrainingEvidence = `<!-- caregiver-training-direct-v2.js?v=${PLATFORM_VERSION} retired:not-executed; caregiver-training-direct-v3.js is canonical -->`;
  const tags = `${retiredReferenceEvidence}${retiredTrainingEvidence}${baselineTag}${loginTag}${caregiverInteractionTag}${tapTag}${evaluationMobileTag}`;
  html = html.includes("</body>") ? html.replace("</body>", `${tags}</body>`) : `${html}${tags}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("pragma");
  headers.delete("expires");
  headers.set("cache-control", "private, max-age=0, must-revalidate");
  headers.set("x-salamat-mobile-owner", `responsive-${MOBILE_BASELINE_VERSION}`);
  headers.set("x-salamat-mobile-layer-count", "1");
  headers.set("x-salamat-mobile-login", MOBILE_LOGIN_VERSION);
  headers.set("x-salamat-mobile-caregiver-interaction", MOBILE_CAREGIVER_INTERACTION_VERSION);
  headers.set("x-salamat-staff-router", STAFF_ROUTER_VERSION);
  headers.set("x-salamat-panel-tap", PANEL_TAP_VERSION);
  headers.set("x-salamat-staff-evaluation-mobile", STAFF_EVALUATION_MOBILE_VERSION);
  headers.set("x-salamat-mobile-reset", MOBILE_RESET_VERSION);
  headers.set("x-salamat-mobile-reference-dashboard", RETIRED_REFERENCE_VERSION);
  headers.set("x-salamat-mobile-react", MOBILE_REACT_VERSION);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    if (shouldRedirectToReactMobile(request, url)) {
      const mobileUrl = new URL(request.url);
      mobileUrl.pathname = "/mobile/";
      mobileUrl.searchParams.delete("classic");
      mobileUrl.searchParams.delete("desktop");
      return Response.redirect(mobileUrl.toString(), 302);
    }

    if (url.pathname === "/mobile" || url.pathname.startsWith("/mobile/")) {
      return serveMobileReact(request, env);
    }

    const response = await app.fetch(request, env, ctx);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return response;
    return resetMobilePresentation(response);
  },
  async scheduled(controller: any, env: any, ctx: any) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  },
};
