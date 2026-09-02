#!/usr/bin/env node
/**
 * Renders the link preview card.
 *
 * The card it replaces said MAKE EVERY ASSET DEFENSIBLE / GAME ASSETOPS / PRIVATE PILOT,
 * in English, over a diagram — on a Korean product with no pilot programme and no
 * customers. It was the most-shared surface we have and it showed nothing we sell.
 *
 * This one is built from the shop: the headline the landing page carries, and four
 * renders of listings that are actually on sale. Every asset here is read from
 * public/market, so a product leaving the catalogue takes its tile with it rather than
 * leaving the card advertising something that is gone.
 *
 * Usage: node scripts/render-og.mjs [--out public/og.png]
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith("--")) args.set(process.argv[i].slice(2), process.argv[i + 1]);
}
const outPath = resolve(root, args.get("out") ?? "public/og.png");

const WIDTH = 1200;
const HEIGHT = 630;

/** Four listings, named by the file the shop already serves for each. */
const TILES = [
  "market/cozy-market-stall/preview-cozy-market-stall.webp",
  "market/cozy-greenhouse/preview-cozy-greenhouse.webp",
  "market/grove-tree-pack-vol1/preview-grove-tree-pack-vol1.webp",
  "market/cozy-crate-produce/preview-cozy-crate-produce.webp",
];

const fallbacks = [
  "landing/showcase/market-stall.webp",
  "landing/showcase/greenhouse.webp",
  "landing/showcase/broadleaf-full.webp",
  "landing/showcase/crate-produce.webp",
];

function tilePath(index) {
  const primary = join(root, "public", TILES[index]);
  if (existsSync(primary)) return primary;
  const fallback = join(root, "public", fallbacks[index]);
  if (existsSync(fallback)) return fallback;
  throw new Error(`No image on disk for tile ${index}: neither ${TILES[index]} nor ${fallbacks[index]}`);
}

// Korean is set with an explicit font stack because librsvg resolves through fontconfig,
// which has no Pretendard on a plain Windows box; Malgun Gothic is the face that is
// actually installed, and naming it keeps the card from falling back to a serif.
const KO = "Malgun Gothic, Apple SD Gothic Neo, sans-serif";

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="0.78" cy="0.28" r="0.72">
      <stop offset="0%" stop-color="#7c5dfa" stop-opacity="0.34"/>
      <stop offset="55%" stop-color="#5a78fa" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#0a0b14" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#7cc4ff"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0b14"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <text x="72" y="96" font-family="${KO}" font-size="30" font-weight="700" fill="#ffffff" letter-spacing="1">Clunk</text>

  <!-- 54px, not 62: the first line is the longest and has to clear the tile column at
       x=738. Measured, not guessed — at 62 it ran under the market stall. -->
  <text x="72" y="232" font-family="${KO}" font-size="54" font-weight="800" fill="#f2f4ff">게임 에셋의 모든 과정을</text>
  <text x="72" y="302" font-family="${KO}" font-size="54" font-weight="800" fill="url(#ink)">Clunk 하나로</text>

  <text x="72" y="378" font-family="${KO}" font-size="25" fill="#a8adc4">에셋을 만들고, 게임에 넣어도 되는지 확인하고,</text>
  <text x="72" y="414" font-family="${KO}" font-size="25" fill="#a8adc4">바로 받아서 씁니다.</text>

  <text x="72" y="522" font-family="${KO}" font-size="19" font-weight="600" fill="#7c8199">저폴리 3D 모델 · 스프라이트 시트 · 심리스 텍스처</text>
  <line x1="72" y1="552" x2="1128" y2="552" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
  <text x="72" y="588" font-family="${KO}" font-size="18" fill="#6b7089">clunk.games</text>
</svg>`;

const TILE = 156;
const GAP = 18;
const ORIGIN_X = 738;
const ORIGIN_Y = 150;

const tiles = await Promise.all(TILES.map(async (_, index) => {
  const image = await sharp(tilePath(index)).resize(TILE, TILE, { fit: "cover" }).png().toBuffer();
  // A rounded plate behind each render, so a tile with a pale background does not read as
  // a white rectangle floating on the dark card.
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">`
    + `<rect width="${TILE}" height="${TILE}" rx="18" ry="18" fill="#ffffff"/></svg>`,
  );
  const rounded = await sharp(image)
    .composite([{ input: plate, blend: "dest-in" }])
    .png()
    .toBuffer();
  return {
    input: rounded,
    left: ORIGIN_X + (index % 2) * (TILE + GAP),
    top: ORIGIN_Y + Math.floor(index / 2) * (TILE + GAP),
  };
}));

const png = await sharp(Buffer.from(background)).composite(tiles).png().toBuffer();
await sharp(png).toFile(outPath);

const meta = await sharp(outPath).metadata();
process.stdout.write(`${JSON.stringify({
  out: outPath,
  size: `${meta.width}x${meta.height}`,
  bytes: png.length,
  tiles: TILES.map((_, i) => tilePath(i).replace(join(root, "public"), "").replaceAll("\\", "/")),
}, null, 2)}\n`);
