#!/usr/bin/env node
// Patch obsidian42-brat to accept glob patterns in the `version` field.
//
// Without the patch BRAT supports two version values:
//   - "latest"  → fetch /releases, pick the newest by semver
//   - "vX.Y.Z"  → fetch /releases/tags/vX.Y.Z, pinned
//
// AKG plugins are released under tags like `akg/page-status-bar/v0.1.0` in
// `akarelin/_`, where the repo carries releases for MULTIPLE plugins. BRAT's
// "latest" therefore picks the wrong one. This patch adds a third mode:
//   - "<pattern with *>"  → fetch /releases, filter tag_name by the glob,
//                            pick the newest match
//
// Example BRAT pluginSubListFrozenVersion entry after the patch:
//   { "repo": "akarelin/_", "version": "akg/page-status-bar/v*" }
//
// Idempotent. BRAT auto-updates will revert this; re-run after each BRAT
// update.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const vault = process.env.VAULT;
if (!vault) {
  console.error("[brat-patch] VAULT env var not set. Usage: VAULT=~/_ node apply.mjs");
  process.exit(1);
}
const resolvedVault = path.resolve(vault.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? ""));
const bratMain = path.join(resolvedVault, ".obsidian", "plugins", "obsidian42-brat", "main.js");

const MARKER = "/* AKG-GLOB-PATCH-v1 */";

if (!fs.existsSync(bratMain)) {
  console.error(`[brat-patch] BRAT not found at ${bratMain}`);
  process.exit(1);
}

let src = fs.readFileSync(bratMain, "utf8");

if (src.includes(MARKER)) {
  console.log("[brat-patch] already patched — nothing to do");
  process.exit(0);
}

// --- patch 1: route the URL based on glob too ---
const URL_NEEDLE = 'let c=e&&e!=="latest"?`https://api.github.com/repos/${s}/releases/tags/${e}`:`https://api.github.com/repos/${s}/releases`,';
const URL_PATCH = `${MARKER}let __akgGlob=typeof e==="string"&&e.includes("*"),c=e&&e!=="latest"&&!__akgGlob?\`https://api.github.com/repos/\${s}/releases/tags/\${e}\`:\`https://api.github.com/repos/\${s}/releases\`,`;

if (!src.includes(URL_NEEDLE)) {
  console.error("[brat-patch] URL needle not found — BRAT's main.js shape changed. Aborting.");
  process.exit(2);
}
// Use a function replacement so '$&' inside the patch isn't interpreted by
// String.prototype.replace as a backreference.
src = src.replace(URL_NEEDLE, () => URL_PATCH);

// --- patch 2: filter releases by glob after fetch ---
const FETCH_NEEDLE = 'let m=e&&e!=="latest"?[g.json]:g.json;';
const FETCH_PATCH = 'let m=e&&e!=="latest"&&!__akgGlob?[g.json]:g.json;if(__akgGlob){let __escG=p=>p.replace(/[.+?^${}()|[\\]\\\\]/g,c=>"\\\\"+c);let __re=new RegExp("^"+e.split("*").map(__escG).join(".*")+"$");m=m.filter(r=>__re.test(r.tag_name));}';

if (!src.includes(FETCH_NEEDLE)) {
  console.error("[brat-patch] fetch needle not found — partial patch! Rolling back URL patch.");
  src = src.replace(URL_PATCH, () => URL_NEEDLE);
  fs.writeFileSync(bratMain, src);
  process.exit(2);
}
src = src.replace(FETCH_NEEDLE, () => FETCH_PATCH);

fs.writeFileSync(bratMain, src);
console.log("[brat-patch] applied. BRAT now accepts glob versions like 'akg/<plugin>/v*'.");
console.log("[brat-patch] note: BRAT may overwrite this when it self-updates. Re-run this script after BRAT updates.");
