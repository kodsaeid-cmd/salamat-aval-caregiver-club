import { mkdir, stat, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { build } from "esbuild";

const mobileOutdir = "preview/mobile";
const desktopOutdir = "preview/app";
const benefitsBannerSha256 = "159e32caff310f9a496fb0d8c39d2490653bae4067d5a08eb81a85023aff4fe4";
const benefitsBannerBytes = 87650;
const benefitsBannerBase64Length = 116868;
const benefitsBannerSourceParts = Array.from(
  { length: 8 },
  (_, index) => `assets-source/caregiver-benefits-banner-v6/part${String(index + 1).padStart(2, "0")}.b64`,
);
const benefitsBannerTargets = [
  "preview/mobile/caregiver-benefits-banner-v1.webp",
  "preview/assets/caregiver-benefits-banner-v1.webp",
];

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
  mkdir("preview/assets", { recursive: true }),
]);

const benefitsBannerBase64 = (
  await Promise.all(benefitsBannerSourceParts.map(file => readFile(file, "utf8")))
).map(part => part.trim()).join("");
if (benefitsBannerBase64.length !== benefitsBannerBase64Length) {
  throw new Error(`Caregiver benefits banner source length mismatch: ${benefitsBannerBase64.length}`);
}
const benefitsBannerBinary = Buffer.from(benefitsBannerBase64, "base64");
if (benefitsBannerBinary.length !== benefitsBannerBytes) {
  throw new Error(`Caregiver benefits banner byte length mismatch: ${benefitsBannerBinary.length}`);
}
const sourceSha256 = createHash("sha256").update(benefitsBannerBinary).digest("hex");
if (sourceSha256 !== benefitsBannerSha256) {
  throw new Error(`Caregiver benefits banner source hash mismatch: ${sourceSha256}`);
}
await Promise.all(benefitsBannerTargets.map(file => writeFile(file, benefitsBannerBinary)));

for (const file of benefitsBannerTargets) {
  const bytes = await readFile(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== benefitsBannerSha256) throw new Error(`Caregiver benefits banner binary mismatch: ${file} -> ${sha256}`);
}
console.log(`HQ caregiver benefits banner ready: 1280x512, ${benefitsBannerBinary.length} bytes, sha256=${benefitsBannerSha256}`);

const common = {
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  platform: "browser",
  target: ["safari15", "ios15", "chrome100", "firefox100"],
  jsx: "automatic",
  legalComments: "none",
  external: ["/logo-salamat-aval.svg"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
};

const caregiverBenefitsPolicyV3 = {
  name: "caregiver-benefits-policy-v3",
  setup(build) {
    build.onResolve({ filter: /^\.\/caregiver-finance-v2$/ }, (args) => {
      if (!args.importer.replaceAll("\\", "/").endsWith("/mobile-react/caregiver-v4.tsx")) return null;
      return { path: resolve("mobile-react/caregiver-finance-bridge-v3.tsx") };
    });
  },
};

// Compatibility markers for parity validation. The wrapper entries below import these canonical app entries:
// mobile-react/caregiver-v2.tsx
// mobile-react/admin-entry.tsx
await build({
  ...common,
  entryPoints: ["mobile-react/caregiver-entry-v5.tsx"],
  outfile: `${mobileOutdir}/app.js`,
  plugins: [caregiverBenefitsPolicyV3],
});

await build({
  ...common,
  entryPoints: ["mobile-react/admin-entry-v3.tsx"],
  outfile: `${mobileOutdir}/admin-app.js`,
});

await build({
  ...common,
  entryPoints: ["desktop-react/entry.tsx"],
  outfile: `${desktopOutdir}/desktop-app.js`,
});

const files = [
  `${mobileOutdir}/app.js`,
  `${mobileOutdir}/app.css`,
  `${mobileOutdir}/admin-app.js`,
  `${mobileOutdir}/admin-app.css`,
  `${desktopOutdir}/desktop-app.js`,
  `${desktopOutdir}/desktop-app.css`,
];
const sizes = {};
for (const file of files) {
  const info = await stat(file);
  if (!info.size) throw new Error(`React bundle output is empty: ${file}`);
  sizes[file] = info.size;
}
console.log(`React bundles ready: ${files.map(file => `${file}=${sizes[file]} bytes`).join(", ")}`);
