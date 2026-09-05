/**
 * Shared surgery helpers for the 2026-09-03 Harvest Frontier machine repair.
 *
 * These operate on the packaged `*.m1.glb` files this repo already sells - the
 * Harvest Frontier checkout stays READ-ONLY and the raw HF export is not re-run,
 * so a repair here cannot regress anything upstream.
 *
 * Three jobs:
 *   1. `dropHiddenProxies` - remove the opacity-0 collider / socket-marker
 *      meshes that ship inside the sale file. The socket *nodes* stay, so a
 *      buyer's attach points are untouched; only the invisible geometry that
 *      cost a draw call and polluted every overlap gate goes.
 *   2. `mergeByAnchor` - collapse every mesh that shares a material AND is
 *      rigidly bound to the same animated node into one mesh. Nothing that can
 *      move on its own is merged, so every named animated node survives.
 *   3. small builders and keyframe helpers used by the per-machine scripts to
 *      add the parts and the motion the audit found missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../../Harvest Frontier/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from '../../../Harvest Frontier/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from '../../../Harvest Frontier/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import * as BufferGeometryUtils from '../../../Harvest Frontier/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

class NodeFileReader {
  result = null; onloadend = null; onerror = null;
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }).catch((e) => this.onerror?.(e));
  }
}
if (typeof globalThis.FileReader === 'undefined') Object.assign(globalThis, { FileReader: NodeFileReader });

export { THREE };

export async function loadGlb(file) {
  const buffer = fs.readFileSync(file);
  const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(array, '', ok, fail);
  });
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

export async function saveGlb(file, scene, animations) {
  scene.updateMatrixWorld(true);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bin = await new Promise((ok, fail) => {
    new GLTFExporter().parse(scene, ok, fail, { binary: true, animations, onlyVisible: false });
  });
  fs.writeFileSync(file, Buffer.from(bin));
}

export const mm = (v) => Math.round(v * 10000) / 10;
export const meshes = (root) => { const out = []; root.traverse((n) => { if (n.isMesh) out.push(n); }); return out; };
export const node = (root, name) => {
  const f = root.getObjectByName(name);
  if (!f) throw new Error(`node "${name}" is not in this file`);
  return f;
};
export const worldBox = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };

/**
 * The box of the vertices that are actually there.
 *
 * `Box3.setFromObject` transforms each geometry's local AABB, so for a rotated
 * rounded box it reports corners the mesh does not have — the processing line's
 * conveyor foot read 7.7 mm below ground that way when its lowest real vertex
 * was exactly on it. Every ground and bounds figure in this repair pass comes
 * from here instead.
 */
export function exactBox(root) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((n) => {
    if (!n.isMesh) return;
    const pos = n.geometry.getAttribute('position');
    const instances = n.isInstancedMesh ? n.count : 1;
    for (let k = 0; k < instances; k += 1) {
      if (n.isInstancedMesh) { n.getMatrixAt(k, m); m.premultiply(n.matrixWorld); } else m.copy(n.matrixWorld);
      for (let i = 0; i < pos.count; i += 1) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
    }
  });
  return box;
}
export const matOf = (m) => (Array.isArray(m.material) ? m.material[0] : m.material);
export const meshTris = (m) => (m.geometry.getIndex()?.count ?? m.geometry.getAttribute('position').count) / 3;
export const drawnTris = (root) => meshes(root).reduce((t, m) => t + meshTris(m) * (m.isInstancedMesh ? m.count : 1), 0);

export function animatedNodeNames(animations) {
  const s = new Set();
  for (const clip of animations) for (const t of clip.tracks) s.add(t.name.split('.')[0]);
  return s;
}

/** Remove the invisible runtime helper meshes. Their parent nodes stay. */
export function dropHiddenProxies(scene) {
  const removed = [];
  for (const m of meshes(scene)) {
    const mat = matOf(m);
    const invisible = Boolean(mat && mat.transparent && mat.opacity < 0.05);
    if (!invisible && !/socketMarker|colliderProxy|colliderbodyproxy/i.test(m.name || '')) continue;
    removed.push({ name: m.name, triangles: meshTris(m), material: mat?.name ?? null });
    m.removeFromParent();
  }
  return removed;
}

/**
 * One geometry, rewritten so any two of them can be merged: de-indexed, exactly
 * the three attributes position / normal / color, every one a plain
 * non-normalised Float32 array. The packaged files mix quantised (KHR_mesh_
 * quantization) and float buffers, and BufferGeometryUtils refuses to merge
 * attributes whose gpuType differs, so the values are read through the
 * BufferAttribute accessors — which undo normalisation — and written out fresh.
 */
function normalise(mesh) {
  let g = mesh.geometry;
  g = g.getIndex() ? g.toNonIndexed() : g.clone();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const count = g.getAttribute('position').count;
  const out = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'color']) {
    const src = g.getAttribute(key);
    const size = key === 'color' ? 3 : 3;
    const arr = new Float32Array(count * size);
    if (src) {
      for (let i = 0; i < count; i += 1) {
        arr[i * size] = src.getX(i);
        arr[i * size + 1] = src.getY(i);
        arr[i * size + 2] = src.getZ(i);
      }
    } else {
      arr.fill(1);
    }
    out.setAttribute(key, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/**
 * Merge every mesh that is rigidly bound to the same anchor and uses the same
 * material. An anchor is the scene root, any animated node, or any node named
 * `socketattach*`, so nothing that can move on its own is ever merged into
 * something that cannot.
 */
export function mergeByAnchor(scene, animations, options = {}) {
  const keep = options.keep ?? [];
  scene.updateMatrixWorld(true);
  const animated = animatedNodeNames(animations);
  const keepRe = keep.length ? new RegExp(keep.join('|')) : null;
  const isAnchor = (n) => n === scene || animated.has(n.name) || /^socketattach/i.test(n.name || '');
  const anchorOf = (m) => { let n = m.parent; while (n && !isAnchor(n)) n = n.parent; return n ?? scene; };

  const groups = new Map();
  for (const m of meshes(scene)) {
    if (m.isInstancedMesh) continue;
    if (keepRe && keepRe.test(m.name || '')) continue;
    const anchor = anchorOf(m);
    const mat = matOf(m);
    const key = `${anchor.uuid}|${mat.uuid}`;
    let entry = groups.get(key);
    if (!entry) { entry = { anchor, mat, list: [] }; groups.set(key, entry); }
    entry.list.push(m);
  }

  const report = [];
  for (const { anchor, mat, list } of groups.values()) {
    if (list.length < 2) continue;
    const inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const geos = list.map((m) => {
      const g = normalise(m);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    let merged = BufferGeometryUtils.mergeGeometries(geos, false);
    merged = BufferGeometryUtils.mergeVertices(merged, 1e-5);
    const short = (mat.name || 'mat').replace(/^.*palette-/, '');
    const out = new THREE.Mesh(merged, mat);
    out.name = `${anchor === scene ? 'body' : anchor.name}_${short}`;
    anchor.add(out);
    report.push({
      mesh: out.name,
      anchor: anchor === scene ? '(scene)' : anchor.name,
      material: mat.name,
      absorbed: list.map((m) => m.name),
      triangles: (merged.getIndex()?.count ?? merged.getAttribute('position').count) / 3,
    });
    for (const m of list) m.removeFromParent();
  }
  scene.updateMatrixWorld(true);
  return report;
}

/**
 * Turn every InstancedMesh into one ordinary mesh holding its instances.
 *
 * The tractor shipped four `treadLugs` nodes of 48 GPU instances each. That made
 * EXT_mesh_gpu_instancing a REQUIRED extension of the file — an engine without it
 * cannot open the product at all — and it split the file's own triangle count from
 * the number a renderer rasterises (48 stored, 2,304 drawn per wheel). Baked, the
 * lugs merge into the tyre they belong to: four fewer draw calls, no required
 * extension, and one triangle count instead of two.
 */
export function bakeInstances(scene) {
  const baked = [];
  const list = [];
  scene.traverse((n) => { if (n.isInstancedMesh) list.push(n); });
  for (const inst of list) {
    const parts = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < inst.count; i += 1) {
      inst.getMatrixAt(i, m);
      const g = normalise(inst);
      g.applyMatrix4(m);
      parts.push(g);
    }
    const merged = BufferGeometryUtils.mergeGeometries(parts, false);
    const out = new THREE.Mesh(merged, matOf(inst));
    out.name = inst.name;
    out.position.copy(inst.position);
    out.quaternion.copy(inst.quaternion);
    out.scale.copy(inst.scale);
    inst.parent.add(out);
    inst.removeFromParent();
    baked.push({ node: inst.name, instances: inst.count, triangles: (merged.getIndex()?.count ?? merged.getAttribute('position').count) / 3 });
  }
  return baked;
}

/**
 * Give every mesh its own geometry object.
 *
 * three's GLTFExporter writes one glTF mesh per geometry instance, so two nodes
 * sharing a geometry become one mesh referenced twice — and the file's stored
 * triangle count (which the shop card and the product page's in-browser
 * re-measure both read) then undercounts what is drawn. Cloning makes the two
 * numbers the same number, which is the whole point of restating them.
 */
export function unshareGeometry(scene) {
  const seen = new Set();
  let cloned = 0;
  for (const m of meshes(scene)) {
    if (seen.has(m.geometry.uuid)) { m.geometry = m.geometry.clone(); cloned += 1; }
    seen.add(m.geometry.uuid);
  }
  return cloned;
}

/** Drop Object3D nodes that now hold nothing and are neither animated nor sockets. */
export function pruneEmpty(scene, animations) {
  const animated = animatedNodeNames(animations);
  let removed = 0;
  for (let pass = 0; pass < 12; pass += 1) {
    const dead = [];
    scene.traverse((n) => {
      if (n === scene || n.isMesh || n.children.length) return;
      if (animated.has(n.name) || /^socketattach/i.test(n.name || '')) return;
      dead.push(n);
    });
    if (!dead.length) break;
    for (const n of dead) { n.removeFromParent(); removed += 1; }
  }
  return removed;
}

/* ------------------------------------------------------------ small builders */
function paint(geometry, colour) {
  const n = geometry.getAttribute('position').count;
  const c = colour instanceof THREE.Color ? colour : new THREE.Color(colour);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}
export const boxGeo = (w, h, d, colour) => paint(new THREE.BoxGeometry(w, h, d), colour);
export const cylGeo = (rt, rb, h, seg, colour) => paint(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), colour);

/** Average vertex colour of an existing mesh, so a new part matches its neighbours. */
export function colourOf(mesh) {
  const c = mesh.geometry.getAttribute('color');
  if (!c) return new THREE.Color('#ffffff');
  let r = 0; let g = 0; let b = 0;
  for (let i = 0; i < c.count; i += 1) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); }
  return new THREE.Color(r / c.count, g / c.count, b / c.count);
}

export function addMesh(parent, geometry, material, name, position) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  if (position) m.position.set(position[0], position[1], position[2]);
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------ keyframes */
export function quatTrack(nodeName, times, eulers) {
  const values = new Float32Array(times.length * 4);
  const q = new THREE.Quaternion();
  for (let i = 0; i < times.length; i += 1) {
    q.setFromEuler(new THREE.Euler(eulers[i][0], eulers[i][1], eulers[i][2], 'XYZ'));
    values[i * 4] = q.x; values[i * 4 + 1] = q.y; values[i * 4 + 2] = q.z; values[i * 4 + 3] = q.w;
  }
  return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, Float32Array.from(times), values);
}
export function vecTrack(nodeName, prop, times, vectors) {
  const values = new Float32Array(times.length * 3);
  for (let i = 0; i < times.length; i += 1) {
    values[i * 3] = vectors[i][0]; values[i * 3 + 1] = vectors[i][1]; values[i * 3 + 2] = vectors[i][2];
  }
  return new THREE.VectorKeyframeTrack(`${nodeName}.${prop}`, Float32Array.from(times), values);
}
export function setTrack(clip, nodeName, prop, track) {
  const i = clip.tracks.findIndex((t) => t.name === `${nodeName}.${prop}`);
  if (i >= 0) clip.tracks[i] = track; else clip.tracks.push(track);
}

/** Evenly spaced sample times over a clip, inclusive of both ends. */
export const samples = (duration, n) => Array.from({ length: n + 1 }, (_, i) => (i / n) * duration);

/* --------------------------------------------------- world-space builders (2026-09-05)
 * The 2026-09-04 passes all placed new parts by hand-writing `parent.worldToLocal(...)`
 * at every call site. That works while every group is axis-aligned; the processing line's
 * conveyor is not (it is tilted 33.2 degrees), and a pipe that has to start on the belt and
 * end on the tank cannot be written in either group's frame. These four take world
 * coordinates and do the frame arithmetic once.
 *
 * Additive only: nothing above this line changed, so the other repair scripts that import
 * from here are untouched.
 */

/** A cylinder whose two end faces are exactly at the world points `from` and `to`. */
export function tubeBetween(parent, material, colour, from, to, radius, name, segments = 12) {
  const a = new THREE.Vector3().fromArray(Array.isArray(from) ? from : from.toArray());
  const b = new THREE.Vector3().fromArray(Array.isArray(to) ? to : to.toArray());
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  if (!(length > 0)) throw new Error(`tubeBetween(${name}): the two ends are the same point`);
  const mesh = new THREE.Mesh(cylGeo(radius, radius, length, segments, colour), material);
  mesh.name = name;
  parent.updateMatrixWorld(true);
  const world = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(world)
    .decompose(mesh.position, mesh.quaternion, mesh.scale);
  parent.add(mesh);
  return mesh;
}

/** A box whose world-axis-aligned extent is exactly [min, max] on each axis. */
export function boxSpan(parent, material, colour, min, max, name) {
  const lo = new THREE.Vector3().fromArray(min);
  const hi = new THREE.Vector3().fromArray(max);
  const size = new THREE.Vector3().subVectors(hi, lo);
  const mesh = new THREE.Mesh(boxGeo(size.x, size.y, size.z, colour), material);
  mesh.name = name;
  parent.updateMatrixWorld(true);
  const centre = new THREE.Vector3().addVectors(lo, hi).multiplyScalar(0.5);
  mesh.position.copy(parent.worldToLocal(centre));
  parent.add(mesh);
  return mesh;
}

/** Translate an object so the centre of the box of its real vertices lands on `target`. */
export function moveBoxCentreTo(object, target) {
  object.updateMatrixWorld(true);
  const centre = exactBox(object).getCenter(new THREE.Vector3());
  const want = new THREE.Vector3().fromArray(Array.isArray(target) ? target : target.toArray());
  const delta = new THREE.Vector3().subVectors(want, centre);
  const parent = object.parent;
  if (parent) {
    parent.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().extractRotation(parent.matrixWorld).invert();
    delta.applyMatrix4(inverse);
    const scale = new THREE.Vector3().setFromMatrixScale(parent.matrixWorld);
    delta.set(delta.x / (scale.x || 1), delta.y / (scale.y || 1), delta.z / (scale.z || 1));
  }
  object.position.add(delta);
  object.updateMatrixWorld(true);
  return object;
}

/** Turn an object about a world axis through a world point, keeping everything else. */
export function spinAboutWorld(object, axis, angle, through) {
  object.updateMatrixWorld(true);
  const pivot = new THREE.Vector3().fromArray(Array.isArray(through) ? through : through.toArray());
  const rotation = new THREE.Matrix4().makeRotationAxis(
    new THREE.Vector3().fromArray(Array.isArray(axis) ? axis : axis.toArray()).normalize(), angle);
  const world = new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(rotation)
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z))
    .multiply(object.matrixWorld);
  const parent = object.parent;
  if (parent) parent.updateMatrixWorld(true);
  const local = parent
    ? new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(world)
    : world;
  local.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrixWorld(true);
  return object;
}

/** The largest distance from the line (point, axis) to any vertex of `object`, in world units. */
export function radiusAbout(object, point, axis) {
  object.updateMatrixWorld(true);
  const origin = new THREE.Vector3().fromArray(Array.isArray(point) ? point : point.toArray());
  const unit = new THREE.Vector3().fromArray(Array.isArray(axis) ? axis : axis.toArray()).normalize();
  let best = 0;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  object.traverse((n) => {
    if (!n.isMesh) return;
    const pos = n.geometry.getAttribute('position');
    const copies = n.isInstancedMesh ? n.count : 1;
    for (let c = 0; c < copies; c += 1) {
      if (n.isInstancedMesh) { n.getMatrixAt(c, m); m.premultiply(n.matrixWorld); } else m.copy(n.matrixWorld);
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m).sub(origin);
        best = Math.max(best, v.clone().sub(unit.clone().multiplyScalar(v.dot(unit))).length());
      }
    }
  });
  return best;
}

/** Deepest world-box overlap between two objects, or 0 when their boxes are apart. */
export function boxOverlap(a, b) {
  const p = exactBox(a);
  const q = exactBox(b);
  const dx = Math.min(p.max.x, q.max.x) - Math.max(p.min.x, q.min.x);
  const dy = Math.min(p.max.y, q.max.y) - Math.max(p.min.y, q.min.y);
  const dz = Math.min(p.max.z, q.max.z) - Math.max(p.min.z, q.min.z);
  return dx > 0 && dy > 0 && dz > 0 ? Math.min(dx, dy, dz) : 0;
}

/* ------------------------------------------- axle joints (2026-09-05, wheel wave)
 * The 2026-09-05 mechanism audit found every driven wheel in this catalogue standing
 * 20-21 mm clear of the nearest axle metal: the hub was a disc with air behind it. A
 * wheel that is not on an axle reads as a wheel that fell off, and the sale gate could
 * not see it because the parts had been merged into one metal mesh per material.
 *
 * These three build the joint a wheel actually has, off the wheel's own vertices:
 *   `faceRing`  reads the ring of vertices on the inboard face of a hub;
 *   `addWorldMesh` puts a world-space triangle soup under any parent;
 *   `axleHubJoint` welds a flange to that exact ring, butts it against the hub face,
 *                  drives a spigot into the hub bore and runs a shaft back to the axle.
 * Because the flange rim reuses the hub's OWN vertex positions, the hub-to-axle gap is
 * 0.0 mm by construction rather than by nudging, and the two faces that meet are
 * opposite-facing, so the butt joint is not a z-fight.
 */

/** The ring of world-space vertices on the extreme face of `object` along world axis `k` (0/1/2). */
export function faceRing(object, k, sign, tolerance = 0.0006) {
  object.updateMatrixWorld(true);
  const points = [];
  const v = new THREE.Vector3();
  object.traverse((n) => {
    if (!n.isMesh) return;
    const pos = n.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) points.push(v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld).clone());
  });
  if (!points.length) throw new Error('faceRing: no vertices');
  const extreme = sign > 0
    ? points.reduce((t, p) => Math.max(t, p.getComponent(k)), -Infinity)
    : points.reduce((t, p) => Math.min(t, p.getComponent(k)), Infinity);
  const onFace = points.filter((p) => Math.abs(p.getComponent(k) - extreme) <= tolerance);
  const a = (k + 1) % 3;
  const b = (k + 2) % 3;
  /* The centre has to come from the extent of the face, not the mean of its vertices: a
     cylinder duplicates its seam vertex, and on a 16-sided hub that one repeat drags the
     mean 8 mm off the axle line — which would then build the whole joint eccentric. */
  const centre = new THREE.Vector3();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of onFace) for (let i = 0; i < 3; i += 1) { lo[i] = Math.min(lo[i], p.getComponent(i)); hi[i] = Math.max(hi[i], p.getComponent(i)); }
  centre.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  centre.setComponent(k, extreme);
  const radiusOf = (p) => Math.hypot(p.getComponent(a) - centre.getComponent(a), p.getComponent(b) - centre.getComponent(b));
  const outer = onFace.reduce((t, p) => Math.max(t, radiusOf(p)), 0);
  const seen = new Map();
  for (const p of onFace) {
    if (radiusOf(p) < outer * 0.92) continue;                       // the cap fan centre is not on the rim
    const angle = Math.atan2(p.getComponent(b) - centre.getComponent(b), p.getComponent(a) - centre.getComponent(a));
    const key = Math.round(angle * 1e4);
    if (!seen.has(key)) seen.set(key, { angle, p });
  }
  const ring = [...seen.values()].sort((x, y) => x.angle - y.angle).map((e) => e.p);
  if (ring.length < 3) throw new Error(`faceRing: found ${ring.length} rim points`);
  const exact = new THREE.Vector3();
  for (const p of ring) exact.add(p);
  exact.multiplyScalar(1 / ring.length).setComponent(k, extreme);
  return { ring, centre: exact, radius: outer, plane: extreme, axis: k };
}

/** Add a mesh from a flat array of world-space triangle vertices. */
export function addWorldMesh(parent, positions, colour, material, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(positions), 3));
  geometry.computeVertexNormals();
  const c = colour instanceof THREE.Color ? colour : new THREE.Color(colour);
  const arr = new Float32Array((positions.length / 3) * 3);
  for (let i = 0; i < positions.length / 3; i += 1) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  parent.updateMatrixWorld(true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  geometry.applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert());
  parent.add(mesh);
  return mesh;
}

/**
 * Flange + spigot + shaft between an axle and a wheel hub, measured off the hub.
 *
 *   parent      the node the joint belongs to (the STATIC side: an axle, not the wheel)
 *   hub         the wheel's hub mesh/group; its inboard face ring becomes the flange rim
 *   k, sign     the hub's axis: world component index and the outboard direction
 *   flange      thickness of the flange plate, metres
 *   spigot      { radius, depth } of the pin that runs on into the hub bore
 *   shaft       { radius, to } a shaft from the flange back to world coordinate `to` on axis k
 */
export function axleHubJoint(parent, hub, k, sign, { flange = 0.035, spigot, shaft, material, colour, name }) {
  const face = faceRing(hub, k, -sign);
  const ring = face.ring;
  const n = ring.length;
  const back = ring.map((p) => { const q = p.clone(); q.setComponent(k, face.plane - sign * flange); return q; });
  const backCentre = face.centre.clone();
  backCentre.setComponent(k, face.plane - sign * flange);
  const tri = [];
  const push = (...ps) => { for (const p of ps) tri.push(p.x, p.y, p.z); };
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    if (sign > 0) { push(ring[i], back[i], back[j]); push(ring[i], back[j], ring[j]); push(backCentre, back[j], back[i]); push(face.centre, ring[j], ring[i]); }
    else { push(ring[i], back[j], back[i]); push(ring[i], ring[j], back[j]); push(backCentre, back[i], back[j]); push(face.centre, ring[i], ring[j]); }
  }
  const parts = [addWorldMesh(parent, tri, colour, material, `${name}Flange`)];
  const a = (k + 1) % 3;
  const b = (k + 2) % 3;
  const at = (c, along, radius, angle) => {
    const p = new THREE.Vector3();
    p.setComponent(k, along);
    p.setComponent(a, c.getComponent(a) + Math.cos(angle) * radius);
    p.setComponent(b, c.getComponent(b) + Math.sin(angle) * radius);
    return p;
  };
  const tube = (radius, from, to, tubeName) => {
    const seg = 16;
    const t = [];
    for (let i = 0; i < seg; i += 1) {
      const t0 = (i / seg) * Math.PI * 2;
      const t1 = ((i + 1) / seg) * Math.PI * 2;
      const f0 = at(face.centre, from, radius, t0); const f1 = at(face.centre, from, radius, t1);
      const b0 = at(face.centre, to, radius, t0); const b1 = at(face.centre, to, radius, t1);
      const c0 = at(face.centre, from, 0, 0); const c1 = at(face.centre, to, 0, 0);
      const forward = (to - from) * sign > 0;
      if (forward) { t.push(f0, b0, b1, f0, b1, f1, c0, f1, f0, c1, b0, b1); }
      else { t.push(f0, b1, b0, f0, f1, b1, c0, f0, f1, c1, b1, b0); }
    }
    const flat = [];
    for (const p of t) flat.push(p.x, p.y, p.z);
    return addWorldMesh(parent, flat, colour, material, tubeName);
  };
  if (spigot) parts.push(tube(spigot.radius, face.plane, face.plane + sign * spigot.depth, `${name}Spigot`));
  if (shaft) parts.push(tube(shaft.radius, face.plane - sign * flange, shaft.to, `${name}Shaft`));
  return { parts: parts.map((p) => p.name), ringPoints: n, hubFaceMm: mm(face.plane), hubRadiusMm: mm(face.radius), centreMm: face.centre.toArray().map(mm) };
}

/**
 * The smallest turn about `axisWorld` that leaves the object looking identical, in degrees.
 *
 * A clip loops cleanly only if every rolling part comes back to a pose the eye cannot tell
 * from where it started. For a lugged tyre that is the lug spacing; for a 16-sided cylinder
 * it is 22.5 degrees; for a smooth disc it is any angle at all. Read off the object's own
 * vertices: bin their angles about the axle, and the answer is 360 / (number of distinct
 * angles), which is exactly the segment count the modeller used.
 */
export function angularSymmetryDeg(object, axisWorld, fallback = 0.5) {
  object.updateMatrixWorld(true);
  const origin = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
  const axis = new THREE.Vector3().fromArray(Array.isArray(axisWorld) ? axisWorld : axisWorld.toArray()).normalize();
  const u = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const e1 = new THREE.Vector3().crossVectors(axis, u).normalize();
  const e2 = new THREE.Vector3().crossVectors(axis, e1).normalize();
  const angles = new Set();
  const v = new THREE.Vector3();
  let maxR = 0;
  const points = [];
  object.traverse((n) => {
    if (!n.isMesh) return;
    const pos = n.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld).sub(origin);
      const p = new THREE.Vector2(v.dot(e1), v.dot(e2));
      maxR = Math.max(maxR, p.length());
      points.push(p);
    }
  });
  for (const p of points) {
    if (p.length() < maxR * 0.35) continue;                 // hub and cap centres carry no angle
    angles.add(Math.round(((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360 * 4) / 4);
  }
  if (!angles.size) return fallback;
  /* Counting the distinct angles is not the answer: a tyre with twelve lugs on a
     forty-eight sided drum has sixty of them and is still only twelve-fold symmetric.
     Test the rotation instead — the smallest turn that maps the angle set onto itself. */
  const set = [...angles].sort((a, b) => a - b);
  const has = (x) => {
    const t = ((x % 360) + 360) % 360;
    for (const a of set) if (Math.abs(a - t) < 0.3 || Math.abs(a - t - 360) < 0.3 || Math.abs(a - t + 360) < 0.3) return true;
    return false;
  };
  for (let n = 360; n >= 1; n -= 1) {
    const shift = 360 / n;
    let ok = true;
    for (const a of set) { if (!has(a + shift)) { ok = false; break; } }
    if (ok) return Math.max(fallback, shift);
  }
  return 360;
}

/**
 * Turn any closed mesh that is inside out the right way round.
 *
 * The 2026-09-05 rule GEO-INVERTED-WINDING caught one file in the catalogue this way: the
 * seeder's four hopper bodies each enclose a NEGATIVE signed volume, so every face points
 * into the bin. On an engine with back-face culling on a single-sided material the hopper
 * disappears. Swapping two indices per triangle and negating the normals fixes it without
 * touching a single vertex position.
 */
export function fixInvertedWinding(object) {
  const flipped = [];
  for (const mesh of meshes(object)) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    const index = g.getIndex();
    const count = index ? index.count : pos.count;
    const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
    let volume = 0;
    for (let i = 0; i < count; i += 3) {
      const i0 = index ? index.getX(i) : i;
      const i1 = index ? index.getX(i + 1) : i + 1;
      const i2 = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      volume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    }
    if (volume >= 0) continue;
    if (index) {
      for (let i = 0; i < count; i += 3) { const t = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, t); }
      index.needsUpdate = true;
    } else {
      for (const name of Object.keys(g.attributes)) {
        const at = g.getAttribute(name);
        for (let i = 0; i < at.count; i += 3) {
          for (let k = 0; k < at.itemSize; k += 1) {
            const t = at.array[(i + 1) * at.itemSize + k];
            at.array[(i + 1) * at.itemSize + k] = at.array[(i + 2) * at.itemSize + k];
            at.array[(i + 2) * at.itemSize + k] = t;
          }
        }
        at.needsUpdate = true;
      }
    }
    const normal = g.getAttribute('normal');
    if (normal) { for (let i = 0; i < normal.array.length; i += 1) normal.array[i] = -normal.array[i]; normal.needsUpdate = true; }
    flipped.push({ mesh: mesh.name, signedVolumeM3: Math.round(volume * 1e9) / 1e9 });
  }
  return flipped;
}
