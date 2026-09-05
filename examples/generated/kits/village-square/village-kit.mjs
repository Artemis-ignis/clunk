/**
 * Village Square — shared authoring kit for the "마을 광장" set.
 *
 * The farm set (examples/generated/cozy-farm-set/) already gave this world its timber, its
 * roof tiles and its ironwork. A village square is the same world one street further in:
 * the same wood, the same iron, and stone doing the structural work the timber does out on
 * the farm. So this kit does not invent a look. It inherits FARM_PALETTE's timber, tile,
 * iron and brass values UNCHANGED and adds only what a square needs and a farmyard does
 * not — two more stone values, a water value and a flower value.
 *
 * Three rules the helpers below exist to enforce across all fifteen parts:
 *
 *   1. One palette. Every part picks materials out of `VILLAGE_PALETTE` by role name, so a
 *      bench and a well read as one purchasable set instead of two lookalikes.
 *   2. One module grid. Path tiles, low walls and the square's furniture are all sized off
 *      `MODULE` below, so a corner tile actually meets a straight tile edge to edge and a
 *      wall corner actually continues a wall run. Nothing here is eyeballed.
 *   3. Genuinely flat shading. `flatten()` re-splits every primitive and recomputes normals
 *      per face, so a 12-sided cylinder reads as twelve facets rather than as a smooth tube.
 *      glTF has no flat-shading flag — faceting has to live in the geometry or it is lost
 *      the moment the file leaves three.js.
 *
 * Clunk gate constraints the helpers protect (same list the farm kit protects):
 *   - node scale is never touched (SCENE-NONUNIT-SCALE) — size is baked into geometry
 *   - every emitted node owns a mesh or has children (SCENE-EMPTY-NODES)
 *   - merged geometry keeps position/normal/uv (GEO-MISSING-NORMALS, TEX-MISSING-UV0)
 *   - materials are created once per role and reused (MAT-DUPLICATES, MAT-MATERIAL-BUDGET)
 *
 * Determinism: nothing calls Math.random. Every wobble comes from `wobble()`, an integer
 * hash, so two builds of the same factory produce the same vertices.
 */
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Series palette, twelve roles.
 *
 * Seven of them are cozy-farm-set/farm-kit.mjs FARM_PALETTE hexes verbatim — that is what
 * makes a village bench and a farm crate the same object from the same world. The five new
 * ones are the ones a farmyard never needed:
 *
 *   stoneLight / stoneShadow  a masonry wall flat-shaded in ONE stone value is a grey slab.
 *                             Three values spaced far enough apart to survive flat shading
 *                             are what turn a course of blocks into a course of blocks.
 *   water                     the well and the fountain both hold standing water, and it has
 *                             to be cool enough to separate from the stone around it.
 *   bloom                     the planters' flowers.
 *
 * `leaf` is FARM's, so village flowers grow the same green as farm cabbages.
 */
export const VILLAGE_PALETTE = {
  // --- masonry: a three-value ramp; the light and dark ends are new to this set ----------
  stoneLight: { color: 0xb8b2a4, roughness: 0.94 },
  stoneBody: { color: 0x9a958a, roughness: 0.95 }, // FARM stone, unchanged
  stoneShadow: { color: 0x6d6961, roughness: 0.96 },
  // --- timber and roofing: FARM_PALETTE verbatim ----------------------------------------
  woodFrame: { color: 0x6b4630, roughness: 0.92 }, // FARM woodFrame
  woodPlank: { color: 0xa8794b, roughness: 0.88 }, // FARM woodPlank
  woodPale: { color: 0xe0c79b, roughness: 0.84 }, // FARM woodPale — also the lamp's panes and the board's paper
  roofTile: { color: 0xa8543e, roughness: 0.85 }, // FARM roofTile
  // --- hardware: FARM_PALETTE verbatim ---------------------------------------------------
  iron: { color: 0x3b4044, roughness: 0.52, metalness: 0.62 }, // FARM iron
  brass: { color: 0xb98b3f, roughness: 0.42, metalness: 0.7 }, // FARM brass
  // --- what a square has and a farmyard does not ----------------------------------------
  water: { color: 0x7aa6bb, roughness: 0.3, metalness: 0.05 },
  leaf: { color: 0x4f7a35, roughness: 0.76 }, // FARM leaf
  bloom: { color: 0xd05a6e, roughness: 0.7 },
};

/**
 * The module grid. Every number a second part has to agree with lives here and nowhere else.
 *
 * Reference measurements these are cut against:
 *   - granite sett paving: setts 100 x 100 x 100 mm laid on a 30 mm bed; a 1 m module is the
 *     standard paving bay. Here the slab shows 60 mm of edge, which is what you actually see
 *     once a path is bedded into ground.
 *   - dry-stone garden boundary wall: 450-600 mm high, 300-450 mm thick, coping 60-100 mm.
 *     This set takes the low end of both, because a 600 mm wall you can sit on is what a
 *     square has and a field boundary is not.
 */
export const MODULE = {
  /** Path tile footprint, metres. Straight, corner and cross are all exactly this square. */
  tile: 1.0,
  /** Path tile total height. Slab bed + sett course. */
  tileHeight: 0.06,
  /** Slab bed under the setts. The setts stand on this, so nothing in a tile floats. */
  tileBed: 0.028,
  /** Wall module run length. A straight spans x = -0.5 .. +0.5; a corner's arms end there. */
  wallRun: 1.0,
  /** Wall thickness. Both wall parts are this deep, so a corner continues a straight flush. */
  wallThickness: 0.3,
  /** Wall total height including the coping. */
  wallHeight: 0.55,
  /** Coping slab thickness, on top of the courses. */
  wallCoping: 0.075,
  /** Thinnest sheet anywhere in the set. Nothing in this kit is thinner than 4 mm. */
  minSheet: 0.006,
};

/**
 * Instantiates only the palette roles a part actually uses, so a bench does not ship the
 * whole series palette in its GLB. Same contract as the farm kit's `selectMaterials`.
 */
export function selectMaterials(THREE, roles) {
  const materials = {};
  for (const role of roles) {
    const spec = VILLAGE_PALETTE[role];
    if (!spec) throw new Error(`Unknown palette role: ${role}`);
    materials[role] = new THREE.MeshStandardMaterial({
      name: role,
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness ?? 0,
      // Set for the sake of anything that previews the scene in three.js before export.
      // glTF cannot carry it, which is exactly why `flatten()` below exists.
      flatShading: true,
    });
  }
  return materials;
}

/** One authored primitive placed in its parent's space. Rotation is applied before position. */
export function place(geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return { geometry, position, rotation };
}

/**
 * Deterministic wobble in -1..1 from an integer seed.
 *
 * Every stone in a wall and every sett in a path is nudged by this, which is the difference
 * between "a course of masonry" and "a row of identical grey boxes". A hash rather than a
 * PRNG so a rebuild is byte-identical and so a single stone can be re-derived from its index.
 */
export function wobble(seed) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export function createKit(THREE) {
  /**
   * Per-face normals, always.
   *
   * `computeVertexNormals` on a non-indexed buffer writes the face normal to all three of a
   * triangle's corners, so a cylinder side that three.js authored smooth comes back faceted.
   * Every primitive in this kit goes through here, which is why a 12-sided fountain basin
   * reads as twelve stones rather than as a lathe.
   */
  const flatten = (geometry) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.computeVertexNormals();
    return flat;
  };

  const box = (w, h, d) => flatten(new THREE.BoxGeometry(w, h, d));
  const cyl = (rTop, rBottom, h, seg = 8, open = false) =>
    flatten(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
  const cone = (r, h, seg = 6) => flatten(new THREE.ConeGeometry(r, h, seg));
  const sphere = (r, seg = 6, rings = 4) => flatten(new THREE.SphereGeometry(r, seg, rings));

  /** Low-poly bloom head. The ellipsoid is baked into the geometry so no node carries scale. */
  const blob = (r, sx = 1, sy = 1, sz = 1) => {
    const geometry = new THREE.IcosahedronGeometry(r, 0);
    if (sx !== 1 || sy !== 1 || sz !== 1) geometry.scale(sx, sy, sz);
    return flatten(geometry);
  };

  /**
   * A convex 2D profile extruded along +Z, with caps and UVs.
   *
   * This is how every chamfered timber in the set is made. `THREE.ExtrudeGeometry` would do
   * it too, but it welds the cap fan to the walls and its UV generator is a surprise; this
   * writes exactly eight side quads and two six-triangle caps for an octagon, which is 28
   * triangles for a chamfered plank against a box's 12 — the price of not having a plank
   * whose arris is a black line under the key light.
   *
   * `points` is [[x, y], ...] counter-clockwise as seen from +Z.
   */
  const prism = (points, depth) => {
    const n = points.length;
    const halfDepth = depth / 2;
    const position = [];
    const uv = [];
    // Perimeter running length, so the side UV does not stretch on the short chamfer faces.
    const run = [0];
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      run.push(run[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const perimeter = run[n] || 1;
    const pushTri = (p0, p1, p2, t0, t1, t2) => {
      position.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      uv.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
    };
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const u0 = run[i] / perimeter;
      const u1 = run[i + 1] / perimeter;
      const af = [a[0], a[1], halfDepth];
      const bf = [b[0], b[1], halfDepth];
      const ab = [a[0], a[1], -halfDepth];
      const bb = [b[0], b[1], -halfDepth];
      pushTri(ab, bb, bf, [u0, 0], [u1, 0], [u1, 1]);
      pushTri(ab, bf, af, [u0, 0], [u1, 1], [u0, 1]);
    }
    // Extents drive the cap UVs so a cap is mapped 0..1 across the profile's own bounding box.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const capUv = ([x, y]) => [(x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1)];
    for (let i = 1; i < n - 1; i += 1) {
      const a = points[0];
      const b = points[i];
      const c = points[i + 1];
      pushTri([a[0], a[1], halfDepth], [b[0], b[1], halfDepth], [c[0], c[1], halfDepth], capUv(a), capUv(b), capUv(c));
      pushTri([a[0], a[1], -halfDepth], [c[0], c[1], -halfDepth], [b[0], b[1], -halfDepth], capUv(a), capUv(c), capUv(b));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
  };

  /** Rectangle w x h with all four corners cut back by `c`. The kit's standard timber arris. */
  const chamferProfile = (w, h, c) => {
    const x = w / 2;
    const y = h / 2;
    const k = Math.min(c, Math.min(x, y) * 0.49);
    return [
      [-x + k, -y], [x - k, -y], [x, -y + k], [x, y - k],
      [x - k, y], [-x + k, y], [-x, y - k], [-x, -y + k],
    ];
  };

  /**
   * A chamfered timber of length `len` along +Z, cross-section w x h.
   * 2 mm is the arris a hand-planed board carries; 6-8 mm is what a low-poly asset needs for
   * the chamfer to still be one pixel wide on a storefront card, so that is what is used.
   */
  const beam = (w, h, len, c = 0.008) => prism(chamferProfile(w, h, c), len);

  /** Regular n-gon profile, flat-topped, for stone drums and lamp columns. */
  const ngonProfile = (radius, sides, phase = 0) => {
    const points = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = phase + (i / sides) * Math.PI * 2;
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    return points;
  };

  /**
   * One voussoir of a ring of masonry — a wedge, not a box.
   *
   * The first cut of this kit built its rings out of boxes whose width was the chord at the
   * ring's MID radius, turned to face the centre. That is wrong and it shows: a box has
   * parallel sides, a ring's blocks do not, so the joints open outwards. On the fountain's
   * 18-block basin (inner 0.82, outer 1.00) that left a 32 mm gap at every outer joint —
   * eighteen slots you could see the water through, in the storefront render.
   *
   * A wedge closes them. Its two radial faces lie on the ring's own radii, so neighbouring
   * blocks meet EXACTLY, with no gap to see through and no overlap to report as a defect.
   *
   * The profile returned is the block's horizontal cross-section already turned to `angle`,
   * mapped so that extruding it and laying the extrusion down with a rotation of -90 degrees
   * about X puts it in the ring. Baking the ring angle into the profile is what keeps the
   * placement to ONE rotation, which is all a three.js Euler in XYZ order can express here.
   *
   *   place(prism(wedgeProfile(inner, outer, angle, span), height), [0, midY, 0], [-Math.PI / 2, 0, 0])
   */
  const wedgeProfile = (innerR, outerR, angle, span) => {
    const half = span / 2;
    const at = (r, t) => [r * Math.cos(angle + t), -r * Math.sin(angle + t)];
    // Counter-clockwise as seen from +Z, which is what `prism` caps assume.
    return [at(innerR, half), at(outerR, half), at(outerR, -half), at(innerR, -half)];
  };

  /**
   * A closed ring of `count` wedges. Returns `{ entry, angle, index }` per block so the caller
   * can file each one into its own tone bucket.
   */
  const ringBlocks = (count, innerR, outerR, yFrom, yTo, { turn = 0, gap = 0, heightJitter = 0, seed = 0 } = {}) => {
    const span = (Math.PI * 2) / count - gap;
    const height = yTo - yFrom;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const angle = turn + (i / count) * Math.PI * 2;
      const shrink = heightJitter ? Math.abs(wobble(seed + i * 7)) * heightJitter : 0;
      out.push({
        index: i,
        angle,
        seed: seed + i * 7,
        entry: place(prism(wedgeProfile(innerR, outerR, angle, span), height - shrink), [0, yFrom + (height - shrink) / 2, 0], [
          -Math.PI / 2,
          0,
          0,
        ]),
      });
    }
    return out;
  };

  const matrix = new THREE.Matrix4();
  const translation = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  /**
   * Bakes every entry into one indexed geometry and returns a single named mesh.
   *
   * Re-welding after the merge only joins vertices that already agree on position, normal AND
   * uv, so the flat facets `flatten()` created survive: only the two triangles of a coplanar
   * quad ever merge. Detail stays in the silhouette; the draw call count stays at one.
   */
  function merged(name, material, entries) {
    if (!entries.length) throw new Error(`Merged part ${name} received no entries.`);
    const baked = entries.map(({ geometry, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
      const clone = geometry.clone();
      const copy = clone.index ? clone.toNonIndexed() : clone;
      if (copy !== clone) clone.dispose();
      euler.set(rotation[0], rotation[1], rotation[2]);
      quaternion.setFromEuler(euler);
      translation.set(position[0], position[1], position[2]);
      matrix.compose(translation, quaternion, unitScale);
      copy.applyMatrix4(matrix);
      return copy;
    });
    const combined = mergeGeometries(baked, false);
    if (!combined) throw new Error(`Merged part ${name} could not be combined.`);
    const welded = mergeVertices(combined) ?? combined;
    for (const geometry of baked) geometry.dispose();
    combined.dispose?.();
    const mesh = new THREE.Mesh(welded, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** A single primitive that stays its own node because something addresses it by name. */
  function solo(name, material, geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function group(name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(position[0], position[1], position[2]);
    node.rotation.set(rotation[0], rotation[1], rotation[2]);
    return node;
  }

  return { box, cyl, cone, sphere, blob, prism, beam, chamferProfile, ngonProfile, wedgeProfile, ringBlocks, merged, solo, group, place, flatten };
}

/**
 * Reports what the factory actually produced, so a listing quotes a measured number instead
 * of an intention. Stored on root.userData.measured by every factory in the set.
 */
export function summarize(THREE, root) {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
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
