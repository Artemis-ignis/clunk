/** Copy the 2D deliverables and compose every hero render into one contact sheet. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharpModule from 'sharp';

// sharp ships `export = sharp` CommonJS declarations, and this repo's tsconfig
// pins `types` to @cloudflare/workers-types, so the shipped namespace does not
// survive into a .mts module (`sharp is of type unknown`). Rather than widen
// the repo's compiler options for one script, the four calls this file makes
// are described here.
interface SharpImage {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(width: number, height: number): SharpImage;
  png(): SharpImage;
  composite(items: readonly { input: Buffer; left: number; top: number }[]): SharpImage;
  toBuffer(): Promise<Buffer>;
  toFile(destination: string): Promise<unknown>;
}
interface SharpCreate {
  create: { width: number; height: number; channels: 3; background: { r: number; g: number; b: number } };
}
const sharp = sharpModule as unknown as (input: string | Buffer | SharpCreate) => SharpImage;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HF = path.resolve(HERE, '../../../Harvest Frontier');
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const TWO_D = path.join(OUT, '2d');

fs.mkdirSync(TWO_D, { recursive: true });
const copied: { file: string; bytes: number; width?: number; height?: number }[] = [];
const sources = [
  ...fs.readdirSync(path.join(HF, 'public/assets/portraits')).map((f) => path.join(HF, 'public/assets/portraits', f)),
  path.join(HF, 'public/assets/textures/plaster-wall.png'),
  path.join(HF, 'public/assets/textures/ridge-woodland.png'),
];
for (const source of sources) {
  const target = path.join(TWO_D, path.basename(source));
  fs.copyFileSync(source, target);
  const meta = await sharp(target).metadata();
  copied.push({ file: `2d/${path.basename(source)}`, bytes: fs.statSync(target).size, width: meta.width, height: meta.height });
}
fs.writeFileSync(path.join(TWO_D, 'index.json'), JSON.stringify(copied, null, 2));
process.stdout.write(`${copied.length} 2D files copied\n`);

// ── contact sheet ───────────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')) as { assets: { group: string; slug: string; render: string | null }[] };
const cells = manifest.assets.filter((a) => a.render);
const CELL = 256;
const LABEL = 26;
const COLS = 6;
const rows = Math.ceil(cells.length / COLS);
const width = COLS * CELL;
const height = rows * (CELL + LABEL);

const composites: { input: Buffer; left: number; top: number }[] = [];
for (let i = 0; i < cells.length; i += 1) {
  const cell = cells[i]!;
  const x = (i % COLS) * CELL;
  const y = Math.floor(i / COLS) * (CELL + LABEL);
  composites.push({
    input: await sharp(path.join(OUT, cell.render!)).resize(CELL, CELL).png().toBuffer(),
    left: x, top: y,
  });
  const label = `${cell.group}/${cell.slug}`;
  const svg = `<svg width="${CELL}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CELL}" height="${LABEL}" fill="#1d1d1f"/>
    <text x="${CELL / 2}" y="${LABEL / 2 + 5}" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#f2f2f2" text-anchor="middle">${label}</text>
  </svg>`;
  composites.push({ input: Buffer.from(svg), left: x, top: y + CELL });
}

const sheet = path.join(OUT, 'contact-sheet.png');
await sharp({ create: { width, height, channels: 3, background: { r: 236, g: 236, b: 236 } } })
  .composite(composites)
  .png()
  .toFile(sheet);
process.stdout.write(`contact sheet ${width}x${height} -> ${sheet} (${fs.statSync(sheet).size} B)\n`);
