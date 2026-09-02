/**
 * Shared helpers for the Harvest Frontier -> GLB export pipeline.
 *
 * Everything here lives in the Clunk repo. The Harvest Frontier checkout is
 * READ-ONLY: we import its factories by relative path and its own copy of
 * three (r185) so that `instanceof` checks inside GLTFExporter see one THREE.
 */
import * as THREE from '../../../Harvest Frontier/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../../Harvest Frontier/node_modules/three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter asks for a FileReader when producing a binary GLB. Node has no
// DOM one; this is the same shim tools/assets/export-tractor-glb.ts installs.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    }).catch((error: unknown) => this.onerror?.(error));
  }
}
if (typeof (globalThis as Record<string, unknown>).FileReader === 'undefined') {
  Object.assign(globalThis, { FileReader: NodeFileReader });
}

export { THREE, GLTFExporter };

/**
 * Cross the Harvest Frontier type boundary.
 *
 * At RUNTIME there is exactly one three in this process — Harvest Frontier's
 * r185, imported above — so an object handed over by an HF factory is already
 * the object this pipeline wants. Only the DECLARATION differs: HF is typed
 * against `@types/three` 0.185 and Clunk against 0.179, and the two are not
 * mutually assignable (r185's `Matrix4` gained `determinantAffine`, and the
 * incompatibility cascades through `Object3D`). Every crossing goes through
 * this one function, so there is a single place to delete when the two
 * checkouts agree on a three version. It is a re-label, never a conversion.
 */
export function crossThree<T>(node: unknown): T {
  return node as T;
}

/**
 * three's GLTFExporter has no support for InstancedMesh, so every instanced
 * scatter has to become real geometry before export. Two modes:
 *
 *  - 'bake'   : every instance matrix is applied and the results merged, so a
 *               fence line or a haystack row keeps its authored layout.
 *  - 'single' : only instance 0 survives, which is how you get ONE orchard
 *               tree / crate / haystack out of a field of them.
 */
export function resolveInstancing(root: THREE.Object3D, mode: 'bake' | 'single' = 'bake'): number {
  const instances: THREE.InstancedMesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.InstancedMesh).isInstancedMesh) instances.push(node as THREE.InstancedMesh);
  });
  for (const instance of instances) {
    const replacement = mode === 'single'
      ? new THREE.Mesh(instance.geometry, instance.material)
      : new THREE.Mesh(bakeInstances(instance), instance.material);
    replacement.name = instance.name;
    replacement.position.copy(instance.position);
    replacement.quaternion.copy(instance.quaternion);
    replacement.scale.copy(instance.scale);
    replacement.castShadow = instance.castShadow;
    replacement.receiveShadow = instance.receiveShadow;
    replacement.userData = { ...instance.userData };
    instance.parent?.add(replacement);
    instance.removeFromParent();
  }
  return instances.length;
}

function bakeInstances(instance: THREE.InstancedMesh): THREE.BufferGeometry {
  const source = instance.geometry;
  const index = source.getIndex();
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const normal = source.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = source.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const color = source.getAttribute('color') as THREE.BufferAttribute | undefined;
  const instanceColor = instance.instanceColor;
  const vertexCount = position.count;
  const count = instance.count;

  const positions = new Float32Array(vertexCount * count * 3);
  const normals = normal ? new Float32Array(vertexCount * count * 3) : null;
  const uvs = uv ? new Float32Array(vertexCount * count * 2) : null;
  const colors = (color || instanceColor) ? new Float32Array(vertexCount * count * 3) : null;
  const indices: number[] = [];

  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const vector = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    instance.getMatrixAt(i, matrix);
    normalMatrix.getNormalMatrix(matrix);
    if (instanceColor) tint.fromBufferAttribute(instanceColor as THREE.BufferAttribute, i);
    const base = i * vertexCount;
    for (let v = 0; v < vertexCount; v += 1) {
      vector.fromBufferAttribute(position, v).applyMatrix4(matrix);
      positions.set([vector.x, vector.y, vector.z], (base + v) * 3);
      if (normals && normal) {
        vector.fromBufferAttribute(normal, v).applyMatrix3(normalMatrix).normalize();
        normals.set([vector.x, vector.y, vector.z], (base + v) * 3);
      }
      if (uvs && uv) uvs.set([uv.getX(v), uv.getY(v)], (base + v) * 2);
      if (colors) {
        const r = color ? color.getX(v) : 1;
        const g = color ? color.getY(v) : 1;
        const b = color ? color.getZ(v) : 1;
        colors.set(instanceColor ? [r * tint.r, g * tint.g, b * tint.b] : [r, g, b], (base + v) * 3);
      }
    }
    if (index) {
      for (let k = 0; k < index.count; k += 1) indices.push(base + index.getX(k));
    } else {
      for (let k = 0; k < vertexCount; k += 1) indices.push(base + k);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals) geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Detach a subtree and re-seat it at the origin so it exports as its own asset. */
export function isolate(node: THREE.Object3D, name: string): THREE.Group {
  node.removeFromParent();
  node.position.set(0, 0, 0);
  node.quaternion.identity();
  const holder = new THREE.Group();
  holder.name = name;
  holder.add(node);
  return holder;
}

/**
 * Keep only the triangles whose centroid falls inside a horizontal radius of
 * (x, z), then re-seat the result at the origin.
 *
 * The hand carts are authored straight into ONE world-space merged mesh
 * (props.ts createRouteDressing -> pushHandCart, which is not exported), so
 * this is the only way to get a single cart out without touching HF. The
 * anchors it is cropped around are HF's own exported ROUTE_CART_ANCHORS.
 */
export function cropAroundAnchor(mesh: THREE.Mesh, x: number, z: number, radius: number): THREE.Mesh {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const attributes = Object.keys(source.attributes);
  const kept: Record<string, number[]> = {};
  for (const key of attributes) kept[key] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const radiusSquared = radius * radius;
  for (let t = 0; t < position.count; t += 3) {
    a.fromBufferAttribute(position, t);
    b.fromBufferAttribute(position, t + 1);
    c.fromBufferAttribute(position, t + 2);
    const cx = (a.x + b.x + c.x) / 3 - x;
    const cz = (a.z + b.z + c.z) / 3 - z;
    if (cx * cx + cz * cz > radiusSquared) continue;
    for (const key of attributes) {
      const attribute = source.getAttribute(key) as THREE.BufferAttribute;
      for (let v = 0; v < 3; v += 1) {
        for (let item = 0; item < attribute.itemSize; item += 1) {
          kept[key]!.push(attribute.array[(t + v) * attribute.itemSize + item] as number);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  for (const key of attributes) {
    const attribute = source.getAttribute(key) as THREE.BufferAttribute;
    geometry.setAttribute(key, new THREE.Float32BufferAttribute(kept[key]!, attribute.itemSize));
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const result = new THREE.Mesh(geometry, mesh.material);
  result.name = mesh.name;
  result.castShadow = mesh.castShadow;
  result.receiveShadow = mesh.receiveShadow;
  return result;
}

export interface JointSample {
  node: THREE.Object3D;
  position: boolean;
}

/**
 * Bake one looping/one-shot clip by REPLAYING the game's own pose function and
 * recording each tracked joint's local TRS per frame. No motion is invented:
 * `pose(t)` calls straight into the engine code that drives the node.
 */
export function bakeClip(
  name: string,
  duration: number,
  fps: number,
  joints: readonly JointSample[],
  pose: (t: number) => void,
): THREE.AnimationClip {
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const times = new Float32Array(frames);
  const quats = joints.map(() => new Float32Array(frames * 4));
  const positions = joints.map((j) => (j.position ? new Float32Array(frames * 3) : null));

  for (let f = 0; f < frames; f += 1) {
    const t = (f / (frames - 1)) * duration;
    times[f] = t;
    pose(t);
    joints.forEach((joint, i) => {
      const q = joint.node.quaternion;
      quats[i]!.set([q.x, q.y, q.z, q.w], f * 4);
      const p = positions[i];
      if (p) p.set([joint.node.position.x, joint.node.position.y, joint.node.position.z], f * 3);
    });
  }

  const tracks: THREE.KeyframeTrack[] = [];
  joints.forEach((joint, i) => {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${joint.node.name}.quaternion`, times as unknown as number[], quats[i] as unknown as number[]));
    const p = positions[i];
    if (p) tracks.push(new THREE.VectorKeyframeTrack(`${joint.node.name}.position`, times as unknown as number[], p as unknown as number[]));
  });
  return new THREE.AnimationClip(name, duration, tracks);
}

export interface Measurement {
  triangles: number;
  drawCalls: number;
  materials: number;
  meshes: number;
  sizeMeters: { x: number; y: number; z: number };
}

/** Measure a live scene graph: world bounding box, triangles, mesh/material draws. */
export function measureScene(root: THREE.Object3D): Measurement {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<string>();
  const draws = new Set<string>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    box.expandByObject(mesh);
    const geometry = mesh.geometry;
    const index = geometry.getIndex();
    const groups = geometry.groups.length > 0 ? geometry.groups.length : 1;
    triangles += index ? index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) if (material) materials.add(material.uuid);
    draws.add(`${mesh.uuid}:${groups}`);
  });
  if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3());
  box.getSize(size);
  return {
    triangles: Math.round(triangles),
    drawCalls: draws.size,
    materials: materials.size,
    meshes,
    sizeMeters: { x: round3(size.x), y: round3(size.y), z: round3(size.z) },
  };
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function exportGlb(root: THREE.Object3D, animations: THREE.AnimationClip[]): Promise<Buffer> {
  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: false,
    trs: true,
    includeCustomExtensions: true,
    animations,
  });
  if (!(binary instanceof ArrayBuffer)) throw new Error('GLTFExporter did not produce a binary GLB');
  return Buffer.from(binary);
}
