#!/usr/bin/env node
// Cloudflare deploy runner: patches the vite-plugin-generated worker config
// with the real production resources, then hands off to wrangler.
//
// The generated dist/server/wrangler.json carries the site-creator
// placeholders (placeholder D1 id, site-creator-r2 bucket). Production values
// are resource *identifiers*, not secrets, so the defaults live here and can
// be overridden via env. Auth comes from CLOUDFLARE_API_TOKEN /
// CLOUDFLARE_ACCOUNT_ID in the environment - never from this file.
//
// Usage: npm run build && node scripts/deploy-cloudflare.mjs [--dry-run]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(root, "dist", "server", "wrangler.json");
if (!existsSync(configPath)) {
  console.error("dist/server/wrangler.json not found - run `npm run build` first.");
  process.exit(1);
}

const WORKER_NAME = process.env.CLUNK_CF_WORKER_NAME ?? "clunk";
const D1_DATABASE_ID = process.env.CLUNK_CF_D1_ID ?? "15b7bd6c-7677-4fe7-b882-5f80a272d6ea";
const D1_DATABASE_NAME = process.env.CLUNK_CF_D1_NAME ?? "clunk";
const R2_BUCKET = process.env.CLUNK_CF_R2_BUCKET ?? "clunk-assets";

const config = JSON.parse(readFileSync(configPath, "utf8"));
config.name = WORKER_NAME;
config.workers_dev = true;
if (Array.isArray(config.d1_databases) && config.d1_databases.length > 0) {
  config.d1_databases = config.d1_databases.map((entry) => ({
    ...entry,
    binding: entry.binding || "DB",
    database_name: D1_DATABASE_NAME,
    database_id: D1_DATABASE_ID,
  }));
}
// R2 has been live since 2026-09-02 (bucket clunk-assets); the binding ships by default.
// Deploying without it silently turns every preview and download into a storage 503 —
// which happened five times that afternoon while the flag was still opt-in. Set
// CLUNK_CF_WITHOUT_R2=1 only for a deliberate storage-less deploy.
if (process.env.CLUNK_CF_WITHOUT_R2 === "1") {
  delete config.r2_buckets;
} else if (Array.isArray(config.r2_buckets) && config.r2_buckets.length > 0) {
  config.r2_buckets = config.r2_buckets.map((entry) => ({
    ...entry,
    binding: entry.binding || "ASSETS",
    bucket_name: R2_BUCKET,
  }));
} else {
  config.r2_buckets = [{ binding: "ASSETS", bucket_name: R2_BUCKET }];
}
// Workers AI. Unlike D1 and R2 this binds a capability on the account rather than a
// resource that has to be created first, so it is declared unconditionally: the route
// behind it checks whether the binding arrived and says so when it did not.
config.ai = { binding: "AI" };

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`patched ${configPath}: name=${config.name}, d1=${D1_DATABASE_NAME}(${D1_DATABASE_ID.slice(0, 8)}…), r2=${R2_BUCKET}, ai=AI`);

if (process.argv.includes("--dry-run")) {
  console.log("dry-run: skipping wrangler deploy");
  process.exit(0);
}

execFileSync("npx", ["wrangler", "deploy", "-c", configPath], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
