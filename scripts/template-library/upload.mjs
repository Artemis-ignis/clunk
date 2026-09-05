#!/usr/bin/env node
/**
 * Mirrors outputs/template-library into R2 under the `templates/` prefix.
 *
 * The library has no D1 row and no listing: it is one immutable tree of files plus
 * `templates/library.json`, which is the only index the runtime reads. That keeps an operator's
 * job to a single command and keeps a half-finished upload from being visible as a broken
 * catalogue — library.json is written LAST, so until it lands the routes answer 503 "not
 * uploaded yet" rather than offering templates whose files are missing.
 *
 * Uploads go through wrangler for the same reason scripts/r2-migrate-entries.mjs does: it
 * streams the file and owns the R2 auth. Nothing here touches D1.
 *
 *   node scripts/template-library/upload.mjs --dry-run          # print the plan, upload nothing
 *   node scripts/template-library/upload.mjs                    # upload to the real bucket
 *   node scripts/template-library/upload.mjs --only crate-closed
 *   node scripts/template-library/upload.mjs --local            # seed the miniflare bucket
 *
 * `--local` writes into .wrangler/state instead, which is the bucket `npm run dev` binds as
 * ASSETS — that is how /studio is exercised end to end on a laptop.
 *
 * Environment: CLUNK_CF_R2_BUCKET (default clunk-assets), plus whatever wrangler needs to
 * authenticate (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID or a wrangler login).
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const REMOTE_BUCKET = process.env.CLUNK_CF_R2_BUCKET ?? "clunk-assets";
/** The miniflare bucket vite.config.ts binds as ASSETS during `npm run dev`. */
const LOCAL_BUCKET = "site-creator-r2";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith("--")) {
    const flag = process.argv[i].slice(2);
    const next = process.argv[i + 1];
    args.set(flag, next && !next.startsWith("--") ? (i += 1, next) : "true");
  }
}
const ROOT = resolve(REPO, args.get("dir") ?? "outputs/template-library");
const DRY = args.get("dry-run") === "true";
const ONLY = args.get("only") ? new Set(args.get("only").split(",").map((value) => value.trim())) : null;
const LOCAL = args.get("local") === "true";
const BUCKET = LOCAL ? LOCAL_BUCKET : REMOTE_BUCKET;

const CONTENT_TYPES = {
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
  ".png": "image/png",
  ".json": "application/json",
};

function contentTypeFor(name) {
  const dot = name.lastIndexOf(".");
  return CONTENT_TYPES[name.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/** Every file under `dir`, depth first, as repository-relative paths. */
function walk(dir, into = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (name.startsWith(".")) continue;
    if (statSync(path).isDirectory()) walk(path, into);
    else into.push(path);
  }
  return into;
}

/** 파일 하나를 올린다(비동기). wrangler 호출 하나가 4~5초라 1,610개를 차례로 올리면 두 시간이
 *  넘는다(2026-09-05 실측). 아래 루프는 --concurrency(기본 8)개를 동시에 돌리고, library.json 만은
 *  전부 끝난 뒤 마지막에 따로 올린다. */
function r2PutAsync(key, file, contentType) {
  return execFileAsync(
    "npx",
    ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", contentType,
      ...(LOCAL ? ["--local", "--persist-to", ".wrangler/state"] : ["--remote"])],
    { cwd: REPO, shell: process.platform === "win32", maxBuffer: 32 * 1024 * 1024 },
  );
}

function r2Put(key, file, contentType) {
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", contentType,
      ...(LOCAL ? ["--local", "--persist-to", ".wrangler/state"] : ["--remote"])],
    { cwd: REPO, stdio: "pipe", shell: process.platform === "win32", maxBuffer: 32 * 1024 * 1024 },
  );
}

const libraryPath = join(ROOT, "library.json");
const library = JSON.parse(readFileSync(libraryPath, "utf8"));
if (library.schema !== "clunk.template-library.v1") throw new Error("library.json is not a clunk.template-library.v1 document.");

/**
 * The plan is derived from library.json rather than from the directory listing, so a file the
 * catalogue does not reference is never uploaded and a file it does reference but that is
 * missing on disk stops the run before anything is written.
 */
const planned = [];
for (const template of library.templates) {
  if (ONLY && !ONLY.has(template.id)) continue;
  const names = new Set();
  for (const palette of template.palettes) {
    names.add(palette.glb);
    if (palette.thumbnail) names.add(palette.thumbnail);
    if (palette.sheet) { names.add(palette.sheet.png); names.add(palette.sheet.json); }
  }
  for (const name of names) {
    const file = join(ROOT, template.id, name);
    const bytes = statSync(file).size; // throws if the catalogue promises a file that is not here
    planned.push({ key: `templates/${template.id}/${name}`, file, bytes, contentType: contentTypeFor(name) });
  }
}

const stray = walk(ROOT)
  .filter((path) => path !== libraryPath && !path.endsWith(`${sep}contact-sheet.png`) && !path.endsWith(`${sep}factory-hashes.json`))
  .map((path) => relative(ROOT, path).split(sep).join("/"))
  .filter((rel) => !planned.some((entry) => entry.key === `templates/${rel}`));

const totalBytes = planned.reduce((sum, entry) => sum + entry.bytes, 0);
process.stdout.write(`대상 ${planned.length}개 파일 · ${(totalBytes / 1048576).toFixed(1)} MB · 버킷 ${BUCKET}${LOCAL ? " (로컬 miniflare)" : ""}\n`);
if (stray.length) process.stdout.write(`카탈로그가 참조하지 않아 건너뛰는 파일 ${stray.length}개\n`);
if (ONLY) process.stdout.write(`--only ${[...ONLY].join(",")} — library.json 은 마지막에 통째로 올라갑니다\n`);

if (DRY) {
  for (const entry of planned) process.stdout.write(`  DRY  ${entry.key}  ${entry.bytes.toLocaleString()} B\n`);
  process.stdout.write("\n--dry-run 이므로 아무것도 올리지 않았습니다.\n");
  process.exit(0);
}

const concurrencyIndex = process.argv.indexOf("--concurrency");
const CONCURRENCY = Math.max(1, Number(concurrencyIndex >= 0 ? process.argv[concurrencyIndex + 1] : 8) || 8);
let done = 0;
let next = 0;
const failures = [];
async function worker() {
  while (next < planned.length) {
    const entry = planned[next++];
    try {
      await r2PutAsync(entry.key, entry.file, entry.contentType);
      done += 1;
      process.stdout.write(`  ${String(done).padStart(4)}/${planned.length}  ${entry.key}\n`);
    } catch (error) {
      failures.push(`${entry.key}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, planned.length) }, () => worker()));
if (failures.length) {
  process.stderr.write(`\n올리지 못한 파일 ${failures.length}개 — library.json 은 올리지 않습니다(옛 카탈로그 유지):\n  ${failures.join("\n  ")}\n`);
  process.exit(1);
}

// library.json last: the routes treat its absence as "not set up yet", so a run that dies
// halfway leaves the old catalogue serving rather than a new one full of missing files.
r2Put("templates/library.json", libraryPath, "application/json");
const digest = createHash("sha256").update(readFileSync(libraryPath)).digest("hex");
process.stdout.write(`\n올림 완료 · templates/library.json sha256 ${digest}\n`);
process.stdout.write("배포된 Worker 는 isolate 마다 library.json 을 한 번 읽어 캐시합니다. 새 카탈로그는 새 isolate 부터 보입니다.\n");
