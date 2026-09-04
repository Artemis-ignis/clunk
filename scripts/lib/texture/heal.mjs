/* Offset-and-heal for a wrapping tile.
 *
 * The audit's own numbers say the wrap mismatch is almost entirely high-frequency
 * (wood-planks left/right: mean |Δ| 14.23, of which the low-frequency part is 1.97).
 * A smooth gradient-domain correction therefore cannot fix it, and a blur would
 * destroy the grain that the sharpness figure measures. So this heals the seam the
 * way a texture artist does: roll the tile by half so the wrap lands in the middle,
 * replace a narrow band along that line with real texture quilted from elsewhere in
 * the same tile — the donor chosen by matching the band's own left/right/previous
 * context — then roll back.
 *
 * Only the band is touched. The interior control column the audit measures (the
 * tile's own middle) is on the rolled image's border and is never written, so
 * before/after ratios are comparable.
 */
const sq = (v) => v * v;
const wrap = (v, N) => ((v % N) + N) % N;
const px = (b, W, H, x, y, k) => b[(wrap(y, H) * W + wrap(x, W)) * 3 + k];
const ramp = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));

/** does the interval [start, start+span) contain `line` (± margin) on a ring of N? */
function crosses(start, span, line, N, margin) {
  const rel = wrap(line - start + margin, N);
  return rel < span + 2 * margin;
}

/**
 * Heal one straight join.
 *   axis "v" — the join is between columns pos-1 and pos, healed down the full height.
 *   axis "h" — between rows pos-1 and pos, healed across the full width.
 * `brokenV` / `brokenH` list join positions a donor patch may not straddle.
 */
export function healLine(src, W, H, axis, pos, opt = {}) {
  const band = opt.band ?? 20;
  const ctx = opt.ctx ?? 20;
  const segLen = opt.segLen ?? 96;
  const ov = opt.ov ?? 28;
  const coarse = opt.coarse ?? 10;
  const brokenV = opt.brokenV ?? [];
  const brokenH = opt.brokenH ?? [];

  const half = band + ctx;
  const pw = 2 * half;                       // width across the join that gets written
  const along = axis === "v" ? H : W;
  const margin = half + 10;

  const toXY = axis === "v" ? (u, v) => [pos - half + v, u] : (u, v) => [u, pos - half + v];

  const out = Buffer.from(src);
  const nSeg = Math.max(1, Math.round(along / (segLen - ov)));
  const step = along / nSeg;

  for (let s = 0; s < nSeg; s++) {
    const u0 = Math.round(s * step);
    const segH = Math.round(step) + ov;
    const isFirst = s === 0, isLast = s === nSeg - 1;

    /* --- the hole's context, sampled from the image as healed so far --- */
    const ctxPts = [];
    for (let u = 0; u < segH; u += 2) for (let v = 0; v < ctx; v += 2) { ctxPts.push([u, v]); ctxPts.push([u, pw - 1 - v]); }
    if (!isFirst) for (let u = 0; u < ov; u += 2) for (let v = ctx; v < pw - ctx; v += 3) ctxPts.push([u, v]);
    if (isLast) for (let u = segH - ov; u < segH; u += 2) for (let v = ctx; v < pw - ctx; v += 3) ctxPts.push([u, v]);

    /* Context samples carry a weight: a pixel sitting on an edge (a plank gap, a
       mortar line) costs more to mismatch than a pixel in flat grain, so the donor
       is chosen to carry those lines through rather than to average well. */
    const tgt = ctxPts.map(([u, v]) => {
      const [x, y] = toXY(u0 + u, v);
      const g = Math.abs(px(out, W, H, x + 1, y, 1) - px(out, W, H, x - 1, y, 1))
              + Math.abs(px(out, W, H, x, y + 1, 1) - px(out, W, H, x, y - 1, 1));
      return [px(out, W, H, x, y, 0), px(out, W, H, x, y, 1), px(out, W, H, x, y, 2), 1 + g / 4];
    });

    /* --- donor search: (cx, cy) is the donor patch origin in image space --- */
    const donorXY = axis === "v" ? (cx, cy, u, v) => [cx + v, cy + u] : (cx, cy, u, v) => [cx + u, cy + v];
    const okDonor = (cx, cy) => {
      const spanX = axis === "v" ? pw : segH, spanY = axis === "v" ? segH : pw;
      for (const L of brokenV) if (crosses(cx, spanX, L, W, margin)) return false;
      for (const L of brokenH) if (crosses(cy, spanY, L, H, margin)) return false;
      return true;
    };
    const score = (cx, cy, cap) => {
      let e = 0;
      for (let i = 0; i < ctxPts.length; i++) {
        const [u, v] = ctxPts[i];
        const [x, y] = donorXY(cx, cy, u, v);
        e += tgt[i][3] * (sq(px(out, W, H, x, y, 0) - tgt[i][0]) + sq(px(out, W, H, x, y, 1) - tgt[i][1]) + sq(px(out, W, H, x, y, 2) - tgt[i][2]));
        if (cap !== undefined && e > cap) return e;
      }
      return e;
    };

    let best = null;
    if (opt.lattice) {
      /* A texture with a real period (the roof's pantiles repeat every 128 px across)
         must be healed with a donor that stands at the SAME phase, or the quilt breaks
         the pattern it was meant to preserve. So the candidates are the lattice of
         whole periods away from the hole, with a couple of pixels of slack for a
         period that does not land on an integer. */
      const [pxs, pys] = opt.lattice;
      /* How far off the lattice a donor may sit. Where the period divides the tile
         exactly (the roof's 128 px across 1024) the answer is zero: one pixel of
         slip puts the donor a pixel out of phase and the join stops landing where
         the pattern's own quiet column is. */
      const [jxr, jyr] = opt.latticeJitter ?? [3, 3];
      const ox0 = axis === "v" ? pos - half : u0;
      const oy0 = axis === "v" ? u0 : pos - half;
      const ni = Math.floor(W / pxs), nj = Math.floor(H / pys);
      for (let i = -ni; i <= ni; i++) for (let j = -nj; j <= nj; j++) {
        if (i === 0 && j === 0) continue;
        for (let jx = -jxr; jx <= jxr; jx++) for (let jy = -jyr; jy <= jyr; jy++) {
          const cx = Math.round(ox0 + i * pxs) + jx, cy = Math.round(oy0 + j * pys) + jy;
          if (!okDonor(cx, cy)) continue;
          const e = score(cx, cy, best?.e);
          if (!best || e < best.e) best = { e, cx, cy };
        }
      }
    } else {
      for (let cy = 0; cy < H; cy += coarse) for (let cx = 0; cx < W; cx += coarse) {
        if (!okDonor(cx, cy)) continue;
        const e = score(cx, cy, best?.e);
        if (!best || e < best.e) best = { e, cx, cy };
      }
      if (best) for (let dy = -coarse + 1; dy < coarse; dy++) for (let dx = -coarse + 1; dx < coarse; dx++) {
        const cx = best.cx + dx, cy = best.cy + dy;
        if (!okDonor(cx, cy)) continue;
        const e = score(cx, cy, best.e);
        if (e < best.e) best = { e, cx, cy };
      }
    }

    /* --- tone match on the context ring, so the patch does not step in brightness --- */
    const off = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      let a = 0, b = 0;
      for (let i = 0; i < ctxPts.length; i++) {
        const [u, v] = ctxPts[i];
        const [x, y] = donorXY(best.cx, best.cy, u, v);
        a += tgt[i][k]; b += px(out, W, H, x, y, k);
      }
      off[k] = (a - b) / ctxPts.length;
    }

    /* --- feathered paste --- */
    for (let u = 0; u < segH; u++) {
      let aU = isFirst ? 1 : ramp(u / ov);
      if (isLast) aU = Math.min(aU, ramp((segH - 1 - u) / ov));
      for (let v = 0; v < pw; v++) {
        const a = aU * Math.min(ramp(v / ctx), ramp((pw - 1 - v) / ctx));
        if (a <= 0.001) continue;
        const [x, y] = toXY(u0 + u, v);
        const xi = wrap(x, W), yi = wrap(y, H);
        const [dx2, dy2] = donorXY(best.cx, best.cy, u, v);
        for (let k = 0; k < 3; k++) {
          const donor = px(src, W, H, dx2, dy2, k) + off[k];
          const cur = out[(yi * W + xi) * 3 + k];
          out[(yi * W + xi) * 3 + k] = Math.max(0, Math.min(255, Math.round(cur * (1 - a) + donor * a)));
        }
      }
    }
  }
  return out;
}

export function roll(buf, W, H, dx, dy) {
  const o = Buffer.alloc(buf.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = wrap(x + dx, W), sy = wrap(y + dy, H);
    for (let k = 0; k < 3; k++) o[(y * W + x) * 3 + k] = buf[(sy * W + sx) * 3 + k];
  }
  return o;
}
