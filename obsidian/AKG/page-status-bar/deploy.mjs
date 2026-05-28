// Copy built plugin artifacts into a local Obsidian vault for live testing.
// Reads VAULT env var (path to the vault root). Skips silently if VAULT is
// unset — release builds in CI don't need to deploy.
//
// Usage:
//   VAULT=~/_ npm run deploy
//   VAULT=~/_ npm run build       # build + deploy
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const vault = process.env.VAULT;
if (!vault) {
  console.log("[deploy] VAULT env var not set — skipping deploy (build artifacts remain in source dir).");
  process.exit(0);
}

const resolvedVault = path.resolve(vault.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? ""));
const pluginId = JSON.parse(
  fs.readFileSync(path.join(here, "manifest.json"), "utf8"),
).id;
const dest = path.join(resolvedVault, ".obsidian", "plugins", pluginId);

if (!fs.existsSync(path.join(resolvedVault, ".obsidian"))) {
  console.error(`[deploy] ${resolvedVault} doesn't look like an Obsidian vault (.obsidian missing).`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

const files = ["main.js", "manifest.json", "styles.css"];
for (const f of files) {
  const src = path.join(here, f);
  if (!fs.existsSync(src)) {
    console.error(`[deploy] missing source: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(dest, f));
  console.log(`[deploy] ${f} -> ${dest}/`);
}
