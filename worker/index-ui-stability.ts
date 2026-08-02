import app from "./index-account-stability";
import { type Env } from "./lib";

const BUILD_VERSION = "2.0.0";
const BOOTSTRAP_VERSION = "1.1.0";
const JALALI_VERSION = "1.0.0";
const PERFORMANCE_TAG = `<script src="./performance-bootstrap.js?v=${BUILD_VERSION}"></script>`;
const BOOTSTRAP_TAG = `<script src="./staff-shell-bootstrap-v3.js?v=${BOOTSTRAP_VERSION}"></script>`;
const JALALI_TAG = `<script src="./evaluation-jalali-calendar.js?v=${JALALI_VERSION}"></script>`;

const HERO_RUNTIME_FILES = [
  "hero-hq-avif-part-0.js",
  "hero-hq-avif-part-1.js",
  "hero-hq-avif-part-2a.js",
  "hero-hq-avif-part-2b.js",
  "hero-hq-avif-part-3a.js",
  "hero-hq-avif-part-3b.js",
  "hero-inline.js",
];

const NON_CRITICAL_STYLES = [
  "caregiver-panel.css",
  "caregiver-panel-v2.css",
  "evaluation-system.css",
  "access-profile.css",
  "caregiver-registration.css",
  "admin-functional.css",
  "feature-upgrades.css",
];

const CACHEABLE_EXTENSIONS = /\.(?:js|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?)$/i;

type ShellSnapshot = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
};

let cachedShell: ShellSnapshot | null = null;

function replaceVersion(html: string, fileName: string, version: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withVersion = new RegExp(`${escaped}(?:\\?v=[^"']+)?`, "g");
  return html.replace(withVersion, `${fileName}?v=${version}`);
}

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script[^>]+src=["'][^"']*${escaped}[^"']*["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function makeStyleNonBlocking(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<link[^>]+href=["']([^"']*${escaped}[^"']*)["'][^>]*>`, "i");
  return html.replace(pattern, (tag, href: string) => {
    if (tag.includes("data-salamat-async-style")) return tag;
    return `<link rel="preload" as="style" href="${href}" data-salamat-async-style="true" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
  });
}

function addDeferToScripts(html: string) {
  return html.replace(/<script\b([^>]*\bsrc=["'][^"']+["'][^>]*)>\s*<\/script>/gi, (tag, attributes: string) => {
    if (/\b(?:defer|async)\b/i.test(attributes)) return tag;
    const src = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1] || "";
    if (src.includes("performance-bootstrap.js") || src.includes("staff-shell-bootstrap-v3.js")) {
      return tag;
    }
    return `<script defer${attributes}></script>`;
  });
}

function addResourceHints(html: string) {
  if (html.includes("data-salamat-performance-hints")) return html;
  const hints = [
    '<meta name="salamat-build" content="performance-2.0.0">',
    '<link rel="preconnect" href="https://fonts.googleapis.com" data-salamat-performance-hints>',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin data-salamat-performance-hints>',
    `<link rel="preload" as="script" href="./app.js?v=${BUILD_VERSION}" data-salamat-performance-hints>`,
  ].join("");
  return html.replace("</head>", `${hints}</head>`);
}

function optimizeHtml(source: string) {
  let html = source;

  for (const fileName of HERO_RUNTIME_FILES) html = stripScript(html, fileName);

  html = replaceVersion(html, "app.js", BUILD_VERSION);
  html = replaceVersion(html, "styles.css", BUILD_VERSION);
  html = replaceVersion(html, "final-theme.css", BUILD_VERSION);
  html = replaceVersion(html, "performance-bootstrap.js", BUILD_VERSION);
  html = replaceVersion(html, "staff-shell-bootstrap-v3.js", BOOTSTRAP_VERSION);
  html = replaceVersion(html, "evaluation-jalali-calendar.js", JALALI_VERSION);

  if (!html.includes("performance-bootstrap.js")) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${PERFORMANCE_TAG}`);
  }
  if (!html.includes("staff-shell-bootstrap-v3.js")) {
    html = html.replace("</head>", `${BOOTSTRAP_TAG}</head>`);
  }
  if (!html.includes("evaluation-jalali-calendar.js")) {
    html = html.replace("</head>", `${JALALI_TAG}</head>`);
  }

  for (const fileName of NON_CRITICAL_STYLES) html = makeStyleNonBlocking(html, fileName);

  html = addResourceHints(html);
  html = addDeferToScripts(html);
  return html;
}

function htmlHeaders(response: Response, cacheState: "MISS" | "HIT") {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
  headers.set("x-salamat-shell-cache", cacheState);
  headers.set("server-timing", `salamat-shell;desc=\"${cacheState.toLowerCase()}\"`);
  headers.delete("content-length");
  return headers;
}

async function stabilizeUi(response: Response, cacheState: "MISS" | "HIT" = "MISS") {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = optimizeHtml(await response.text());
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: htmlHeaders(response, cacheState),
  });
}

function isShellRequest(request: Request, url: URL) {
  if (request.method !== "GET") return false;
  if (!["/", "/index.html"].includes(url.pathname)) return false;
  const accept = request.headers.get("accept") || "";
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

function responseFromSnapshot(snapshot: ShellSnapshot) {
  const headers = new Headers(snapshot.headers);
  headers.set("x-salamat-shell-cache", "HIT");
  headers.set("server-timing", 'salamat-shell;desc="hit"');
  return new Response(snapshot.body, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers,
  });
}

async function snapshotShell(response: Response) {
  const body = await response.text();
  const snapshot: ShellSnapshot = {
    body,
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers.entries()],
  };
  if (response.ok) cachedShell = snapshot;
  return responseFromSnapshot({ ...snapshot, headers: [...htmlHeaders(response, "MISS").entries()] });
}

function applyAssetCaching(response: Response, request: Request, url: URL) {
  if (!["GET", "HEAD"].includes(request.method) || !response.ok || !CACHEABLE_EXTENSIONS.test(url.pathname)) {
    return response;
  }
  const headers = new Headers(response.headers);
  const versioned = url.searchParams.has("v") || url.searchParams.has("ver");
  headers.set(
    "cache-control",
    versioned
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600, stale-while-revalidate=86400",
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("vary", "Accept-Encoding");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/");

    if (!isApi && isShellRequest(request, url) && cachedShell) {
      return responseFromSnapshot(cachedShell);
    }

    const response = await app.fetch(request, env);
    if (isApi) return response;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const stabilized = await stabilizeUi(response);
      return isShellRequest(request, url) ? snapshotShell(stabilized) : stabilized;
    }
    return applyAssetCaching(response, request, url);
  },
};
