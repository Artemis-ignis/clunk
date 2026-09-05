/*
 * Deterministic software rasteriser.
 *
 * The z-buffer, the flat warm-key / cool-sky shading, the COLOR_0 handling and the soft contact
 * shadow are the ones the storefront hero renders already use
 * (outputs/market-launch/wave1/tools/hero-render.mjs, itself derived from
 * examples/generated/hf-wave2/preview.mjs), so a capture made here and a capture made there are
 * the same picture of the same asset. Three things are new: non-square frames, a fixed player
 * camera that does not reframe, and a footprint mask that makes "is it standing on the floor"
 * measurable rather than a matter of opinion.
 *
 * There is no PBR, no image-based lighting, no reflections, no ray-traced shadow and no ambient
 * occlusion beyond the contact shadow. Nothing here is a GPU engine screenshot, and the evidence
 * this file feeds says so in its own renderer block.
 */

import type { CameraPose, CaptureViewSpec, RasterResult, SceneBounds, Vec3, VisualScene } from "./types";

const BACKGROUND: readonly [number, number, number] = [0xe9, 0xe6, 0xe0];
const KEY: Vec3 = [1.0, 0.94, 0.84];
const SKY: Vec3 = [0.62, 0.72, 0.82];
const AMBIENT = 0.2;
const SHADOW_STRENGTH = 0.3;
const SHADOW_BLUR = 0.022;
const SHADOW_FALLOFF = 0.55;

/**
 * The floor is y = 0, not the asset's own lowest point.
 *
 * This is the whole difference between a picture that flatters an asset and a picture that tells
 * you something. An engine drops a prop at the origin; if the geometry was authored half a metre
 * up, the prop hovers. Shading the shadow onto the asset's own minimum would hide exactly that,
 * because every asset touches its own minimum by definition. Every catalogue file measured on
 * 2026-09-05 (crate, tractor, H145) is authored with min y = 0.0000, so this reference costs
 * a correct asset nothing and shows an incorrect one immediately.
 */
export const FLOOR_Y = 0;

export const RASTER_BACKGROUND = BACKGROUND;

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

const KEY_DIR: Vec3 = normalise([0.52, 0.74, 0.42]);

export interface RenderInput {
  scene: VisualScene;
  bounds: SceneBounds;
  view: CaptureViewSpec;
  /**
   * Solve the orbit framing over these scenes instead of the one being drawn.
   *
   * Motion phases are the reason this exists. An orbit view reframes to fill 88 % of the frame,
   * so three poses of the same character each get their own solve and a pose that moves the
   * silhouette is partly cancelled by the camera pulling back to fit it — worst on a clip that
   * translates the whole rig, where the frames come out nearly identical. Passing every phase
   * here solves one framing over all of them and reuses it, so what changes between the frames is
   * the asset. Left undefined the framing is solved per frame, which is what a single still
   * capture and every rigid clip captured before 2026-09-05 do.
   */
  framingScenes?: readonly VisualScene[];
}

export interface RenderOutput extends RasterResult {
  pose: CameraPose;
}

/**
 * Places the camera for one view.
 *
 * An orbit view sits on a unit direction at a distance that comfortably contains the subject; the
 * exact framing is then solved after projection. A player view is the opposite: eye height and
 * ground distance are fixed by the spec, because the question that view answers is how big the
 * asset actually is when somebody walks up to it.
 */
export function placeCamera(view: CaptureViewSpec, bounds: SceneBounds): CameraPose {
  const centre: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const size: Vec3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const radius = Math.hypot(size[0], size[1], size[2]) / 2 || 1;
  if (view.kind === "orbit") {
    const direction = normalise(view.direction ?? [0.78, 0.5, 0.92]);
    return {
      eye: [
        centre[0] + direction[0] * radius * 3.1,
        centre[1] + direction[1] * radius * 3.1,
        centre[2] + direction[2] * radius * 3.1,
      ],
      target: centre,
      fovYDeg: view.fovYDeg,
    };
  }
  const distance = view.distanceMetres ?? 5;
  const height = view.eyeHeightMetres ?? 1.6;
  // The player stands on the +Z side, on the floor plane, and looks at the subject's centre.
  return {
    eye: [centre[0], FLOOR_Y + height, centre[2] + distance],
    target: centre,
    fovYDeg: view.fovYDeg,
  };
}

class Projector {
  focal: number;
  shiftX = 0;
  shiftY = 0;
  private readonly eye: Vec3;
  private readonly forward: Vec3;
  private readonly right: Vec3;
  private readonly up: Vec3;
  private readonly halfReference: number;
  private readonly width: number;
  private readonly height: number;

  constructor(pose: CameraPose, width: number, height: number) {
    this.eye = pose.eye;
    this.forward = normalise([pose.target[0] - pose.eye[0], pose.target[1] - pose.eye[1], pose.target[2] - pose.eye[2]]);
    let right = cross(this.forward, [0, 1, 0]);
    if (Math.hypot(right[0], right[1], right[2]) < 1e-6) right = cross(this.forward, [0, 0, 1]);
    this.right = normalise(right);
    this.up = normalise(cross(this.right, this.forward));
    this.focal = 1 / Math.tan((pose.fovYDeg * Math.PI) / 360);
    this.width = width;
    this.height = height;
    this.halfReference = 0.5 * height;
  }

  project(x: number, y: number, z: number): { x: number; y: number; depth: number } | null {
    const dx = x - this.eye[0];
    const dy = y - this.eye[1];
    const dz = z - this.eye[2];
    const depth = dx * this.forward[0] + dy * this.forward[1] + dz * this.forward[2];
    if (depth < 0.01) return null;
    const u = dx * this.right[0] + dy * this.right[1] + dz * this.right[2];
    const v = dx * this.up[0] + dy * this.up[1] + dz * this.up[2];
    return {
      x: ((this.focal * u) / depth) * this.halfReference + this.width / 2 + this.shiftX,
      y: -((this.focal * v) / depth) * this.halfReference + this.height / 2 + this.shiftY,
      depth,
    };
  }

  /** The world point a pixel is looking at, given the depth the z-buffer recorded for it. */
  unproject(sx: number, sy: number, depth: number): Vec3 {
    const u = ((sx - this.width / 2 - this.shiftX) * depth) / (this.focal * this.halfReference);
    const v = (-(sy - this.height / 2 - this.shiftY) * depth) / (this.focal * this.halfReference);
    return [
      this.eye[0] + this.forward[0] * depth + this.right[0] * u + this.up[0] * v,
      this.eye[1] + this.forward[1] * depth + this.right[1] * u + this.up[1] * v,
      this.eye[2] + this.forward[2] * depth + this.right[2] * u + this.up[2] * v,
    ];
  }
}

/**
 * Solves the framing for an orbit view. Screen offset from the frame centre is exactly linear in
 * the focal length, so one measurement of the projected bounding box is enough to compute the
 * focal length and principal-point shift that put the subject at a chosen size, centred. No
 * iteration and no guess — the same solve the storefront hero render uses.
 */
function fitOrbitCamera(projector: Projector, scenes: readonly VisualScene[], width: number, height: number, targetFill: number): void {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const scene of scenes) {
    const positions = scene.positions;
    const limit = scene.triangleCount * 9;
    for (let i = 0; i < limit; i += 3) {
      const p = projector.project(positions[i], positions[i + 1], positions[i + 2]);
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
  const extent = Math.max(maxX - minX, maxY - minY);
  if (extent <= 0) return;
  const scale = (targetFill * Math.min(width, height)) / extent;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  projector.focal *= scale;
  projector.shiftX = -(cx - width / 2) * scale;
  projector.shiftY = -(cy - height / 2) * scale;
}

/** Separable box blur with a running sum: O(pixels) regardless of radius. */
function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(width * height);
  const dst = new Float32Array(width * height);
  const windowSize = radius * 2 + 1;
  const clampX = (value: number) => Math.min(width - 1, Math.max(0, value));
  const clampY = (value: number) => Math.min(height - 1, Math.max(0, value));
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) sum += src[row + clampX(x)];
    for (let x = 0; x < width; x += 1) {
      tmp[row + x] = sum / windowSize;
      sum -= src[row + clampX(x - radius)];
      sum += src[row + clampX(x + radius + 1)];
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) sum += tmp[clampY(y) * width + x];
    for (let y = 0; y < height; y += 1) {
      dst[y * width + x] = sum / windowSize;
      sum -= tmp[clampY(y - radius) * width + x];
      sum += tmp[clampY(y + radius + 1) * width + x];
    }
  }
  return dst;
}

interface Tri2D { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number }

function rasteriseMask(mask: Float32Array, width: number, height: number, tri: Tri2D, weight: number): void {
  const area = (tri.x1 - tri.x0) * (tri.y2 - tri.y0) - (tri.x2 - tri.x0) * (tri.y1 - tri.y0);
  if (area === 0) return;
  const minX = Math.max(0, Math.floor(Math.min(tri.x0, tri.x1, tri.x2)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(tri.x0, tri.x1, tri.x2)));
  const minY = Math.max(0, Math.floor(Math.min(tri.y0, tri.y1, tri.y2)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(tri.y0, tri.y1, tri.y2)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((tri.x1 - px) * (tri.y2 - py) - (tri.x2 - px) * (tri.y1 - py)) / area;
      const w1 = ((tri.x2 - px) * (tri.y0 - py) - (tri.x0 - px) * (tri.y2 - py)) / area;
      const w2 = ((tri.x0 - px) * (tri.y1 - py) - (tri.x1 - px) * (tri.y0 - py)) / area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const offset = y * width + x;
      if (weight > mask[offset]) mask[offset] = weight;
    }
  }
}

/**
 * How much daylight there is under the asset, measured exactly rather than guessed.
 *
 * For every column the lowest drawn pixel is taken, its world position is read back out of the
 * z-buffer, and the floor point directly beneath that world position — same x, same z, at the
 * asset's own lowest y — is projected. The distance between the two rows is the empty band a
 * player would see under that part of the asset.
 *
 * Reading the depth back is what makes this trustworthy on a long object. Comparing against a
 * projected floor rectangle instead is wrong: on a 13 m helicopter seen from eye level the near
 * and far edges of that rectangle land 40 rows apart, so the answer would depend on which edge
 * was picked rather than on the asset.
 */
function measureGroundGaps(
  projector: Projector,
  coverage: Uint8Array,
  depth: Float64Array,
  width: number,
  height: number,
): Float32Array {
  const gaps = new Float32Array(width).fill(Number.NaN);
  const floorY = FLOOR_Y;
  for (let x = 0; x < width; x += 1) {
    let bottom = -1;
    for (let y = height - 1; y >= 0; y -= 1) {
      if (coverage[y * width + x]) { bottom = y; break; }
    }
    if (bottom < 0) continue;
    const world = projector.unproject(x + 0.5, bottom + 0.5, depth[bottom * width + x]);
    const floor = projector.project(world[0], floorY, world[2]);
    if (!floor) continue;
    gaps[x] = Math.max(0, floor.y - (bottom + 0.5));
  }
  return gaps;
}

export function renderView(input: RenderInput): RenderOutput {
  const { scene, bounds, view } = input;
  const ss = Math.max(1, Math.round(view.supersample));
  const W = view.width * ss;
  const H = view.height * ss;
  const pose = placeCamera(view, bounds);
  const projector = new Projector(pose, W, H);
  if (view.kind === "orbit") {
    fitOrbitCamera(projector, input.framingScenes ?? [scene], W, H, view.targetFill ?? 0.88);
  }

  const positions = scene.positions;
  const colors = scene.colors;
  const triangleCount = scene.triangleCount;

  // --- contact shadow ---------------------------------------------------------------------
  let shadow: Float32Array | null = null;
  if (view.shadow) {
    const groundY = FLOOR_Y;
    const modelHeight = Math.max(bounds.max[1] - groundY, 1e-6);
    let mask: Float32Array = new Float32Array(W * H);
    for (let t = 0; t < triangleCount; t += 1) {
      const o = t * 9;
      const meanY = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
      const normalised = (meanY - groundY) / (modelHeight * SHADOW_FALLOFF);
      if (normalised >= 1) continue;
      const weight = (1 - normalised) ** 1.5;
      const p0 = projector.project(positions[o], groundY, positions[o + 2]);
      const p1 = projector.project(positions[o + 3], groundY, positions[o + 5]);
      const p2 = projector.project(positions[o + 6], groundY, positions[o + 8]);
      if (!p0 || !p1 || !p2) continue;
      rasteriseMask(mask, W, H, { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, weight);
    }
    const blurRadius = Math.max(1, Math.round(SHADOW_BLUR * Math.max(W, H)));
    for (let pass = 0; pass < 3; pass += 1) mask = boxBlur(mask, W, H, blurRadius);
    shadow = mask;
  }

  // --- raster -----------------------------------------------------------------------------
  const pixels = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i += 1) {
    const attenuation = shadow ? 1 - Math.min(1, shadow[i]) * SHADOW_STRENGTH : 1;
    pixels[i * 3] = BACKGROUND[0] * attenuation;
    pixels[i * 3 + 1] = BACKGROUND[1] * attenuation;
    pixels[i * 3 + 2] = BACKGROUND[2] * attenuation;
  }
  const depth = new Float64Array(W * H).fill(Infinity);
  const coverage = new Uint8Array(W * H);
  let drawnTriangleCount = 0;

  for (let t = 0; t < triangleCount; t += 1) {
    const o = t * 9;
    const p0 = projector.project(positions[o], positions[o + 1], positions[o + 2]);
    const p1 = projector.project(positions[o + 3], positions[o + 4], positions[o + 5]);
    const p2 = projector.project(positions[o + 6], positions[o + 7], positions[o + 8]);
    if (!p0 || !p1 || !p2) continue;
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (area === 0) continue;
    drawnTriangleCount += 1;

    const abx = positions[o + 3] - positions[o];
    const aby = positions[o + 4] - positions[o + 1];
    const abz = positions[o + 5] - positions[o + 2];
    const acx = positions[o + 6] - positions[o];
    const acy = positions[o + 7] - positions[o + 1];
    const acz = positions[o + 8] - positions[o + 2];
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const ex = pose.eye[0] - positions[o];
    const ey = pose.eye[1] - positions[o + 1];
    const ez = pose.eye[2] - positions[o + 2];
    if (nx * ex + ny * ey + nz * ez < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const key = Math.max(0, nx * KEY_DIR[0] + ny * KEY_DIR[1] + nz * KEY_DIR[2]) * 0.82;
    const sky = (ny * 0.5 + 0.5) * 0.34;
    const c = t * 3;
    const r = Math.min(1, Math.max(0, colors[c] * (AMBIENT + key * KEY[0] + sky * SKY[0]))) ** (1 / 1.05) * 255;
    const g = Math.min(1, Math.max(0, colors[c + 1] * (AMBIENT + key * KEY[1] + sky * SKY[1]))) ** (1 / 1.05) * 255;
    const b = Math.min(1, Math.max(0, colors[c + 2] * (AMBIENT + key * KEY[2] + sky * SKY[2]))) ** (1 / 1.05) * 255;

    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
        const w2 = ((p0.x - px) * (p1.y - py) - (p1.x - px) * (p0.y - py)) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * p0.depth + w1 * p1.depth + w2 * p2.depth;
        const offset = y * W + x;
        if (z >= depth[offset]) continue;
        depth[offset] = z;
        coverage[offset] = 1;
        pixels[offset * 3] = r;
        pixels[offset * 3 + 1] = g;
        pixels[offset * 3 + 2] = b;
      }
    }
  }

  // --- silhouette measured at supersample resolution ---------------------------------------
  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;
  let covered = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!coverage[y * W + x]) continue;
      covered += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // --- downsample ---------------------------------------------------------------------------
  const outW = view.width;
  const outH = view.height;
  const rgb = new Uint8Array(outW * outH * 3);
  const alpha = new Float32Array(outW * outH);
  const inverse = 1 / (ss * ss);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        const row = (y * ss + sy) * W;
        for (let sx = 0; sx < ss; sx += 1) {
          const source = row + x * ss + sx;
          r += pixels[source * 3];
          g += pixels[source * 3 + 1];
          b += pixels[source * 3 + 2];
          a += coverage[source];
        }
      }
      const offset = (y * outW + x) * 3;
      rgb[offset] = Math.round(Math.min(255, Math.max(0, r * inverse)));
      rgb[offset + 1] = Math.round(Math.min(255, Math.max(0, g * inverse)));
      rgb[offset + 2] = Math.round(Math.min(255, Math.max(0, b * inverse)));
      alpha[y * outW + x] = a * inverse;
    }
  }

  const gapsSs = measureGroundGaps(projector, coverage, depth, W, H);
  const groundGapPx = new Float32Array(outW).fill(Number.NaN);
  for (let x = 0; x < outW; x += 1) {
    let best = Number.NaN;
    for (let sx = 0; sx < ss; sx += 1) {
      const value = gapsSs[x * ss + sx];
      if (Number.isNaN(value)) continue;
      const scaled = value / ss;
      if (Number.isNaN(best) || scaled < best) best = scaled;
    }
    groundGapPx[x] = best;
  }

  return {
    width: outW,
    height: outH,
    rgb,
    alpha,
    coverageRatio: covered / (W * H),
    bbox: maxX < 0 ? null : {
      x: minX / ss,
      y: minY / ss,
      width: (maxX - minX + 1) / ss,
      height: (maxY - minY + 1) / ss,
    },
    clipped: {
      top: maxX >= 0 && minY <= 0,
      bottom: maxX >= 0 && maxY >= H - 1,
      left: maxX >= 0 && minX <= 0,
      right: maxX >= 0 && maxX >= W - 1,
    },
    drawnTriangleCount,
    pose,
    groundGapPx,
  };
}

// --- PNG -------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length, false);
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) typeBytes[i] = type.charCodeAt(i);
  const body = concat([typeBytes, data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(body), false);
  return concat([length, body, crc]);
}

/** Uncompressed (stored) deflate. Portable everywhere, including a Workers isolate. */
export function storedDeflate(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 0xffff;
  let offset = 0;
  do {
    const size = Math.min(MAX, raw.length - offset);
    const header = new Uint8Array(5);
    header[0] = offset + size >= raw.length ? 1 : 0;
    header[1] = size & 0xff;
    header[2] = (size >> 8) & 0xff;
    header[3] = ~size & 0xff;
    header[4] = (~size >> 8) & 0xff;
    parts.push(header, raw.subarray(offset, offset + size));
    offset += size;
  } while (offset < raw.length);
  let a = 1;
  let b = 0;
  for (let i = 0; i < raw.length; i += 1) {
    a = (a + raw[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0, false);
  parts.push(adler);
  return concat(parts);
}

export type DeflateFn = (raw: Uint8Array) => Uint8Array;

/** RGB8 PNG, filter type 0 on every row. deflate is injected so core never imports node:zlib. */
export function encodePng(width: number, height: number, rgb: Uint8Array, deflate: DeflateFn = storedDeflate): Uint8Array {
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflate(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
