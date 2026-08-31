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
 * mullions, rails, eave plates, ridge, rafters, rake boards) + Mesh "glass_panels" (the tinted
 * grid). ONE material, all colour in COLOR_0, every transform baked, deterministic.
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
 *   "door-bay"       -> gable-front, bottom row, centre column: the entrance opening
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
  framePush(beam(THREE, [frameWidth, sillH, 0.12], [0, sillH / 2, halfD - 0.06]));
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
    framePush(beam(THREE, [frameWidth, 0.05, 0.07], [0, y, halfD - 0.035]));
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
        if (isOmitted(face, col, row, mullionCols, omitPanels)) continue;
        const y0 = yEdges[row];
        const y1 = yEdges[row + 1];
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

  // record which world faces ended up holed (for the passport / report)
  for (const token of omitPanels) {
    if (token === "door-bay") openings.push("gable-front (+Z) centre bay, bottom row — door opening");
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
