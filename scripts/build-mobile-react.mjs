import { mkdir, stat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { build } from "esbuild";

const mobileOutdir = "preview/mobile";
const desktopOutdir = "preview/app";
const benefitsBannerTargets = [
  "preview/mobile/caregiver-benefits-banner-v2.webp",
  "preview/assets/caregiver-benefits-banner-v2.webp",
];

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
  mkdir("preview/assets", { recursive: true }),
]);

const bannerFiles = await Promise.all(benefitsBannerTargets.map(async file => {
  const bytes = await readFile(file);
  if (bytes.length < 80_000) throw new Error(`Caregiver benefits banner is unexpectedly small for HQ delivery: ${file} -> ${bytes.length}`);
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`Caregiver benefits banner is not a valid WebP container: ${file}`);
  }
  return { file, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}));

if (bannerFiles[0].sha256 !== bannerFiles[1].sha256) {
  throw new Error(`Caregiver benefits banner targets diverged: ${bannerFiles.map(item => `${item.file}:${item.sha256}`).join(", ")}`);
}
console.log(`Caregiver benefits HQ banner verified: ${bannerFiles[0].bytes.length} bytes, sha256=${bannerFiles[0].sha256}`);

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
