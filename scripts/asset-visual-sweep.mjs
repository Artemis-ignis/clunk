#!/usr/bin/env node
/**
 * 파는 3D 파일 전부를 여러 각도에서 렌더해 한 장짜리 대조표로 묶는다.
 *
 * 왜 필요한가. 2026-09-04 마스터가 첫 화면 트랙터의 앞바퀴가 공중에 떠 있는 것을 눈으로
 * 찾았다. 그때 형상 감사(scripts/asset-geometry-audit.mjs)는 그 트랙터를 "이상 없음"
 * 으로 통과시키고 있었다. 그 감사는 부품이 서로 뚫는지와 아무 데도 안 닿는지만 재는데,
 * 바퀴는 축의 상자와 겹쳐 있었기 때문이다 — 겹쳐 있으면서 눈에는 떨어져 보이는 것을
 * 재는 항목이 없었다.
 *
 * 숫자로 재는 검사는 무엇을 잴지 미리 정한 것만 잡는다. 어색한 것은 대부분 미리 정해
 * 두지 않은 종류로 나타난다. 그래서 이 도구는 판정하지 않는다 — 사람이(또는 사람 대신
 * 보는 쪽이) 실제로 볼 수 있게 그림을 만들어 놓는 것이 전부다.
 *
 * 각도는 여섯. 그중 "낮은 앞"은 지면 가까이에서 보는 시선이라 바닥에서 뜬 부품이
 * 가장 잘 드러난다.
 *
 * 사용:
 *   node scripts/asset-visual-sweep.mjs              전부
 *   node scripts/asset-visual-sweep.mjs hf-tractor-compact   하나만
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const OUT = resolve(root, "outputs/visual-sweep");
const WORK = resolve(root, "tmp/visual-sweep");
const RENDERER = resolve(root, "outputs/market-launch/wave1/tools/hero-render.mjs");

/** 각도 여섯. 이름은 대조표에 그대로 적힌다. */
const VIEWS = [
  { id: "front", label: "앞", dir: "0,0.22,1" },
  { id: "low", label: "낮은 앞", dir: "0,0.06,1" },
  { id: "right", label: "오른쪽", dir: "1,0.22,0" },
  { id: "back", label: "뒤", dir: "0,0.22,-1" },
  { id: "three-quarter", label: "3/4", dir: "0.78,0.5,0.92" },
  { id: "top", label: "위", dir: "0.25,1,0.35" },
];

const CELL = 420;
const PAD = 10;
const LABEL = 26;

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });

/** 상품마다 파는 파일 하나. 폴더에 여러 개면 상품 이름을 단 것이 대표다. */
function entryOf(slug) {
  let names;
  try {
    names = readdirSync(resolve(root, "public/market", slug)).filter((n) => n.toLowerCase().endsWith(".glb"));
  } catch {
    return null;
  }
  if (!names.length) return null;
  const named = names.find((n) => n.replace(/\.[^.]+$/, "") === slug);
  return resolve(root, "public/market", slug, named ?? names[0]);
}

const slugs = readdirSync(resolve(root, "public/market"))
  .filter((slug) => (only.length ? only.includes(slug) : true))
  .filter((slug) => {
    try {
      return statSync(resolve(root, "public/market", slug)).isDirectory() && entryOf(slug);
    } catch {
      return false;
    }
  })
  .sort();

const rows = [];
for (const slug of slugs) {
  const entry = entryOf(slug);
  const tiles = [];
  for (const view of VIEWS) {
    const png = resolve(WORK, `${slug}__${view.id}.png`);
    try {
      execFileSync("node", [RENDERER, entry, png], {
        env: { ...process.env, HERO_VIEW_DIR: view.dir },
        stdio: "pipe",
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (error) {
      rows.push({ slug, note: `${view.label} 렌더 실패: ${String(error.message).slice(0, 60)}` });
      continue;
    }
    tiles.push({ view, png });
  }
  if (!tiles.length) continue;

  // 3 × 2 로 붙이고 각 칸 위에 각도 이름을 적는다.
  const cols = 3;
  const rowsOfTiles = Math.ceil(tiles.length / cols);
  const width = cols * CELL + (cols + 1) * PAD;
  const height = rowsOfTiles * (CELL + LABEL) + (rowsOfTiles + 1) * PAD;
  const composites = [];
  for (const [i, tile] of tiles.entries()) {
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const left = PAD + cx * (CELL + PAD);
    const top = PAD + cy * (CELL + LABEL + PAD);
    composites.push({
      input: await sharp(tile.png).resize(CELL, CELL, { fit: "contain", background: "#ececec" }).png().toBuffer(),
      left,
      top: top + LABEL,
    });
    composites.push({
      input: Buffer.from(
        `<svg width="${CELL}" height="${LABEL}"><text x="4" y="18" font-family="sans-serif" font-size="15" fill="#333">${view_label(tile)}</text></svg>`,
      ),
      left,
      top,
    });
  }
  const sheet = resolve(OUT, `${slug}.png`);
  await sharp({ create: { width, height, channels: 4, background: "#ffffff" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(sheet);
  rows.push({ slug, sheet, views: tiles.length });
  console.log(`${slug.padEnd(28)} ${tiles.length}각도 → ${sheet.replace(`${root}\\`, "").replace(`${root}/`, "")}`);
}

function view_label(tile) {
  return `${tile.view.label}`;
}

rmSync(WORK, { recursive: true, force: true });
const failed = rows.filter((r) => r.note);
console.log(`\n상품 ${rows.filter((r) => r.sheet).length}개 대조표 · 실패 ${failed.length}건`);
for (const f of failed) console.log(`  ${f.slug}: ${f.note}`);
