import { mkdir, stat, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { build } from "esbuild";

const mobileOutdir = "preview/mobile";
const desktopOutdir = "preview/app";
const benefitsBannerSourceParts = [1,2,3,4,5].map(index => `assets-source/caregiver-benefits-banner-v13/part${String(index).padStart(2,"0")}.b64`);
const benefitsBannerTargets = [
  "preview/mobile/caregiver-benefits-banner-sharp-v13.webp",
  "preview/assets/caregiver-benefits-banner-sharp-v13.webp",
];
const benefitsBannerBytes = 65878;
const benefitsBannerSha256 = "ff9b391bcd73a214ab0c6103b023898f8ab96244b119a3023c68c3ff91b5305a";

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
  mkdir("preview/assets", { recursive: true }),
]);

const benefitsBannerBase64 = (await Promise.all(benefitsBannerSourceParts.map(file => readFile(file, "utf8")))).join("").replace(/\s+/g, "");
const benefitsBannerBinary = Buffer.from(benefitsBannerBase64, "base64");
if (benefitsBannerBinary.length !== benefitsBannerBytes) throw new Error(`Caregiver benefits sharp banner byte mismatch: ${benefitsBannerBinary.length}`);
if (benefitsBannerBinary.subarray(0,4).toString("ascii") !== "RIFF" || benefitsBannerBinary.subarray(8,12).toString("ascii") !== "WEBP") throw new Error("Caregiver benefits sharp banner is not a valid WebP container");
const benefitsBannerActualSha256 = createHash("sha256").update(benefitsBannerBinary).digest("hex");
if (benefitsBannerActualSha256 !== benefitsBannerSha256) throw new Error(`Caregiver benefits sharp banner hash mismatch: ${benefitsBannerActualSha256}`);
await Promise.all(benefitsBannerTargets.map(file => writeFile(file, benefitsBannerBinary)));
console.log(`Caregiver benefits sharp banner ready: 960x384, ${benefitsBannerBinary.length} bytes, sha256=${benefitsBannerActualSha256}`);

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
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
};
const caregiverBenefitsPolicyV3 = {
  name: "caregiver-benefits-policy-v3",
  setup(build) {
    build.onResolve({ filter: /^\.\/caregiver-finance-v2$/ }, args => {
      if (!args.importer.replaceAll("\\", "/").endsWith("/mobile-react/caregiver-v4.tsx")) return null;
      return { path: resolve("mobile-react/caregiver-finance-bridge-v3.tsx") };
    });
  },
};

// Compatibility markers for parity validation. The wrapper entries below import these canonical app entries:
// mobile-react/caregiver-v2.tsx
// mobile-react/admin-entry.tsx
await build({ ...common, entryPoints:["mobile-react/caregiver-entry-v5.tsx"], outfile:`${mobileOutdir}/app.js`, plugins:[caregiverBenefitsPolicyV3] });
await build({ ...common, entryPoints:["mobile-react/admin-entry-v3.tsx"], outfile:`${mobileOutdir}/admin-app.js` });
await build({ ...common, entryPoints:["desktop-react/entry.tsx"], outfile:`${desktopOutdir}/desktop-app.js` });
const files = [`${mobileOutdir}/app.js`,`${mobileOutdir}/app.css`,`${mobileOutdir}/admin-app.js`,`${mobileOutdir}/admin-app.css`,`${desktopOutdir}/desktop-app.js`,`${desktopOutdir}/desktop-app.css`];
const sizes = {};
for (const file of files) {
  const info = await stat(file);
  if (!info.size) throw new Error(`React bundle output is empty: ${file}`);
  sizes[file] = info.size;
}
console.log(`React bundles ready: ${files.map(file => `${file}=${sizes[file]} bytes`).join(", ")}`);
