import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import path from "node:path";

const CONFIG = process.env.WRANGLER_CONFIG || "wrangler.backend.jsonc";
const REQUIRED = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const wrangler = path.join("node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

function runWrangler(args, input) {
  const result = spawnSync(wrangler, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "wrangler command failed").trim();
    throw new Error(detail || `wrangler exited with status ${result.status}`);
  }
  return String(result.stdout || "");
}

function parseSecretList(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Could not parse Wrangler secret list output");
  const parsed = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Unexpected Wrangler secret list response");
  return new Set(parsed.map((item) => String(item?.name || "")).filter(Boolean));
}

function listSecretNames() {
  return parseSecretList(runWrangler(["secret", "list", "--format", "json", "--config", CONFIG]));
}

function base64UrlToBuffer(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="), "base64");
}

async function generateVapidSecrets() {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const priv = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
  if (!pub.x || !pub.y || !priv.d) throw new Error("VAPID JWK export failed");
  const publicBytes = Buffer.concat([Buffer.from([4]), base64UrlToBuffer(pub.x), base64UrlToBuffer(pub.y)]);
  return {
    VAPID_PUBLIC_KEY: publicBytes.toString("base64url"),
    VAPID_PRIVATE_KEY: priv.d,
    VAPID_SUBJECT: "mailto:notifications@salamataval.com",
  };
}

if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("Cloudflare production credentials are required before bootstrapping Web Push secrets");
}

const existing = listSecretNames();
if (REQUIRED.every((name) => existing.has(name))) {
  console.log("Caregiver Web Push VAPID secrets already exist; preserving the stable key pair.");
  process.exit(0);
}

console.log("Caregiver Web Push VAPID configuration is incomplete; creating one complete stable key pair.");
const secrets = await generateVapidSecrets();
runWrangler(["secret", "bulk", "--config", CONFIG], `${JSON.stringify(secrets)}\n`);

const verified = listSecretNames();
const missing = REQUIRED.filter((name) => !verified.has(name));
if (missing.length) throw new Error(`Web Push secrets missing after bootstrap: ${missing.join(", ")}`);
console.log("Caregiver Web Push VAPID secret names verified in Cloudflare; secret values were not printed.");
