import { AwsClient } from "aws4fetch";
import app from "./index-data-protection";
import { type Env, json } from "./lib";

const INTRO_PATH = "/media/caregiver-club-intro.mp4";
const BOOTSTRAP_PATH = "/api/system/login-intro-video-bootstrap";
const OBJECT_KEY = "organization/public/login-intro/caregiver-club-intro.mp4";
const EXPECTED_BYTES = 403_168;
const EXPECTED_SHA256 = "8cd9c2b05c2742e354f3b01749b13b1f058c17841229add262e6a7617ac3b48f";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
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

async function serveIntroVideo(request: Request, env: Env) {
  if (!storageConfig(env)) return new Response("media storage unavailable", { status: 503 });
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  const upstream = await s3Fetch(env, OBJECT_KEY, { method: request.method, headers });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(upstream.status === 404 ? "video not found" : "media unavailable", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: mediaHeaders(upstream.headers),
  });
}

async function bootstrapIntroVideo(request: Request, env: Env) {
  if (!storageConfig(env)) return json({ error: "storage_not_configured" }, 503);
  const claimedSha = String(request.headers.get("x-content-sha256") || "").toLowerCase();
  const claimedSize = Number(request.headers.get("content-length") || 0);
  if (claimedSha !== EXPECTED_SHA256 || claimedSize !== EXPECTED_BYTES) {
    return json({ error: "bootstrap_contract_mismatch" }, 400);
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength !== EXPECTED_BYTES || await sha256Hex(buffer) !== EXPECTED_SHA256) {
    return json({ error: "bootstrap_payload_mismatch" }, 400);
  }
  let uploaded = await s3Fetch(env, OBJECT_KEY, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "cache-control": "public, max-age=31536000, immutable",
      "x-amz-meta-sha256": EXPECTED_SHA256,
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
  return json({ status: "ok", path: INTRO_PATH, sizeBytes: EXPECTED_BYTES, sha256: EXPECTED_SHA256 }, 201);
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (url.pathname === INTRO_PATH && (method === "GET" || method === "HEAD")) {
      return serveIntroVideo(request, env);
    }
    if (url.pathname === BOOTSTRAP_PATH && method === "PUT") {
      return bootstrapIntroVideo(request, env);
    }
    return app.fetch(request, env, context);
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
