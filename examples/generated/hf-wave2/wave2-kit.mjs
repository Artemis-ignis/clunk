/**
 * HF Wave 2 — shared authoring kit for the "haystack + wood crate" delivery.
 *
 * Two products, five variants, one discipline. Written code-first in the img2threejs
 * order the generation rail documents (docs/generate-pipeline.ko.md): blockout -> structure
 * -> form -> material. No textures, no downloaded art, no photogrammetry.
 *
 * WHY THIS KIT EXISTS
 * -------------------
 * Harvest Frontier's current haystack is a smooth untextured ochre droplet and its crate is
 * an orange untextured cube. Both fail for the same reason: the surface carries no
 * information, so the silhouette is the only thing the eye gets, and a smooth lathe of
 * revolution has no silhouette worth reading. This kit's whole job is to put the surface
 * language INTO THE GEOMETRY, because the delivery contract is 1 material and 0 textures:
 *
 *   - straw  -> faceted shell (per-vertex radial jitter), wound-layer terracing on the roll
 *               ends, circumferential compression bands on the barrel, twine bands, and real
 *               straw wisps modelled as tapered prisms that break the outline
 *   - timber -> every plank is its own box with a real air gap to its neighbour, plank faces
 *               are segmented along the grain so tone can streak down the board, undersides
 *               are darkened so each gap reads as a shadow line
 *
 * ONE MATERIAL PER VARIANT
 * ------------------------
 * All colour lives in COLOR_0 against a white MeshStandardMaterial with `vertexColors: true`
 * and `flatShading: true` — the same discipline as harvest-frontier-trees/tree-kit.mjs and as
 * the Harvest side's own `paintVertexColors` / `mergeColoredParts`. Colour is baked per FACE
 * (all three corners share one value) so interpolation never softens the facet edges the
 * low-poly read depends on.
 *
 * PALETTE
 * -------
 * `WAVE2_PALETTE` is anchored on cozy-farm-set/farm-kit.mjs `FARM_PALETTE` so these props sit
 * in the same world as the market stall, the shed and the gate. The crate roles are the farm
 * palette hexes VERBATIM (woodCrate / woodPale / woodPlank / woodFrame / iron); the straw
 * roles are interpolated between farm `woodPale`/`canvasCream` and Harvest Frontier's
 * STYLE_BIBLE harvest gold `#dcae55`, which is the one colour both worlds already share.
 *
 * CLUNK GATE CONSTRAINTS THIS KIT PROTECTS
 * ----------------------------------------
 *   - node scale is never touched (SCENE-NONUNIT-SCALE): every transform is baked into the
 *     vertex buffer, so each emitted mesh sits at identity and is InstancedMesh-ready
 *   - every emitted node owns a mesh or has children (SCENE-EMPTY-NODES)
 *   - normals are always present and flat (GEO-MISSING-NORMALS)
 *   - UVs are deliberately deleted: there are no textures, so TEX-MISSING-UV0 cannot fire and
 *     the attribute would be 8 bytes per vertex of pure payload
 *   - exactly one material per variant (MAT-DUPLICATES, MAT-MATERIAL-BUDGET)
 *
 * DETERMINISM
 * -----------
 * Nothing calls Math.random. Every wobble is a hash of an integer grid index or of a world
 * coordinate, so two exports of the same factory are byte-identical.
 */

// =============================================================================== colour

/**
 * Series palette, sRGB.
 *
 * `crate*` and `iron` are cozy-farm-set/farm-kit.mjs FARM_PALETTE hexes, unchanged — that is
 * what makes a wave-2 crate read as the same object the market stall is already stacked with.
 * `hay*` bridges farm woodPale/canvasCream to Harvest Frontier's harvest gold.
 */
export const WAVE2_PALETTE = {
  // --- straw: a three-stop ramp plus a compressed-core tone for cut sections -------------
  hayShadow: "#8a6437", // between FARM woodPlank #a8794b and woodFrame #6b4630
  hayBody: "#d7ad60", // between HF harvest gold #dcae55 and FARM woodPale #e0c79b
  hayLight: "#f0e2b4", // between FARM woodPale #e0c79b and canvasCream #f0e5c8
  hayCore: "#7d5a30", // damp compressed core, only ever seen inside a cut face
  hayDust: "#c9b489", // sun-bleached loose straw on the ground
  // Baler twine has to be a VALUE step, not a hue step: a cord one shade off the straw is
  // invisible at 10 m, which is exactly what the first render pass proved. Two passes later it
  // also has to stay light enough to read as a raised cord — pushed too dark it reads as a
  // groove cut into the bale instead of a rope lying on it. #8a7442 is the value that survived
  // both: dark enough to separate from the straw, light enough to still catch the key.
  twine: "#8a7442",

  // --- timber: FARM_PALETTE verbatim ----------------------------------------------------
  crateBody: "#c99e6a", // FARM woodCrate
  crateLight: "#e0c79b", // FARM woodPale
  crateShadow: "#a8794b", // FARM woodPlank
  crateFrame: "#6b4630", // FARM woodFrame
  iron: "#3b4044", // FARM iron

  // --- produce --------------------------------------------------------------------------
  // Deliberately a red apple, not an orange one. The first pass sat closer to FARM carrot
  // #e0762c and eight of them in a crate read as a pile of small pumpkins.
  appleBody: "#b03c2a", // a shade off FARM tomato #c8402f, so the two crates share a world
  appleBlush: "#d0763a", // sunny cheek, pulled toward FARM carrot but never reaching it
  appleShade: "#7e2a20",
  leaf: "#4f7a35", // FARM leaf
  stem: "#6b4630", // FARM woodFrame
  voidFill: "#5c4326", // the dark plate under a heaped crate: reads as "full", not "empty"
};

/** sRGB hex -> [r, g, b] in 0..1 sRGB space. Mixing happens in sRGB, conversion at write. */
export function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

export function mix(a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function shift(color, amount) {
  return [
    Math.min(1, Math.max(0, color[0] + amount)),
    Math.min(1, Math.max(0, color[1] + amount)),
    Math.min(1, Math.max(0, color[2] + amount)),
  ];
}

/**
 * glTF stores COLOR_0 in LINEAR space. We author and mix in sRGB (predictable against the
 * palette hexes) and convert once, at the moment the buffer is written, so the result never
 * depends on `THREE.ColorManagement` being enabled in the exporting process.
 */
export function toLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

/**
 * Key direction used to bake lighting into COLOR_0. Deliberately the same vector as the
 * offline preview rasteriser's KEY_DIR, so what the preview shows is what the baked colour
 * says — if they disagreed, the render self-check would be checking the wrong thing.
 */
export const SUN = [0.521, 0.742, 0.421];

// ================================================================================ noise

/**
 * Hash of a *position* (or of an integer grid index), not of a vertex ordinal. Hashing the
 * coordinate keeps duplicated seam vertices welded: two vertices at the same place always get
 * the same answer, so a deformed surface never tears and a facet never cracks open.
 */
export function hashAt(x, y, z, salt) {
  let h = (2166136261 ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  const parts = [Math.round(x * 4096) | 0, Math.round(y * 4096) | 0, Math.round(z * 4096) | 0];
  for (const part of parts) {
    for (let byte = 0; byte < 4; byte += 1) {
      h ^= (part >> (byte * 8)) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Signed variant in -1..1. */
export function hashSigned(x, y, z, salt) {
  return hashAt(x, y, z, salt) * 2 - 1;
}

/** Smooth 1-D value noise. This is the grain: it runs ALONG an axis and varies across it. */
export function noise1(t, salt) {
  const i = Math.floor(t);
  const f = t - i;
  const a = hashAt(i, 0, 0, salt);
  const b = hashAt(i + 1, 0, 0, salt);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

// ============================================================================= geometry

/** Strip what the runtime does not need, then bake flat per-face normals. */
export function finish(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
  if (flat.getAttribute("uv1")) flat.deleteAttribute("uv1");
  flat.computeVertexNormals();
  return flat;
}

/** Bakes a position/rotation into the vertex buffer. Node transforms stay at identity. */
export function at(THREE, geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])),
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

/** Orients +Y onto `direction`, then translates. Used for straw blades leaving a surface. */
export function along(THREE, geometry, origin, direction, roll = 0) {
  const dir = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const spin = new THREE.Quaternion().setFromAxisAngle(dir, roll);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(origin[0], origin[1], origin[2]),
    spin.multiply(quaternion),
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * Bake one colour per triangle into COLOR_0.
 *
 * Per-face rather than per-vertex is the point: interpolating across a face would soften the
 * exact facet edges the low-poly read depends on. `paint` gets the face centroid and the face
 * normal and returns an sRGB triple.
 */
export function paintFaces(THREE, geometry, paint) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const count = position.count;
  const colors = new Float32Array(count * 3);
  for (let f = 0; f < count; f += 3) {
    const cx = (position.getX(f) + position.getX(f + 1) + position.getX(f + 2)) / 3;
    const cy = (position.getY(f) + position.getY(f + 1) + position.getY(f + 2)) / 3;
    const cz = (position.getZ(f) + position.getZ(f + 1) + position.getZ(f + 2)) / 3;
    const value = paint(cx, cy, cz, normal.getX(f), normal.getY(f), normal.getZ(f));
    const r = toLinear(clamp01(value[0]));
    const g = toLinear(clamp01(value[1]));
    const b = toLinear(clamp01(value[2]));
    for (let k = 0; k < 3; k += 1) {
      colors[(f + k) * 3] = r;
      colors[(f + k) * 3 + 1] = g;
      colors[(f + k) * 3 + 2] = b;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Concatenate non-indexed position/normal/color buffers into one geometry. Written longhand
 * instead of importing BufferGeometryUtils so a factory touches nothing but the `THREE`
 * namespace the rail hands it.
 */
export function mergeParts(THREE, parts) {
  let total = 0;
  for (const part of parts) total += part.getAttribute("position").count;
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    position.set(part.getAttribute("position").array, offset * 3);
    normal.set(part.getAttribute("normal").array, offset * 3);
    color.set(part.getAttribute("color").array, offset * 3);
    offset += part.getAttribute("position").count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.setAttribute("color", new THREE.BufferAttribute(color, 3));
  return merged;
}

/** Lowest y across a set of geometries — used to drop an asset onto the ground plane. */
export function lowestY(parts) {
  let min = Infinity;
  for (const part of parts) {
    const position = part.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) min = Math.min(min, position.getY(i));
  }
  return Number.isFinite(min) ? min : 0;
}

export function translateAll(THREE, parts, dy) {
  const matrix = new THREE.Matrix4().makeTranslation(0, dy, 0);
  for (const part of parts) part.applyMatrix4(matrix);
  return parts;
}

/** The one material every variant ships. White base; all colour is COLOR_0. */
export function wave2Material(THREE, name, roughness) {
  return new THREE.MeshStandardMaterial({
    name,
    color: 0xffffff,
    roughness,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
}

// ================================================================== straw: blades & clumps

/**
 * One straw blade: a tapered triangular prism, two segments long, with a bend.
 *
 * A flat quad ribbon would have been half the cost, but it disappears the moment the camera
 * gets behind it (back faces are culled in engine) and it contributes nothing to the
 * silhouette edge-on. A prism is 9 triangles, is visible from every angle, and actually
 * pokes a spike out of the outline — which is the entire reason the wisps exist.
 *
 * Built along +Y from the origin; use `along()` to plant it on a surface.
 */
export function strawBlade(THREE, spec) {
  const { length = 0.18, width = 0.011, bend = 0.35, droop = 0.5, seed = 1 } = spec;
  const sections = [
    { t: 0, r: 1.0 },
    { t: 0.55, r: 0.62 },
    { t: 1.0, r: 0.0 },
  ];
  const ring = [];
  for (const section of sections) {
    const y = section.t * length;
    // Bend + droop: the blade leaves the surface straight and curls over under its own weight.
    const lean = bend * length * section.t * section.t;
    const fall = -droop * length * Math.pow(section.t, 2.6);
    const points = [];
    for (let k = 0; k < 3; k += 1) {
      const angle = (k / 3) * Math.PI * 2 + 0.3 * hashSigned(seed, k, 0, 91);
      const r = width * section.r * (1 + 0.25 * hashSigned(seed, k, section.t * 10, 17));
      points.push([Math.cos(angle) * r + lean, y + fall, Math.sin(angle) * r]);
    }
    ring.push(points);
  }

  const vertices = [];
  const push = (p) => vertices.push(p[0], p[1], p[2]);
  for (let s = 0; s < 2; s += 1) {
    const lower = ring[s];
    const upper = ring[s + 1];
    for (let k = 0; k < 3; k += 1) {
      const n = (k + 1) % 3;
      if (s === 1) {
        // Top section collapses to a point: one triangle per side, not a degenerate quad.
        push(lower[k]);
        push(lower[n]);
        push(upper[0]);
      } else {
        push(lower[k]);
        push(lower[n]);
        push(upper[n]);
        push(lower[k]);
        push(upper[n]);
        push(upper[k]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A trodden clump of loose straw: a squashed icosahedron with a positional wobble. 20 tris. */
export function strawClump(THREE, spec) {
  const { radius = 0.11, squash = 0.34, jitter = 0.3, seed = 5 } = spec;
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const push = 1 + jitter * hashSigned(x, y, z, seed);
    position.setXYZ(i, x * push * 1.25, y * squash * push, z * push);
  }
  return geometry;
}

// ================================================================================== bale

/**
 * A machine-rolled round bale, axis along +X, built as an explicit parametric grid so every
 * surface feature is authored rather than hoped for.
 *
 * Returns { barrel, capNeg, capPos } as separate un-finished geometries so each can be painted
 * with the painter that matches its grain direction (the barrel's straw runs around the
 * circumference; the end faces show the coil as a spiral).
 *
 * Surface language, in the order it matters at 10 m:
 *   1. `bands`    circumferential compression grooves along the axis — sawtooth, so each band
 *                 has one hard step edge instead of a soft ripple
 *   2. `seam`     one raised helical ridge: the tail of the last wound layer
 *   3. `jitter`   per-vertex radial wobble, hashed off the grid index, so no ring is a circle
 *   4. cap spiral a sawtooth in (radius, theta) — the coil, terraced into visible steps
 *   5. `crater`   optional scooped bite, quantised into wound-layer strata
 */
export function baleShell(THREE, spec) {
  const {
    radius = 0.7,
    halfWidth = 0.6,
    xMin = -halfWidth,
    xMax = halfWidth,
    eatenEnd = null,
    tornEnd = 0,
    radial = 18,
    axial = 8,
    bands = 4,
    bandDepth = 0.055,
    // Kept small on purpose. A fat barrel bulge rounds the roll into a potato at thumbnail
    // size; the cylinder's straight top and bottom edges are most of what says "bale".
    bulge = 0.015,
    jitter = 0.02,
    seam = 0.019,
    endTaper = 0.055,
    settle = 0.88,
    yScale = 0.98,
    zScale = 1.02,
    capRings = [1, 0.86, 0.72, 0.58, 0.43, 0.29, 0.15],
    capTurns = 3,
    capStep = 0.034,
    capDish = 0.05,
    crater = null,
    thetaWarp = 0.72,
    seed = 11,
  } = spec;

  const axisY = radius * yScale;

  /**
   * The fed-out trough, applied to an already-computed surface radius.
   *
   * Three things here were each learned from a render that failed:
   *
   *  1. It is a TROUGH, not a bowl. A round bite big enough to show four strata also swallowed
   *     the whole visible face and the roll stopped reading as a roll. A channel that is narrow
   *     across and long down the bale spends its width on the strata and leaves the crown and
   *     the lower front intact, so the silhouette survives the variant.
   *  2. The wall falloff is LINEAR in angle (`1 - a`), not quadratic. A quadratic bowl bunches
   *     all of its level sets against the rim, where they land closer together than the grid
   *     and alias into a smooth dish.
   *  3. The snap is measured off the NOMINAL radius, not off `r`. `r` already carries the band
   *     sawtooth and the straw jitter — up to 0.8 of a layer of noise — and feeding that into
   *     the snap scatters neighbouring vertices onto different shells. A wound layer is a clean
   *     cylinder, and the exposed strata have to be clean too.
   */
  function biteInto(r, theta, x) {
    if (!crater) return r;
    let dt = theta - crater.theta0;
    while (dt > Math.PI) dt -= Math.PI * 2;
    while (dt < -Math.PI) dt += Math.PI * 2;
    const a = Math.abs(dt) / crater.angRadius;
    const b = Math.abs(x - crater.x0) / crater.axRadius;
    if (a >= 1 || b >= 1) return r;
    // Flat-bottomed along most of its length, tapering out at both ends of the channel.
    const f = (1 - a) * smoothstep(1, 0.55, b);
    const target = radius - crater.depth * f;
    const snapped = Math.round(target / crater.layer) * crater.layer;
    return Math.min(r - crater.layer * 0.4, snapped);
  }

  /**
   * Angle of radial column `i`.
   *
   * When there is a trough to show, the columns are redistributed so they crowd around it:
   * `s + (k/2pi) sin(2pi s)` is monotone for k < 1 and concentrates sampling at the trough's
   * centre by a factor of 1/(1-k). This is the whole reason the strata are legible — a uniform
   * 24-column ring gives 0.26 rad per column, which is under one column per exposed layer, and
   * no amount of colour will rescue terraces the grid cannot resolve. It costs zero triangles.
   */
  function thetaOf(i) {
    const s = (i % radial) / radial;
    if (!crater || !thetaWarp) return s * Math.PI * 2;
    const warped = s + (thetaWarp / (Math.PI * 2)) * Math.sin(Math.PI * 2 * s);
    return crater.theta0 - Math.PI + warped * Math.PI * 2;
  }

  /** Radius of the straw surface at (theta, x), before the elliptical squash. */
  function radiusAt(i, j) {
    const theta = thetaOf(i);
    const u = j / axial;
    const x = xMin + u * (xMax - xMin);

    let r = radius * (1 + bulge * Math.sin(Math.PI * u));
    const bandPhase = u * bands;
    r -= bandDepth * (bandPhase - Math.floor(bandPhase));
    const seamPhase = theta / (Math.PI * 2) + u * 1.35;
    const seamFrac = seamPhase - Math.floor(seamPhase);
    const seamDist = Math.min(seamFrac, 1 - seamFrac);
    r += seam * Math.exp(-(seamDist * seamDist) / (2 * 0.055 * 0.055));
    // End chamfer. Without it the barrel meets the end face on a razor-perfect circle, which
    // is the single loudest "lathe of revolution" tell there is — the first render pass had it.
    r *= 1 - endTaper * smoothstep(0.8, 1, Math.abs(u * 2 - 1));
    r *= 1 + jitter * hashSigned(i % radial, j, 0, seed);
    r = biteInto(r, theta, x);
    return { theta, x, r };
  }

  /** Ring of world-space points at axial station j. Shared with the cap so seams cannot gap. */
  function ringAt(j) {
    const points = [];
    for (let i = 0; i < radial; i += 1) {
      const { theta, x, r } = radiusAt(i, j);
      // `settle` < 1 squares off the lower flanks: a bale that has sat in a field for a week
      // spreads at the bottom instead of balancing on a tangent line.
      const c = Math.cos(theta);
      const cy = c >= 0 ? c : -Math.pow(-c, settle);
      // A fed-out end is not cut with a knife. Ragging the last ring's x per column is what
      // stops the eaten face from being a clean machined disc.
      const torn = j === axial && tornEnd ? tornEnd * hashSigned(i % radial, 7, 0, seed + 13) : 0;
      points.push([x + torn, axisY + r * yScale * cy, r * zScale * Math.sin(theta)]);
    }
    return points;
  }

  const rings = [];
  for (let j = 0; j <= axial; j += 1) rings.push(ringAt(j));

  // ---- barrel: radial x axial quads -----------------------------------------------------
  const barrelVerts = [];
  const pushTri = (target, a, b, c) => {
    target.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  for (let j = 0; j < axial; j += 1) {
    for (let i = 0; i < radial; i += 1) {
      const n = (i + 1) % radial;
      const a = rings[j][i];
      const b = rings[j][n];
      const c = rings[j + 1][n];
      const d = rings[j + 1][i];
      pushTri(barrelVerts, a, c, b);
      pushTri(barrelVerts, a, d, c);
    }
  }
  const barrel = new THREE.BufferGeometry();
  barrel.setAttribute("position", new THREE.BufferAttribute(new Float32Array(barrelVerts), 3));

  // ---- caps: concentric rings scaled off the shared rim, terraced into a coil ------------
  function buildCap(j, sign, eaten) {
    const rim = rings[j];
    const ringList = eaten ? eaten.rings : capRings;
    const capVerts = [];
    const shells = ringList.map((t, ringIndex) => {
      const shell = [];
      for (let i = 0; i < radial; i += 1) {
        const theta = thetaOf(i); // the coil phase has to follow the same columns the rim uses
        const rimPoint = rim[i];
        const dy = rimPoint[1] - axisY;
        const dz = rimPoint[2];
        const fade = Math.min(1, (1 - t) * 6); // keeps the rim ring identical to the barrel's
        let inset;
        if (eaten) {
          // A chewed cross-section, not a coil. Depth grows toward the middle (that is where a
          // cow or a fork gets to first), carries a per-column irregularity, and is then snapped
          // to the same fixed `layer` the wound shells use — so the face terraces into the
          // actual layers of the roll instead of into an arbitrary staircase.
          // Flat-bottomed with steep walls, not a cone. A linear (1 - t) profile turns the
          // face into a funnel and the terraces spiral into a vortex at the hub; pow 2.2 keeps
          // the middle broadly hollowed and puts the steps where the layers actually are.
          const base = eaten.depth * (1 - Math.pow(t, 2.2));
          const rough = eaten.irregular * hashAt(i % radial, ringIndex, 5, seed + 61);
          inset = Math.round(((base + rough) * fade) / eaten.layer) * eaten.layer;
        } else {
          // Coil terrace: a sawtooth in (radius, theta), faded out over the outer 17 % of the
          // face so the rim ring still matches the barrel exactly and the seam stays watertight.
          const phase = capTurns * (1 - t) + theta / (Math.PI * 2);
          const step = capStep * (phase - Math.floor(phase)) * fade;
          const dish = capDish * (1 - t) * (1 - t);
          const wobble = t > 0.98 ? 0 : 0.012 * hashSigned(i, Math.round(t * 100), 3, seed + 41);
          inset = dish + step + wobble;
        }
        // Measured off the rim column's own x, so a torn end ring carries through the face.
        shell.push([rimPoint[0] - sign * inset, axisY + dy * t, dz * t]);
      }
      return shell;
    });
    for (let s = 0; s < shells.length - 1; s += 1) {
      const outer = shells[s];
      const inner = shells[s + 1];
      for (let i = 0; i < radial; i += 1) {
        const n = (i + 1) % radial;
        if (sign > 0) {
          pushTri(capVerts, outer[i], inner[i], inner[n]);
          pushTri(capVerts, outer[i], inner[n], outer[n]);
        } else {
          pushTri(capVerts, outer[i], inner[n], inner[i]);
          pushTri(capVerts, outer[i], outer[n], inner[n]);
        }
      }
    }
    // Centre fan. The hub continues the dish curve rather than exceeding it — an over-deep hub
    // turns the coil into a whirlpool, which is what the first render pass showed. On an eaten
    // face the hub is the deepest point instead: that is where the feeding started.
    const last = shells[shells.length - 1];
    const hubInset = eaten
      ? Math.round((eaten.depth * 0.96) / eaten.layer) * eaten.layer
      : capDish * 1.02;
    const hub = [rim[0][0] - sign * hubInset, axisY, 0];
    for (let i = 0; i < radial; i += 1) {
      const n = (i + 1) % radial;
      if (sign > 0) pushTri(capVerts, last[i], hub, last[n]);
      else pushTri(capVerts, last[i], last[n], hub);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capVerts), 3));
    return cap;
  }

  return {
    barrel,
    capNeg: buildCap(0, -1, null),
    capPos: buildCap(axial, 1, eatenEnd),
    axisY,
    radius,
    halfWidth,
    xMin,
    xMax,
  };
}

/**
 * Twine band wrapped around the barrel at axial station x. Outer face plus both side walls —
 * the inner face is buried in the straw and is not authored.
 */
export function twineBand(THREE, spec) {
  const {
    axisY,
    radius,
    x,
    width = 0.055,
    lift = 0.065,
    radial = 18,
    yScale = 0.98,
    zScale = 1.02,
    settle = 0.88,
    seed = 3,
  } = spec;
  const verts = [];
  const point = (i, side, out) => {
    const theta = ((i % radial) / radial) * Math.PI * 2;
    // The cord is cinched tight over the crown and sinks into the straw as it comes round the
    // shoulders — a cord standing equally proud all the way round reads as a hula hoop.
    const grip = out ? lift * (0.34 + 0.66 * (0.5 + 0.5 * Math.cos(theta))) : -0.02;
    const r = radius * (1 + grip) * (1 + 0.01 * hashSigned(i % radial, 0, 0, seed));
    const c = Math.cos(theta);
    const cy = c >= 0 ? c : -Math.pow(-c, settle);
    return [x + side * width * 0.5, axisY + r * yScale * cy, r * zScale * Math.sin(theta)];
  };
  const tri = (a, b, c) => verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < radial; i += 1) {
    const n = i + 1;
    const oL = point(i, -1, true);
    const oR = point(i, 1, true);
    const oL2 = point(n, -1, true);
    const oR2 = point(n, 1, true);
    const iL = point(i, -1, false);
    const iR = point(i, 1, false);
    const iL2 = point(n, -1, false);
    const iR2 = point(n, 1, false);
    tri(oL, oR, oR2);
    tri(oL, oR2, oL2); // outer face
    tri(iL, oL2, oL);
    tri(iL, iL2, oL2); // -X side wall
    tri(iR, oR, oR2);
    tri(iR, oR2, iR2); // +X side wall
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return geometry;
}

// ================================================================================ painters

/**
 * Straw on the barrel. The grain runs AROUND the axis, so the tonal banding is spaced ALONG
 * the axis — that is what makes the bands read as wound layers instead of as noise. Faces that
 * sit well inside the bale radius get the damp compressed-core tone, which is the only thing
 * that makes a cut section look cut.
 */
export function barrelPainter(spec) {
  const { axisY, radius, yScale = 0.98, zScale = 1.02, layer = 0, seed = 21 } = spec;
  const body = rgb(WAVE2_PALETTE.hayBody);
  const light = rgb(WAVE2_PALETTE.hayLight);
  const shadow = rgb(WAVE2_PALETTE.hayShadow);
  const core = rgb(WAVE2_PALETTE.hayCore);
  return (cx, cy, cz, nx, ny, nz) => {
    // Undo the settle squash before measuring, so a shell index means the same thing all the
    // way round instead of drifting by 2 % between the crown and the flanks.
    const dist = Math.hypot((cy - axisY) / yScale, cz / zScale);
    const depth = clamp01((radius - dist) / (radius * 0.55)); // 0 surface -> 1 deep core
    // Straw banding: one slow layer plus one fine layer, both along the axis.
    const grain = noise1(cx * 6.5, seed) * 0.62 + noise1(cx * 27, seed + 7) * 0.38;
    let color = grain < 0.5 ? mix(shadow, body, grain * 2) : mix(body, light, (grain - 0.5) * 2);
    color = mix(color, core, depth * 0.82);
    // Exposed wound layers, painted at the SAME fixed radii the trough geometry snaps to.
    // This is the half of the strata that does not depend on grid resolution: even where a
    // terrace is only one column wide, alternating the tone from shell to shell keeps the
    // layering legible. Geometry and colour describe the same shells, which is what makes the
    // cut face read as a cut and not as a dent.
    if (layer > 0 && depth > 0.02) {
      const shell = Math.round(dist / layer);
      const alternate = shell % 2 === 0 ? 0.22 : -0.16;
      color = mix(color, alternate > 0 ? light : shadow, Math.abs(alternate) * clamp01(depth * 2.2));
    }
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, light, 0.4 * key * (1 - depth * 0.6));
    color = mix(color, shadow, 0.5 * clamp01(-ny));
    return shift(color, 0.045 * hashSigned(cx, cy, cz, seed + 3));
  };
}

/**
 * Straw on the roll's end face. Here the grain IS the spiral, so the tone steps with the same
 * phase the terracing steps with — the coil is drawn twice, once in geometry and once in
 * value, and the two agree.
 */
export function capPainter(spec) {
  const { axisY, radius, capTurns = 3.4, seed = 33 } = spec;
  const body = rgb(WAVE2_PALETTE.hayBody);
  const light = rgb(WAVE2_PALETTE.hayLight);
  const shadow = rgb(WAVE2_PALETTE.hayShadow);
  return (cx, cy, cz, nx, ny, nz) => {
    const dy = cy - axisY;
    const t = clamp01(Math.hypot(dy, cz) / radius);
    const theta = Math.atan2(cz, dy);
    const phase = capTurns * (1 - t) + theta / (Math.PI * 2);
    const frac = phase - Math.floor(phase);
    // Three tones cycling along the coil: shaded riser, body tread, dusty lit edge.
    let color = frac < 0.34 ? mix(shadow, body, frac / 0.34) : frac < 0.72 ? body : mix(body, light, (frac - 0.72) / 0.28);
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, light, 0.3 * key);
    color = mix(color, shadow, 0.34 * clamp01(-ny) + 0.16 * (1 - t));
    return shift(color, 0.05 * hashSigned(cx, cy, cz, seed));
  };
}

/**
 * The eaten cross-section.
 *
 * A round bale is a coil, so a face torn off one is a set of concentric wound layers seen
 * end-on. The tone therefore steps by SHELL INDEX — the same fixed radii the geometry terraces
 * to — and darkens with how far back into the roll that patch has been eaten. Between them the
 * two give the face what a smooth ochre lump can never have: a readable internal structure.
 */
export function eatenPainter(spec) {
  const { axisY, radius, layer, faceX, yScale = 0.98, zScale = 1.02, seed = 43 } = spec;
  const body = rgb(WAVE2_PALETTE.hayBody);
  const light = rgb(WAVE2_PALETTE.hayLight);
  const shadow = rgb(WAVE2_PALETTE.hayShadow);
  const core = rgb(WAVE2_PALETTE.hayCore);
  return (cx, cy, cz, nx, ny, nz) => {
    const dist = Math.hypot((cy - axisY) / yScale, cz / zScale);
    const t = clamp01(dist / radius);
    const shell = Math.round(dist / layer);
    // How far back this patch has been chewed. The hollow centre is damp and dark; the outer
    // rings are still dry straw.
    const bite = clamp01((faceX - cx) / (radius * 0.55));
    let color = mix(body, core, 0.3 + 0.55 * bite);
    color = mix(color, shell % 2 === 0 ? light : shadow, 0.26);
    color = mix(color, light, 0.2 * t); // the intact outer rings stay closest to the barrel tone
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, light, 0.3 * key * (1 - bite * 0.5));
    color = mix(color, shadow, 0.36 * clamp01(-ny));
    return shift(color, 0.05 * hashSigned(cx, cy, cz, seed));
  };
}

/** Loose straw: brighter, drier, dustier than the packed bale so it separates from it. */
export function loosePainter(spec = {}) {
  const { seed = 51, tint = 0 } = spec;
  const dust = rgb(WAVE2_PALETTE.hayDust);
  const light = rgb(WAVE2_PALETTE.hayLight);
  const shadow = rgb(WAVE2_PALETTE.hayShadow);
  return (cx, cy, cz, nx, ny, nz) => {
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    let color = mix(dust, light, 0.45 * key + tint * 0.3);
    // Only lightly darkened underneath. A loose blade is thin enough to transmit light; drop
    // its undersides to full shadow and a tuft turns into a cluster of black insect legs.
    color = mix(color, shadow, 0.24 * clamp01(-ny));
    return shift(color, 0.05 * hashSigned(cx, cy, cz, seed));
  };
}

export function twinePainter(seed = 61) {
  const base = rgb(WAVE2_PALETTE.twine);
  const light = rgb(WAVE2_PALETTE.hayLight);
  const shadow = rgb(WAVE2_PALETTE.hayShadow);
  const core = rgb(WAVE2_PALETTE.hayCore);
  return (cx, cy, cz, nx, ny, nz) => {
    // The twist: a fast band along the wrap direction so the cord does not read as a hoop.
    const twist = noise1((Math.atan2(cz, cy) + Math.PI) * 9, seed);
    let color = mix(base, twist > 0.5 ? light : shadow, 0.5);
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, light, 0.42 * key);
    // The cord's side walls face along the bale axis. Sinking them to the core tone plants a
    // contact shadow either side of the rope — without it a raised cord reads as a painted
    // stripe, which is what two render passes of a lighter, flatter twine kept producing.
    color = mix(color, core, 0.55 * Math.abs(nx));
    color = mix(color, shadow, 0.4 * clamp01(-ny));
    return color;
  };
}

/**
 * Timber. `grainAxis` is the plank's long axis: tone streaks ALONG it, which is why every
 * visible plank face is segmented along that same axis. `-ny` darkening is what turns each
 * air gap between planks into a shadow line instead of a hole.
 */
export function woodPainter(spec) {
  const {
    role = "crateBody",
    grainAxis = "x",
    // Length of one authored segment along the board. The grain lookup is SNAPPED to it, so
    // both triangles of a segment get the same tone. Without the snap the two halves of every
    // quad drift apart and the board shows its triangulation as a diagonal seam instead of
    // showing grain — which is exactly what the first crate render produced.
    grainStep = 0,
    // Pitch between neighbouring boards on the same face, and the axis they are stacked along.
    // Offsetting the noise by the board index is what stops eleven boards cut from the same
    // routine from being eleven identical boards.
    boardAxis = "y",
    boardStep = 0,
    seed = 71,
    wear = 0,
  } = spec;
  const base = rgb(WAVE2_PALETTE[role]);
  const light = rgb(WAVE2_PALETTE.crateLight);
  const shadow = rgb(WAVE2_PALETTE.crateShadow);
  const deep = rgb(WAVE2_PALETTE.crateFrame);
  return (cx, cy, cz, nx, ny, nz) => {
    const raw = grainAxis === "x" ? cx : grainAxis === "z" ? cz : cy;
    const t = grainStep > 0 ? Math.round(raw / grainStep) * grainStep : raw;
    const across = boardAxis === "x" ? cx : boardAxis === "z" ? cz : cy;
    const boardIndex = boardStep > 0 ? Math.round(across / boardStep) : 0;
    const grain =
      noise1(t * 9 + boardIndex * 3.7 + seed * 0.31, seed) * 0.62 +
      noise1(t * 26 + boardIndex * 11.3 + seed * 0.17, seed + 9) * 0.38;
    let color = grain < 0.5 ? mix(mix(base, shadow, 0.8), base, grain * 2) : mix(base, light, (grain - 0.5) * 1.4);
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    color = mix(color, light, 0.28 * key);
    color = mix(color, deep, 0.5 * clamp01(-ny)); // undersides -> the slit between boards
    if (wear) color = mix(color, light, wear * clamp01(ny) * 0.35); // scuffed top edges
    return shift(color, 0.03 * hashSigned(cx, cy, cz, seed + 5));
  };
}

/** Flat dark tone for hardware and for the fill plate under a heaped crate. */
export function flatPainter(role, seed = 81, keyAmount = 0.34) {
  const base = rgb(WAVE2_PALETTE[role]);
  return (cx, cy, cz, nx, ny, nz) => {
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    let color = mix(base, [1, 1, 1], keyAmount * key * 0.55);
    color = mix(color, [0, 0, 0], 0.3 * clamp01(-ny));
    return shift(color, 0.02 * hashSigned(cx, cy, cz, seed));
  };
}

export function applePainter(seed = 91) {
  const body = rgb(WAVE2_PALETTE.appleBody);
  const blush = rgb(WAVE2_PALETTE.appleBlush);
  const shade = rgb(WAVE2_PALETTE.appleShade);
  return (cx, cy, cz, nx, ny, nz) => {
    const key = clamp01(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
    // A cheek that faces the sun goes gold; the shaded side stays deep red. One fruit, two
    // readable values — which is what stops eight of them reading as one red mass.
    let color = mix(body, blush, 0.38 * key * key);
    color = mix(color, shade, 0.55 * clamp01(-ny) + 0.3 * (1 - key));
    return shift(color, 0.04 * hashSigned(cx, cy, cz, seed));
  };
}

/**
 * A low-poly apple: squashed icosahedron with a shallow stem well. 20 triangles.
 *
 * The well is a gentle 12 % pull on the top ring only. An earlier version pinched it 28 % and
 * every fruit came out looking like a small pumpkin with a crease.
 */
export function appleGeometry(THREE, spec) {
  const { radius = 0.045, seed = 7 } = spec;
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const push = 1 + 0.07 * hashSigned(x, y, z, seed);
    const crown = y > radius * 0.7 ? 0.88 : 1;
    position.setXYZ(i, x * push * 1.04, y * push * 0.92 * crown, z * push * 1.04);
  }
  return geometry;
}

// ================================================================================== crate

/**
 * A crate board. `segs` subdivides the board ALONG its long axis so the grain painter has
 * somewhere to put a streak; a board with one segment per face can only ever show two tones.
 */
export function board(THREE, size, position, rotation = [0, 0, 0], segs = 1, grainAxis = "x") {
  const [w, h, d] = size;
  const geometry =
    grainAxis === "z"
      ? new THREE.BoxGeometry(w, h, d, 1, 1, segs)
      : grainAxis === "y"
        ? new THREE.BoxGeometry(w, h, d, 1, segs, 1)
        : new THREE.BoxGeometry(w, h, d, segs, 1, 1);
  return at(THREE, geometry, position, rotation);
}

/**
 * A crate board that spends its subdivision only on the faces you can actually see.
 *
 * `board()` above uses THREE.BoxGeometry, whose widthSegments splits FOUR faces — the two broad
 * ones you look at and the two narrow edges buried in the gap between boards. At 3 segments a
 * wall board costs 28 triangles and 16 of them are spent on edges nobody will ever see, which
 * caps the grain at three tonal blocks per board and makes the "streak" read as blocking.
 *
 * This builds the box by hand and splits only the pair of faces named by `face`. Same 28
 * triangles, five grain bands instead of three, and the narrow edges stay single quads where
 * they belong.
 *
 *   face "z" — board long in X, thin in Z (front and back walls): splits +Z / -Z along X
 *   face "x" — board long in Z, thin in X (side walls):           splits +X / -X along Z
 *   face "y" — board long in X, thin in Y (lid boards):           splits +Y / -Y along X
 */
export function grainBoard(THREE, size, position, rotation = [0, 0, 0], segs = 3, face = "z") {
  const [w, h, d] = size;
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const verts = [];
  const quad = (a, b, c, e) => verts.push(...a, ...b, ...c, ...a, ...c, ...e);

  if (face === "z") {
    for (let s = 0; s < segs; s += 1) {
      const x0 = -hx + (s / segs) * w;
      const x1 = -hx + ((s + 1) / segs) * w;
      quad([x0, -hy, hz], [x1, -hy, hz], [x1, hy, hz], [x0, hy, hz]);
      quad([x1, -hy, -hz], [x0, -hy, -hz], [x0, hy, -hz], [x1, hy, -hz]);
    }
    quad([hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]);
    quad([-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]);
    quad([-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]);
    quad([-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]);
  } else if (face === "x") {
    for (let s = 0; s < segs; s += 1) {
      const z0 = -hz + (s / segs) * d;
      const z1 = -hz + ((s + 1) / segs) * d;
      quad([hx, -hy, z1], [hx, -hy, z0], [hx, hy, z0], [hx, hy, z1]);
      quad([-hx, -hy, z0], [-hx, -hy, z1], [-hx, hy, z1], [-hx, hy, z0]);
    }
    quad([-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]);
    quad([hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]);
    quad([-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]);
    quad([-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]);
  } else {
    for (let s = 0; s < segs; s += 1) {
      const x0 = -hx + (s / segs) * w;
      const x1 = -hx + ((s + 1) / segs) * w;
      quad([x0, hy, hz], [x1, hy, hz], [x1, hy, -hz], [x0, hy, -hz]);
      quad([x0, -hy, -hz], [x1, -hy, -hz], [x1, -hy, hz], [x0, -hy, hz]);
    }
    quad([hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]);
    quad([-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]);
    quad([-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]);
    quad([hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return at(THREE, geometry, position, rotation);
}

/** Nail / clout head: a small proud box. Cheapest primitive that still catches the key light. */
export function nailHead(THREE, position, facing = "z", size = 0.016) {
  const t = 0.007;
  const dims = facing === "z" ? [size, size, t] : facing === "x" ? [t, size, size] : [size, t, size];
  return at(THREE, new THREE.BoxGeometry(dims[0], dims[1], dims[2]), position);
}

/**
 * Reports what a factory actually produced, so a listing can quote measured numbers instead
 * of intentions. Stored on root.userData.measured.
 */
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
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    triangles,
    meshes,
    materials: materials.size,
    sizeMeters: [Number(size.x.toFixed(3)), Number(size.y.toFixed(3)), Number(size.z.toFixed(3))],
    groundedAtY: Number(bounds.min.y.toFixed(4)),
  };
}
