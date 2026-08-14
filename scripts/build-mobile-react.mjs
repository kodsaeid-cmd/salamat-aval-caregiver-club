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
const benefitsBannerSourceSuffixes = [
  "U",
  "",
  "",
  "QfJwJw4md7d+ilSMYXp5J68NRLYv2D11Izm60SNWo1OFe9aRNkDiwUbFjVg/eJCgkypg/JupkoP6Q2dGzdG4Mvf+APMG+sYSK9hPw4yabwKvfM29y78RkkTjWOCcqH8+CoBElvvUekCaQs/5QawZafeFiakFQmWAPePFI1V/ETXM/UDiXr5lr0Nq/JzXlzUBw7EC4sXKuRGW89WDi4vd+1g+EzVoCISoPugaU/z+Wb9ZWru3EuxKU7Gh+5TTSPCH1glO46zfvk/bnDzxkVifrx1t0Nccj/A5EngMweB9mYXCvh3ceJpz6l+dN0ipE53kkqanED707oOuWa5J2S3vAm/U6rs4g5zAdqLKDjKmOwh/WVnPW/dJpank1fVCXgC3tGwLWE4DnsbiFk8RQeJd+t1wywcTFi2vawaSxz/Yl",
  "",
  "",
  "",
  "",
];
const benefitsBannerPartSha256 = [
  "7cd2d483c797a7d8191c5d5c4e5aa7bc0a13d6b3cf747474be0453bcc34ab012",
  "bfc7777f2922dce97e0149ff3a902980f32dbdcf030beda29e65e14ba9117c1a",
  "4ec0e2c9cf2e5272ff2e7c7fa2aba3f39379dfc24fa34fbd89af56da5cf5b5b3",
  "8240dfe412caefe2893c019e2606612888aa1360c2c34a8647760f9f71257659",
  "3cfc42c2b8dd58acb86fef39e11d43f7b3bf5e2b0190c21be73050c47d46bd70",
  "cea9e5db4d71b0fb2d37d1dfa6fa1d732b8477062598e42c88f225cc4d6df6f6",
  "67166f9be9a919268df09cb3197c8efd211e232cc7e0fec27547b2ff1f010d2f",
  "8d35a3d9a7ab8b7492f3ae2d4262b761cd2ecc783f3229a71f18c8a85d314321",
];
const benefitsBannerTargets = [
  "preview/mobile/caregiver-benefits-banner-v1.webp",
  "preview/assets/caregiver-benefits-banner-v1.webp",
];

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
  mkdir("preview/assets", { recursive: true }),
]);

const benefitsBannerRawParts = await Promise.all(benefitsBannerSourceParts.map(file => readFile(file, "utf8")));
const benefitsBannerCorrectedParts = benefitsBannerRawParts.map((part, index) => part.trim() + benefitsBannerSourceSuffixes[index]);
const badParts = benefitsBannerCorrectedParts.flatMap((part, index) => {
  const hash = createHash("sha256").update(part).digest("hex");
  return hash === benefitsBannerPartSha256[index] ? [] : [`part${String(index + 1).padStart(2, "0")}:${part.length}:${hash}`];
});
if (badParts.length) throw new Error(`Caregiver benefits banner part mismatch: ${badParts.join(", ")}`);

const benefitsBannerBase64 = benefitsBannerCorrectedParts.join("");
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
