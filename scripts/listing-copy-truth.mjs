#!/usr/bin/env node
/**
 * 상품 설명문이 파일과 어긋나는지 본다.
 *
 * 사양 줄의 숫자는 파일에서 다시 재고 검사가 지킨다(tests/listing-facts-truth.test.mjs).
 * 설명문은 사람이 쓴 글이라 아무도 지키지 않는데, 같은 숫자가 두 곳에 있으면 파일이
 * 바뀔 때 한쪽만 뒤처진다. 2026-09-04 트랙터가 그랬다 — 사양 줄은 58,156, 설명문은
 * 39,320. 사는 사람은 한 화면에서 두 숫자를 같이 본다.
 *
 * 설명문은 D1 에 있어 저장소 검사로는 닿지 않는다. 그래서 명령으로 둔다. 상품 글을
 * 고치거나 파일을 바꾼 뒤에 돌린다.
 *
 * 사용: node scripts/listing-copy-truth.mjs
 * 필요: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1 = process.env.CLUNK_CF_D1_ID ?? "15b7bd6c-7677-4fe7-b882-5f80a272d6ea";
if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요합니다.");
  process.exit(2);
}

async function query(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${D1}/query`,
    { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ sql }) },
  );
  const payload = await response.json();
  if (!payload.success) throw new Error(`D1: ${JSON.stringify(payload.errors)}`);
  return payload.result[0].results;
}

const facts = JSON.parse(readFileSync(resolve(root, "app/data/listing-facts.json"), "utf8")).facts;
const rows = await query(
  "SELECT slug, description FROM clunk_marketplace_listings WHERE status = 'PUBLISHED' ORDER BY slug",
);

const problems = [];
for (const row of rows) {
  const fact = facts[row.slug];
  const text = String(row.description ?? "");
  if (!fact) continue;

  const triangles = text.match(/폴리곤 ([\d,]+)\s*개/);
  if (triangles && fact.triangles !== null) {
    const said = Number(triangles[1].replace(/,/g, ""));
    if (said !== fact.triangles) problems.push(`${row.slug}: 설명문 폴리곤 ${said.toLocaleString("ko-KR")} / 파일 ${fact.triangles.toLocaleString("ko-KR")}`);
  }
  const materials = text.match(/재질 (\d+)\s*개/);
  if (materials && fact.materials !== null && Number(materials[1]) !== fact.materials) {
    problems.push(`${row.slug}: 설명문 재질 ${materials[1]} / 파일 ${fact.materials}`);
  }
  // 그리기 횟수는 파는 화면에서 뺐다. 설명문에도 남으면 안 된다.
  if (/그리기\s*\d+\s*회/.test(text)) problems.push(`${row.slug}: 설명문에 그리기 횟수가 남아 있습니다`);

  // 색이 어디에 들어 있는지. 색표 그림으로 옮긴 파일에 "재질에 들어 있다"고 적혀 있으면
  // 사는 사람이 텍스처를 빼고 써도 된다고 읽는다.
  const colour = fact.engine?.colour;
  if (colour && /색(이|은)\s*재질에 들어 있/.test(text) && colour !== "material") {
    problems.push(`${row.slug}: 설명문은 색이 재질에 있다고 하는데 파일은 ${colour === "texture" ? "그림" : "정점"}에 들고 있습니다`);
  }
  if (colour === "vertex" && /텍스처 파일 없이 바로/.test(text)) {
    problems.push(`${row.slug}: 색이 정점에만 있는데 설명문은 바로 쓸 수 있다고 합니다`);
  }
}

console.log(`상품 ${rows.length}개를 봤습니다.`);
if (!problems.length) {
  console.log("설명문과 파일이 어긋나는 곳이 없습니다.");
  process.exit(0);
}
console.log(`\n어긋난 곳 ${problems.length}건:`);
for (const line of problems) console.log(`  ${line}`);
process.exit(1);
