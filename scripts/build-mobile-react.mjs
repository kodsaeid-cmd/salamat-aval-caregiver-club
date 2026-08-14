import { mkdir, stat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { build } from "esbuild";

const mobileOutdir = "preview/mobile";
const desktopOutdir = "preview/app";
const benefitsBannerSha256 = "159e32caff310f9a496fb0d8c39d2490653bae4067d5a08eb81a85023aff4fe4";
const benefitsBannerBytes = 87650;
const benefitsBannerTargets = [
  "preview/mobile/caregiver-benefits-banner-v1.webp",
  "preview/assets/caregiver-benefits-banner-v1.webp",
];

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
  mkdir("preview/assets", { recursive: true }),
]);

for (const file of benefitsBannerTargets) {
  const bytes = await readFile(file);
  if (bytes.length !== benefitsBannerBytes) {
    throw new Error(`Caregiver benefits banner size mismatch: ${file} -> ${bytes.length}`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== benefitsBannerSha256) {
    throw new Error(`Caregiver benefits banner binary mismatch: ${file} -> ${sha256}`);
  }
}
console.log(`HQ caregiver benefits banner verified: 1280x512, ${benefitsBannerBytes} bytes, sha256=${benefitsBannerSha256}`);

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
