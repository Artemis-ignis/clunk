/* Pixel operations that respect the tile's wrap: everything here samples on the
   torus so no operation can introduce a new edge at the tile border. */
const wrap = (v, N) => ((v % N) + N) % N;

/** Separable box blur, three passes ≈ Gaussian, wrapping at the tile edge. */
export function torusBlur(buf, W, H, radius) {
  let a = Float32Array.from(buf), b = new Float32Array(buf.length);
  const passes = 3, r = Math.max(1, Math.round(radius / 1.4));
  for (let p = 0; p < passes; p++) {
    for (let k = 0; k < 3; k++) {
      for (let y = 0; y < H; y++) {
        let s = 0;
        for (let i = -r; i <= r; i++) s += a[(y * W + wrap(i, W)) * 3 + k];
        for (let x = 0; x < W; x++) {
          b[(y * W + x) * 3 + k] = s / (2 * r + 1);
          s += a[(y * W + wrap(x + r + 1, W)) * 3 + k] - a[(y * W + wrap(x - r, W)) * 3 + k];
        }
      }
    }
    [a, b] = [b, a];
    for (let k = 0; k < 3; k++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) s += a[(wrap(i, H) * W + x) * 3 + k];
        for (let y = 0; y < H; y++) {
          b[(y * W + x) * 3 + k] = s / (2 * r + 1);
          s += a[(wrap(y + r + 1, H) * W + x) * 3 + k] - a[(wrap(y - r, H) * W + x) * 3 + k];
        }
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Unsharp mask on the torus. amount 1.0 doubles the detail at the chosen scale. */
export function unsharp(buf, W, H, radius, amount) {
  const lo = torusBlur(buf, W, H, radius);
  const o = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) o[i] = Math.max(0, Math.min(255, Math.round(buf[i] + amount * (buf[i] - lo[i]))));
  return o;
}

/**
 * Flatten the tile-scale shading.
 *
 * A repeated tile reads as a grid mostly because its own large blotches and its
 * overall light-to-dark drift come back at the same place in every copy. Removing
 * only the very low frequencies (wavelength above `radius`) takes the recurring
 * blob away and leaves every stone, grain and pit untouched — `strength` 1 removes
 * it entirely. Sampled on the torus so the tile stays seamless.
 */
export function flattenLowFrequency(buf, W, H, radius, strength) {
  const lo = torusBlur(buf, W, H, radius);
  const mean = [0, 0, 0];
  for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) mean[k] += lo[i * 3 + k];
  for (let k = 0; k < 3; k++) mean[k] /= W * H;
  const o = Buffer.alloc(buf.length);
  for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) {
    o[i * 3 + k] = Math.max(0, Math.min(255, Math.round(buf[i * 3 + k] - strength * (lo[i * 3 + k] - mean[k]))));
  }
  return o;
}
