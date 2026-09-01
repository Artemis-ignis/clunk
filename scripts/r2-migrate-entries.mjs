#!/usr/bin/env node
/**
 * Move the files buyers download out of the Worker's static assets and into R2.
 *
 * Why: two published texture products were returning HTTP 500 about half the time. The
 * cause was Cloudflare's static asset service on multi-megabyte files — not our bytes, not
 * our paths, not the worker (all four were tested). R2 is a different service reached
 * through the Worker's own binding, so the download stops depending on the one that fails.
 *
 * It also removes an exposure the code already flagged: an `asset:/` object key redirects
 * to a public static URL, so a paid product's bytes were fetchable by anyone who guessed
 * the path. An R2 key goes through the entitlement check in the download route instead.
 *
 * Only `entry` artifacts move. Previews and hero images are small, have never failed, and
 * are meant to be public — leaving them where they are keeps the product-page viewer
 * working exactly as it does now.
 *
 * Usage: node scripts/r2-migrate-entries.mjs [--dry-run] [--limit N]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const BUCKET = process.env.CLUNK_CF_R2_BUCKET ?? "clunk-assets";
const dryRun = process.argv.includes("--dry-run");
// Which artifact roles to move. Entries are the files buyers download; previews are the
// card images, which travel the same route and may as well leave the service that was
// failing. Hero renders and manifests stay where they are — they are small, public, and
// nothing has ever failed to serve them.
const roleAt = process.argv.indexOf("--roles");
const ROLES = (roleAt > -1 ? process.argv[roleAt + 1] : "entry").split(",");
const limitAt = process.argv.indexOf("--limit");
const limit = limitAt > -1 ? Number(process.argv[limitAt + 1]) : Infinity;

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1 = process.env.CLUNK_CF_D1_ID ?? "15b7bd6c-7677-4fe7-b882-5f80a272d6ea";
if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요합니다.");
  process.exit(2);
}

/**
 * Query D1 over its HTTP API rather than through wrangler.
 *
 * `wrangler d1 execute --command` has to be handed a whole SQL statement as one argument,
 * and on Windows the shell wrangler is launched through splits it on spaces into thirty
 * unknown arguments. Passing the statement in a file avoids that but makes wrangler print a
 * summary instead of the rows. The HTTP API has neither problem.
 */
async function query(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${D1}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ sql }),
    },
  );
  const payload = await response.json();
  if (!payload.success) throw new Error(`D1: ${JSON.stringify(payload.errors)}`);
  return payload.result[0].results;
}

/** Uploads still go through wrangler: it streams the file and handles the R2 auth. */
function r2Put(key, file, contentType) {
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", contentType, "--remote"],
    { cwd: root, stdio: "pipe", shell: process.platform === "win32", maxBuffer: 32 * 1024 * 1024 },
  );
}

const rows = await query(
  "SELECT id, file_name AS fileName, content_type AS contentType, byte_length AS byteLength, sha256, object_key AS objectKey" +
    ` FROM clunk_asset_artifacts WHERE role IN (${ROLES.map((r) => `'${r}'`).join(", ")}) AND object_key LIKE 'asset:/%' ORDER BY id`,
);

console.log(`대상 ${rows.length}개 · 합계 ${(rows.reduce((s, r) => s + Number(r.byteLength), 0) / 1048576).toFixed(1)} MB`);

const updates = [];
const mismatched = [];
let uploaded = 0;
let totalBytes = 0;
for (const row of rows.slice(0, limit)) {
  // "asset:/market/slug/file.png" -> local public/market/slug/file.png, R2 key market/slug/file.png
  const relative = row.objectKey.slice("asset:/".length);
  const localPath = join(root, "public", relative);
  if (!existsSync(localPath)) {
    console.warn(`SKIP ${row.id}: ${relative} 파일 없음`);
    continue;
  }
  const bytes = readFileSync(localPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // The catalogue publishes this hash as evidence. Uploading bytes that do not match it
  // would make every listing's stated hash wrong, so the mismatch stops the run.
  if (sha256 !== row.sha256) {
    // Never upload bytes that do not match the hash the listing publishes as evidence.
    // Collected rather than thrown so one run reports every mismatch instead of the first.
    mismatched.push({ relative, db: row.sha256, disk: sha256, dbBytes: Number(row.byteLength), diskBytes: bytes.length });
    continue;
  }
  totalBytes += bytes.length;
  if (!dryRun) {
    r2Put(relative, localPath, row.contentType);
  }
  updates.push(
    `UPDATE clunk_asset_artifacts SET object_key = '${relative.replace(/'/g, "''")}' WHERE id = '${row.id.replace(/'/g, "''")}';`,
  );
  uploaded += 1;
  console.log(`  ${uploaded}/${rows.length} ${relative} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

if (mismatched.length) {
  console.log(`
해시 불일치 ${mismatched.length}건 — 업로드에서 제외했습니다:`);
  for (const bad of mismatched) {
    console.log(`  ${bad.relative}  DB ${bad.dbBytes}B ${bad.db.slice(0, 10)}…  디스크 ${bad.diskBytes}B ${bad.disk.slice(0, 10)}…`);
  }
}

const sqlPath = join(root, "tmp", "r2-entry-keys.sql");
writeFileSync(sqlPath, `${updates.join("\n")}\n`, "utf8");
console.log(
  `\n${uploaded}개 · ${(totalBytes / 1048576).toFixed(1)} MB${dryRun ? " (dry-run, 업로드 안 함)" : " 업로드 완료"}` +
    `\nClass A 쓰기 ${dryRun ? 0 : uploaded}회 (무료 월 1,000,000회)` +
    `\nSQL: ${sqlPath}`,
);
