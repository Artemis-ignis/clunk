/**
 * Cozy Farm Set — shared authoring kit for the marketplace asset series.
 *
 * Written in the img2threejs discipline the generation pipeline documents
 * (docs/generate-pipeline.ko.md): blockout -> structure -> form -> material, code only,
 * no textures, no downloaded art.
 *
 * Two rules this kit exists to enforce across every asset in the series:
 *
 *   1. One palette. Every asset picks its materials out of `FARM_PALETTE`, so the shed,
 *      the stall and the gate read as one purchasable set instead of three lookalikes.
 *   2. Detail without draw calls. Repeated trim (plank lines, canvas stripes, crate slats,
 *      produce) is authored as many small primitives and then merged into ONE named mesh
 *      per functional group. The silhouette keeps the detail; the runtime keeps the budget.
 *
 * Clunk gate constraints the helpers below deliberately protect:
 *   - node scale is never touched (SCENE-NONUNIT-SCALE) — size is baked into geometry
 *   - every emitted node owns a mesh or has children (SCENE-EMPTY-NODES)
 *   - merged geometry keeps position/normal/uv (GEO-MISSING-NORMALS, TEX-MISSING-UV0)
 *   - materials are created once per role and reused (MAT-DUPLICATES, MAT-MATERIAL-BUDGET)
 */
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Series palette. Warm two-tone timber, a two-colour canvas, terracotta roofing and a small
 * set of produce accents — the whole set is legible without a single texture or normal map.
 */
export const FARM_PALETTE = {
  // Three timber values, spaced far enough apart to survive flat shading: dark structure,
  // mid-light boarding, light crate stock. If these three read as one brown the whole set
  // collapses into a silhouette with no internal information.
  woodFrame: { color: 0x6b4630, roughness: 0.92 },
  woodPlank: { color: 0xa8794b, roughness: 0.88 },
  woodCrate: { color: 0xc99e6a, roughness: 0.86 },
  woodPale: { color: 0xe0c79b, roughness: 0.84 },
  canvasCream: { color: 0xf0e5c8, roughness: 0.78 },
  canvasGreen: { color: 0x6d8b4a, roughness: 0.78 },
  roofTile: { color: 0xa8543e, roughness: 0.85 },
  roofTileDark: { color: 0x7d3b2c, roughness: 0.87 },
  stone: { color: 0x9a958a, roughness: 0.95 },
  iron: { color: 0x3b4044, roughness: 0.52, metalness: 0.62 },
  brass: { color: 0xb98b3f, roughness: 0.42, metalness: 0.7 },
  glass: { color: 0xa9c6c4, roughness: 0.24, metalness: 0.05 },
  carrot: { color: 0xe0762c, roughness: 0.7 },
  leaf: { color: 0x4f7a35, roughness: 0.76 },
  tomato: { color: 0xc8402f, roughness: 0.62 },
  cabbage: { color: 0xb7cc84, roughness: 0.74 },
  potato: { color: 0xcbab72, roughness: 0.88 },
};

/**
 * Instantiates only the palette roles an asset actually uses. Keeping the selection explicit
 * is what holds each asset under the profile material budget instead of shipping the whole
 * series palette in every GLB.
 */
export function selectMaterials(THREE, roles) {
  const materials = {};
  for (const role of roles) {
    const spec = FARM_PALETTE[role];
    if (!spec) throw new Error(`Unknown palette role: ${role}`);
    materials[role] = new THREE.MeshStandardMaterial({
      name: role,
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness ?? 0,
    });
  }
  return materials;
}

/**
 * One authored primitive placed in its parent's space. `rotation` is applied before
 * `position`, matching how the parts are reasoned about while blocking out.
 */
export function place(geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return { geometry, position, rotation };
}

export function createKit(THREE) {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rTop, rBottom, h, seg = 8) => new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
  const torus = (r, tube, radial = 4, tubular = 8) => new THREE.TorusGeometry(r, tube, radial, tubular);

  /** Low-poly produce ball. The ellipsoid is baked into the geometry so no node carries scale. */
  const blob = (r, sx = 1, sy = 1, sz = 1) => {
    const geometry = new THREE.IcosahedronGeometry(r, 0);
    if (sx !== 1 || sy !== 1 || sz !== 1) geometry.scale(sx, sy, sz);
    return geometry;
  };

  const matrix = new THREE.Matrix4();
  const translation = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  /**
   * Bakes every entry into one indexed geometry and returns a single named mesh.
   * Entries are converted to non-indexed first so box/cone/icosahedron primitives can share a
   * buffer, then re-welded — welding only merges vertices that already agree on normal and uv,
   * which preserves the hard flat-shaded facets the low-poly look depends on.
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

  /** A single primitive that stays its own node because something needs to address it by name. */
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

  return { box, cyl, cone, torus, blob, merged, solo, group, place };
}

/**
 * Reports what the factory actually produced so the asset description can quote measured
 * numbers instead of intentions. Called by the factories and stored on root.userData.
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
