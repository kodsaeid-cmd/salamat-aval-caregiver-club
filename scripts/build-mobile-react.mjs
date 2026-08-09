import { mkdir, stat } from "node:fs/promises";
import { build } from "esbuild";

const outdir = "preview/mobile";
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ["mobile-react/app.tsx"],
  outfile: `${outdir}/app.js`,
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
});

const js = await stat(`${outdir}/app.js`);
const css = await stat(`${outdir}/app.css`);
if (!js.size || !css.size) throw new Error("Mobile React bundle output is empty.");
console.log(`Mobile React bundle ready: app.js=${js.size} bytes, app.css=${css.size} bytes`);
