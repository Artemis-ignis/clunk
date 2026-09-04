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
