#!/usr/bin/env node
/**
 * Measures the tile products the shop ships and writes what it measured into
 * app/data/texture-seam-measurements.json, which is where the product page's
 * "이음매 좌우 ×n · 상하 ×n" row and its seamless flag come from.
 *
 * The measurement is the catalogue audit's own, transcribed: the wrap-edge mean
 * |Δ| per channel divided by the same measure one pixel in from the tile's middle
 * (1.0 = the join cannot be told from the interior), plus the mean |Laplacian| as
 * sharpness. Keeping it in one file means the page can never claim a tile is
 * seamless while the file on disk measures otherwise — run this, and the claim is
 * whatever the bytes say.
 *
 * The repair that produced the current tiles (offset-and-heal quilting, the
 * low-frequency flatten, the mixable variants and the derived normal/roughness
 * maps) lives in scripts/lib/texture/{heal,ops,variant,maps}.mjs.
 *
 * Usage:
 *   node scripts/texture-seam-cli.mjs                       # measure and rewrite the JSON
 *   node scripts/texture-seam-cli.mjs --check               # measure and fail if a tile broke the 1.15 bar
 *   node scripts/texture-seam-cli.mjs --print <file.png>    # one file, numbers only
 */
import fs from "node:fs";
import path from "node:path";
import { measureFile } from "./lib/texture/measure.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "app/data/texture-seam-measurements.json");
/** The bar the shop calls seamless. A tile above it may not claim the word. */
export const SEAMLESS_MAX = 1.15;

const printAt = process.argv.indexOf("--print");
if (printAt > -1) {
  for (const f of process.argv.slice(printAt + 1)) console.log(path.basename(f), JSON.stringify(await measureFile(f)));
  process.exit(0);
}

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { textures: {} };
const slugs = Object.keys(existing.textures).filter((s) => s.startsWith("tex-"));
let worst = 0;
const rows = [];
for (const slug of slugs) {
  const dir = path.join(ROOT, "public/market", slug);
  const colours = fs.readdirSync(dir).filter((f) => /\.png$/.test(f) && !/-normal|-rough/.test(f));
  const per = [];
  for (const f of colours) per.push({ file: f, ...(await measureFile(path.join(dir, f))) });
  const lr = Math.max(...per.map((m) => m.seamRatioR));
  const tb = Math.max(...per.map((m) => m.seamRatioB));
  const sharp = Math.min(...per.map((m) => m.sharpness));
  worst = Math.max(worst, lr, tb);
  const t = existing.textures[slug];
  t.seamLeftRight = lr; t.seamTopBottom = tb; t.sharpness = sharp;
  t.seamless = Math.max(lr, tb) <= SEAMLESS_MAX;
  t.colourVariants = per.length;
  rows.push({ slug, lr, tb, sharp, seamless: t.seamless });
  console.log(`${slug.padEnd(24)} 좌우 ×${lr.toFixed(2)}  상하 ×${tb.toFixed(2)}  선명도 ${sharp}  ${t.seamless ? "이어붙음" : "!! 기준 초과"}`);
}
const bundle = existing.textures["verified-seamless-textures-vol1"];
if (bundle && rows.length) {
  bundle.seamLeftRight = Math.max(...rows.map((r) => r.lr));
  bundle.seamTopBottom = Math.max(...rows.map((r) => r.tb));
  bundle.sharpness = Math.min(...rows.map((r) => r.sharp));
  bundle.seamless = rows.every((r) => r.seamless);
  bundle.colourVariants = rows.reduce((s, r) => s + (existing.textures[r.slug].colourVariants ?? 1), 0);
}
existing.measuredAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n");
console.log(`\n최악 축 ×${worst.toFixed(2)} (기준 ${SEAMLESS_MAX} 이하) · ${OUT}`);
if (process.argv.includes("--check") && worst > SEAMLESS_MAX) process.exit(2);
