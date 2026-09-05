/**
 * HF Order #5 — "Greenhouse glass-finish kit".
 *
 * Harvest Frontier asked for a working greenhouse whose gable-front frame carries a proper
 * mullion grid and whose glass reads as glass — a cool green-cyan tint that lifts toward the
 * sky at the top, with an ivory highlight streak raked across it — WITHOUT paying for alpha
 * blending or depth sorting. The contract HF signed is an OPAQUE APPROXIMATION: the glass is
 * solid geometry whose colour is baked into COLOR_0, so the runtime sees one material, zero
 * textures, no transparency, no sort cost.
 *
 * WHY GLASS AS OPAQUE COLOR_0
 * ---------------------------
 * Transmission / alpha-hash options were on the table and HF explicitly SKIPPED them. So the
 * glass tint is authored exactly the way harvest-frontier-trees/tree-kit.mjs and hf-wave2 bake
 * their colour: a white MeshStandardMaterial with `vertexColors: true`, every colour living in
 * COLOR_0. A vertical gradient (base #b7d3c9 at the sill, sky-reflection #d8e6da at the ridge)
 * is baked per face, plus one-to-two diagonal ivory (#f2ead9) streaks. Saturation is held down
 * — Grounded Stylized Realism, no neon.
 *
 * THE PANEL-OMISSION CONTRACT (the crux)
 * --------------------------------------
 * The greenhouse is a WORKING house: four rows of strawberry beds are meant to read through the
 * openings (new strawberry content raised their importance). A fully glazed opaque box kills
 * that intent. So the factory takes an `omitPanels` flag and leaves the DOOR BAY and part of a
 * side-wall LOW BAND unglazed — real holes the beds keep reading through. The top of the walls
 * and the whole roof stay covered by the opaque approximation.
 *
 * 2026-09-05: the door bay was ONLY a hole. The six-angle review sweep showed a 2.80 x 1.75 m
 * white rectangle in the middle of the front wall with no jamb, no head, no threshold and no
 * leaf anywhere near it, from every angle — an omission with nothing fitted into it reads as
 * damage. The token now drives a real DOORWAY (see the doorway block in the factory): the
 * centre column is glazed around a 1.50 x 2.15 m clear opening carrying jambs, a head, a
 * threshold and two glazed leaves. The hole the beds read through is still there; it is now
 * door-shaped.
 *
 * MEASURED FRAME (metres, HF-signed)
 * ----------------------------------
 *   footprint 8.4 W (X) x 6.5 D (Z), eave 3.4, ridge +0.75 => 4.15 (gable roof)
 *   mullion section 0.055, frame finish #536c62 (desaturated green-grey)
 *   side-wall mullions at z = +-1.95 / +-0.65 (5 bays, even 1.3 m rhythm)
 *   gable-face mullions at x = +-2.8 / +-1.4 (5 bays, wide centre = door bay)
 *   horizontal mid-rail at height ratio 0.55 (2 rows per wall)
 *   roof rafters at z = 0 / +-1.3 / +-2.6
 *
 * ORIGIN on the ground at the centre; +Z is the gable-front (the door side).
 *
 * DELIVERY: Group "hf_greenhouse_glass_kit" -> Mesh "greenhouse_frame" (sills, corner posts,
 * mullions, rails, eave plates, ridge, rafters, rake boards, doorway carpentry) + Mesh
 * "glass_panels" (the tinted grid and the door's four lights). ONE material, all colour in
 * COLOR_0, every transform baked, deterministic.
 *
 * Tools reused verbatim from hf-wave2/wave2-kit.mjs (read-only sibling): the COLOR_0 discipline
 * (finish / paintFaces / mergeParts), sRGB->linear conversion, the hashed determinism, the sun
 * vector shared with the preview rasteriser, and the white vertex-colour material.
 */
import {
  at,
  clamp01,
  finish,
  hashSigned,
  lowestY,
  mergeParts,
  mix,
  paintFaces,
  rgb,
  shift,
  smoothstep,
  summarize,
  SUN,
  translateAll,
  wave2Material,
} from "../hf-wave2/wave2-kit.mjs";

// ================================================================================= palette
// sRGB. Mixing happens in sRGB; paintFaces converts to linear at the moment it writes COLOR_0.
export const GREENHOUSE_PALETTE = {
  frame: "#536c62", // desaturated green-grey frame finish (HF-signed)
  glassBase: "#b7d3c9", // desaturated cool green-cyan, the tint at the sill
  glassTop: "#d8e6da", // lifts toward here at the ridge — sky reflection
  glassStreak: "#f2ead9", // ivory diagonal highlight streak
};

// ============================================================================ vec helpers
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vnorm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ============================================================================== geometry
/**
 * A flat glass quad, subdivided u x v and built double-sided so it reads from inside the house
 * too (the openings let the camera see the far panels' back faces). `corners` are four world
 * points p00 -> p10 -> p11 -> p01 (u then v). The pane is given a whisker of thickness along
 * its normal so it sits proud of nothing and never z-fights the mullion it lands in.
 *
 * Subdivided in v mainly (the gradient runs up the height) and a little in u (so the diagonal
 * streak is not a single hard step per bay). Per-face flat COLOR_0 means resolution is what
 * makes the gradient read smooth rather than banded.
 */
function glassQuad(THREE, corners, uSegs, vSegs, thickness) {
  const [p00, p10, p11, p01] = corners;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const point = (u, v) => lerp(lerp(p00, p10, u), lerp(p01, p11, u), v);
  const n = vnorm(vcross(vsub(p10, p00), vsub(p01, p00)));
  const off = vscale(n, thickness * 0.5);
  const verts = [];
  const push = (p) => verts.push(p[0], p[1], p[2]);
  for (let iu = 0; iu < uSegs; iu += 1) {
    for (let iv = 0; iv < vSegs; iv += 1) {
      const a = point(iu / uSegs, iv / vSegs);
      const b = point((iu + 1) / uSegs, iv / vSegs);
      const c = point((iu + 1) / uSegs, (iv + 1) / vSegs);
      const d = point(iu / uSegs, (iv + 1) / vSegs);
      const af = vadd(a, off), bf = vadd(b, off), cf = vadd(c, off), df = vadd(d, off);
      push(af); push(bf); push(cf); push(af); push(cf); push(df); // front
      const ab = vsub(a, off), bb = vsub(b, off), cb = vsub(c, off), db = vsub(d, off);
      push(ab); push(cb); push(bb); push(ab); push(db); push(cb); // back (reversed)
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

/** A frame member: an axis box, its transform baked into the vertex buffer. */
function beam(THREE, size, position, rotation = [0, 0, 0]) {
  return at(THREE, new THREE.BoxGeometry(size[0], size[1], size[2]), position, rotation);
}

// =============================================================================== painters
function framePainter() {
  const base = rgb(GREENHOUSE_PALETTE.frame);
  const light = shift(base, 0.13);
  const deep = shift(base, -0.15);
  return (cx, cy, cz, nx, ny, nz) => {
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    let color = mix(base, light, 0.24 * key);
    color = mix(color, deep, 0.42 * clamp01(-ny)); // undersides drop to a shadow line
    return shift(color, 0.014 * hashSigned(cx, cy, cz, 7));
  };
}

/**
 * The glass tint. Vertical gradient base -> sky, one to two raked ivory streaks, a soft sky
 * key on the up-facing normals, and only the faintest hashed break so it never goes flat OR
 * neon. `ridgeY` is passed so the gradient spans the true height of this instance.
 */
function glassPainter(ridgeY) {
  const base = rgb(GREENHOUSE_PALETTE.glassBase);
  const top = rgb(GREENHOUSE_PALETTE.glassTop);
  const streak = rgb(GREENHOUSE_PALETTE.glassStreak);
  return (cx, cy, cz, nx, ny, nz) => {
    const t = clamp01(cy / ridgeY); // 0 at the sill, 1 at the ridge
    let color = mix(base, top, smoothstep(0.04, 1.0, t));
    // Two diagonal ivory streaks. The diagonal coordinate mixes x and height so the streak
    // rakes across the glazing the way a low sun glances off a real greenhouse. Kept narrow and
    // aimed up-and-across, so it never muddies the low corners into a khaki smear.
    const diag = cx * 0.42 + cy * 1.0;
    const streakAmount = Math.max(
      smoothstep(0.12, 0.0, Math.abs(diag - 2.45)),
      0.68 * smoothstep(0.1, 0.0, Math.abs(diag - 0.35)),
    );
    color = mix(color, streak, 0.44 * streakAmount);
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, top, 0.18 * key); // sky catches the up-facing panes (roof especially)
    color = mix(color, base, 0.14 * clamp01(-ny));
    return shift(color, 0.006 * hashSigned(cx, cy, cz, 19)); // saturation held down: no neon
  };
}

// ============================================================================ omit contract
/**
 * Resolve the `omitPanels` tokens against a wall panel identified by (face, col, row). Faces:
 *   "gable-front" (+Z, the door side)   "gable-back" (-Z)
 *   "side-west"   (-X)                   "side-east" (+X)
 * Tokens supported (contract):
 *   "door-bay"       -> gable-front, bottom row, centre column: the entrance.
 *                       NOTE the factory does not simply skip this panel any more — it hands
 *                       the whole centre column of the gable front to the doorway block, which
 *                       glazes everything except the door frame's own footprint. This predicate
 *                       still answers for that panel so callers reading the contract get the
 *                       same answer, but the gable loop takes the door column first.
 *   "side-low-south" -> side-west,  bottom row, the three centre columns: a low viewing band
 * Objects `{ face, cols?, rows? }` are also honoured for callers who want explicit control.
 */
function isOmitted(face, col, row, colCount, omitPanels) {
  const centre = Math.floor(colCount / 2);
  for (const token of omitPanels) {
    if (typeof token === "object" && token) {
      if (token.face !== face) continue;
      const rowHit = token.rows ? token.rows.includes(row) : true;
      const colHit = token.cols ? token.cols.includes(col) : true;
      if (rowHit && colHit) return true;
      continue;
    }
    if (token === "door-bay" && face === "gable-front" && row === 0 && col === centre) return true;
    if (token === "side-low-south" && face === "side-west" && row === 0 && col >= 1 && col <= colCount - 2) {
      return true;
    }
  }
  return false;
}

// ================================================================================ factory
/**
 * @param {object} THREE
 * @param {object} opts
 * @param {number} opts.frameWidth   footprint along X (m)
 * @param {number} opts.frameHeight  eave height (m)
 * @param {number} opts.frameDepth   footprint along Z (m)
 * @param {number} [opts.ridgeRise]  how far the ridge sits above the eave (m)
 * @param {number} [opts.mullionRows] glass rows per wall (2 => one mid-rail)
 * @param {number} [opts.mullionCols] glass bays across each wall
 * @param {number} [opts.mullionThickness] mullion section (m)
 * @param {Array}  [opts.omitPanels] panels to leave unglazed (see isOmitted)
 * @returns {object} THREE.Object3D
 */
export function greenhouseGlassKit(THREE, opts = {}) {
  const {
    frameWidth = 8.4,
    frameHeight = 3.4,
    frameDepth = 6.5,
    ridgeRise = 0.75,
    mullionRows = 2,
    mullionCols = 5,
    mullionThickness = 0.055,
    omitPanels = ["door-bay", "side-low-south"],
  } = opts;

  const halfW = frameWidth / 2; // 4.2
  const halfD = frameDepth / 2; // 3.25
  const eaveY = frameHeight; // 3.4
  const ridgeY = frameHeight + ridgeRise; // 4.15
  const mt = mullionThickness;
  const sillH = 0.12;
  const sillTop = sillH;
  const glassIn = 0.04; // glass sits this far inside the outer wall face
  const roofLift = 0.045; // roof glass sits this far above the eave/ridge structural line
  const roofBarLift = 0.09; // external glazing bars (rafters, purlins) ride above the glass

  // Height of the roof line above the eave at a given |x| across the gable (ridge at x=0).
  const gableTopAt = (x) => eaveY + ridgeRise * (1 - Math.abs(x) / halfW);

  // --- bay rhythm -----------------------------------------------------------------------
  const ratioEdges = (n) => Array.from({ length: n + 1 }, (_, i) => -1 + (2 * i) / n);
  // Side walls: even 1.3 m rhythm -> z = +-3.25, +-1.95, +-0.65 (HF-signed).
  const sideZEdges = ratioEdges(mullionCols).map((r) => r * halfD);
  // Gable faces: 1/3, 2/3 rhythm at 5 bays -> x = +-4.2, +-2.8, +-1.4 with a WIDE centre bay
  // (the door bay). Falls back to even spacing for any other column count.
  const gableXEdges =
    mullionCols === 5
      ? [-1, -2 / 3, -1 / 3, 1 / 3, 2 / 3, 1].map((r) => r * halfW)
      : ratioEdges(mullionCols).map((r) => r * halfW);
  // Rows: mid-rail at height ratio 0.55 for the 2-row default; even splits otherwise.
  const rowRatios =
    mullionRows === 2 ? [0.55] : Array.from({ length: mullionRows - 1 }, (_, i) => (i + 1) / mullionRows);
  const yEdges = [sillTop, ...rowRatios.map((r) => r * eaveY), eaveY];

  // --- doorway ---------------------------------------------------------------------------
  /*
   * The `door-bay` token leaves the centre bottom bay of the gable front unglazed. Left at
   * that, the model ships with a 2.80 x 1.75 m rectangular hole in its front wall and no
   * jamb, head, threshold or leaf anywhere near it — from every one of the six review angles
   * it reads as damage, not as a way in. So the omission is FITTED: the bay keeps its hole,
   * but the hole is now door-shaped and the rest of the bay is glazed like any other panel.
   *
   * Sections follow the house, not a door catalogue: jambs at 0.10 (between the 0.09 corner
   * post and the 0.055 mullion), a 0.14 head that reads as one band with the mid-rail it
   * interrupts, and the same #536c62 finish through COLOR_0.
   *
   * Clear opening 1.50 W x 2.15 H. Both numbers are the door's, not the grid's:
   *   - the mid-rail at 1.87 is INTERRUPTED, not obeyed. Hanging the head under it gave 1.795 m
   *     of clear height, which renders as a stooping door on a 3.4 m eave;
   *   - the 0.12 front sill is CUT at the frame and a 0.05 threshold closes the gap, because
   *     stepping over 120 mm of sill would have eaten the height back again.
   * The glass in the centre column is then cut around the frame instead of the frame being cut
   * around the glass — see the gable loop below.
   */
  const hasDoor = omitPanels.some((token) => token === "door-bay") && mullionCols >= 3;
  const doorCentreCol = Math.floor(mullionCols / 2);
  const doorClearHalf = 0.75; // half the clear opening
  const jambT = 0.1; // jamb section across the opening
  const doorFrameHalf = doorClearHalf + jambT; // 0.85 — outer edge of the door frame
  const doorHeadBottom = 2.2; // underside of the head — 2.15 m clear over the threshold
  const doorHeadH = 0.15;
  const doorHeadTop = doorHeadBottom + doorHeadH;
  const thresholdH = 0.05;
  const doorFrameZ = halfD - 0.06; // jamb/head centre plane: outer face flush with the wall

  const framePaint = framePainter();
  const glassPaint = glassPainter(ridgeY);
  const frameParts = [];
  const glassParts = [];
  const framePush = (geo) => {
    const f = finish(geo);
    paintFaces(THREE, f, framePaint);
    frameParts.push(f);
  };
  const glassPush = (geo) => {
    const f = finish(geo);
    paintFaces(THREE, f, glassPaint);
    glassParts.push(f);
  };

  const openings = []; // for the report / userData: which world faces are actually holed

  // ============================================================== FRAME
  // Sill beams around the footprint. Kept just inside +-halfW / +-halfD so the outer frame
  // face lands exactly on the measured 8.4 x 6.5 footprint.
  if (hasDoor) {
    // The front sill stops either side of the door frame; the threshold below closes the gap.
    const segW = halfW - doorFrameHalf;
    for (const sx of [-1, 1]) {
      framePush(beam(THREE, [segW, sillH, 0.12], [sx * (doorFrameHalf + segW / 2), sillH / 2, halfD - 0.06]));
    }
  } else {
    framePush(beam(THREE, [frameWidth, sillH, 0.12], [0, sillH / 2, halfD - 0.06]));
  }
  framePush(beam(THREE, [frameWidth, sillH, 0.12], [0, sillH / 2, -(halfD - 0.06)]));
  framePush(beam(THREE, [0.12, sillH, frameDepth - 0.24], [halfW - 0.06, sillH / 2, 0]));
  framePush(beam(THREE, [0.12, sillH, frameDepth - 0.24], [-(halfW - 0.06), sillH / 2, 0]));

  // Corner posts up to the eave (outer face on the footprint line).
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      framePush(beam(THREE, [0.09, eaveY, 0.09], [sx * (halfW - 0.045), eaveY / 2, sz * (halfD - 0.045)]));
    }
  }

  // Eave plates (side walls, running in Z) and the ridge (running in X).
  framePush(beam(THREE, [0.1, 0.1, frameDepth - 0.18], [halfW - 0.05, eaveY, 0]));
  framePush(beam(THREE, [0.1, 0.1, frameDepth - 0.18], [-(halfW - 0.05), eaveY, 0]));
  framePush(beam(THREE, [frameWidth, 0.14, 0.16], [0, ridgeY + 0.02, 0])); // ridge cap covers the rafter tops

  // Mid-rails on every wall.
  for (const r of rowRatios) {
    const y = r * eaveY;
    framePush(beam(THREE, [0.07, 0.05, frameDepth - 0.24], [halfW - 0.035, y, 0]));
    framePush(beam(THREE, [0.07, 0.05, frameDepth - 0.24], [-(halfW - 0.035), y, 0]));
    if (hasDoor && y > thresholdH && y < doorHeadTop) {
      // A rail cannot run through a doorway. The head below takes over across the opening.
      const segW = halfW - doorFrameHalf;
      for (const sx of [-1, 1]) {
        framePush(beam(THREE, [segW, 0.05, 0.07], [sx * (doorFrameHalf + segW / 2), y, halfD - 0.035]));
      }
    } else {
      framePush(beam(THREE, [frameWidth, 0.05, 0.07], [0, y, halfD - 0.035]));
    }
    framePush(beam(THREE, [frameWidth, 0.05, 0.07], [0, y, -(halfD - 0.035)]));
  }

  // Side-wall vertical mullions (interior z edges only; the ends are the corner posts).
  for (let i = 1; i < sideZEdges.length - 1; i += 1) {
    const z = sideZEdges[i];
    framePush(beam(THREE, [0.07, eaveY, mt], [halfW - 0.035, eaveY / 2, z]));
    framePush(beam(THREE, [0.07, eaveY, mt], [-(halfW - 0.035), eaveY / 2, z]));
  }

  // Gable vertical mullions, each carried up to the sloped roof line at its x.
  for (let i = 1; i < gableXEdges.length - 1; i += 1) {
    const x = gableXEdges[i];
    const h = gableTopAt(x);
    framePush(beam(THREE, [mt, h, 0.07], [x, h / 2, halfD - 0.035]));
    framePush(beam(THREE, [mt, h, 0.07], [x, h / 2, -(halfD - 0.035)]));
  }

  // Rake boards along the two gable roof edges (eave corner up to the ridge).
  {
    const rakeLen = Math.hypot(halfW, ridgeRise);
    const rakeAngle = Math.atan2(ridgeRise, halfW);
    for (const sz of [-1, 1]) {
      // left slope: x -4.2 (y eave) -> 0 (y ridge), tilts up toward +x
      framePush(beam(THREE, [rakeLen, 0.09, 0.09], [-halfW / 2, (eaveY + ridgeY) / 2, sz * (halfD - 0.045)], [0, 0, rakeAngle]));
      // right slope: x 0 (ridge) -> +4.2 (eave), tilts down
      framePush(beam(THREE, [rakeLen, 0.09, 0.09], [halfW / 2, (eaveY + ridgeY) / 2, sz * (halfD - 0.045)], [0, 0, -rakeAngle]));
    }
  }

  // Roof rafters running down the slope (ridge -> eave), one per gable mullion x plus the
  // wall edges, so the roof grid lines up with the walls below it.
  {
    const rafterAngle = Math.atan2(ridgeRise, halfD);
    const rafterZ0 = 0.3; // start just below the ridge; the ridge cap closes the gap so the bar
    // never solves the slope's peak above the cap
    const rafterZc = (rafterZ0 + halfD) / 2;
    const rafterYc = eaveY + ridgeRise * (1 - rafterZc / halfD) + roofBarLift;
    const rafterLen = Math.hypot(halfD - rafterZ0, (ridgeRise * (halfD - rafterZ0)) / halfD);
    const rafterX = [-(halfW - 0.03), ...gableXEdges.slice(1, -1), halfW - 0.03, 0].filter((v, i, a) => a.indexOf(v) === i);
    for (const x of rafterX) {
      // +Z slope, lifted above the glass so it reads as an external glazing bar
      framePush(beam(THREE, [0.06, 0.05, rafterLen], [x, rafterYc, rafterZc], [rafterAngle, 0, 0]));
      // -Z slope
      framePush(beam(THREE, [0.06, 0.05, rafterLen], [x, rafterYc, -rafterZc], [-rafterAngle, 0, 0]));
    }
  }

  // Roof purlins running across the slope in X, at the contracted z stations +-1.3 / +-2.6.
  for (const z of [-2.6, -1.3, 1.3, 2.6]) {
    if (Math.abs(z) >= halfD) continue;
    const y = eaveY + ridgeRise * (1 - Math.abs(z) / halfD) + roofBarLift;
    framePush(beam(THREE, [frameWidth, 0.05, 0.06], [0, y, z]));
  }

  // ============================================================== GLASS
  const uSegsWall = 4;
  const vSegsWall = 8;
  const paneT = 0.016;

  // --- side walls (planes at x = +-halfW), bays along Z, rows in Y --------------------
  for (const [sx, face] of [[-1, "side-west"], [1, "side-east"]]) {
    const xp = sx * (halfW - glassIn);
    for (let col = 0; col < sideZEdges.length - 1; col += 1) {
      const z0 = sideZEdges[col];
      const z1 = sideZEdges[col + 1];
      for (let row = 0; row < yEdges.length - 1; row += 1) {
        if (isOmitted(face, col, row, mullionCols, omitPanels)) continue;
        const y0 = yEdges[row];
        const y1 = yEdges[row + 1];
        glassPush(
          glassQuad(
            THREE,
            [
              [xp, y0, z0],
              [xp, y0, z1],
              [xp, y1, z1],
              [xp, y1, z0],
            ],
            uSegsWall,
            vSegsWall,
            paneT,
          ),
        );
      }
    }
  }

  // --- gable faces (planes at z = +-halfD): rectangular grid + the triangular top ------
  for (const [sz, face] of [[1, "gable-front"], [-1, "gable-back"]]) {
    const zp = sz * (halfD - glassIn);
    // rectangular part
    for (let col = 0; col < gableXEdges.length - 1; col += 1) {
      const x0 = gableXEdges[col];
      const x1 = gableXEdges[col + 1];
      for (let row = 0; row < yEdges.length - 1; row += 1) {
        const y0 = yEdges[row];
        const y1 = yEdges[row + 1];
        /*
         * The door column is glazed around the door frame rather than skipped wholesale.
         * The `door-bay` token omits one 2.80 x 1.75 panel; the door is 1.70 wide over its
         * frame and 2.35 tall to the top of its head, so leaving the whole panel out threw
         * away 1.10 m of glazing beside the door and the head's transom above it — which is
         * precisely why the front wall shipped as a hole. Three rects per row instead: the
         * two strips beside the frame, and whatever is left above the head.
         */
        if (hasDoor && face === "gable-front" && col === doorCentreCol) {
          const rects = [
            [x0, -doorFrameHalf, y0, y1],
            [doorFrameHalf, x1, y0, y1],
            [-doorFrameHalf, doorFrameHalf, Math.max(y0, doorHeadTop), y1],
          ];
          for (const [xa, xb, ya, yb] of rects) {
            if (xb - xa < 0.05 || yb - ya < 0.05) continue;
            glassPush(
              glassQuad(
                THREE,
                [
                  [xa, ya, zp],
                  [xb, ya, zp],
                  [xb, yb, zp],
                  [xa, yb, zp],
                ],
                Math.max(1, Math.round((xb - xa) / 0.6)),
                Math.max(2, Math.round((yb - ya) / 0.22)),
                paneT,
              ),
            );
          }
          continue;
        }
        if (isOmitted(face, col, row, mullionCols, omitPanels)) continue;
        glassPush(
          glassQuad(
            THREE,
            [
              [x0, y0, zp],
              [x1, y0, zp],
              [x1, y1, zp],
              [x0, y1, zp],
            ],
            uSegsWall,
            vSegsWall,
            paneT,
          ),
        );
      }
    }
    // triangular gable top: x-strips from the eave line up to the sloped roof line, so the
    // ridge peak is preserved instead of being cut off by one flat quad.
    const strips = 12;
    for (let s = 0; s < strips; s += 1) {
      const xa = -halfW + (s / strips) * frameWidth;
      const xb = -halfW + ((s + 1) / strips) * frameWidth;
      glassPush(
        glassQuad(
          THREE,
          [
            [xa, eaveY, zp],
            [xb, eaveY, zp],
            [xb, gableTopAt(xb), zp],
            [xa, gableTopAt(xa), zp],
          ],
          1,
          2,
          paneT,
        ),
      );
    }
  }

  // --- roof: two sloped opaque-approximation panes (ridge -> eave), no omissions -------
  // Lifted clear of the structural line so the glazing sits ON the structure (external glass);
  // the glazing bars above (roofBarLift) then ride proud of it.
  for (const sz of [-1, 1]) {
    glassPush(
      glassQuad(
        THREE,
        [
          [-halfW, ridgeY + roofLift, 0],
          [halfW, ridgeY + roofLift, 0],
          [halfW, eaveY + roofLift, sz * halfD],
          [-halfW, eaveY + roofLift, sz * halfD],
        ],
        8,
        5,
        paneT,
      ),
    );
  }

  // ============================================================== DOORWAY
  /*
   * Jamb, head, threshold and a pair of glazed leaves, shut. Built last because it needs both
   * pushers: the carpentry is frame finish, the lights are the same tinted glass as the walls.
   *
   * The leaves sit 0.048 back from the wall face, so the jambs and head keep a reveal and the
   * doorway still reads as a doorway from the low-front and 3/4 angles where a flush panel
   * would have flattened back into the wall.
   */
  if (hasDoor) {
    // Threshold. Low enough to step over, deep enough to catch the light as a line.
    framePush(beam(THREE, [doorFrameHalf * 2, thresholdH, 0.14], [0, thresholdH / 2, halfD - 0.07]));
    // Jambs. They run to the ground, because the front sill is cut for them.
    for (const sx of [-1, 1]) {
      framePush(
        beam(THREE, [jambT, doorHeadBottom, 0.12], [sx * (doorClearHalf + jambT / 2), doorHeadBottom / 2, doorFrameZ]),
      );
    }
    // Head. 0.06 wider than the frame each side, so it laps the jambs instead of butting
    // them, and deep enough to read as one band with the mid-rail it replaces.
    framePush(
      beam(THREE, [doorFrameHalf * 2 + 0.12, doorHeadH, 0.13], [0, doorHeadBottom + doorHeadH / 2, halfD - 0.065]),
    );

    // Two leaves, shut. Stile-and-rail carpentry with two lights each — the same construction
    // the walls use, at door scale, so the door belongs to this greenhouse and not to a kit.
    const leafGap = 0.012; // the meeting joint, wide enough to read as two leaves
    /* Clearance to the jamb and to the threshold. Without it the leaf's own side face landed
       exactly on the jamb's inner face and the leaf's underside exactly on the threshold's
       top face — two coplanar surfaces the depth buffer cannot separate, which stitched a
       dashed line down each side of the door in the front render. */
    const leafReveal = 0.006;
    const leafW = (doorClearHalf * 2 - leafGap) / 2 - leafReveal;
    const leafBottom = thresholdH + leafReveal;
    const leafTop = doorHeadBottom - 0.006;
    const leafH = leafTop - leafBottom;
    const leafZ = halfD - 0.075;
    const leafT = 0.055;
    const stileW = 0.08;
    const bottomRailH = 0.18;
    const lockRailH = 0.11;
    const topRailH = 0.09;
    const lockRailY = leafBottom + 1.02; // lock rail at ~1.07 m, where a hand meets the door
    const railW = leafW - stileW * 2;
    for (const sx of [-1, 1]) {
      const cx = sx * (leafGap / 2 + leafW / 2);
      for (const ix of [-1, 1]) {
        framePush(beam(THREE, [stileW, leafH, leafT], [cx + (ix * (leafW - stileW)) / 2, leafBottom + leafH / 2, leafZ]));
      }
      framePush(beam(THREE, [railW, bottomRailH, leafT], [cx, leafBottom + bottomRailH / 2, leafZ]));
      framePush(beam(THREE, [railW, lockRailH, leafT], [cx, lockRailY, leafZ]));
      framePush(beam(THREE, [railW, topRailH, leafT], [cx, leafTop - topRailH / 2, leafZ]));
      const lights = [
        [leafBottom + bottomRailH, lockRailY - lockRailH / 2],
        [lockRailY + lockRailH / 2, leafTop - topRailH],
      ];
      for (const [ly0, ly1] of lights) {
        glassPush(
          glassQuad(
            THREE,
            [
              [cx - railW / 2, ly0, leafZ],
              [cx + railW / 2, ly0, leafZ],
              [cx + railW / 2, ly1, leafZ],
              [cx - railW / 2, ly1, leafZ],
            ],
            2,
            2,
            paneT,
          ),
        );
      }
      /* Pull handle. Centred ON the meeting stile (which spans 0.006..0.086 from the joint),
         not across it: the first cut straddled the stile edge and the two pulls read as nubs
         hanging over the glass. Proud of the leaf face, still inside the wall plane. */
      framePush(beam(THREE, [0.032, 0.34, 0.05], [sx * (leafGap / 2 + stileW / 2), leafBottom + 1.05, halfD - 0.045]));
    }
    /* Meeting bead, BEHIND the leaves. The 12 mm joint is a slot straight through the house,
       and through it the front render showed a white line the full height of the door — the
       far wall's lit inner face. A real double door carries an astragal on the closing stile
       for exactly this reason; here it costs 12 triangles and closes the slot. */
    framePush(beam(THREE, [0.06, leafH, 0.03], [0, leafBottom + leafH / 2, leafZ - 0.042]));
    /* Door stops, one bead per jamb, behind the leaf. Same reason as the bead above: the
       6 mm reveal that keeps the leaf off the jamb is also 6 mm of daylight, and it drew a
       dashed line down both sides of the door. A leaf closes against a stop in real joinery. */
    for (const sx of [-1, 1]) {
      framePush(beam(THREE, [0.024, leafH, 0.03], [sx * (doorClearHalf - 0.003), leafBottom + leafH / 2, leafZ - 0.042]));
    }
  }

  // record which world faces ended up holed (for the passport / report)
  for (const token of omitPanels) {
    if (token === "door-bay") {
      openings.push(
        hasDoor
          ? `gable-front (+Z) centre bay — fitted doorway ${(doorClearHalf * 2).toFixed(2)} x ${(doorHeadBottom - thresholdH).toFixed(3)} m clear: threshold, jambs, head and two glazed leaves (shut)`
          : "gable-front (+Z) centre bay, bottom row — door opening",
      );
    }
    else if (token === "side-low-south") openings.push("side-west (-X) bottom row, centre bays — low viewing band");
    else if (typeof token === "object" && token) openings.push(`${token.face} custom omission`);
  }

  // ============================================================== assemble
  const all = [...frameParts, ...glassParts];
  translateAll(THREE, all, -lowestY(all)); // drop onto the ground plane

  const material = wave2Material(THREE, "hf_greenhouse_glass", 0.55);
  const root = new THREE.Group();
  root.name = "hf_greenhouse_glass_kit";

  const frameMesh = new THREE.Mesh(mergeParts(THREE, frameParts), material);
  frameMesh.name = "greenhouse_frame";
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  // The glass is a SEPARATE named mesh so a consumer can swap it for a reflective / transmissive
  // material later without touching the frame.
  const glassMesh = new THREE.Mesh(mergeParts(THREE, glassParts), material);
  glassMesh.name = "glass_panels";
  glassMesh.castShadow = true;
  glassMesh.receiveShadow = true;
  root.add(frameMesh, glassMesh);

  root.userData = {
    generator: "clunk-generate-pipeline",
    kit: "hf-greenhouse-v1",
    series: "hf-greenhouse",
    assetId: "hf-greenhouse.glass-kit.m1",
    upAxis: "+Y",
    originAtGroundCentre: true,
    scaleMeters: 1,
    materials: 1,
    colorSource: "COLOR_0",
    palette: "hf-greenhouse GREENHOUSE_PALETTE (frame #536c62; glass #b7d3c9 -> #d8e6da, streak #f2ead9)",
    measuredFrame: {
      footprintMeters: [frameWidth, frameDepth],
      eaveHeight: eaveY,
      ridgeHeight: ridgeY,
      mullionThickness: mt,
      sideBays: mullionCols,
      gableBays: mullionCols,
      rows: mullionRows,
    },
    doorway: hasDoor
      ? {
          clearWidthMetres: Number((doorClearHalf * 2).toFixed(3)),
          clearHeightMetres: Number((doorHeadBottom - thresholdH).toFixed(3)),
          jambSection: jambT,
          headDepth: doorHeadH,
          thresholdHeight: thresholdH,
          leaves: 2,
          leafState: "shut",
          parts: ["threshold", "jambs", "head", "two glazed stile-and-rail leaves", "pull handles"],
        }
      : null,
    glazing: "opaque approximation (no alpha blend, no sort): tint baked into COLOR_0",
    omitPanels,
    openings,
    parts: ["greenhouse_frame", "glass_panels"],
    swapNote: 'replace the "glass_panels" mesh material to make the glazing reflective/transmissive without touching the frame',
  };
  root.userData.measured = summarize(THREE, root);
  return root;
}

export default greenhouseGlassKit;
