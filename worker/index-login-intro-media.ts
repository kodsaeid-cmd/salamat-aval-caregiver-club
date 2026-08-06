import { AwsClient } from "aws4fetch";
import app from "./index-data-protection";
import { type Env, json } from "./lib";

const INTRO_PATH = "/media/caregiver-club-intro.mp4";
const BOOTSTRAP_PATH = "/api/system/login-intro-video-bootstrap";
const UPLOAD_PAGE_PATH = "/system/login-intro-video-upload-782bb1";
const OBJECT_KEY = "organization/public/login-intro/caregiver-club-intro.mp4";
const EDGE_CACHE_VERSION = "hd-720p-v2";
const ACCEPTED_FILES = [
  {
    label: "فایل اصلی HD 720p",
    bytes: 13_303_455,
    sha256: "170caf9487035cce0eae3d25ef661efca2caf455b1b01604d6f9a60ef00bc6e8",
  },
] as const;

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

type RewriterElement = {
  before(content: string, options?: { html?: boolean }): void;
};

declare const HTMLRewriter: {
  new(): {
    on(selector: string, handlers: { element(element: RewriterElement): void }): {
      transform(response: Response): Response;
    };
  };
};

function storageConfig(env: Env) {
  const endpointRaw = String(env.PARSPACK_S3_ENDPOINT || "").trim();
  const bucket = String(env.PARSPACK_S3_BUCKET || "").trim();
  const accessKeyId = String(env.PARSPACK_S3_ACCESS_KEY || "").trim();
  const secretAccessKey = String(env.PARSPACK_S3_SECRET_KEY || "").trim();
  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: new URL(/^https?:\/\//i.test(endpointRaw) ? endpointRaw : `https://${endpointRaw}`),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: String(env.PARSPACK_S3_REGION || "us-east-1").trim() || "us-east-1",
  };
}

function objectUrl(env: Env, key: string) {
  const config = storageConfig(env);
  if (!config) return null;
  const endpoint = new URL(config.endpoint.toString());
  const segments = endpoint.pathname.split("/").filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  if (segments.at(-1) !== config.bucket) segments.push(config.bucket);
  endpoint.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  const base = endpoint.toString().replace(/\/+$/, "");
  const encodedKey = key.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${encodedKey}`;
}

function s3Client(env: Env) {
  const config = storageConfig(env);
  if (!config) return null;
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region,
  });
}

async function s3Fetch(env: Env, key: string, init: RequestInit) {
  const client = s3Client(env);
  const url = objectUrl(env, key);
  if (!client || !url) throw new Error("storage_not_configured");
  return client.fetch(url, init);
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mediaHeaders(source?: Headers) {
  const headers = new Headers();
  for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = source?.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "video/mp4");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("content-disposition", "inline; filename=caregiver-club-intro.mp4");
  return headers;
}

function edgeCacheUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  url.pathname = INTRO_PATH;
  url.search = `?edge=${EDGE_CACHE_VERSION}`;
  url.hash = "";
  return url.toString();
}

function fullCacheRequest(requestUrl: string) {
  return new Request(edgeCacheUrl(requestUrl), { method: "GET" });
}

function rangedCacheRequest(request: Request) {
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  return new Request(edgeCacheUrl(request.url), { method: "GET", headers });
}

async function fetchFullVideo(env: Env) {
  const upstream = await s3Fetch(env, OBJECT_KEY, { method: "GET" });
  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? "video not found" : "media unavailable", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "cache-control": "no-store" },
    });
  }
  const headers = mediaHeaders(upstream.headers);
  headers.set("x-salamat-video-cache", "MISS");
  return new Response(upstream.body, { status: 200, headers });
}

async function warmIntroVideoCache(requestUrl: string, env: Env) {
  if (!storageConfig(env)) return;
  const cache = caches.default;
  const key = fullCacheRequest(requestUrl);
  const cached = await cache.match(key);
  if (cached) return;
  const response = await fetchFullVideo(env);
  if (response.ok) await cache.put(key, response.clone());
}

function withCacheStatus(response: Response, status: "HIT" | "MISS") {
  const headers = new Headers(response.headers);
  headers.set("x-salamat-video-cache", status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function serveIntroVideo(request: Request, env: Env, context: WorkerLifecycleContext) {
  if (!storageConfig(env)) return new Response("media storage unavailable", { status: 503 });
  const cache = caches.default;
  const method = request.method.toUpperCase();
  const isHead = method === "HEAD";

  if (isHead) {
    const cached = await cache.match(fullCacheRequest(request.url));
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("x-salamat-video-cache", "HIT");
      return new Response(null, { status: 200, headers });
    }
    context.waitUntil(warmIntroVideoCache(request.url, env).catch(() => undefined));
    const upstream = await s3Fetch(env, OBJECT_KEY, { method: "GET", headers: { range: "bytes=0-0" } });
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(upstream.status === 404 ? "video not found" : "media unavailable", {
        status: upstream.status === 404 ? 404 : 502,
        headers: { "cache-control": "no-store" },
      });
    }
    const headers = mediaHeaders(upstream.headers);
    const contentRange = upstream.headers.get("content-range") || "";
    const total = contentRange.match(/\/(\d+)$/)?.[1];
    if (total) headers.set("content-length", total);
    headers.delete("content-range");
    headers.set("x-salamat-video-cache", "MISS");
    return new Response(null, { status: 200, headers });
  }

  const cached = await cache.match(rangedCacheRequest(request));
  if (cached) return withCacheStatus(cached, "HIT");

  const range = request.headers.get("range");
  if (range) {
    context.waitUntil(warmIntroVideoCache(request.url, env).catch(() => undefined));
    const upstream = await s3Fetch(env, OBJECT_KEY, { method: "GET", headers: { range } });
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(upstream.status === 404 ? "video not found" : "media unavailable", {
        status: upstream.status === 404 ? 404 : 502,
        headers: { "cache-control": "no-store" },
      });
    }
    const headers = mediaHeaders(upstream.headers);
    headers.set("x-salamat-video-cache", "MISS");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  const response = await fetchFullVideo(env);
  if (response.ok) context.waitUntil(cache.put(fullCacheRequest(request.url), response.clone()));
  return response;
}

async function bootstrapIntroVideo(request: Request, env: Env) {
  if (!storageConfig(env)) return json({ error: "storage_not_configured" }, 503);
  const claimedSha = String(request.headers.get("x-content-sha256") || "").toLowerCase();
  const claimedSize = Number(request.headers.get("content-length") || 0);
  const accepted = ACCEPTED_FILES.find((item) => item.sha256 === claimedSha && item.bytes === claimedSize);
  if (!accepted) return json({ error: "bootstrap_contract_mismatch" }, 400);
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength !== accepted.bytes || await sha256Hex(buffer) !== accepted.sha256) {
    return json({ error: "bootstrap_payload_mismatch" }, 400);
  }
  let uploaded = await s3Fetch(env, OBJECT_KEY, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "cache-control": "public, max-age=31536000, immutable",
      "x-amz-meta-sha256": accepted.sha256,
    },
    body: buffer,
  });
  if (!uploaded.ok && [400, 403].includes(uploaded.status)) {
    uploaded = await s3Fetch(env, OBJECT_KEY, {
      method: "PUT",
      headers: { "content-type": "video/mp4" },
      body: buffer,
    });
  }
  if (!uploaded.ok) {
    return json({ error: "bootstrap_upload_failed", providerStatus: uploaded.status }, 502);
  }
  await caches.default.delete(fullCacheRequest(request.url));
  return json({ status: "ok", path: INTRO_PATH, file: accepted.label, sizeBytes: accepted.bytes, sha256: accepted.sha256 }, 201);
}

function uploadPage() {
  const accepted = JSON.stringify(ACCEPTED_FILES);
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بارگذاری ویدئوی اصلی HD</title><style>body{margin:0;background:#eef7f1;color:#173e2d;font-family:Tahoma,Arial,sans-serif;display:grid;min-height:100vh;place-items:center}.card{width:min(620px,calc(100% - 32px));background:#fff;border:1px solid #d9ebe0;border-radius:24px;padding:28px;box-shadow:0 20px 60px #17452b1c}h1{font-size:24px;margin:0 0 12px}p{line-height:2;color:#60776b}.box{border:2px dashed #99c8ad;border-radius:18px;padding:22px;text-align:center;margin:20px 0}input{max-width:100%}button{width:100%;border:0;border-radius:14px;padding:14px;background:#08743f;color:#fff;font:700 15px Tahoma;cursor:pointer}button:disabled{opacity:.5}.status{margin-top:16px;padding:12px;border-radius:12px;background:#f3f8f5;line-height:1.8;word-break:break-word}.ok{background:#e5f6eb;color:#086a39}.bad{background:#fff0f0;color:#a21b1b}small{display:block;color:#789086;margin-top:10px}</style></head><body><main class="card"><h1>جایگزینی با ویدئوی اصلی HD 720p</h1><p>فایل اصلی ضمیمه‌شده را انتخاب کنید. سامانه حجم و SHA-256 آن را کنترل می‌کند و نسخه کم‌کیفیت را نمی‌پذیرد.</p><div class="box"><input id="file" type="file" accept="video/mp4"><small>فقط فایل اصلی ۱۳٬۳۰۳٬۴۵۵ بایتی با کیفیت ۱۲۸۰×۷۲۰ پذیرفته می‌شود.</small></div><button id="send" disabled>بارگذاری نسخه اصلی در S3</button><div id="status" class="status">هنوز فایلی انتخاب نشده است.</div></main><script>const accepted=${accepted};const fileInput=document.getElementById('file');const send=document.getElementById('send');const status=document.getElementById('status');let selected=null;let sha='';const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');fileInput.onchange=async()=>{selected=fileInput.files?.[0]||null;send.disabled=true;status.className='status';if(!selected){status.textContent='هنوز فایلی انتخاب نشده است.';return}status.textContent='در حال بررسی فایل اصلی…';const buffer=await selected.arrayBuffer();sha=hex(await crypto.subtle.digest('SHA-256',buffer));const match=accepted.find(x=>x.bytes===selected.size&&x.sha256===sha);if(!match){status.className='status bad';status.textContent='این فایل نسخه اصلی تأییدشده نیست. حجم: '+selected.size+' بایت، SHA-256: '+sha;return}status.className='status ok';status.textContent=match.label+' تأیید شد و آماده بارگذاری در S3 است.';send.disabled=false};send.onclick=async()=>{if(!selected)return;send.disabled=true;status.className='status';status.textContent='در حال بارگذاری نسخه اصلی؛ صفحه را نبندید…';try{const response=await fetch('${BOOTSTRAP_PATH}',{method:'PUT',headers:{'content-type':'video/mp4','x-content-sha256':sha},body:selected});const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data));const probe=await fetch('${INTRO_PATH}?v=2.1.0-edge-cache&verify='+Date.now(),{headers:{range:'bytes=0-31'}});if(!(probe.ok||probe.status===206))throw new Error('ویدئو ذخیره شد اما آزمون پخش ناموفق بود: '+probe.status);status.className='status ok';status.innerHTML='نسخه اصلی HD با موفقیت در S3 ذخیره و فعال شد.<br><a href="/?video=hq-original" style="color:#08743f;font-weight:bold">بازگشت به صفحه اصلی و بررسی کیفیت</a>'}catch(error){status.className='status bad';status.textContent='بارگذاری ناموفق بود: '+error.message;send.disabled=false}};</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" } });
}

class MobileVideoScriptInjector {
  element(element: RewriterElement) {
    element.before('<script src="./mobile-login-video-fix.js?v=2.1.0-edge-cache"></script>', { html: true });
  }
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (url.pathname === INTRO_PATH && (method === "GET" || method === "HEAD")) {
      return serveIntroVideo(request, env, context);
    }
    if (url.pathname === UPLOAD_PAGE_PATH && method === "GET") return uploadPage();
    if (url.pathname === BOOTSTRAP_PATH && method === "PUT") {
      return bootstrapIntroVideo(request, env);
    }
    const response = await app.fetch(request, env, context);
    const contentType = response.headers.get("content-type") || "";
    if (method === "GET" && contentType.includes("text/html")) {
      context.waitUntil(warmIntroVideoCache(request.url, env).catch(() => undefined));
      return new HTMLRewriter().on("body", new MobileVideoScriptInjector()).transform(response);
    }
    return response;
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
