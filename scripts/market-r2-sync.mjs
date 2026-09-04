#!/usr/bin/env node
/**
 * public/market 의 파일과 사는 사람이 실제로 받는 파일(R2)을 맞춘다.
 *
 * 왜 필요한가. 에셋을 고치는 일은 public/market 안에서 일어나는데, 파는 것은 R2 에 있는
 * 사본이다. 둘이 갈라지면 상품 페이지의 숫자는 새 파일에서 잰 값인데 내려받는 것은 옛
 * 파일이 된다 — 사양이 파일과 다르다는, 이 가게가 팔지 않겠다고 한 바로 그 상태다.
 *
 * D1 의 `clunk_asset_artifacts` 는 파일마다 길이와 sha256 을 들고 있어 R2 를 뒤지지 않고도
 * 무엇이 다른지 알 수 있다. 다른 것만 올리고 기록을 함께 고친다.
 *
 * 역할을 가리지 않는다. 모델(entry)만 맞추고 미리보기를 두면 카드에 옛 그림이 남는다.
 *
 * 사용:
 *   node scripts/market-r2-sync.mjs            무엇이 다른지만 말한다
 *   node scripts/market-r2-sync.mjs --apply    올리고 기록을 고친다
 * 필요: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const BUCKET = process.env.CLUNK_CF_R2_BUCKET ?? "clunk-assets";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1 = process.env.CLUNK_CF_D1_ID ?? "15b7bd6c-7677-4fe7-b882-5f80a272d6ea";
const apply = process.argv.includes("--apply");
if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요합니다.");
  process.exit(2);
}

async function query(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${D1}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(`D1: ${JSON.stringify(payload.errors)}`);
  return payload.result[0].results;
}

const rows = await query(
  "SELECT a.id, a.file_name AS fileName, a.role, a.byte_length AS byteLength, a.sha256," +
    " a.object_key AS objectKey, a.content_type AS contentType, l.slug" +
    " FROM clunk_asset_artifacts a JOIN clunk_marketplace_listings l ON l.asset_id = a.asset_id" +
    " WHERE l.status = 'PUBLISHED' ORDER BY l.slug, a.role, a.file_name",
);

// 길이가 두 곳에 적혀 있다. 상품 머리글의 배지는 `clunk_assets` 를 읽고 사양 줄은 파일에서
// 잰 값을 읽으므로, 한쪽만 고치면 한 화면에 3.3MB 와 2.8MB 가 같이 뜬다. 헬리콥터가 그랬다.
const assetRows = await query(
  "SELECT a.id, a.file_name AS fileName, a.byte_length AS byteLength, a.sha256, l.slug" +
    " FROM clunk_assets a JOIN clunk_marketplace_listings l ON l.asset_id = a.id" +
    " WHERE l.status = 'PUBLISHED' ORDER BY l.slug",
);
const assetBySlug = new Map(assetRows.map((row) => [String(row.slug), row]));
const assetFixes = [];

const stale = [];
let missing = 0;
for (const row of rows) {
  // 키는 두 가지 꼴로 적혀 있다. 둘 다 public/ 아래의 같은 자리를 가리킨다.
  const key = String(row.objectKey).startsWith("r2:")
    ? String(row.objectKey).slice(3)
    : String(row.objectKey).replace(/^asset:\//, "");
  const local = join(root, "public", key);
  if (!existsSync(local)) {
    missing += 1;
    continue; // 여기에 사본이 없는 파일은 이 도구가 판단할 대상이 아니다
  }
  const bytes = readFileSync(local);
  const sha = createHash("sha256").update(bytes).digest("hex");

  // 상품 머리글이 읽는 자산 행. 파일을 올릴 필요는 없고 기록만 고치면 되는 경우가 있다.
  const asset = row.role === "entry" ? assetBySlug.get(String(row.slug)) : undefined;
  if (asset && String(asset.fileName) === String(row.fileName) && (asset.sha256 !== sha || Number(asset.byteLength) !== bytes.byteLength)) {
    assetFixes.push({ id: asset.id, slug: row.slug, bytes: bytes.byteLength, sha, was: Number(asset.byteLength) });
  }

  if (sha === row.sha256 && Number(row.byteLength) === bytes.byteLength) continue;
  stale.push({ ...row, key, local, bytes: bytes.byteLength, sha });
  console.log(
    `${String(row.slug).padEnd(26)} ${String(row.role).padEnd(8)} ${String(row.fileName).padEnd(38)}` +
      ` ${(Number(row.byteLength) / 1024).toFixed(1)}→${(bytes.byteLength / 1024).toFixed(1)}KB`,
  );
}

for (const fix of assetFixes) {
  console.log(`${String(fix.slug).padEnd(26)} 머리글   자산 행 길이 ${(fix.was / 1024).toFixed(1)}→${(fix.bytes / 1024).toFixed(1)}KB`);
}

console.log(
  `\n기록된 파일 ${rows.length}개 · 여기 사본 없음 ${missing}개 · 다른 것 ${stale.length}개` +
    ` · 머리글이 어긋난 상품 ${assetFixes.length}개`,
);
if (!stale.length && !assetFixes.length) {
  console.log("R2 와 여기가 같습니다.");
  process.exit(0);
}
if (!apply) {
  console.log("미리보기입니다. 올리려면 --apply 를 붙이세요.");
  process.exit(0);
}

for (const item of stale) {
  execFileSync(
    "npx",
    [
      "wrangler", "r2", "object", "put", `${BUCKET}/${item.key}`,
      "--file", item.local,
      "--content-type", item.contentType || "application/octet-stream",
      "--remote",
    ],
    { cwd: root, stdio: "pipe", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 },
  );
  await query(`UPDATE clunk_asset_artifacts SET byte_length = ${item.bytes}, sha256 = '${item.sha}' WHERE id = '${item.id}'`);
  console.log(`  올림 ${item.key}`);
}
for (const fix of assetFixes) {
  await query(`UPDATE clunk_assets SET byte_length = ${fix.bytes}, sha256 = '${fix.sha}' WHERE id = '${fix.id}'`);
  console.log(`  머리글 고침 ${fix.slug}`);
}
console.log(`파일 ${stale.length}개를 올리고, 기록 ${stale.length + assetFixes.length}건을 고쳤습니다.`);
