/**
 * Frame-strip helpers.
 *
 * A "strip" is N poses of the same subject laid out along X inside ONE GLB and
 * rendered ONCE by the untouched wave-1 hero renderer. Putting the whole row in
 * a single file matters: the renderer auto-fits its camera to the subject, so
 * rendering frames separately would re-frame every frame and two rows could not
 * be compared. One file, one fit, one camera.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharpModule from 'sharp';
import { THREE, exportGlb } from './lib.mjs';

interface SharpImage {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(width: number, height: number): SharpImage;
  trim(options?: { threshold?: number }): SharpImage;
  extend(options: { top: number; bottom: number; left: number; right: number; background: { r: number; g: number; b: number } }): SharpImage;
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
const REPO = path.resolve(HERE, '../..');
export const HERO_RENDER = path.join(REPO, 'outputs/market-launch/wave1/tools/hero-render.mjs');
export const SCRATCH = process.env.HF_STRIP_SCRATCH
  ?? path.join(REPO, 'examples/harvest-frontier/exports/anim-strips/.work');

// hero-render.mjs fixes VIEW_DIR = [0.78, 0.5, 0.92]: the camera sits at that
// direction from the subject, i.e. at azimuth atan2(0.78, 0.92) = 40.3 deg
// measured from +Z toward +X, about 24 deg above the horizon. The renderer
// takes no camera argument and is not to be modified, so the SUBJECT is yawed
// instead. Yawing a model by phi turns its local -Z axis to
// (-sin phi, 0, -cos phi); setting that equal to the camera direction gives the
// front view, and a further -90 deg gives the side view.
const CAMERA_AZIMUTH = Math.atan2(0.78, 0.92);

/**
 * Yaw that turns a subject whose forward vector is `(fx, fz)` to face the
 * renderer's camera. Yawing by phi adds phi to a vector's atan2(x, z) angle, so
 * the answer is simply the camera's azimuth minus the subject's.
 */
export function yawForFront(fx: number, fz: number): number {
  return CAMERA_AZIMUTH - Math.atan2(fx, fz);
}

export const VIEW_YAW = {
  front: yawForFront(0, -1),
  side: yawForFront(0, -1) - Math.PI / 2,
} as const;
export type ViewName = keyof typeof VIEW_YAW;

/**
 * Lay posed subjects out in a row and write a strip GLB.
 *
 * Each SUBJECT is yawed for the requested view; the ROW itself is laid along the
 * world direction perpendicular to the camera. Yawing the row instead would
 * swing it into the camera's depth axis on the side view and stack the frames
 * on top of one another instead of spreading them across the frame.
 */
export async function writeStripGlb(poses: readonly THREE.Object3D[], view: ViewName, spacing: number, file: string): Promise<void> {
  const row = new THREE.Group();
  row.name = 'strip';
  // Camera direction (0.78, _, 0.92) normalised in the ground plane, turned 90 deg.
  const camX = 0.78 / Math.hypot(0.78, 0.92);
  const camZ = 0.92 / Math.hypot(0.78, 0.92);
  poses.forEach((pose, index) => {
    const holder = new THREE.Group();
    holder.name = `frame${index}`;
    holder.position.set(index * spacing * camZ, 0, index * spacing * -camX);
    pose.rotation.y += VIEW_YAW[view];
    holder.add(pose);
    row.add(holder);
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await exportGlb(row, []));
}

/** Render a strip GLB with the untouched wave-1 renderer, then trim its margins. */
export function renderStrip(glb: string, png: string): void {
  fs.mkdirSync(path.dirname(png), { recursive: true });
  execFileSync(process.execPath, [HERO_RENDER, glb, png], { stdio: 'ignore' });
}

export interface StripRow { label: string; png: string }

/** Stack labelled rows into one image. */
export async function composeRows(rows: readonly StripRow[], out: string, width = 1400): Promise<void> {
  const LABEL = 30;
  const tiles: { buffer: Buffer; height: number; label: string }[] = [];
  for (const row of rows) {
    const trimmed = await sharp(row.png).trim({ threshold: 4 }).png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const scale = width / (meta.width ?? width);
    const height = Math.max(1, Math.round((meta.height ?? 1) * scale));
    tiles.push({ buffer: await sharp(trimmed).resize(width, height).png().toBuffer(), height, label: row.label });
  }
  const total = tiles.reduce((sum, t) => sum + t.height + LABEL, 0);
  const composites: { input: Buffer; left: number; top: number }[] = [];
  let top = 0;
  for (const tile of tiles) {
    const svg = `<svg width="${width}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect width="${width}" height="${LABEL}" fill="#1d1d1f"/>`
      + `<text x="12" y="${LABEL / 2 + 5}" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#f2f2f2">${tile.label}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: 0, top });
    composites.push({ input: tile.buffer, left: 0, top: top + LABEL });
    top += LABEL + tile.height;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width, height: total, channels: 3, background: { r: 236, g: 236, b: 236 } } })
    .composite(composites)
    .png()
    .toFile(out);
}

export function cleanScratch(): void {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
}
