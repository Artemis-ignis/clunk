/* A second and third tile that can sit next to the first.
 *
 * Two variants only break a repeat if they can be mixed freely, and that needs
 * every variant to carry the SAME border. So a variant keeps the base tile's outer
 * ring byte for byte and rearranges only the middle — the middle is the base rolled
 * on the torus, which is a different arrangement of the same stones — and then the
 * four straight joins where the new middle meets the kept ring are healed with the
 * same quilting used on the wrap seam. The result: any variant beside any other,
 * in any order, and the wrap measurements are unchanged because the wrap pixels are
 * the base's own.
 */
import { healLine, roll } from "./heal.mjs";

export function makeVariant(base, W, H, ox, oy, opt = {}) {
  const R = opt.ring ?? 64;
  const heal = { band: 26, ctx: 10, segLen: 64, ov: 16, ...(opt.lattice ? { lattice: opt.lattice } : {}) };
  const rolled = roll(base, W, H, ox, oy);
  let img = Buffer.from(rolled);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < R || x >= W - R || y < R || y >= H - R) {
      for (let k = 0; k < 3; k++) img[(y * W + x) * 3 + k] = base[(y * W + x) * 3 + k];
    }
  }
  const bV = [R, W - R], bH = [R, H - R];
  img = healLine(img, W, H, "v", R, { ...heal, brokenV: bV, brokenH: bH });
  img = healLine(img, W, H, "v", W - R, { ...heal, brokenV: bV, brokenH: bH });
  img = healLine(img, W, H, "h", R, { ...heal, brokenV: bV, brokenH: bH });
  img = healLine(img, W, H, "h", H - R, { ...heal, brokenV: bV, brokenH: bH });
  // the outer ring must be the base's, exactly — restore what the heal feathered into
  const keep = R - (heal.band + heal.ctx) - 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < keep || x >= W - keep || y < keep || y >= H - keep) {
      for (let k = 0; k < 3; k++) img[(y * W + x) * 3 + k] = base[(y * W + x) * 3 + k];
    }
  }
  return img;
}

/**
 * Choose the two rolls the variants are built from.
 *
 * A variant keeps the base's border, so its wrap pixels — and therefore its wrap
 * difference — are the base's. What does move is the column and row the audit
 * measures the interior with, and on a tile with strong structure those differ a
 * lot from place to place: the roof's quiet columns range 5.35 to 7.63. Picking
 * the roll blind can therefore ship a variant that measures worse than the tile it
 * came from while being pixel-for-pixel as seamless. So the roll is chosen from the
 * offsets whose interior probe lands somewhere comparable, and among those, the two
 * that move the content furthest.
 *
 * `lattice` constrains the roll to whole periods, which a periodic texture needs or
 * the roll breaks the pattern it is meant to keep.
 */
export function pickVariantOffsets(base, W, H, { lattice = null, bar = 1.05, minSpread = 180 } = {}) {
  const at = (x, y, k) => base[((((y % H) + H) % H) * W + (((x % W) + W) % W)) * 3 + k];
  const cp = [], rp = [];
  for (let x = 0; x < W; x++) { let v = 0; for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) v += Math.abs(at(x + 1, y, k) - at(x, y, k)); cp.push(v / (3 * H)); }
  for (let y = 0; y < H; y++) { let v = 0; for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) v += Math.abs(at(x, y + 1, k) - at(x, y, k)); rp.push(v / (3 * W)); }
  const wc = cp[W - 1], wr = rp[H - 1];
  const axis = (N, period) => {
    if (!period) return Array.from({ length: Math.floor((N - 2 * 120) / 7) }, (_, i) => 120 + i * 7);
    const out = []; for (let k = 0; k * period < N - 1; k++) out.push(Math.round(k * period)); return out;
  };
  const xs = axis(W, lattice?.[0]), ys = axis(H, lattice?.[1]);
  const ok = [];
  for (const ox of xs) for (const oy of ys) {
    if (ox === 0 && oy === 0) continue;
    /* Half the tile puts the interior probe exactly on the wrap column the variant
       inherited, which would make the ratio 1.00 by construction rather than by
       measurement. Refuse it — the number has to mean something. */
    if (ox === W >> 1 || oy === H >> 1) continue;
    const m = Math.max(wc / cp[(((W >> 1) - 1 + ox) % W)], wr / rp[(((H >> 1) - 1 + oy) % H)]);
    if (m <= bar) ok.push({ m, ox, oy, move: Math.min(ox, W - ox) + Math.min(oy, H - oy) });
  }
  if (!ok.length) throw new Error("no variant roll keeps the interior probe comparable");
  ok.sort((a, b) => b.move - a.move);
  const first = ok[0];
  const second = ok.find((c) => Math.abs(c.ox - first.ox) + Math.abs(c.oy - first.oy) > minSpread) ?? ok[1] ?? first;
  return [[first.ox, first.oy], [second.ox, second.oy]];
}
