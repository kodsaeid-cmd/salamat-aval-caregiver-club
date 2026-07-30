const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), publickey-credentials-get=(), usb=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized() {
  return withSecurityHeaders(
    new Response("Authentication required", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="Salamat Aval Secure Preview", charset="UTF-8"',
      },
    }),
  );
}

function unavailable() {
  return withSecurityHeaders(
    new Response("Secure preview is not configured", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  );
}

function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

function validBasicAuth(request, username, password) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const suppliedUser = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    return timingSafeEqual(suppliedUser, username) && timingSafeEqual(suppliedPassword, password);
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const method = request.method.toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      return withSecurityHeaders(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD, OPTIONS" },
        }),
      );
    }

    const accessEnabled = String(env.PREVIEW_AUTH_ENABLED || "").toLowerCase() === "true";
    if (accessEnabled) {
      const username = String(env.PREVIEW_AUTH_USERNAME || "");
      const password = String(env.PREVIEW_AUTH_PASSWORD || "");
      if (!username || !password) return unavailable();
      if (!validBasicAuth(request, username, password)) return unauthorized();
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  },
};
