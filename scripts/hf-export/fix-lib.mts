/**
 * Geometry / graph surgery helpers for the Harvest Frontier export fix pass.
 *
 * Everything here operates on a GLB this repo produced, never on the Harvest
 * Frontier checkout, which stays read-only. The rules the fix scripts follow:
 *
 *   - MATERIALS ARE NEVER TOUCHED. Not the colour, not the palette, not the
 *     vertex colours. The only exception is `adoptMaterial`, which makes one
 *     part use a material that ALREADY exists on the same asset, for the two
 *     cases where a single part was authored with the wrong one.
 *   - Geometry edits are the smallest that answer a measured defect: move a
 *     node, drop a welded lump, translate a lump, or clone an existing wall to
 *     close a hole. No remodelling, no retopology, no new shapes invented.
 *   - Every helper returns the numbers it changed so the fix scripts can print
 *     a before/after row instead of asserting success.
 */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, exportGlb } from './lib.mjs';
import { GLTFLoader } from '../../../Harvest Frontier/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../Harvest Frontier/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

export interface Loaded {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export async function loadGlb(file: string): Promise<Loaded> {
  const buffer = fs.readFileSync(file);
  const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise<Loaded>((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(array as ArrayBuffer, '', ((g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) => ok({ scene: g.scene, animations: g.animations })) as never, fail);
  });
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

export async function saveGlb(file: string, loaded: Loaded): Promise<void> {
  loaded.scene.updateMatrixWorld(true);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await exportGlb(loaded.scene, loaded.animations));
}

export function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((node) => { if ((node as THREE.Mesh).isMesh) out.push(node as THREE.Mesh); });
  return out;
}

export function node(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`node "${name}" is not in this file`);
  return found;
}

export function mesh(root: THREE.Object3D, name: string): THREE.Mesh {
  const found = node(root, name) as THREE.Mesh;
  if (!found.isMesh) throw new Error(`node "${name}" is not a mesh`);
  return found;
}

export function triangleCount(root: THREE.Object3D): number {
  let total = 0;
  for (const m of meshes(root)) {
    const index = m.geometry.getIndex();
    total += (index ? index.count : m.geometry.getAttribute('position').count) / 3;
  }
  return total;
}

export function worldBox(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

export const mm = (value: number): number => Math.round(value * 10000) / 10;
export const sizeMm = (box: THREE.Box3): number[] =>
  box.getSize(new THREE.Vector3()).toArray().map((v) => mm(v));

/** Welded connected components of one geometry, as vertex-index lists. */
export function components(geometry: THREE.BufferGeometry): number[][] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const parent = new Int32Array(position.count);
  for (let i = 0; i < position.count; i += 1) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number): void => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const seen = new Map<string, number>();
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i); else union(first, i);
  }
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    union(a, b); union(b, c);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < position.count; i += 1) {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i); else groups.set(root, [i]);
  }
  return [...groups.values()];
}

export interface Lump {
  indices: number[];
  /** Local-space box of the lump inside its mesh. */
  box: THREE.Box3;
  /** World-space box, at the pose the scene currently holds. */
  world: THREE.Box3;
  size: THREE.Vector3;
  centre: THREE.Vector3;
}

/** Every welded lump of a mesh, measured both locally and in world space. */
export function lumps(target: THREE.Mesh): Lump[] {
  const position = target.geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();
  return components(target.geometry).map((indices) => {
    const box = new THREE.Box3();
    const world = new THREE.Box3();
    for (const i of indices) {
      point.fromBufferAttribute(position, i);
      box.expandByPoint(point);
      world.expandByPoint(point.clone().applyMatrix4(target.matrixWorld));
    }
    return {
      indices, box, world,
      size: world.getSize(new THREE.Vector3()),
      centre: world.getCenter(new THREE.Vector3()),
    };
  });
}

/** Move one welded lump, in the mesh's LOCAL space. */
export function moveLump(target: THREE.Mesh, lump: Lump, deltaLocal: THREE.Vector3): void {
  const position = target.geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();
  for (const i of lump.indices) {
    point.fromBufferAttribute(position, i).add(deltaLocal);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  target.geometry.computeBoundingBox();
  target.geometry.computeBoundingSphere();
}

/** Move one welded lump by a WORLD-space delta. */
export function moveLumpWorld(target: THREE.Mesh, lump: Lump, deltaWorld: THREE.Vector3): void {
  const scale = target.getWorldScale(new THREE.Vector3());
  moveLump(target, lump, new THREE.Vector3(
    deltaWorld.x / (scale.x || 1),
    deltaWorld.y / (scale.y || 1),
    deltaWorld.z / (scale.z || 1),
  ));
}

/** Scale one welded lump about a local point, per axis. */
export function scaleLump(target: THREE.Mesh, lump: Lump, factor: THREE.Vector3, aboutLocal: THREE.Vector3): void {
  const position = target.geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();
  for (const i of lump.indices) {
    point.fromBufferAttribute(position, i).sub(aboutLocal).multiply(factor).add(aboutLocal);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  target.geometry.computeBoundingBox();
  target.geometry.computeBoundingSphere();
}

/**
 * Drop welded lumps from a mesh, rebuilding every attribute.
 *
 * A triangle goes only if ALL three of its corners belong to a doomed lump, so
 * a lump that shares vertices with the body it sits on cannot take the body
 * with it. Returns the triangles removed.
 */
export function deleteLumps(target: THREE.Mesh, doomed: readonly Lump[]): number {
  const geometry = target.geometry;
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  const dead = new Set<number>();
  for (const lump of doomed) for (const i of lump.indices) dead.add(i);

  const oldCount = index ? index.count : position.count;
  const keptTriangles: number[][] = [];
  for (let i = 0; i < oldCount; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    if (dead.has(a) && dead.has(b) && dead.has(c)) continue;
    keptTriangles.push([a, b, c]);
  }
  const removed = oldCount / 3 - keptTriangles.length;
  if (removed === 0) return 0;

  // Re-index onto only the vertices the survivors use, so no orphan data ships.
  const remap = new Map<number, number>();
  const order: number[] = [];
  for (const tri of keptTriangles) for (const v of tri) {
    if (remap.has(v)) continue;
    remap.set(v, order.length);
    order.push(v);
  }
  const next = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const source = geometry.getAttribute(name) as THREE.BufferAttribute;
    const itemSize = source.itemSize;
    // Keep the attribute's own storage type -- a normalised Uint8 COLOR_0 must
    // not silently become float32 on the way out.
    const ArrayType = (source.array as unknown as { constructor: new (n: number) => Float32Array }).constructor;
    const data = new ArrayType(order.length * itemSize);
    for (let i = 0; i < order.length; i += 1) {
      for (let k = 0; k < itemSize; k += 1) {
        data[i * itemSize + k] = (source.array as ArrayLike<number>)[order[i] * itemSize + k];
      }
    }
    next.setAttribute(name, new THREE.BufferAttribute(data, itemSize, source.normalized));
  }
  const indices = new Uint32Array(keptTriangles.length * 3);
  keptTriangles.forEach((tri, t) => { for (let k = 0; k < 3; k += 1) indices[t * 3 + k] = remap.get(tri[k])!; });
  next.setIndex(new THREE.BufferAttribute(indices, 1));
  next.computeBoundingBox();
  next.computeBoundingSphere();
  target.geometry = next;
  return removed;
}

/** Detach a node from the graph. Returns the triangles it took with it. */
export function removeNode(root: THREE.Object3D, name: string): number {
  const target = node(root, name);
  let triangles = 0;
  target.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const index = m.geometry.getIndex();
    triangles += (index ? index.count : m.geometry.getAttribute('position').count) / 3;
  });
  target.removeFromParent();
  return triangles;
}

/**
 * Give one part a material that ALREADY exists elsewhere in the same asset.
 * Used only where a single part was authored with the wrong one; it introduces
 * no new colour, and the palette the file ships with is unchanged.
 */
export function adoptMaterial(target: THREE.Mesh, donor: THREE.Mesh): void {
  target.material = donor.material;
}

/**
 * Copy the vertex colours of one lump onto another, so a part that was
 * authored in the wrong shade takes a shade the asset already uses. No new
 * colour value is invented: the donor's own average COLOR_0 is written.
 */
export function adoptVertexColour(target: THREE.Mesh, doomed: Lump, donor: THREE.Mesh, source: Lump): THREE.Color | null {
  const from = donor.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  const to = target.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!from || !to) return null;
  let r = 0; let g = 0; let b = 0;
  for (const i of source.indices) { r += from.getX(i); g += from.getY(i); b += from.getZ(i); }
  const n = source.indices.length;
  r /= n; g /= n; b /= n;
  for (const i of doomed.indices) to.setXYZ(i, r, g, b);
  to.needsUpdate = true;
  return new THREE.Color(r, g, b);
}

/** Lowest world Y over every mesh of a subtree, in metres. */
export function lowestY(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  let low = Infinity;
  const point = new THREE.Vector3();
  for (const m of meshes(root)) {
    const position = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      low = Math.min(low, point.fromBufferAttribute(position, i).applyMatrix4(m.matrixWorld).y);
    }
  }
  return low;
}

/** Raise or lower a node so the whole asset's lowest point sits on y = 0. */
export function seatOnGround(root: THREE.Object3D, mover: THREE.Object3D): { beforeMm: number; afterMm: number } {
  const before = lowestY(root);
  mover.position.y -= before;
  root.updateMatrixWorld(true);
  return { beforeMm: mm(before), afterMm: mm(lowestY(root)) };
}

/**
 * Tracks whose every key is the same value are payload with no effect. They are
 * reported by name so a removal is never silent.
 */
export function deadTracks(clip: THREE.AnimationClip): string[] {
  const dead: string[] = [];
  for (const track of clip.tracks) {
    const values = track.values as unknown as ArrayLike<number>;
    const stride = values.length / track.times.length;
    let moves = false;
    for (let i = stride; i < values.length && !moves; i += 1) {
      if (Math.abs(values[i] - values[i % stride]) > 1e-6) moves = true;
    }
    if (!moves) dead.push(track.name);
  }
  return dead;
}

export function removeDeadTracks(clips: readonly THREE.AnimationClip[]): { clip: string; removed: string[] }[] {
  const report: { clip: string; removed: string[] }[] = [];
  for (const clip of clips) {
    const dead = new Set(deadTracks(clip));
    if (dead.size === 0) continue;
    clip.tracks = clip.tracks.filter((t) => !dead.has(t.name));
    report.push({ clip: clip.name, removed: [...dead] });
  }
  return report;
}

/** Meshes whose world bounding boxes coincide to within `epsilon` metres. */
export function coincidentMeshes(root: THREE.Object3D, epsilon = 1e-4): THREE.Mesh[][] {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const m of meshes(root)) {
    const box = worldBox(m);
    const round = (v: number) => Math.round(v / epsilon);
    const key = [box.min, box.max]
      .flatMap((v) => [round(v.x), round(v.y), round(v.z)])
      .join(',');
    const list = buckets.get(key);
    if (list) list.push(m); else buckets.set(key, [m]);
  }
  return [...buckets.values()].filter((group) => group.length > 1);
}

/** Smallest world-space gap between two meshes' boxes, in mm (0 if they overlap). */
export function boxGapMm(a: THREE.Object3D, b: THREE.Object3D): number {
  const ba = worldBox(a);
  const bb = worldBox(b);
  const dx = Math.max(0, ba.min.x - bb.max.x, bb.min.x - ba.max.x);
  const dy = Math.max(0, ba.min.y - bb.max.y, bb.min.y - ba.max.y);
  const dz = Math.max(0, ba.min.z - bb.max.z, bb.min.z - ba.max.z);
  return mm(Math.hypot(dx, dy, dz));
}

/** Nearest other mesh, by box gap. Used to seat a floating part. */
export function nearestNeighbour(root: THREE.Object3D, target: THREE.Mesh): { mesh: THREE.Mesh; gapMm: number } | null {
  let best: { mesh: THREE.Mesh; gapMm: number } | null = null;
  for (const other of meshes(root)) {
    if (other === target) continue;
    const gap = boxGapMm(target, other);
    if (!best || gap < best.gapMm) best = { mesh: other, gapMm: gap };
  }
  return best;
}


/**
 * The average COLOR_0 of a mesh, or of one welded lump of it.
 *
 * Every part these fix passes ADD takes its colour from a part the asset
 * already ships, so no new colour enters the palette. Returns null for a mesh
 * with no vertex colours, and the caller then adds none.
 */
export function averageColour(source: THREE.Mesh, indices?: readonly number[]): THREE.Color | null {
  const attribute = source.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attribute) return null;
  const list = indices ?? Array.from({ length: attribute.count }, (_, i) => i);
  let r = 0; let g = 0; let b = 0;
  for (const i of list) { r += attribute.getX(i); g += attribute.getY(i); b += attribute.getZ(i); }
  return new THREE.Color(r / list.length, g / list.length, b / list.length);
}

export interface BoxSpec {
  /** World-space minimum corner, metres. */
  min: [number, number, number];
  /** World-space maximum corner, metres. */
  max: [number, number, number];
}

/**
 * One mesh holding a set of axis-aligned boxes, built in WORLD space and then
 * carried back into `parent`'s local frame.
 *
 * Each box keeps its own eight vertices, so the faces stay flat-shaded like the
 * rest of these assets and no two boxes share a vertex. Boxes are expected to
 * BUTT, never to overlap: a shared plane between two boxes has opposing
 * normals and is therefore not a z-fighting candidate, while an overlap would
 * add crossing triangles. The caller lays them out; this only builds them.
 */
export function buildBoxes(
  name: string,
  boxes: readonly BoxSpec[],
  donor: THREE.Mesh,
  parent: THREE.Object3D,
  colour: THREE.Color | null = averageColour(donor),
): THREE.Mesh {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const inverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const point = new THREE.Vector3();
  for (const box of boxes) {
    const [x0, y0, z0] = box.min;
    const [x1, y1, z1] = box.max;
    const corners: [number, number, number][] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const base = positions.length / 3;
    for (const [x, y, z] of corners) {
      point.set(x, y, z).applyMatrix4(inverse);
      positions.push(point.x, point.y, point.z);
      if (colour) colours.push(colour.r, colour.g, colour.b);
    }
    const quad = (a: number, b: number, c: number, d: number): void => {
      indices.push(base + a, base + b, base + c, base + a, base + c, base + d);
    };
    quad(1, 0, 3, 2); // -Z
    quad(4, 5, 6, 7); // +Z
    quad(0, 4, 7, 3); // -X
    quad(5, 1, 2, 6); // +X
    quad(0, 1, 5, 4); // -Y
    quad(3, 7, 6, 2); // +Y
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colour) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const built = new THREE.Mesh(geometry, donor.material);
  built.name = name;
  parent.add(built);
  built.updateMatrixWorld(true);
  return built;
}

/**
 * Push a thin part (a window pane) along its own thin axis, INTO the solid the
 * asset's centre lies in, by `inset` metres.
 *
 * The move is decided in world space and carried back through the pane's own
 * parent, because a pane can hang off a node that is yawed 90 or 180 degrees;
 * adding to `position[axis]` directly sends half of them out through the wall.
 */
export function insetPane(root: THREE.Object3D, pane: THREE.Mesh, inset: number): { pane: string; axis: 'x' | 'z'; beforeMm: number; afterMm: number } {
  const centre = worldBox(root).getCenter(new THREE.Vector3());
  const box = worldBox(pane);
  const size = box.getSize(new THREE.Vector3());
  const axis: 'x' | 'z' = size.x < size.z ? 'x' : 'z';
  const paneCentre = box.getCenter(new THREE.Vector3());
  const inward = Math.sign(centre[axis] - paneCentre[axis]) || 1;
  const before = paneCentre[axis];
  const target = pane.getWorldPosition(new THREE.Vector3());
  target[axis] += inward * inset;
  pane.position.copy(pane.parent ? pane.parent.worldToLocal(target) : target);
  root.updateMatrixWorld(true);
  return { pane: pane.name, axis, beforeMm: mm(before), afterMm: mm(worldBox(pane).getCenter(new THREE.Vector3())[axis]) };
}


/**
 * How far the nearest OTHER surface is from a pane's two faces, along the
 * pane's own thin axis, once the pane is displaced by `offset` metres.
 *
 * Only vertices standing over the pane's own footprint count -- a face on the
 * far side of the building shares the plane but never overlaps it in
 * projection, and the z-fighting the panes were flagged for needs both. The
 * figure returned is a real separation in metres, so a caller can pick a
 * direction by measurement instead of by a rule of thumb about "inward".
 */
export function paneClearance(root: THREE.Object3D, pane: THREE.Mesh, axis: 'x' | 'y' | 'z', offset: number): number {
  const box = worldBox(pane);
  const others = ['x', 'y', 'z'].filter((a) => a !== axis) as ('x' | 'y' | 'z')[];
  const faces = [box.min[axis] + offset, box.max[axis] + offset];
  let best = Infinity;
  const point = new THREE.Vector3();
  for (const other of meshes(root)) {
    if (other === pane) continue;
    const position = other.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(other.matrixWorld);
      let inside = true;
      for (const a of others) {
        if (point[a] < box.min[a] - 1e-6 || point[a] > box.max[a] + 1e-6) { inside = false; break; }
      }
      if (!inside) continue;
      for (const face of faces) best = Math.min(best, Math.abs(point[axis] - face));
    }
  }
  return best;
}

export { THREE };
