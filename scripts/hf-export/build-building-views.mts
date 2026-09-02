/**
 * Four-direction inspection renders of the two buildings.
 *
 * hero-render.mjs already exposes HERO_VIEW_DIR (line 45-48), so the camera can
 * be moved without touching or copying the renderer.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeRows, HERO_RENDER, SCRATCH } from './strip-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../examples/harvest-frontier/exports');
const VIEWS: { name: string; dir: string; label: string }[] = [
  { name: '3q-front', dir: '0.78,0.5,0.92', label: 'three-quarter front (the storefront hero angle)' },
  { name: '3q-rear', dir: '-0.78,0.5,-0.92', label: 'three-quarter rear' },
  { name: 'front-low', dir: '0.10,0.17,1.0', label: 'front, near eye level' },
  { name: 'top', dir: '0.30,1.55,0.36', label: 'from above (the angle the dark tiles read worst at)' },
];

const index: Record<string, string> = {};
for (const slug of ['farmhouse', 'barn']) {
  const glb = path.join(OUT, 'building', `${slug}.m1.glb`);
  const rows: { label: string; png: string }[] = [];
  for (const view of VIEWS) {
    const png = path.join(SCRATCH, `${slug}-${view.name}.png`);
    fs.mkdirSync(path.dirname(png), { recursive: true });
    execFileSync(process.execPath, [HERO_RENDER, glb, png], { stdio: 'ignore', env: { ...process.env, HERO_VIEW_DIR: view.dir } });
    rows.push({ label: `${slug} / ${view.name} / ${view.label}`, png });
  }
  const out = path.join(OUT, 'render', `${slug}-4views.png`);
  await composeRows(rows, out, 1100);
  index[slug] = path.relative(OUT, out).split(path.sep).join('/');
  process.stdout.write(`${index[slug]}\n`);
}
fs.writeFileSync(path.join(OUT, 'render', 'building-views.json'), JSON.stringify({ builtAt: new Date().toISOString(), views: VIEWS, images: index }, null, 2));
