/**
 * Mine Entrance Kit — shared authoring kit for the "산기슭 갱도 입구" product family.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A kit is not sixteen models that happen to ship on the same day. It is sixteen models that
 * share ONE palette, ONE scale, ONE shape language and — for the track — one set of joint
 * dimensions, so a buyer can put a cart on a rail and a rail against a portal and have nothing
 * float, clip or change colour. Everything that has to agree across parts lives in `SPEC`
 * below, is imported by every factory, and is re-measured off the exported GLB by ./build.mjs.
 *
 * WHAT IT REUSES
 * --------------
 * The maths, the merge and the flat-shading discipline come straight out of
 * examples/generated/hf-wave2/wave2-kit.mjs (hash noise, per-face COLOR_0 painting, buffer
 * concatenation, grounding). Nothing is re-implemented that already works. What is NOT reused:
 *
 *   - the palette. `MINE_PALETTE` below is anchored on cozy-farm-set/farm-kit.mjs FARM_PALETTE
 *     (four hexes verbatim) so a mine timber and a farm crate are cut from the same tree, then
 *     adds the stone / iron / ore values a mine needs and a farm does not.
 *   - the sun. wave2-kit bakes with SUN = [0.521, 0.742, 0.421]. Two thirds of that vector is
 *     horizontal, which welds a compass into the vertex colours: the +X faces are permanently
 *     brighter than the -X faces, and no runtime light rig can take it back out because it is
 *     in the file, not in the lighting. `MINE_SUN` is straight up. On a sphere the distribution
 *     of clamp01(n · SUN) does not depend on which unit direction SUN is, so no contrast is
 *     lost — it moves from "which way does this face point" to "how much sky does it see",
 *     which is what an ambient bake should have been measuring in the first place.
 *
 * CLUNK GATE CONSTRAINTS EVERY FACTORY HERE PROTECTS
 * --------------------------------------------------
 *   - node scale is never touched (SCENE-NONUNIT-SCALE). Static parts bake every transform
 *     into the vertex buffer; the two animated parts use node ROTATION and TRANSLATION only.
 *   - every emitted node owns a mesh or has children (SCENE-EMPTY-NODES)
 *   - normals always present and flat (GEO-MISSING-NORMALS)
 *   - UVs deliberately absent: no textures ship, so the attribute would be dead payload
 *   - exactly one material per part (MAT-DUPLICATES, MAT-MATERIAL-BUDGET)
 *   - no zero-thickness cards: the thinnest authored solid in the kit is the lantern glass at
 *     6 mm and the cart's strap iron at 8 mm
 *
 * DETERMINISM
 * -----------
 * Nothing calls Math.random. Every wobble is a hash of a world coordinate or of an integer
 * index, so two runs of ./build.mjs write byte-identical GLBs.
 */
import {
  at,
  board,
  clamp01,
  finish,
  grainBoard,
  hashAt,
  hashSigned,
  lowestY,
  mergeParts,
  mix,
  noise1,
  paintFaces,
  rgb,
  shift,
  smoothstep,
  translateAll,
} from "../../hf-wave2/wave2-kit.mjs";

export { at, board, clamp01, finish, grainBoard, hashAt, hashSigned, lowestY, mergeParts, mix, noise1, paintFaces, rgb, shift, smoothstep, translateAll };

// ================================================================================= palette

/**
 * Twelve values, sRGB. Four are cozy-farm-set FARM_PALETTE hexes verbatim — that is the
 * whole reason a mine prop and a farm prop read as one world rather than two purchases.
 *
 * The mine's own contribution is the cold half: two stone values, two iron values, a rust,
 * a true black for the adit mouth, and three ore tints that have to be told apart at
 * thumbnail size, which is why copper is pushed orange, iron blue-grey and gold yellow
 * rather than all three being "brownish rock with sparkle".
 */
export const MINE_PALETTE = {
  // --- timber: FARM_PALETTE verbatim ------------------------------------------------------
  timberDark: "#6b4630", // FARM woodFrame — posts, cap beams, anything structural
  timberBody: "#a8794b", // FARM woodPlank — lagging, boards, sleepers
  timberLight: "#c99e6a", // FARM woodCrate — fresh-cut faces, handles, ladder rungs
  iron: "#3b4044", // FARM iron — straps, bands, spikes, tool heads

  // --- the mine's own cold half ------------------------------------------------------------
  // Rail heads are polished by wheels and nothing else in the kit is this bright a grey, so
  // this one value is what makes a length of track legible as track from directly above.
  ironWorn: "#7b8288",
  rust: "#8a4b2c", // between FARM roofTile #a8543e and woodFrame #6b4630: old iron, not new
  stone: "#9a958a", // FARM stone verbatim
  stoneDark: "#6d6a63", // the same rock in its own shadow; also the spoil under a boulder
  // The inside of the adit. Not #000000: a true black plate reads as a hole in the render,
  // and this is a solid 120 mm board that a buyer can walk a camera up to.
  adit: "#1e1b19",
  oreCopper: "#b06a38",
  oreIron: "#6f7580",
  // Also the lantern's lit pane. One value doing two jobs is deliberate: a mine lantern and a
  // gold seam are the only two warm-bright things down a shaft, and giving them separate hexes
  // would have bought nothing but a thirteenth colour.
  oreGold: "#d9ae3f",
};

/**
 * Straight up. See the file header — a horizontal component here is permanent and unfixable.
 */
export const MINE_SUN = [0, 1, 0];

// ============================================================== shared dimensions (metres)

/**
 * Every number two parts have to agree on.
 *
 * Reference reality, so the kit is not just internally consistent but consistent with a real
 * mine: British 2 ft (610 mm) narrow gauge is the standard for a hand-pushed mine tub, tubs
 * ran 0.8-1.0 m long with 0.25-0.30 m wheels, timbered adits were set on 1.0-1.5 m centres,
 * and a portal's clear opening was sized to the tub plus a man — about 2.4-2.7 m.
 */
export const SPEC = {
  /** Rail head centre to rail head centre. 0.600 m: 2 ft narrow gauge, rounded to the metre. */
  gauge: 0.6,
  /** Sleeper: 110 mm along the track, 50 mm thick, 860 mm across. */
  sleeperWidth: 0.11,
  sleeperHeight: 0.05,
  sleeperLength: 0.86,
  /** Rail section height ABOVE the sleeper top. */
  railHeight: 0.06,
  /** Rail head width — what the wheel tread has to cover. */
  railHeadWidth: 0.04,
  /** Rail foot width — what the spikes bite. */
  railFootWidth: 0.052,
  /** The one number the cart and all three track pieces have to agree on. */
  get railTopY() {
    return this.sleeperHeight + this.railHeight;
  },
  /** Straight module length, and therefore the tile the whole track grid is cut from. */
  module: 1.2,
  /** Sleeper stations on a straight module. Butt two modules and the pitch stays 0.4 m. */
  sleeperStations: [-0.4, 0, 0.4],
  /**
   * Curve: a 90 degree turn, centreline radius 1.2 m, connectors on the tile's own diagonal.
   *
   * 1.2 m and not 0.6. At a centreline radius equal to the gauge, an 860 mm sleeper centred on
   * the centreline reaches to within 170 mm of the arc centre, so the three sleepers' inner
   * ends converge into one bunched wedge — which is exactly what the first render of this
   * module showed. At 1.2 m the inner ends stop 770 mm out and stay parallel-ish, and the
   * curve also stops being tighter than its own track gauge.
   */
  curveRadius: 1.2,
  curveSteps: 10,

  /** Cart running gear. The flange is what makes the cart sit ON the rail rather than near it. */
  wheelTreadRadius: 0.13,
  wheelFlangeRadius: 0.152,
  wheelWidth: 0.05,
  flangeThickness: 0.012,
  /** How far the flange hangs below the tread — and therefore the cart's own ground clearance. */
  get flangeDrop() {
    return this.wheelFlangeRadius - this.wheelTreadRadius;
  },
  /** Lift a cart by this to put its treads exactly on a rail head. Proven in ./build.mjs. */
  get cartLiftOntoRail() {
    return this.railTopY - this.flangeDrop;
  },

  /** Timbering: leg centres and the pitch a support set repeats on down a drift. */
  supportSpan: 1.8,
  supportPitch: 1.2,
  /** Portal clear opening — a tub (0.62 m wide) plus a man beside it. */
  portalOpening: 2.6,
  /** Adit blanking board. 120 mm of real timber, never a card. */
  aditPlateThickness: 0.12,
};

// ================================================================================ material

/** The one material every part in the kit ships. White base; all colour lives in COLOR_0. */
export function mineMaterial(THREE, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({
    name: "mine_entrance_kit",
    color: 0xffffff,
    roughness,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
}

// ================================================================================= painters

/** Vertical key. `ny` is the whole of it — see MINE_SUN. */
function key(ny) {
  return clamp01(ny * MINE_SUN[1]);
}

/**
 * Timber. `grainAxis` is the board's long axis: tone streaks ALONG it, which is why every
 * board face that matters is subdivided along that axis. The `-ny` term is what turns the air
 * gap between two boards into a shadow line instead of a slot.
 */
export function timberPainter(spec = {}) {
  const {
    role = "timberBody",
    grainAxis = "x",
    grainStep = 0,
    boardAxis = "y",
    boardStep = 0,
    seed = 17,
    wear = 0,
  } = spec;
  const base = rgb(MINE_PALETTE[role]);
  const light = rgb(MINE_PALETTE.timberLight);
  const shadow = rgb(MINE_PALETTE.timberBody);
  const deep = rgb(MINE_PALETTE.timberDark);
  return (cx, cy, cz, nx, ny) => {
    const raw = grainAxis === "x" ? cx : grainAxis === "z" ? cz : cy;
    const t = grainStep > 0 ? Math.round(raw / grainStep) * grainStep : raw;
    const across = boardAxis === "x" ? cx : boardAxis === "z" ? cz : cy;
    const boardIndex = boardStep > 0 ? Math.round(across / boardStep) : 0;
    const grain =
      noise1(t * 9 + boardIndex * 3.7 + seed * 0.31, seed) * 0.62 +
      noise1(t * 26 + boardIndex * 11.3 + seed * 0.17, seed + 9) * 0.38;
    let color = grain < 0.5 ? mix(mix(base, shadow, 0.8), base, grain * 2) : mix(base, light, (grain - 0.5) * 1.4);
    color = mix(color, light, 0.3 * key(ny));
    color = mix(color, deep, 0.52 * clamp01(-ny));
    if (wear) color = mix(color, light, wear * clamp01(ny) * 0.35);
    return shift(color, 0.03 * hashSigned(cx, cy, cz, seed + 5));
  };
}

/**
 * Iron. `polish` lifts the upward faces toward `ironWorn` — that is the rail head, and it is
 * the difference between a length of track and two brown sticks on some sleepers.
 */
export function ironPainter(spec = {}) {
  const { seed = 31, polish = 0, rust = 0.22 } = spec;
  const base = rgb(MINE_PALETTE.iron);
  const worn = rgb(MINE_PALETTE.ironWorn);
  const corroded = rgb(MINE_PALETTE.rust);
  return (cx, cy, cz, nx, ny) => {
    const k = key(ny);
    let color = mix(base, corroded, rust * (0.4 + 0.6 * hashAt(cx, cy, cz, seed)));
    color = mix(color, worn, (0.34 + polish * 0.62) * k);
    color = mix(color, [0, 0, 0], 0.32 * clamp01(-ny));
    return shift(color, 0.025 * hashSigned(cx, cy, cz, seed + 3));
  };
}

/**
 * Rock. Facet tone is hashed off the face centroid, not off a light direction, so a boulder
 * still reads as faceted from every side — which is the only way it can, with a vertical sun.
 */
export function stonePainter(spec = {}) {
  const { seed = 47, damp = 0 } = spec;
  const base = rgb(MINE_PALETTE.stone);
  const dark = rgb(MINE_PALETTE.stoneDark);
  const deep = rgb(MINE_PALETTE.adit);
  return (cx, cy, cz, nx, ny) => {
    const facet = hashAt(cx, cy, cz, seed);
    let color = mix(dark, base, 0.25 + 0.75 * facet);
    color = mix(color, dark, damp * 0.45);
    color = mix(color, base, 0.34 * key(ny));
    color = mix(color, deep, 0.5 * clamp01(-ny));
    return shift(color, 0.04 * hashSigned(cx, cy, cz, seed + 7));
  };
}

/** A metal seam in the rock. Bright, faceted, and never mixed back toward the stone. */
export function orePainter(role, seed = 61) {
  const base = rgb(MINE_PALETTE[role]);
  const dark = rgb(MINE_PALETTE.stoneDark);
  return (cx, cy, cz, nx, ny) => {
    const facet = hashAt(cx, cy, cz, seed);
    let color = mix(base, [1, 1, 1], 0.14 + 0.3 * facet);
    color = mix(color, base, 0.4 * (1 - key(ny)));
    color = mix(color, dark, 0.42 * clamp01(-ny));
    return shift(color, 0.035 * hashSigned(cx, cy, cz, seed + 11));
  };
}

/** One flat value with a vertical key. Hardware, the adit plate, canvas, anything unstreaked. */
export function flatPainter(role, seed = 71, keyAmount = 0.3) {
  const base = rgb(MINE_PALETTE[role]);
  return (cx, cy, cz, nx, ny) => {
    let color = mix(base, [1, 1, 1], keyAmount * key(ny) * 0.6);
    color = mix(color, [0, 0, 0], 0.3 * clamp01(-ny));
    return shift(color, 0.02 * hashSigned(cx, cy, cz, seed));
  };
}

/**
 * The lit pane of the lantern. Deliberately NOT an emissive material — the delivery contract
 * is one material with no textures, so "lit" has to be a value, and a value that survives
 * being drawn next to #3b4044 iron is a very pale gold.
 */
export function emberPainter(seed = 83) {
  const glow = rgb(MINE_PALETTE.oreGold);
  return (cx, cy, cz, nx, ny) => {
    const color = mix(glow, [1, 1, 1], 0.42 + 0.2 * key(ny));
    return shift(color, 0.02 * hashSigned(cx, cy, cz, seed));
  };
}

// ================================================================================= geometry

/** finish() + paint, the pair every part applies to every primitive it authors. */
export function painted(THREE, geometry, painter) {
  const done = finish(geometry);
  paintFaces(THREE, done, painter);
  return done;
}

/**
 * A prism extruded along +Y from a polygon in the XZ plane.
 *
 * The polygon must be convex and wound COUNTER-CLOCKWISE in (x, z) maths coordinates
 * (positive shoelace area). The winding of every emitted triangle is derived from that, and
 * ./build.mjs re-checks it by integrating the signed volume of every exported mesh — a part
 * that came out inside-out has negative volume and fails the build rather than shipping as a
 * model that only looks right with backface culling off.
 */
export function prism(THREE, polygon, height, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const verts = [];
  const n = polygon.length;
  // Guard, not documentation. A polygon handed in clockwise produces a solid whose every face
  // points inward — it renders correctly only while backface culling is off, which is exactly
  // the failure the kit's contract forbids and exactly the one nobody notices in a hero render.
  let twiceArea = 0;
  for (let k = 0; k < n; k += 1) {
    const m = (k + 1) % n;
    twiceArea += polygon[k][0] * polygon[m][1] - polygon[m][0] * polygon[k][1];
  }
  if (twiceArea <= 0) {
    throw new Error(`prism() needs a counter-clockwise polygon in (x, z); signed area was ${(twiceArea / 2).toFixed(6)}.`);
  }
  const hy = height / 2;
  const push = (p) => verts.push(p[0], p[1], p[2]);
  const lo = polygon.map(([x, z]) => [x, -hy, z]);
  const hi = polygon.map(([x, z]) => [x, hy, z]);
  // Sides. Outward for a CCW polygon is (b_k, t_k, t_k+1, b_k+1).
  for (let k = 0; k < n; k += 1) {
    const m = (k + 1) % n;
    push(lo[k]); push(hi[k]); push(hi[m]);
    push(lo[k]); push(hi[m]); push(lo[m]);
  }
  const cLo = [0, -hy, 0];
  const cHi = [0, hy, 0];
  for (let k = 0; k < n; k += 1) {
    const m = (k + 1) % n;
    push(cLo); push(lo[k]); push(lo[m]); // -Y
    push(cHi); push(hi[m]); push(hi[k]); // +Y
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return at(THREE, geometry, position, rotation);
}

/**
 * The chamfered rectangular section every piece of timber in this kit is cut from.
 *
 * A sawn beam with a perfectly sharp arris is the loudest "this is a box" tell there is, and
 * the fix costs 16 triangles: an octagon instead of a rectangle, so every long edge catches a
 * narrow highlight of its own. Same trick as the cozy crate's corner posts standing proud —
 * spend a little geometry on the edge, because the edge is what the eye reads.
 */
export function chamferSection(width, depth, chamfer) {
  const hx = width / 2;
  const hz = depth / 2;
  const c = Math.min(chamfer, hx * 0.6, hz * 0.6);
  return [
    [hx, hz - c], [hx - c, hz], [-(hx - c), hz], [-hx, hz - c],
    [-hx, -(hz - c)], [-(hx - c), -hz], [hx - c, -hz], [hx, -(hz - c)],
  ];
}

/**
 * A chamfered timber. `size` is [x, y, z] of the UNCHAMFERED stock, so a 220 mm post measures
 * 220 mm across its faces exactly like the sawmill would have cut it.
 */
export function beam(THREE, size, position = [0, 0, 0], rotation = [0, 0, 0], chamfer = 0.018) {
  const [w, h, d] = size;
  return prism(THREE, chamferSection(w, d, chamfer), h, position, rotation);
}

/**
 * Sweep a closed section along a list of frames.
 *
 * A frame is { o, u, v }: an origin and the two unit vectors the section's (u, v) coordinates
 * are measured along. (u, v, travel) must be right-handed and the section must be wound CCW in
 * (u, v). This is how both rail modules are built, which is the only reason the straight and
 * the curve can be guaranteed to present the same cross-section at their ends — they are the
 * same twelve points.
 */
export function sweepPath(THREE, section, frames) {
  const verts = [];
  const push = (p) => verts.push(p[0], p[1], p[2]);
  const pointAt = (frame, [u, v]) => [
    frame.o[0] + frame.u[0] * u + frame.v[0] * v,
    frame.o[1] + frame.u[1] * u + frame.v[1] * v,
    frame.o[2] + frame.u[2] * u + frame.v[2] * v,
  ];
  const rings = frames.map((frame) => section.map((point) => pointAt(frame, point)));
  const n = section.length;
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < n; k += 1) {
      const m = (k + 1) % n;
      const a = rings[i][k];
      const b = rings[i][m];
      const c = rings[i + 1][m];
      const d = rings[i + 1][k];
      push(a); push(b); push(c);
      push(a); push(c); push(d);
    }
  }
  const centroid = (ring) => {
    const sum = [0, 0, 0];
    for (const p of ring) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  };
  const first = rings[0];
  const last = rings[rings.length - 1];
  const cFirst = centroid(first);
  const cLast = centroid(last);
  for (let k = 0; k < n; k += 1) {
    const m = (k + 1) % n;
    push(cFirst); push(first[m]); push(first[k]); // -travel
    push(cLast); push(last[k]); push(last[m]); // +travel
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

/**
 * The rail section, in (lateral, vertical) millimetres-as-metres, wound CCW.
 *
 * Twelve points, not four: a flat bar reads as a plank painted grey. Foot, waisted web and a
 * proud head is what a rail is, and at this size the waist is the shadow line that says so.
 * Height is SPEC.railHeight and the head is SPEC.railHeadWidth, because the cart's tread was
 * sized off those two numbers and nothing else.
 */
export function railSection() {
  const hf = SPEC.railFootWidth / 2; // 0.026
  const hh = SPEC.railHeadWidth / 2; // 0.020
  const hw = 0.009; // web half-width
  const h = SPEC.railHeight; // 0.060
  return [
    [-hf, 0], [hf, 0], [hf, 0.012], [hw, 0.024], [hw, 0.042], [hh, 0.05],
    [hh, h], [-hh, h], [-hh, 0.05], [-hw, 0.042], [-hw, 0.024], [-hf, 0.012],
  ];
}

/**
 * Frames for a rail running straight along +X at lateral offset `z`, from x0 to x1.
 *
 * `u` is -Z, not +Z. Travel is +X and `v` is up, so right-handedness needs u x v = +X, and
 * (0,0,1) x (0,1,0) is -X. The first build of this kit used +Z and every straight rail came out
 * with its faces pointing inward — a solid that renders correctly only while backface culling
 * is off. The signed-volume check in ./build.mjs is what found it; nothing in the hero render
 * looked wrong at all.
 */
export function straightFrames(z, x0, x1, y) {
  return [x0, x1].map((x) => ({ o: [x, y, z], u: [0, 0, -1], v: [0, 1, 0] }));
}

/**
 * Frames for a rail on a circular arc in the XZ plane.
 *
 * `u` is the outward radial direction and `v` is up, so (u, v, travel) stays right-handed for
 * an arc swept with increasing angle — the same handedness the straight uses, which is what
 * lets both share one `railSection()` without one of them coming out inside-out.
 */
export function arcFrames(centre, radius, a0, a1, steps, y) {
  const frames = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    frames.push({
      o: [centre[0] + radius * cos, y, centre[1] + radius * sin],
      u: [cos, 0, sin],
      v: [0, 1, 0],
    });
  }
  return frames;
}

/**
 * A lathed solid: `profile` is [[radius, y], ...] bottom to top, revolved `segments` ways.
 * Barrels, kegs, wheels and lantern bodies all come out of this.
 */
export function lathe(THREE, profile, segments, position = [0, 0, 0], rotation = [0, 0, 0], twist = 0) {
  const verts = [];
  const push = (p) => verts.push(p[0], p[1], p[2]);
  const rings = profile.map(([r, y], j) =>
    Array.from({ length: segments }, (_, i) => {
      const a = ((i + (j % 2) * twist) / segments) * Math.PI * 2;
      return [r * Math.cos(a), y, r * Math.sin(a)];
    }),
  );
  for (let j = 0; j < rings.length - 1; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const m = (i + 1) % segments;
      const a = rings[j][i];
      const b = rings[j + 1][i];
      const c = rings[j + 1][m];
      const d = rings[j][m];
      push(a); push(b); push(c);
      push(a); push(c); push(d);
    }
  }
  const first = rings[0];
  const last = rings[rings.length - 1];
  const cLo = [0, profile[0][1], 0];
  const cHi = [0, profile[profile.length - 1][1], 0];
  for (let i = 0; i < segments; i += 1) {
    const m = (i + 1) % segments;
    push(cLo); push(first[i]); push(first[m]); // -Y
    push(cHi); push(last[m]); push(last[i]); // +Y
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return at(THREE, geometry, position, rotation);
}

/**
 * A rock. Icosahedron with a hashed radial push and an anisotropic squash, so no two lumps in
 * the kit are the same lump and none of them is a ball.
 */
export function lump(THREE, spec = {}) {
  const { radius = 0.3, detail = 1, jitter = 0.26, scale = [1, 0.78, 1], seed = 5 } = spec;
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const push = 1 + jitter * hashSigned(x, y, z, seed);
    position.setXYZ(i, x * push * scale[0], y * push * scale[1], z * push * scale[2]);
  }
  return geometry;
}

/** A crystal: an octahedron, squashed and tilted. Eight triangles for a readable ore facet. */
export function crystal(THREE, size, position, rotation, seed = 9) {
  const geometry = new THREE.OctahedronGeometry(size, 0);
  const attr = geometry.getAttribute("position");
  for (let i = 0; i < attr.count; i += 1) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const z = attr.getZ(i);
    const push = 1 + 0.3 * hashSigned(x, y, z, seed);
    attr.setXYZ(i, x * push * 0.8, y * push * 1.35, z * push * 0.8);
  }
  return at(THREE, geometry, position, rotation);
}

/** A cylinder with its axis along +Y. Flat-shaded, so the segment count is the whole read. */
export function tube(THREE, radius, height, segments, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return lathe(THREE, [[radius, -height / 2], [radius, height / 2]], segments, position, rotation);
}

// =============================================================================== assembly

/**
 * Sit ONE geometry on a plane by its own lowest vertex.
 *
 * Needed because a low-poly lathe or icosahedron does not have a vertex at its analytic bottom:
 * a 10-segment cylinder's lowest ring vertex is at r*cos(18 deg), not r. Anything placed by
 * arithmetic instead of by measurement therefore either hovers or sinks, and on a track module
 * a single sunk ballast chip drags the whole part down when ground() runs — which moves the
 * railhead off SPEC.railTopY and silently breaks the one number the cart depends on.
 */
export function restOn(THREE, geometry, y = 0) {
  const position = geometry.getAttribute("position");
  let min = Infinity;
  for (let i = 0; i < position.count; i += 1) min = Math.min(min, position.getY(i));
  geometry.translate(0, y - min, 0);
  return geometry;
}

/** Drop a set of geometries so the lowest vertex sits exactly on y = 0. */
export function ground(THREE, parts) {
  translateAll(THREE, parts, -lowestY(parts));
  return parts;
}

/** One named mesh from a list of painted geometries. */
export function meshOf(THREE, name, material, parts) {
  if (!parts.length) throw new Error(`Mesh ${name} received no geometry.`);
  const mesh = new THREE.Mesh(mergeParts(THREE, parts), material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** What the factory actually produced, measured off the built scene. */
export function summarize(THREE, root) {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    meshes += 1;
    materials.add(node.material.name);
    const geometry = node.geometry;
    triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    triangles,
    meshes,
    materials: materials.size,
    sizeMeters: [Number(size.x.toFixed(4)), Number(size.y.toFixed(4)), Number(size.z.toFixed(4))],
    groundedAtY: Number(bounds.min.y.toFixed(5)),
  };
}

/** The block every factory writes onto root.userData, so the listing quotes the file. */
export function kitUserData(THREE, root, spec) {
  root.userData = {
    generator: "clunk-generate-pipeline",
    kit: "mine-entrance-v1",
    series: "mine-entrance",
    upAxis: "+Y",
    originAtGroundCentre: true,
    scaleMeters: 1,
    materials: 1,
    colorSource: "COLOR_0",
    palette: "kits/mine-entrance/mine-kit.mjs MINE_PALETTE (timber + iron roles are FARM_PALETTE verbatim)",
    bakedSunDirection: MINE_SUN,
    ...spec,
  };
  root.userData.measured = summarize(THREE, root);
  return root;
}
