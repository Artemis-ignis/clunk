/* A normal and a roughness map derived from the tile's own base colour.
 *
 * These are DERIVED, not scanned: the height proxy is the albedo's luminance, so a
 * dark stone reads as a low stone. That is the standard way to get a usable surface
 * out of a colour-only tile and it is what the listing says it is. Both maps are
 * built with torus sampling, so they tile exactly like the colour map does.
 */
import { torusBlur } from "./ops.mjs";
const wrap = (v, N) => ((v % N) + N) % N;

const lum = (b, i) => 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2];

export function normalMap(buf, W, H, strength) {
  const soft = torusBlur(buf, W, H, 1.2);
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = (0.2126 * soft[i * 3] + 0.7152 * soft[i * 3 + 1] + 0.0722 * soft[i * 3 + 2]) / 255;
  const o = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const L = h[y * W + wrap(x - 1, W)], R = h[y * W + wrap(x + 1, W)];
    const U = h[wrap(y - 1, H) * W + x], D = h[wrap(y + 1, H) * W + x];
    const nx = -(R - L) * strength, ny = (D - U) * strength, nz = 1;
    const m = Math.hypot(nx, ny, nz);
    const i = (y * W + x) * 3;
    o[i] = Math.round((nx / m * 0.5 + 0.5) * 255);
    o[i + 1] = Math.round((ny / m * 0.5 + 0.5) * 255);
    o[i + 2] = Math.round((nz / m * 0.5 + 0.5) * 255);
  }
  return o;
}

export function roughnessMap(buf, W, H, base, spread) {
  let mean = 0;
  for (let i = 0; i < W * H; i++) mean += lum(buf, i);
  mean /= W * H;
  const o = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = base + spread * ((mean - lum(buf, i)) / 128);
    o[i] = Math.max(0, Math.min(255, Math.round(Math.max(0, Math.min(1, v)) * 255)));
  }
  return o;
}
