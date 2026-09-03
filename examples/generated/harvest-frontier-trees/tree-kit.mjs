/**
 * Harvest Frontier tree set — one parameterised procedural three.js factory that
 * emits six InstancedMesh-ready templates (3 species x 2 forms).
 *
 * Written code-first in the img2threejs discipline (blockout -> structure -> form ->
 * material), no photogrammetry, no downloaded art. Runs on the Clunk generation rail:
 * `scripts/threejs-to-glb.mjs <entry>.factory.mjs <out>.glb` (docs/generate-pipeline.ko.md).
 *
 * CONTRACT THE CONSUMER CAN RELY ON
 * --------------------------------
 * Every template exports as exactly:
 *
 *   Group "<templateId>"            identity transform
 *     Mesh "trunk"                  identity transform, material `hf_tree_bark`
 *     Mesh "canopy"                 identity transform, material `hf_tree_foliage`
 *
 *   - 3 nodes, 2 primitives, 2 materials, 0 textures, 0 empty nodes, 0 non-unit scale.
 *     Every authoring transform is baked into the vertex data, so each mesh's geometry
 *     can be handed straight to `new THREE.InstancedMesh(geometry, material, count)`.
 *   - NO per-instance material. All colour lives in the geometry as COLOR_0
 *     (`vertexColors: true` against a white base), which is the same discipline as
 *     `assetUtils.paintVertexColors` / `mergeColoredParts` on the Harvest side.
 *   - Colours are baked per FACE (all three corners share one value) so the facets read
 *     hard-edged, and normals are flat (non-indexed + computeVertexNormals) so no
 *     smoothing group survives export to soften the low-poly read.
 *   - Scale / rotation / position variety is deliberately NOT baked in: that is the
 *     scatter layer's job. Two templates of the same species differ in FORM, not in size.
 *
 * Budgets held per template: <= 3,000 triangles, <= 2 materials.
 *
 * Palette is `.art/STYLE_BIBLE.md` verbatim (Harvest Frontier, read-only reference):
 * deep pine / botanical green / sage / harvest gold / sunlit ivory / soil umber /
 * barn oxide / sky haze / charcoal ink. Leaves are "deep green with lighter tips";
 * wood is "warm, rough and slightly varied".
 */

// --------------------------------------------------------------------------- colour

/** Harvest Frontier visual bible palette, sRGB. */
const PALETTE = {
  pine: "#17271f",
  botanical: "#55795a",
  sage: "#8ea58a",
  gold: "#dcae55",
  ivory: "#f2ead9",
  soil: "#7f593d",
  barn: "#9b4f3e",
  charcoal: "#253029",
  sky: "#c8d9d2",
};

/** sRGB hex -> [r, g, b] in 0..1 sRGB space. Mixing happens here, conversion happens at write. */
function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

function mix(a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function shift(color, amount) {
  return [
    Math.min(1, Math.max(0, color[0] + amount)),
    Math.min(1, Math.max(0, color[1] + amount)),
    Math.min(1, Math.max(0, color[2] + amount)),
  ];
}

/**
 * glTF stores COLOR_0 in linear space. We author and mix in sRGB (predictable against the
 * style bible hexes) and convert once, at the moment the buffer is written, so the result
 * does not depend on `THREE.ColorManagement` being enabled in the exporting process.
 */
function toLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

// --------------------------------------------------------------------------- noise

/** Deterministic mulberry32, so the same template always exports the same bytes. */
function seededRandom(seed) {
  let state = (Math.floor(seed * 1000) ^ 0x6d2b79f5) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash of a *position*, not of a vertex index. Deforming and colouring by position keeps
 * duplicated seam/cap vertices welded: two vertices at the same coordinate always get the
 * same answer, so the surface never tears and the facets never crack.
 */
function hashAt(x, y, z, salt) {
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
function hashSigned(x, y, z, salt) {
  return hashAt(x, y, z, salt) * 2 - 1;
}

// --------------------------------------------------------------------------- geometry

/** Strip everything the runtime does not need, then bake flat per-face normals. */
function finish(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  // No textures anywhere in this set, so UVs are pure payload. Dropping them is ~8 bytes
  // per vertex and TEX-MISSING-UV0 only fires on textured assets.
  if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
  if (flat.getAttribute("uv1")) flat.deleteAttribute("uv1");
  flat.computeVertexNormals();
  return flat;
}

function placeDir(THREE, geometry, origin, direction) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(origin[0], origin[1], origin[2]),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function placeScaled(THREE, geometry, position, scale, yaw = 0) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * A tapered, leaning, root-flared stem built by reshaping one unit cylinder.
 *
 * The flare and the bark wobble ride on the existing vertex rings, so silhouette detail at
 * the base costs zero extra triangles — which is the whole reason this is one deformed
 * cylinder instead of a stack of primitives.
 */
function stemGeometry(THREE, spec) {
  const {
    height,
    baseRadius,
    topRadius,
    radial = 8,
    rings = 5,
    taper = 1,
    lean = [0, 0],
    leanPower = 1.7,
    flare = 0,
    flareLobes = 3,
    flarePhase = 0,
    flareFalloff = 7,
    wobble = 0.05,
    seed = 1,
  } = spec;

  const geometry = new THREE.CylinderGeometry(1, 1, 1, radial, rings, false);
  const position = geometry.getAttribute("position");

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = clamp01(y + 0.5);
    const ring = Math.hypot(x, z);

    let radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, taper);
    if (flare > 0) {
      const theta = ring > 1e-6 ? Math.atan2(z, x) : 0;
      const falloff = Math.exp(-t * flareFalloff);
      radius += flare * falloff * (0.55 + 0.45 * Math.cos(flareLobes * theta + flarePhase));
    }
    radius *= 1 + wobble * hashSigned(x, y, z, seed);

    // Cap centres sit at ring === 0 and must stay on the axis or the cap fan inverts.
    const scale = ring > 1e-6 ? radius / ring : 0;
    const bend = Math.pow(t, leanPower);
    position.setXYZ(i, x * scale + lean[0] * bend, t * height, z * scale + lean[1] * bend);
  }

  return geometry;
}

/**
 * One canopy lobe: a jittered icosahedron. Detail 1 (80 tris) for lobes that carry the
 * silhouette, detail 0 (20 tris) for the small clumps that break up the seams between them.
 */
function lobeGeometry(THREE, radius, detail, jitter, seed) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const push = 1 + jitter * hashSigned(x, y, z, seed);
    const lateral = jitter * radius * 0.30;
    position.setXYZ(
      i,
      (x / length) * length * push + lateral * hashSigned(x, y, z, seed + 101),
      (y / length) * length * push + lateral * 0.6 * hashSigned(x, y, z, seed + 202),
      (z / length) * length * push + lateral * hashSigned(x, y, z, seed + 303),
    );
  }
  return geometry;
}

/**
 * One conifer skirt: a cone whose profile is bent concave and whose rim is cut into a
 * ragged bough line. Both moves ride the existing rings, so a skirt stays at 4-5 dozen
 * triangles while reading as needles rather than as a party hat.
 */
function skirtGeometry(THREE, spec) {
  const { radius, height, radial = 12, curve = 0.85, jag = 0.16, seed = 1 } = spec;
  const geometry = new THREE.ConeGeometry(1, 1, radial, 2, false);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = clamp01(y + 0.5);
    const ring = Math.hypot(x, z);
    let value = radius * Math.pow(Math.max(0, 1 - t), curve);
    const rim = Math.max(0, 1 - t * 3);
    value *= 1 + jag * rim * hashSigned(x, 0, z, seed);
    const scale = ring > 1e-6 ? value / ring : 0;
    position.setXYZ(i, x * scale, t * height, z * scale);
  }
  return geometry;
}

// --------------------------------------------------------------------------- painting

/**
 * Bake one colour per triangle into COLOR_0.
 *
 * Per-face rather than per-vertex is the point: interpolating across a face would soften
 * exactly the facet edges the low-poly read depends on. `paint` receives the face centroid
 * and the face normal and returns an sRGB triple.
 */
function paintFaces(THREE, geometry, paint) {
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
 * Sky term, not a sun.
 *
 * These used to shade against a fixed direction, [0.58, 0.62, 0.53], baked
 * straight into COLOR_0. A buyer who rotated the tree about Y got a different
 * tree: the same trunk read bright facing one way and flat facing the other,
 * and the sprite exports came out with visible brightness drift between angles
 * because each frame saw a different side of a sun that never moved with it.
 *
 * Vertical facing is the part worth keeping. Undersides sit in shadow and
 * upward faces catch the sky no matter which way the tree is turned, so the
 * crown still reads as a volume while the asset stays rotation-invariant and
 * lights correctly under the buyer's own scene lighting.
 */
function skyKey(ny) {
  return clamp01(0.5 + 0.5 * ny);
}

function barkPainter(template, extent) {
  const base = rgb(template.bark.base);
  const shadow = rgb(template.bark.shadow);
  const light = rgb(template.bark.light);
  const span = Math.max(0.001, extent.max - extent.min);
  return (cx, cy, cz, nx, ny, nz) => {
    const t = clamp01((cy - extent.min) / span);
    // Damp, dark at the root flare; warmer and lighter into the crown.
    let color = mix(shadow, base, smoothstep(0, 0.30, t));
    color = mix(color, light, 0.42 * smoothstep(0.15, 1, t));
    const key = skyKey(ny);
    color = mix(color, light, 0.34 * key);
    color = mix(color, shadow, 0.30 * clamp01(-ny));
    return shift(color, 0.045 * hashSigned(cx, cy, cz, 77));
  };
}

function leafPainter(template, extent, tint) {
  const base = rgb(template.leaf.base);
  const shadow = rgb(template.leaf.shadow);
  const light = rgb(template.leaf.light);
  const span = Math.max(0.001, extent.max - extent.min);
  return (cx, cy, cz, nx, ny, nz) => {
    const t = clamp01((cy - extent.min) / span);
    const key = skyKey(ny);
    // Three-stop ramp: shaded underside -> body -> sunlit tips. Height and facing are
    // weighted together so the crown reads as a lit volume, not as a gradient decal.
    const lift = clamp01(0.44 * t + 0.56 * key);
    const color =
      lift < 0.5 ? mix(shadow, base, lift * 2) : mix(base, light, (lift - 0.5) * 2);
    // Per-lobe tint is what keeps the clusters legible as separate masses.
    const lobed = tint >= 0 ? mix(color, light, tint * 0.20) : mix(color, shadow, -tint * 0.24);
    return shift(lobed, 0.038 * hashSigned(cx, cy, cz, 31));
  };
}

// --------------------------------------------------------------------------- merging

/**
 * Concatenate non-indexed position/normal/color geometries into one buffer.
 *
 * Written out longhand instead of pulling in BufferGeometryUtils so the factory keeps the
 * rail's contract exactly — it touches nothing but the `THREE` namespace it is handed.
 */
function mergeParts(THREE, parts) {
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

function verticalExtent(parts) {
  let min = Infinity;
  let max = -Infinity;
  for (const part of parts) {
    const position = part.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 1 };
}

// --------------------------------------------------------------------------- canopies

/**
 * Round broadleaf crown — lobes distributed on a squashed shell by golden-angle spiral, so
 * the mass is even but never symmetric, plus a couple of core lobes so the crown is not
 * hollow when the camera looks through a gap.
 */
function roundCrown(spec, rand) {
  const {
    center,
    radius,
    squash = 0.82,
    shellCount = 11,
    coreCount = 4,
    fillCount = 8,
    lobeScale = 0.40,
    lift = 1.0,
  } = spec;
  const clusters = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < coreCount; i += 1) {
    const angle = golden * i * 3;
    const reach = radius * 0.30 * rand();
    clusters.push({
      position: [
        center[0] + Math.cos(angle) * reach,
        center[1] + (rand() - 0.45) * radius * 0.34 * squash,
        center[2] + Math.sin(angle) * reach,
      ],
      radius: radius * (lobeScale + 0.16) * (0.9 + 0.2 * rand()),
      scale: [1.06, squash * (0.92 + 0.16 * rand()), 1.06],
      detail: 1,
      tint: -0.35 - 0.3 * rand(),
      jitter: 0.19,
    });
  }

  for (let i = 0; i < shellCount; i += 1) {
    const u = (i + 0.5) / shellCount;
    const angle = golden * i;
    // Bias the shell into the upper dome: a crown is a canopy, not a ball on a stick.
    const polar = Math.acos(1 - 1.42 * u);
    const reach = radius * (0.62 + 0.30 * rand());
    const x = Math.sin(polar) * Math.cos(angle) * reach;
    const z = Math.sin(polar) * Math.sin(angle) * reach;
    const y = Math.cos(polar) * reach * squash * lift;
    const height = clamp01((y / (radius * squash)) * 0.5 + 0.5);
    clusters.push({
      position: [center[0] + x, center[1] + y, center[2] + z],
      radius: radius * lobeScale * (0.82 + 0.36 * rand()),
      scale: [1, squash * (0.86 + 0.22 * rand()), 1],
      detail: 1,
      tint: (height - 0.42) * 1.5,
      jitter: 0.22,
      yaw: rand() * Math.PI,
    });
  }

  for (let i = 0; i < fillCount; i += 1) {
    const angle = golden * (i + shellCount) * 1.7;
    const polar = Math.acos(1 - 1.55 * ((i + 0.5) / fillCount));
    const reach = radius * (0.80 + 0.22 * rand());
    const y = Math.cos(polar) * reach * squash * lift;
    clusters.push({
      position: [
        center[0] + Math.sin(polar) * Math.cos(angle) * reach,
        center[1] + y,
        center[2] + Math.sin(polar) * Math.sin(angle) * reach,
      ],
      radius: radius * lobeScale * 0.56 * (0.8 + 0.4 * rand()),
      scale: [1, squash, 1],
      detail: 0,
      tint: 0.4 + 0.5 * rand(),
      jitter: 0.26,
    });
  }

  return clusters;
}

/**
 * Vertical broadleaf — a flame profile. Widest around a third of the way up and drawn to a
 * point, with every lobe stretched on Y so even a single cluster reads as "upright".
 */
function flameColumn(spec, rand) {
  const { base, height, radius, rows = 9, shoulder = 0.34, stretch = 1.6 } = spec;
  const clusters = [];
  // Fast rise to a low shoulder, then a long taper to a point: a poplar flame, not a barrel.
  //
  // The floor is load-bearing, not cosmetic. Row spacing is height/rows, a lobe's vertical
  // half-extent is radius*profile*factor*stretch, and jitter can shave a quarter off that.
  // Let the profile run to zero and the top rows stop reaching each other — the crown then
  // ends in a chain of detached blobs floating over a gap, which is what the first two
  // renders of this template showed.
  const profile = (t) =>
    Math.max(
      0.24,
      t < shoulder
        ? Math.pow(t / shoulder, 0.5)
        : Math.pow(1 - (t - shoulder) / (1 - shoulder), 0.85),
    );

  for (let row = 0; row < rows; row += 1) {
    const t = (row + 0.5) / rows;
    const p = profile(t);
    // Rings of two or three lobes push the mass off-axis, so the outline is scalloped
    // rather than a smooth extrusion of one silhouette.
    const count = p > 0.62 ? 3 : p > 0.34 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + row * 1.31;
      const reach = count === 1 ? 0 : radius * p * 0.46;
      clusters.push({
        position: [
          base[0] + Math.cos(angle) * reach,
          base[1] + height * t,
          base[2] + Math.sin(angle) * reach,
        ],
        radius: radius * p * (count === 1 ? 0.98 : 0.64) * (0.9 + 0.2 * rand()),
        scale: [1, stretch * (0.9 + 0.2 * rand()), 1],
        detail: 1,
        tint: (t - 0.35) * 1.35,
        jitter: 0.24,
        yaw: rand() * Math.PI,
      });
    }
  }
  // Flank clumps stay below the taper: pushed out to 86% of the profile radius they would
  // detach near the tip, where the profile is already at its floor.
  for (let i = 0; i < 6; i += 1) {
    const t = 0.14 + 0.56 * ((i + 0.5) / 6);
    const p = profile(t);
    const angle = i * 2.4 + 0.7;
    clusters.push({
      position: [
        base[0] + Math.cos(angle) * radius * p * 0.86,
        base[1] + height * t + (rand() - 0.5) * 0.3,
        base[2] + Math.sin(angle) * radius * p * 0.86,
      ],
      radius: radius * p * 0.36,
      scale: [1, 1.35, 1],
      detail: 0,
      tint: 0.45 + 0.4 * rand(),
      jitter: 0.30,
    });
  }
  return clusters;
}

/**
 * Vertical broadleaf, tiered — horizontal shelves with open trunk between them. Same
 * species palette as the flame form; a completely different mass distribution.
 */
function tieredShelves(spec, rand) {
  const { base, shelves } = spec;
  const clusters = [];
  shelves.forEach((shelf, index) => {
    const { y, radius, thickness, count } = shelf;
    // Lobes are squashed to exactly `thickness` tall and pushed out to the shelf rim, so a
    // shelf is a plate with open sky above and below it — the whole point of this form.
    const lobe = radius * 0.40;
    const flat = thickness / (2 * lobe);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + index * 0.9;
      const reach = radius - lobe * (0.80 + 0.28 * rand());
      clusters.push({
        position: [
          base[0] + Math.cos(angle) * reach,
          base[1] + y + (rand() - 0.5) * thickness * 0.30,
          base[2] + Math.sin(angle) * reach,
        ],
        radius: lobe * (0.88 + 0.24 * rand()),
        scale: [1.1, flat, 1.1],
        detail: 1,
        tint: (index / Math.max(1, shelves.length - 1) - 0.30) * 1.5,
        jitter: 0.22,
        yaw: rand() * Math.PI,
      });
    }
    // A flattened core so each shelf reads as a continuous plate from below.
    clusters.push({
      position: [base[0], base[1] + y, base[2]],
      radius: radius * 0.56,
      scale: [1.05, (thickness * 0.85) / (2 * radius * 0.56), 1.05],
      detail: 0,
      tint: -0.6,
      jitter: 0.16,
    });
  });
  return clusters;
}

/** Broad clumps riding the rim of the umbrella pine's plates. */
function umbrellaClumps(spec, rand) {
  const { base, plates } = spec;
  const clusters = [];
  plates.forEach((plate, index) => {
    const { y, radius, count } = plate;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + index * 1.2;
      const reach = radius * (0.60 + 0.28 * rand());
      clusters.push({
        position: [
          base[0] + Math.cos(angle) * reach,
          base[1] + y + rand() * 0.22,
          base[2] + Math.sin(angle) * reach,
        ],
        radius: radius * 0.34 * (0.85 + 0.3 * rand()),
        scale: [1.2, 0.56, 1.2],
        detail: 1,
        tint: 0.15 + 0.55 * rand(),
        jitter: 0.24,
        yaw: rand() * Math.PI,
      });
    }
  });
  return clusters;
}

/** Needle clumps that break the conifer skirt rims out of a clean cone. */
function spireClumps(spec, rand) {
  const { base, skirts } = spec;
  const clusters = [];
  skirts.forEach((skirt, index) => {
    if (index % 2 === 1 && index !== skirts.length - 1) return;
    const count = index >= skirts.length - 2 ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + index * 1.7;
      const reach = skirt.radius * (0.72 + 0.2 * rand());
      clusters.push({
        position: [
          base[0] + Math.cos(angle) * reach,
          base[1] + skirt.y + skirt.height * 0.18,
          base[2] + Math.sin(angle) * reach,
        ],
        radius: skirt.radius * 0.30 * (0.8 + 0.3 * rand()),
        scale: [1, 0.72, 1],
        detail: 0,
        tint: 0.2 + 0.5 * rand(),
        jitter: 0.3,
      });
    }
  });
  return clusters;
}

// --------------------------------------------------------------------------- assembly

function stemProfile(spec) {
  const radiusAt = (t) =>
    spec.baseRadius + (spec.topRadius - spec.baseRadius) * Math.pow(clamp01(t), spec.taper ?? 1);
  const offsetAt = (t) => {
    const lean = spec.lean ?? [0, 0];
    const bend = Math.pow(clamp01(t), spec.leanPower ?? 1.7);
    return [lean[0] * bend, lean[1] * bend];
  };
  return { radiusAt, offsetAt };
}

/**
 * Where one branch attaches, which way it points, and how long it ends up.
 *
 * Split out of `buildBranches` so the containment diagnostic below measures the branch the
 * factory actually emits instead of a second copy of the same arithmetic — the two drifted
 * apart once already on the conifer skirts and that is how a branch ends up hanging in the
 * open air with nothing around it.
 *
 * Consumes exactly one random value, so a caller replaying a fresh RNG in branch order gets
 * the same lengths `createTree` gets.
 */
function branchPlacement(THREE, trunkSpec, branch, rand) {
  const { radiusAt, offsetAt } = stemProfile(trunkSpec);
  const t = branch.t;
  const offset = offsetAt(t);
  const yaw = branch.yaw;
  const attachRadius = radiusAt(t) * 0.55;
  const origin = [
    offset[0] + Math.cos(yaw) * attachRadius,
    trunkSpec.height * t,
    offset[1] + Math.sin(yaw) * attachRadius,
  ];
  const pitch = branch.pitch;
  const direction = new THREE.Vector3(
    Math.cos(yaw) * Math.sin(pitch),
    Math.cos(pitch),
    Math.sin(yaw) * Math.sin(pitch),
  );
  const length = branch.length * (0.88 + 0.24 * rand());
  return { origin, direction, length, droop: branch.droop ?? 0 };
}

/** The matrix `placeDir` would apply, without needing a geometry to apply it to. */
function branchMatrix(THREE, placement) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    placement.direction.clone().normalize(),
  );
  return new THREE.Matrix4().compose(
    new THREE.Vector3(placement.origin[0], placement.origin[1], placement.origin[2]),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
}

/**
 * A point on the branch axis in world space. `u` runs 0 (attachment) to 1 (tip).
 * Mirrors the axis `stemGeometry` builds: the lean offset rides `u ** leanPower` with
 * leanPower 2, and for a branch the lean is `[0, droop]`.
 */
function branchAxisPoint(THREE, placement, u) {
  const bend = Math.pow(u, 2);
  const local = new THREE.Vector3(0, u * placement.length, placement.droop * bend);
  return local.applyMatrix4(branchMatrix(THREE, placement));
}

function buildBranches(THREE, parts, trunkSpec, branches, rand) {
  branches.forEach((branch, index) => {
    const placement = branchPlacement(THREE, trunkSpec, branch, rand);
    const geometry = stemGeometry(THREE, {
      height: placement.length,
      baseRadius: branch.radius,
      topRadius: branch.radius * 0.32,
      radial: branch.radial ?? 6,
      rings: branch.rings ?? 2,
      taper: 0.85,
      lean: [0, placement.droop],
      leanPower: 2,
      wobble: 0.07,
      seed: 40 + index * 7,
    });
    parts.push(placeDir(THREE, geometry, placement.origin, placement.direction));
  });
}

/**
 * Diagnostic: the world-space axis of every branch a template emits, sampled from `fromU` to
 * the tip. Used by scripts/dogfood-tree-containment.mjs to ask whether a branch ends inside
 * the foliage or in the open air.
 *
 * The RNG is recreated from the template seed and read in branch order, which is exactly what
 * `createTree` does — leaders are placed before branches but consume no random values, so the
 * lengths returned here are the lengths in the GLB.
 */
/**
 * A leaf clump on the end of every branch.
 *
 * Without these, a branch is a bare stick that stops in open air short of the crown: the
 * silhouette reads as foliage floating above a tree rather than foliage growing on it, which is
 * what a player noticed first. Real boughs carry their leaves at the tip, so that is where the
 * clump goes.
 *
 * The clump is centred just inboard of the tip and sized to swallow the last fifth of the branch,
 * which is the span scripts/dogfood-tree-containment.mjs checks. `tuft` on a template scales it:
 * a species with small leaves wants a smaller ball than a broadleaf.
 */
function boughTufts(THREE, template) {
  const tuft = template.tuft ?? {};
  const scale = tuft.scale ?? 1;
  const minimum = tuft.minRadius ?? 0.42;
  return branchAxisSamples(THREE, template, 0.8, 2).map((branch, index) => {
    const centre = branchAxisSamples(THREE, template, tuft.centreU ?? 0.9, 1)[index].tip;
    // Reach from the clump centre back to u = 0.8 and forward past the tip, plus a margin so
    // the clump surface -- not just its centre -- covers the wood.
    const span = branch.length * Math.max((tuft.centreU ?? 0.9) - 0.8, 1 - (tuft.centreU ?? 0.9));
    return {
      position: [centre.x, centre.y, centre.z],
      radius: Math.max(minimum, span * 2.6) * scale,
      scale: tuft.squash ? [1.05, tuft.squash, 1.05] : [1.05, 0.9, 1.05],
      // detail 0 (20 triangles) on purpose: this is a filler clump that sits where a bough meets
      // the crown, the same job the small canopy clumps already do at detail 0. detail 1 would
      // quadruple its cost for a shape nobody sees in silhouette.
      detail: tuft.detail ?? 0,
      tint: tuft.tint ?? 0.15,
      jitter: 0.26,
      yaw: index * 1.1,
    };
  });
}

export function branchAxisSamples(THREE, template, fromU = 0.8, samples = 5) {
  const rand = seededRandom(template.seed);
  const trunkSpec = template.trunk;
  return (template.branches ?? []).map((branch, index) => {
    const placement = branchPlacement(THREE, trunkSpec, branch, rand);
    const points = [];
    for (let step = 0; step < samples; step += 1) {
      // One sample means "just fromU"; without this guard the divisor is zero and every
      // coordinate comes back NaN, which silently destroys whatever consumes the points.
      const u = samples === 1 ? fromU : fromU + ((1 - fromU) * step) / (samples - 1);
      points.push(branchAxisPoint(THREE, placement, u));
    }
    return {
      index,
      length: placement.length,
      radiusAtTip: branch.radius * 0.32,
      tip: points[points.length - 1],
      points,
    };
  });
}

function buildRoots(THREE, parts, trunkSpec, roots, rand) {
  if (!roots || roots.count <= 0) return;
  for (let i = 0; i < roots.count; i += 1) {
    const yaw = (i / roots.count) * Math.PI * 2 + (roots.phase ?? 0);
    const length = roots.length * (0.75 + 0.5 * rand());
    const geometry = stemGeometry(THREE, {
      height: length,
      baseRadius: roots.radius,
      topRadius: roots.radius * 0.22,
      radial: 5,
      rings: 1,
      taper: 0.7,
      wobble: 0.1,
      seed: 90 + i * 5,
    });
    const pitch = Math.PI * (0.5 + (roots.dip ?? 0.13));
    const direction = new THREE.Vector3(
      Math.cos(yaw) * Math.sin(pitch),
      Math.cos(pitch),
      Math.sin(yaw) * Math.sin(pitch),
    );
    const origin = [
      Math.cos(yaw) * trunkSpec.baseRadius * 0.35,
      roots.y ?? trunkSpec.height * 0.045,
      Math.sin(yaw) * trunkSpec.baseRadius * 0.35,
    ];
    parts.push(placeDir(THREE, geometry, origin, direction));
  }
}

function buildClusters(THREE, parts, clusters, seedBase) {
  clusters.forEach((cluster, index) => {
    const geometry = lobeGeometry(
      THREE,
      cluster.radius,
      cluster.detail ?? 1,
      cluster.jitter ?? 0.2,
      seedBase + index * 13,
    );
    parts.push({
      geometry: placeScaled(THREE, geometry, cluster.position, cluster.scale ?? [1, 1, 1], cluster.yaw ?? 0),
      tint: cluster.tint ?? 0,
    });
  });
}

/**
 * Build one template. Returns a Group with exactly two identity-transform meshes.
 *
 * @param {typeof import("three")} THREE injected by scripts/threejs-to-glb.mjs
 * @param {object} template one of TREE_TEMPLATES
 * @param {{ boughTufts?: boolean }} [options] diagnostic switches; defaults ship the tufts
 */
export function createTree(THREE, template, options = {}) {
  const rand = seededRandom(template.seed);

  // ---- bark ---------------------------------------------------------------
  const barkParts = [];
  const trunk = template.trunk;
  barkParts.push(stemGeometry(THREE, { ...trunk, seed: template.seed }));
  for (const leader of template.leaders ?? []) {
    const { radiusAt, offsetAt } = stemProfile(trunk);
    const offset = offsetAt(leader.t);
    const geometry = stemGeometry(THREE, {
      height: leader.height,
      baseRadius: radiusAt(leader.t) * (leader.radiusScale ?? 0.72),
      topRadius: radiusAt(leader.t) * (leader.radiusScale ?? 0.72) * 0.30,
      radial: leader.radial ?? 7,
      rings: leader.rings ?? 3,
      taper: 0.9,
      wobble: 0.05,
      seed: template.seed + 17,
    });
    const pitch = leader.pitch;
    const direction = new THREE.Vector3(
      Math.cos(leader.yaw) * Math.sin(pitch),
      Math.cos(pitch),
      Math.sin(leader.yaw) * Math.sin(pitch),
    );
    barkParts.push(
      placeDir(THREE, geometry, [offset[0], trunk.height * leader.t, offset[1]], direction),
    );
  }
  buildBranches(THREE, barkParts, trunk, template.branches ?? [], rand);
  buildRoots(THREE, barkParts, trunk, template.roots, rand);

  const barkFinished = barkParts.map((part) => finish(part));
  const barkExtent = verticalExtent(barkFinished);
  const barkPaint = barkPainter(template, barkExtent);
  for (const part of barkFinished) paintFaces(THREE, part, barkPaint);

  // ---- foliage ------------------------------------------------------------
  const foliageParts = [];
  for (const skirt of template.skirts ?? []) {
    foliageParts.push({
      geometry: placeScaled(
        THREE,
        skirtGeometry(THREE, { ...skirt, seed: template.seed + Math.round(skirt.y * 100) }),
        [skirt.x ?? 0, skirt.y, skirt.z ?? 0],
        skirt.scale ?? [1, 1, 1],
        skirt.yaw ?? 0,
      ),
      tint: skirt.tint ?? 0,
    });
  }
  buildClusters(THREE, foliageParts, template.canopy(rand, template), template.seed + 500);
  // Appended after the template's own canopy, and built from a fresh RNG inside boughTufts, so
  // adding tufts does not shift a single existing lobe. `boughTufts: false` builds the crown
  // without them, which is how the containment diagnostic asks "does the branch reach the crown
  // on its own, or only because it carries its own clump?".
  if (options.boughTufts !== false) {
    buildClusters(THREE, foliageParts, boughTufts(THREE, template), template.seed + 700);
  }

  const foliageFinished = foliageParts.map((part) => ({
    geometry: finish(part.geometry),
    tint: part.tint,
  }));
  const foliageExtent = verticalExtent(foliageFinished.map((part) => part.geometry));
  for (const part of foliageFinished) {
    paintFaces(THREE, part.geometry, leafPainter(template, foliageExtent, part.tint));
  }

  // ---- export shape -------------------------------------------------------
  const bark = new THREE.MeshStandardMaterial({
    name: "hf_tree_bark",
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const foliage = new THREE.MeshStandardMaterial({
    name: "hf_tree_foliage",
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });

  const root = new THREE.Group();
  root.name = template.id;
  root.userData = {
    generator: "clunk-generate-pipeline",
    kit: "harvest-frontier-tree-set-v1",
    template: template.id,
    species: template.species,
    form: template.form,
    formLanguage: template.formLanguage,
    upAxis: "+Y",
    originAtBase: true,
    instancing: {
      mode: "InstancedMesh",
      meshes: ["trunk", "canopy"],
      perInstanceMaterial: false,
      colorSource: "COLOR_0",
      note: "Both geometries are baked at identity; instance them directly and let the scatter layer own scale/rotation.",
    },
    palette: "harvest-frontier/.art/STYLE_BIBLE.md",
  };

  const trunkMesh = new THREE.Mesh(mergeParts(THREE, barkFinished), bark);
  trunkMesh.name = "trunk";
  root.add(trunkMesh);

  const canopyMesh = new THREE.Mesh(
    mergeParts(
      THREE,
      foliageFinished.map((part) => part.geometry),
    ),
    foliage,
  );
  canopyMesh.name = "canopy";
  root.add(canopyMesh);

  return root;
}

// --------------------------------------------------------------------------- templates

const BROADLEAF_BARK = { base: PALETTE.soil, shadow: PALETTE.charcoal, light: "#a87d55" };
const PALE_BARK = { base: "#9c866e", shadow: "#453d34", light: "#d8cdb6" };
const CONIFER_BARK = { base: "#6d4634", shadow: "#2a201a", light: PALETTE.barn };

// Three leaf ramps, spread far enough apart that the species still separate at scatter
// distance, but all drawn from the bible's pine / botanical / sage axis.
const BROADLEAF_LEAF = { base: PALETTE.botanical, shadow: PALETTE.pine, light: PALETTE.sage };
const COLUMN_LEAF = { base: "#7b9670", shadow: "#2d4232", light: "#bccaa6" };
const CONIFER_LEAF = { base: "#2f4c3c", shadow: "#12211b", light: "#6b8a6f" };

/**
 * Six templates: three species, two forms each. Read the `formLanguage` line to see what
 * each one is supposed to contribute to a skyline that currently repeats one blob.
 */
export const TREE_TEMPLATES = {
  "broadleaf-round-full": {
    id: "hf_tree_broadleaf_round_full",
    species: "broadleaf-round",
    form: "full",
    formLanguage:
      "One wide billowing dome — lobes packed into a mushroom mass that sits low and heavy over a short, thick, root-flared trunk.",
    seed: 11.3,
    bark: BROADLEAF_BARK,
    leaf: BROADLEAF_LEAF,
    trunk: {
      height: 3.6,
      baseRadius: 0.46,
      topRadius: 0.19,
      radial: 9,
      rings: 6,
      taper: 0.62,
      lean: [0.10, -0.07],
      flare: 0.30,
      flareLobes: 5,
      flareFalloff: 9,
      wobble: 0.055,
    },
    roots: { count: 5, length: 0.72, radius: 0.20, dip: 0.16, phase: 0.4 },
    // Every bough has to end inside the dome. The crown centre sits at y 5.25 with a 2.55 m
    // radius squashed to 0.80, so its underside is around y 3.2 -- a bough leaving the trunk at
    // y 2.2 needs roughly 2.5 m of rise, not the 1.1 m the first cut gave it. Pitch is the angle
    // from straight up, so the smaller numbers below are what turn a sideways stub into a limb
    // that climbs into the leaves.
    branches: [
      { t: 0.60, yaw: 0.5, pitch: 0.55, length: 2.9, radius: 0.13 },
      { t: 0.72, yaw: 2.6, pitch: 0.58, length: 2.5, radius: 0.13 },
      { t: 0.82, yaw: 4.5, pitch: 0.55, length: 2.1, radius: 0.12 },
      { t: 0.92, yaw: 3.4, pitch: 0.40, length: 1.2, radius: 0.10 },
    ],
    canopy: (rand) =>
      roundCrown(
        {
          center: [0.10, 5.25, -0.05],
          radius: 2.55,
          squash: 0.80,
          shellCount: 11,
          coreCount: 4,
          fillCount: 8,
          lobeScale: 0.42,
        },
        rand,
      ),
  },

  "broadleaf-round-forked": {
    id: "hf_tree_broadleaf_round_forked",
    species: "broadleaf-round",
    form: "forked",
    formLanguage:
      "The same round-lobe language split in two — a low fork throws one tall leader and one low sideways leader, so the crown is two offset masses with sky cutting between them.",
    seed: 27.9,
    bark: BROADLEAF_BARK,
    leaf: BROADLEAF_LEAF,
    trunk: {
      height: 2.3,
      baseRadius: 0.50,
      topRadius: 0.30,
      radial: 9,
      rings: 5,
      taper: 0.7,
      lean: [-0.16, 0.10],
      flare: 0.34,
      flareLobes: 4,
      flareFalloff: 8,
      wobble: 0.06,
    },
    roots: { count: 6, length: 0.80, radius: 0.21, dip: 0.17, phase: 0.9 },
    leaders: [
      { t: 0.97, yaw: 0.50, pitch: 0.36, height: 3.1, radiusScale: 0.80, radial: 8, rings: 4 },
      { t: 0.97, yaw: 3.75, pitch: 1.00, height: 2.6, radiusScale: 0.66, radial: 7, rings: 3 },
    ],
    // The two crowns sit at (1.15, 5.00, 0.60) and (-2.25, 3.05, -1.05). The first cut aimed both
    // boughs at neither of them, so both ended in the gap of sky between the masses. Each yaw
    // below points at one crown centre and the length is the distance to it.
    branches: [
      { t: 0.55, yaw: 3.58, pitch: 0.92, length: 2.35, radius: 0.11 },
      { t: 0.80, yaw: 0.48, pitch: 0.57, length: 2.90, radius: 0.11 },
    ],
    canopy: (rand) => [
      ...roundCrown(
        {
          center: [1.15, 5.00, 0.60],
          radius: 1.95,
          squash: 0.84,
          shellCount: 8,
          coreCount: 2,
          fillCount: 5,
          lobeScale: 0.44,
        },
        rand,
      ),
      ...roundCrown(
        {
          center: [-2.25, 3.05, -1.05],
          radius: 1.50,
          squash: 0.74,
          shellCount: 7,
          coreCount: 2,
          fillCount: 4,
          lobeScale: 0.46,
        },
        rand,
      ),
    ],
  },

  "broadleaf-column-flame": {
    id: "hf_tree_broadleaf_column_flame",
    species: "broadleaf-column",
    form: "flame",
    formLanguage:
      "A vertical flame — the crown starts near the ground, swells at a third height and tapers to a single point, so it reads as one tall stroke against the horizon.",
    seed: 44.1,
    bark: PALE_BARK,
    leaf: COLUMN_LEAF,
    trunk: {
      height: 8.4,
      baseRadius: 0.30,
      topRadius: 0.06,
      radial: 8,
      rings: 6,
      taper: 0.85,
      lean: [0.05, 0.12],
      flare: 0.20,
      flareLobes: 4,
      flareFalloff: 11,
      wobble: 0.05,
    },
    roots: { count: 5, length: 0.48, radius: 0.13, dip: 0.14, phase: 0.2 },
    branches: [
      { t: 0.30, yaw: 1.1, pitch: 0.42, length: 1.0, radius: 0.075 },
      { t: 0.52, yaw: 4.0, pitch: 0.36, length: 0.95, radius: 0.065 },
      { t: 0.72, yaw: 2.2, pitch: 0.30, length: 0.8, radius: 0.055 },
    ],
    canopy: (rand) =>
      flameColumn(
        { base: [0.06, 1.45, 0.10], height: 7.1, radius: 1.42, rows: 9, shoulder: 0.32, stretch: 1.55 },
        rand,
      ),
  },

  "broadleaf-column-tiered": {
    id: "hf_tree_broadleaf_column_tiered",
    species: "broadleaf-column",
    form: "tiered",
    formLanguage:
      "The same pale-barked species stacked as four horizontal shelves with open trunk between them — a wide flat-layered silhouette that stripes the skyline instead of filling it.",
    seed: 58.7,
    bark: PALE_BARK,
    leaf: COLUMN_LEAF,
    // CONTAINMENT INVARIANT — do not raise `height` past the top shelf's core.
    // This form ends in a thin plate, not a mass, so the trunk has very little foliage above it
    // to hide in. At height 6.5 the trunk top (6.50) stood above the whole canopy (6.44) and a
    // bare stub showed over the crown from every angle — 1350/1350 escape rays in
    // scripts/dogfood-tree-containment.mjs.
    //   top shelf   y 6.05, thickness 0.70, so its central core spans 5.75 .. 6.35 on the axis
    //               with radius 1.12*0.56*1.05 = 0.66 and up to ~0.10 m of jitter off the top
    //   trunk reach at top = topRadius*(1+wobble) + |lean| = 0.10*1.05 + 0.10 = 0.205 << 0.66
    // Ending the trunk at the shelf's own centre height leaves ~0.20 m of foliage above it in
    // the worst jitter case, and the model's height is now set by the canopy, as it should be.
    trunk: {
      height: 6.05,
      baseRadius: 0.34,
      topRadius: 0.10,
      radial: 9,
      rings: 6,
      taper: 0.78,
      lean: [-0.08, 0.06],
      flare: 0.22,
      flareLobes: 5,
      flareFalloff: 10,
      wobble: 0.05,
    },
    roots: { count: 5, length: 0.55, radius: 0.15, dip: 0.15, phase: 1.3 },
    // This form is four flat shelves with deliberate sky between them, so a bough that stops
    // between two shelves stops in that sky. Each `t` below leaves the trunk just under a shelf
    // and each pitch tilts up enough to finish inside it: shelves are at y 2.50 / 3.85 / 5.05 /
    // 6.05 and the trunk is 6.05 tall, so t 0.36 / 0.55 / 0.79 / 0.93 start at 2.18 / 3.33 /
    // 4.78 / 5.63.
    branches: [
      { t: 0.36, yaw: 0.4, pitch: 1.34, length: 1.55, radius: 0.075, droop: -0.10 },
      { t: 0.55, yaw: 2.5, pitch: 1.36, length: 1.40, radius: 0.070, droop: -0.10 },
      { t: 0.79, yaw: 4.6, pitch: 1.25, length: 1.30, radius: 0.062, droop: -0.08 },
      { t: 0.93, yaw: 1.13, pitch: 1.20, length: 0.90, radius: 0.055, droop: -0.06 },
    ],
    canopy: (rand) =>
      tieredShelves(
        {
          base: [0, 0, 0],
          shelves: [
            { y: 2.50, radius: 2.55, thickness: 0.92, count: 6 },
            { y: 3.85, radius: 2.20, thickness: 0.84, count: 5 },
            { y: 5.05, radius: 1.70, thickness: 0.76, count: 5 },
            { y: 6.05, radius: 1.12, thickness: 0.70, count: 4 },
          ],
        },
        rand,
      ),
  },

  "conifer-spire": {
    id: "hf_tree_conifer_spire",
    species: "conifer",
    form: "spire",
    formLanguage:
      "A tight needle spire — nine concave skirts with ragged bough rims stacked to a point, the one silhouette in the set with straight diagonal edges.",
    seed: 71.5,
    bark: CONIFER_BARK,
    leaf: CONIFER_LEAF,
    // CONTAINMENT INVARIANT — do not raise `height` without redoing this arithmetic.
    // The top skirt is a needle, so near the apex the canopy has almost no radius to hide
    // anything inside it. At height 7.4 the trunk top (7.40) sat just under the apex (7.45)
    // where the skirt radius is ~0.02, and the leaned, wobbling stem punched a brown stub
    // out through the tip — a vertical protrusion no camera angle hides.
    //   trunk outer extent at top = topRadius*(1+wobble) + |lean| = 0.07*1.05 + 0.05 = 0.124
    //   top skirt radius at y     = 0.34 * (1 - (y-6.50)/0.95)^0.92, times cos(pi/9) for the
    //                               inscribed radius of its 9-gon cross-section
    //   at y = 6.85               = 0.223 * 0.940 = 0.209  ->  0.085 m of clearance
    // 6.85 also keeps the model's overall height at the skirt apex (7.45), unchanged.
    trunk: {
      height: 6.85,
      baseRadius: 0.34,
      topRadius: 0.07,
      radial: 8,
      rings: 5,
      taper: 0.75,
      lean: [0.03, -0.04],
      flare: 0.24,
      flareLobes: 5,
      flareFalloff: 12,
      wobble: 0.05,
    },
    roots: { count: 5, length: 0.52, radius: 0.15, dip: 0.16, phase: 0.6 },
    branches: [],
    skirts: [
      { y: 0.95, radius: 1.92, height: 1.35, radial: 13, curve: 0.80, jag: 0.17, tint: -0.6 },
      { y: 1.75, radius: 1.76, height: 1.28, radial: 13, curve: 0.80, jag: 0.17, tint: -0.4 },
      { y: 2.55, radius: 1.58, height: 1.22, radial: 12, curve: 0.82, jag: 0.16, tint: -0.2 },
      { y: 3.30, radius: 1.38, height: 1.16, radial: 12, curve: 0.82, jag: 0.16, tint: 0.0 },
      { y: 4.02, radius: 1.16, height: 1.08, radial: 11, curve: 0.84, jag: 0.16, tint: 0.15 },
      { y: 4.70, radius: 0.95, height: 1.00, radial: 11, curve: 0.84, jag: 0.15, tint: 0.3 },
      { y: 5.34, radius: 0.74, height: 0.92, radial: 10, curve: 0.86, jag: 0.15, tint: 0.45 },
      { y: 5.94, radius: 0.54, height: 0.86, radial: 10, curve: 0.88, jag: 0.14, tint: 0.6 },
      { y: 6.50, radius: 0.34, height: 0.95, radial: 9, curve: 0.92, jag: 0.12, tint: 0.8 },
    ],
    // Clumps ride the skirt rims, so they read the skirt list rather than repeating it —
    // two copies of these numbers drifted apart once already while tuning the profile.
    canopy: (rand, template) =>
      spireClumps({ base: [0, 0, 0], skirts: template.skirts.slice(0, -1) }, rand),
  },

  "conifer-umbrella": {
    id: "hf_tree_conifer_umbrella",
    species: "conifer",
    form: "umbrella",
    formLanguage:
      "The same needle species grown out instead of up — two thirds bare leaning trunk, then three wide flat plates of foliage, so it silhouettes as a canopy on a stalk.",
    seed: 89.2,
    bark: CONIFER_BARK,
    leaf: CONIFER_LEAF,
    trunk: {
      height: 6.8,
      baseRadius: 0.38,
      topRadius: 0.13,
      radial: 9,
      rings: 7,
      taper: 0.70,
      lean: [0.55, -0.22],
      leanPower: 2.1,
      flare: 0.26,
      flareLobes: 4,
      flareFalloff: 9,
      wobble: 0.05,
    },
    roots: { count: 6, length: 0.62, radius: 0.17, dip: 0.15, phase: 0.1 },
    // Kept low and near-horizontal on purpose: at a steeper pitch the tips broke the
    // canopy line and read as antennae rather than as boughs under the plates.
    // Still low and near-horizontal -- steeper than this and the tips break the plate line and
    // read as antennae. What changed is where the two lowest boughs start and stop: at t 0.58 /
    // 0.66 they ended around y 4.3 and 4.6, a good half metre below the bottom plate at y 5.05,
    // hanging in the open. They now leave the trunk higher and finish just inside that plate.
    branches: [
      { t: 0.66, yaw: 0.9, pitch: 1.26, length: 1.85, radius: 0.10, droop: -0.20 },
      { t: 0.70, yaw: 3.7, pitch: 1.31, length: 1.75, radius: 0.10, droop: -0.20 },
      { t: 0.74, yaw: 2.1, pitch: 1.38, length: 1.45, radius: 0.09, droop: -0.18 },
      { t: 0.78, yaw: 5.2, pitch: 1.36, length: 1.35, radius: 0.085, droop: -0.18 },
    ],
    skirts: [
      { x: 0.42, y: 5.05, z: -0.17, radius: 2.10, height: 0.78, radial: 14, curve: 1.15, jag: 0.20, tint: -0.5 },
      { x: 0.50, y: 5.75, z: -0.20, radius: 1.90, height: 0.72, radial: 14, curve: 1.15, jag: 0.20, tint: -0.1 },
      { x: 0.55, y: 6.40, z: -0.22, radius: 1.35, height: 0.72, radial: 13, curve: 1.10, jag: 0.18, tint: 0.35 },
    ],
    canopy: (rand) =>
      umbrellaClumps(
        {
          base: [0.48, 0, -0.19],
          plates: [
            { y: 5.10, radius: 2.10, count: 6 },
            { y: 5.80, radius: 1.88, count: 5 },
            { y: 6.45, radius: 1.32, count: 4 },
          ],
        },
        rand,
      ),
  },
};

/** Convenience wrapper: `createTemplate("conifer-spire")` -> `(THREE) => Object3D`. */
export function createTemplate(key) {
  const template = TREE_TEMPLATES[key];
  if (!template) throw new Error(`Unknown tree template: ${key}`);
  return (THREE) => createTree(THREE, template);
}
