#!/usr/bin/env node
// Wave-1 QA publication seeder (master directive 2026-08-31: put the real
// inventory on the market for purchase-flow QA before R2 exists).
//
// - Copies the wave-1 product files (bytes measured in upload-manifest.json)
//   into public/market/<slug>/ so the deployed Worker itself stores them.
// - Emits seed SQL: store user/workspace, assets, artifacts with
//   object_key "asset:/market/..." (served by the assets route bridge),
//   PASS reviews (master-directed QA publication), PUBLISHED listings with
//   QA-provisional prices in whole credits (1 credit = W100).
//
// Prices are QA-PROVISIONAL: final prices are a master decision before 실판매.
// Usage: node scripts/seed-wave1-qa.mjs   (then wrangler d1 execute --file)
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const wave1 = join(root, "outputs", "market-launch", "wave1");
const manifest = JSON.parse(readFileSync(join(wave1, "upload-manifest.json"), "utf8"));
const outSql = join(root, "scripts", "seed-wave1-qa.sql");

const STORE_USER = "usr-artemis-store";
const STORE_WORKSPACE = "ws-artemis-store";

/** QA-provisional credit prices by product family (whole credits × 10,000 = price_cents). */
function creditPriceFor(slug, kind) {
  if (kind === "2d-image" || kind === "2d") return 9;
  if (/greenhouse|market-stall/.test(slug)) return 69;
  if (/shed|storage/.test(slug)) return 49;
  if (/tree|broadleaf|conifer|grove/.test(slug)) return 29;
  return 19; // crates, haystacks, fence pieces and other props
}

function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const statements = [];
statements.push(`INSERT OR IGNORE INTO clunk_users (id, email, display_name) VALUES (${q(STORE_USER)}, 'store@clunk.internal', '아르테미스 스토어');`);
statements.push(`INSERT OR IGNORE INTO clunk_workspaces (id, owner_user_id, name) VALUES (${q(STORE_WORKSPACE)}, ${q(STORE_USER)}, 'Artemis Store');`);
statements.push(`INSERT OR IGNORE INTO clunk_workspace_members (workspace_id, user_id, role) VALUES (${q(STORE_WORKSPACE)}, ${q(STORE_USER)}, 'owner');`);

let copied = 0;
/** Files whose bytes no longer match what the manifest recorded for them. */
const drifted = [];
const roleHistogram = {};
for (const product of manifest.products) {
  const slug = product.slug;
  const entry = product.files.find((file) => file.role === "entry");
  if (!entry) {
    console.warn(`SKIP ${slug}: no entry file`);
    continue;
  }
  const assetId = `asset-w1-${slug}`;
  const entryBytes = readFileSync(join(wave1, entry.path));
  const entryMeasured = {
    byteLength: entryBytes.length,
    sha256: createHash("sha256").update(entryBytes).digest("hex"),
  };
  statements.push(
    `INSERT OR REPLACE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (` +
      `${q(assetId)}, ${q(STORE_WORKSPACE)}, ${q(basename(entry.path))}, ${q(entry.contentType)}, ${entryMeasured.byteLength}, ${q(entryMeasured.sha256)});`,
  );

  let hasPreview = product.files.some((file) => file.role === "preview");
  for (const file of product.files) {
    const src = join(wave1, file.path);
    if (!existsSync(src)) {
      console.warn(`MISSING ${file.path}`);
      continue;
    }
    const fileName = basename(file.path);
    const destRel = `market/${slug}/${fileName}`;
    const dest = join(root, "public", destRel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied += 1;

    // Measure the bytes being copied instead of trusting the manifest's record of them.
    //
    // The manifest is written by hand-run tools and goes stale silently: conifer-spire.glb
    // was rebuilt at some point and the catalogue kept publishing the previous build's
    // hash, so the evidence beside that product described a file nobody could download.
    // The seeder is the last thing to touch these bytes, so it is the right place to say
    // what they are.
    const bytes = readFileSync(src);
    const measured = { byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    if (measured.sha256 !== file.sha256) {
      drifted.push({ path: file.path, manifest: file.sha256, actual: measured.sha256 });
    }

    // Paid public previews require role='preview'; promote the hero render
    // when the manifest carries none.
    let role = file.role;
    if (!hasPreview && /hero-.*\.png$/i.test(fileName)) {
      role = "preview";
      hasPreview = true;
    }
    roleHistogram[role] = (roleHistogram[role] ?? 0) + 1;

    statements.push(
      `INSERT OR REPLACE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (` +
        `${q(`artifact-w1-${slug}-${fileName}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(fileName)}, ${q(role)}, ${q(file.contentType)}, ${measured.byteLength}, ${q(measured.sha256)}, ${q(`asset:/${destRel}`)});`,
    );
  }

  // Each lane gets the verdict its own evidence file supports, and nothing more.
  //
  // visual_runtime: the 3D products each have a hero render that was produced and measured
  // (measurements/hero-*.json). The textures do not, and their audit says so itself —
  // "visualRuntime": "NOT_EVALUATED", "measurementScope": "texture-only" — while the shop
  // was showing PASS next to the words "loaded into a real three.js renderer".
  //
  // player_facing: nothing here measured whether an asset reads correctly to a player in a
  // game. The texture readability metric comes closest and is a computed contrast figure at
  // a distance band, not a person looking. It stays in the description as the number it is.
  const renderMeasured = product.kind !== "2d-texture" && !/^verified-seamless-textures/.test(slug);
  statements.push(
    `INSERT OR REPLACE INTO clunk_asset_reviews (id, workspace_id, asset_id, visual_runtime, player_facing, human_decision, note, evidence_json, reviewer_user_id) VALUES (` +
      `${q(`review-w1-${slug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${renderMeasured ? "'PASS'" : "'NOT_EVALUATED'"}, 'NOT_EVALUATED', 'PASS', ` +
      `${q("QA 게시 (마스터 지시 2026-08-31) — HF 납품 라인 실측·감사 통과 인벤토리")}, ` +
      `${q(JSON.stringify({ source: "wave1", measuredBy: "outputs/market-launch/wave1/measurements", publication: "QA", salesLock: true }))}, ${q(STORE_USER)});`,
  );

  const credits = creditPriceFor(slug, product.kind);
  const priceCents = credits * 10_000;
  statements.push(
    `INSERT OR REPLACE INTO clunk_marketplace_listings (id, workspace_id, asset_id, slug, title, description, price_cents, currency, license_status, status, published_at) VALUES (` +
      `${q(`listing-w1-${slug}`)}, ${q(STORE_WORKSPACE)}, ${q(assetId)}, ${q(slug)}, ${q(product.title)}, ${q(product.description)}, ${priceCents}, 'KRW', 'cleared', 'PUBLISHED', CURRENT_TIMESTAMP);`,
  );
}

writeFileSync(outSql, `${statements.join("\n")}\n`);
console.log(`products: ${manifest.products.length}`);
console.log(`files copied to public/market: ${copied}`);
console.log(`roles:`, roleHistogram);
if (drifted.length) {
  console.log(`
매니페스트와 다른 파일 ${drifted.length}건 — 실제 바이트 기준으로 기록했습니다:`);
  for (const item of drifted) {
    console.log(`  ${item.path}  매니페스트 ${item.manifest.slice(0, 10)}…  실제 ${item.actual.slice(0, 10)}…`);
  }
}
console.log(`sql statements: ${statements.length} -> ${outSql}`);
