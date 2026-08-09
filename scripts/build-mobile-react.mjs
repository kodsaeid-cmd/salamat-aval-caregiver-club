import { mkdir, stat } from "node:fs/promises";
import { build } from "esbuild";

const outdir = "preview/mobile";
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  platform: "browser",
  target: ["safari15", "ios15", "chrome100", "firefox100"],
  jsx: "automatic",
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: ["mobile-react/app.tsx"],
  outfile: `${outdir}/app.js`,
});

await build({
  ...common,
  entryPoints: ["mobile-react/admin-entry.tsx"],
  outfile: `${outdir}/admin-app.js`,
});

const files = ["app.js", "app.css", "admin-app.js", "admin-app.css"];
const sizes = {};
for (const file of files) {
  const info = await stat(`${outdir}/${file}`);
  if (!info.size) throw new Error(`Mobile React bundle output is empty: ${file}`);
  sizes[file] = info.size;
}
console.log(`Mobile React bundles ready: ${files.map(file => `${file}=${sizes[file]} bytes`).join(", ")}`);
