import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
const m = JSON.parse(readFileSync("outputs/market-launch/wave1/upload-manifest.json", "utf8"));
const W = 480, H = 360, COLS = 4;
const items = [];
for (const p of m.products) {
  const hero = `outputs/market-launch/wave1/hero/hero-${p.slug}.png`;
  const prev = `outputs/market-launch/wave1/preview/preview-${p.slug}.webp`;
  const src = existsSync(hero) ? hero : existsSync(prev) ? prev : null;
  if (!src) { console.log("no image:", p.slug); continue; }
  items.push({ slug: p.slug, title: p.title, src });
}
const rows = Math.ceil(items.length / COLS);
const tiles = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const img = await sharp(it.src).resize(W, H - 40, { fit: "contain", background: "#0b0d16" }).png().toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="40"><rect width="100%" height="100%" fill="#151a2b"/><text x="10" y="26" font-family="Malgun Gothic, sans-serif" font-size="16" fill="#e8ecf8">${i + 1}. ${it.title.replace(/&/g, "&amp;")}</text></svg>`);
  const tile = await sharp({ create: { width: W, height: H, channels: 4, background: "#0b0d16" } }).composite([{ input: img, top: 0, left: 0 }, { input: label, top: H - 40, left: 0 }]).png().toBuffer();
  tiles.push({ input: tile, left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
}
await sharp({ create: { width: W * COLS, height: H * rows, channels: 4, background: "#000" } }).composite(tiles).png().toFile(process.argv[2]);
console.log("tiles:", items.length, items.map((x, i) => `${i + 1}:${x.slug}`).join(" "));
