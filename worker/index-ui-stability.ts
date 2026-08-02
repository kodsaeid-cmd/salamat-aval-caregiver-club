import app from "./index-account-stability";
import { type Env } from "./lib";

const BOOTSTRAP_TAG = '<script src="./staff-shell-bootstrap-v3.js?v=1.0.0"></script>';
const JALALI_TAG = '<script src="./evaluation-jalali-calendar.js?v=1.0.0"></script>';

function replaceVersion(html: string, fileName: string, version: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`${escaped}\\?v=[^"']+`, "g"), `${fileName}?v=${version}`);
}

async function stabilizeUi(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  html = replaceVersion(html, "staff-shell-bootstrap-v3.js", "1.0.0");
  html = replaceVersion(html, "evaluation-jalali-calendar.js", "1.0.0");

  const tags = [
    html.includes("staff-shell-bootstrap-v3.js") ? "" : BOOTSTRAP_TAG,
    html.includes("evaluation-jalali-calendar.js") ? "" : JALALI_TAG,
  ].filter(Boolean).join("");

  if (tags) html = html.replace("</head>", `${tags}</head>`);

  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await app.fetch(request, env);
    return new URL(request.url).pathname.startsWith("/api/")
      ? response
      : stabilizeUi(response);
  },
};
