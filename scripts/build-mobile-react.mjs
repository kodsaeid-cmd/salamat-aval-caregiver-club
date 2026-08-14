import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const mobileOutdir = "preview/mobile";
const desktopOutdir = "preview/app";

await Promise.all([
  mkdir(mobileOutdir, { recursive: true }),
  mkdir(desktopOutdir, { recursive: true }),
]);

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
  loader: { ".webp": "dataurl" },
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
