import app from "./index-ui-stability";
import { type Env } from "./lib";

const SINGLE_CLICK_VERSION = "1.0.0";
const SINGLE_CLICK_FILE = "staff-caregiver-single-click-fix-v1.js";
const SINGLE_CLICK_TAG = `<script src="./${SINGLE_CLICK_FILE}?v=${SINGLE_CLICK_VERSION}"></script>`;
const ROUTE_OWNER_VERSION = "1.0.0";
const ROUTE_OWNER_FILE = "staff-caregiver-route-owner-v1.js";
const ROUTE_OWNER_TAG = `<script src="./${ROUTE_OWNER_FILE}?v=${ROUTE_OWNER_VERSION}"></script>`;

function versionRuntime(html: string, fileName: string, version: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`${escaped}(?:\\?v=[^\"']+)?`, "g"),
    `${fileName}?v=${version}`,
  );
}

function injectRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return response.text().then((source) => {
    let html = source;
    html = versionRuntime(html, ROUTE_OWNER_FILE, ROUTE_OWNER_VERSION);
    html = versionRuntime(html, SINGLE_CLICK_FILE, SINGLE_CLICK_VERSION);

    const tags: string[] = [];
    if (!html.includes(ROUTE_OWNER_FILE)) tags.push(ROUTE_OWNER_TAG);
    if (!html.includes(SINGLE_CLICK_FILE)) tags.push(SINGLE_CLICK_TAG);
    if (tags.length) html = html.replace("</head>", `${tags.join("")}</head>`);

    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
    headers.set("x-salamat-caregiver-single-click", SINGLE_CLICK_VERSION);
    headers.set("x-salamat-caregiver-route-owner", ROUTE_OWNER_VERSION);
    headers.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await app.fetch(request, env);
    return new URL(request.url).pathname.startsWith("/api/")
      ? response
      : injectRuntime(response);
  },
};
