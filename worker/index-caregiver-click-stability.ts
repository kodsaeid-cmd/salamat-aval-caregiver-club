import app from "./index-ui-stability";
import { type Env } from "./lib";

const RUNTIME_VERSION = "1.0.0";
const RUNTIME_FILE = "staff-caregiver-single-click-fix-v1.js";
const RUNTIME_TAG = `<script src="./${RUNTIME_FILE}?v=${RUNTIME_VERSION}"></script>`;

function injectRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return response.text().then((source) => {
    let html = source;
    if (!html.includes(RUNTIME_FILE)) {
      html = html.replace("</head>", `${RUNTIME_TAG}</head>`);
    } else {
      html = html.replace(
        new RegExp(`${RUNTIME_FILE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?v=[^\"']+)?`, "g"),
        `${RUNTIME_FILE}?v=${RUNTIME_VERSION}`,
      );
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
    headers.set("x-salamat-caregiver-single-click", RUNTIME_VERSION);
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
