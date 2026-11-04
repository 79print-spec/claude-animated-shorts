// usage: node scripts/clean-remotion-temp.mjs [--yes]   (dry run unless --yes; run it when no render is going)
// deletes leftover remotion-webpack-bundle-* and puppeteer_dev_chrome_profile-* folders in REMOTION_TMP, or the OS temp folder
// findLeftovers() is also imported by bridge-stills.mjs for its size warning
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const pattern = /^(remotion-webpack-bundle|puppeteer_dev_chrome_profile)-/;
const GB = 1024 ** 3;

// total size in bytes; symlinks are not followed
function sizeOf(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += sizeOf(p);
    else if (e.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

// only top-level folders whose names match exactly; nothing else in the temp folder is touched
export function findLeftovers(root = process.env.REMOTION_TMP || os.tmpdir()) {
  if (!fs.existsSync(root)) return { root, found: [], total: 0, missing: true };
  const found = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && pattern.test(e.name))
    .map((e) => ({ dir: path.join(root, e.name), bytes: sizeOf(path.join(root, e.name)) }));
  const total = found.reduce((sum, f) => sum + f.bytes, 0);
  return { root, found, total, missing: false };
}

function main() {
  const yes = process.argv.includes("--yes");
  const { root, found, total, missing } = findLeftovers();
  if (missing) {
    console.log(`Folder not found: ${root}`);
    return;
  }

  console.log(`Temp folder: ${root}`);
  for (const f of found) console.log(`  ${(f.bytes / GB).toFixed(2)} GB  ${f.dir}`);
  console.log(`Found ${found.length} leftover folder(s), ${(total / GB).toFixed(2)} GB in total.`);

  if (found.length === 0) {
    console.log("Nothing to clean.");
  } else if (!yes) {
    console.log("Dry run: nothing deleted. Run again with --yes to delete these folders.");
  } else {
    let failed = 0;
    for (const f of found) {
      try { fs.rmSync(f.dir, { recursive: true, force: true }); console.log("deleted", f.dir); }
      catch (e) { failed++; console.warn(`[warn] could not delete ${f.dir}: ${e.message}`); }
    }
    console.log(failed ? `${failed} folder(s) could not be deleted. Close any running render and try again.` : "Done.");
  }
}

// run the cleanup only when this file is executed directly, not when it is imported
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
