// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, GPU via ANGLE, jpeg)
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
import fs from "node:fs";
// each bundle copies public/ (~1.3 GB) into the temp dir; C: is full, so keep bundles on D:
// Remotion bundles fill the temp folder (~1.3 GB each): set REMOTION_TMP to a folder on a big drive
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { findLeftovers } from "./clean-remotion-temp.mjs";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
const browserExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };
// warn (never delete) if old bundles from earlier runs take more than 5 GB; a failed check must not stop the render
try {
  const { root, found, total } = findLeftovers();
  if (total > 5 * 1024 ** 3) console.warn(`[warn] ${found.length} leftover Remotion bundle(s) use ${(total / 1024 ** 3).toFixed(1)} GB in ${root}. Clean them with: node templates/scripts/clean-remotion-temp.mjs --yes`);
} catch { /* skip the check */ }
// the bundle folder is set by onDirectoryCreated, so it is known even if bundling fails halfway
let bundleDir = null;
try {
  const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public"), onDirectoryCreated: (dir) => { bundleDir = dir; } });
  const composition = await selectComposition({ serveUrl, id: "BridgeShort", browserExecutable, chromiumOptions });
  const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
  for (const f of frames.split(",").map(Number)) {
    const t0 = Date.now();
    await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
      browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
    console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  }
} finally {
  // delete the bundle copy of public/ (~1.3 GB) after the last render, so the browser has released its files
  if (bundleDir) {
    try { fs.rmSync(bundleDir, { recursive: true, force: true }); console.log("deleted bundle", bundleDir); }
    catch (e) { console.warn(`[warn] could not delete bundle ${bundleDir}: ${e.message}`); }
  }
}
