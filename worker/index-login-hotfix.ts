import app from "./index-access-control";
import { type Env } from "./lib";

function withLoginCompatibility(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return response.text().then((source) => {
    let html = source;
    if (!html.includes("staff-role-bridge.js")) {
      html = html.replace(
        "</head>",
        '<script src="./staff-role-bridge.js?v=2.0.0"></script></head>',
      );
    } else {
      html = html.replace(
        /staff-role-bridge\.js\?v=[^"']+/g,
        "staff-role-bridge.js?v=2.0.0",
      );
    }
    if (!html.includes("login-identifier-compat.js")) {
      html = html.replace(
        "</head>",
        '<script src="./login-identifier-compat.js?v=3.4.0"></script></head>',
      );
    } else {
      html = html.replace(
        /login-identifier-compat\.js\?v=[^"']+/g,
        "login-identifier-compat.js?v=3.4.0",
      );
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
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
      : withLoginCompatibility(response);
  },
};