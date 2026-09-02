/**
 * Exact surface-contact measurement for the Harvest Frontier machine fix pass.
 *
 * `fix-lib.mts` measures with bounding boxes and with a winding-number point
 * test. Neither answers the two questions this pass has to answer:
 *
 *   1. "Does this part CUT that part?" -- a box gap of 0 only says the boxes
 *      overlap, and a winding test needs a closed shell, which several of these
 *      parts are not (`treadLugs` is 12 loose triangles instanced 48 times).
 *      So contact here is an exact Moller triangle-triangle intersection.
 *
 *   2. "Does it cut the face the camera can SEE?" -- the tractor's front fender
 *      arch is authored overlapping the tyre at rest, on faces that point
 *      inboard and down, and the tyre hides them. That overlap is not a defect.
 *      What IS a defect is the tyre coming out through the outboard face. So
 *      `visibleSkin` keeps only the fender triangles whose outward normal faces
 *      the camera, and `outboardOvershootMm` reports how far the tyre pokes past
 *      the outboard extreme of the part that is supposed to cover it.
 *
 * Instanced meshes are expanded: every instance is geometry a buyer sees, and
 * the repo's older `verify.mjs` skips them, which is exactly why the audit's
 * numbers missed the lugs.
 */
import { THREE } from './lib.mjs';

export interface Tri {
  mesh: string;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  n: THREE.Vector3;
  box: THREE.Box3;
}

const HELPER = /collider|proxy|runtimeOnly|socketMarker|socketattach/i;

/** Every world-space triangle of a subtree, instances expanded, helpers dropped. */
export function surface(root: THREE.Object3D, keepHelpers = false): Tri[] {
  const out: Tri[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const m = object as THREE.Mesh & { isInstancedMesh?: boolean; count?: number; getMatrixAt?: (i: number, t: THREE.Matrix4) => void };
    if (!m.isMesh) return;
    if (!keepHelpers && HELPER.test(m.name)) return;
    const transforms: THREE.Matrix4[] = [];
    if (m.isInstancedMesh) {
      for (let k = 0; k < (m.count ?? 0); k += 1) {
        const instance = new THREE.Matrix4();
        m.getMatrixAt!(k, instance);
        transforms.push(new THREE.Matrix4().multiplyMatrices(m.matrixWorld, instance));
      }
    } else transforms.push(m.matrixWorld);
    const position = m.geometry.getAttribute('position');
    const index = m.geometry.getIndex();
    const count = index ? index.count : position.count;
    for (const X of transforms) {
      for (let i = 0; i < count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        const a = new THREE.Vector3().fromBufferAttribute(position as THREE.BufferAttribute, ia).applyMatrix4(X);
        const b = new THREE.Vector3().fromBufferAttribute(position as THREE.BufferAttribute, ib).applyMatrix4(X);
        const c = new THREE.Vector3().fromBufferAttribute(position as THREE.BufferAttribute, ic).applyMatrix4(X);
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        if (n.lengthSq() < 1e-18) continue;
        out.push({ mesh: m.name, a, b, c, n: n.normalize(), box: new THREE.Box3().setFromPoints([a, b, c]) });
      }
    }
  });
  return out;
}

/** Moller triangle-triangle overlap. True when the two triangles actually cross. */
export function triTri(t1: Tri, t2: Tri): boolean {
  const d2 = -t2.n.dot(t2.a);
  const d = [t1.a, t1.b, t1.c].map((p) => t2.n.dot(p) + d2);
  if ((d[0] > 1e-9 && d[1] > 1e-9 && d[2] > 1e-9) || (d[0] < -1e-9 && d[1] < -1e-9 && d[2] < -1e-9)) return false;
  const d1 = -t1.n.dot(t1.a);
  const e = [t2.a, t2.b, t2.c].map((p) => t1.n.dot(p) + d1);
  if ((e[0] > 1e-9 && e[1] > 1e-9 && e[2] > 1e-9) || (e[0] < -1e-9 && e[1] < -1e-9 && e[2] < -1e-9)) return false;
  const D = new THREE.Vector3().crossVectors(t1.n, t2.n);
  if (D.lengthSq() < 1e-18) return false;
  const span = (t: Tri, dd: number[]): [number, number] | null => {
    const P = [t.a, t.b, t.c].map((p) => D.dot(p));
    const hits: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const j = (i + 1) % 3;
      if (dd[i] * dd[j] < 0) hits.push(P[i] + (P[j] - P[i]) * (dd[i] / (dd[i] - dd[j])));
      else if (Math.abs(dd[i]) < 1e-12) hits.push(P[i]);
    }
    return hits.length < 2 ? null : [Math.min(...hits), Math.max(...hits)];
  };
  const i1 = span(t1, d);
  const i2 = span(t2, e);
  if (!i1 || !i2) return false;
  return i1[0] <= i2[1] + 1e-9 && i2[0] <= i1[1] + 1e-9;
}

/** Triangle pairs where subtree A cuts subtree B, and which meshes did it. */
export function contact(a: Tri[], b: Tri[]): { pairs: number; meshes: string[] } {
  let pairs = 0;
  const meshes = new Set<string>();
  for (const p of a) {
    for (const q of b) {
      if (!p.box.intersectsBox(q.box)) continue;
      if (!triTri(p, q)) continue;
      pairs += 1;
      meshes.add(`${p.mesh} x ${q.mesh}`);
    }
  }
  return { pairs, meshes: [...meshes] };
}

/** Smallest surface-to-surface distance between two triangle soups, in mm. */
export function minSurfaceGapMm(a: Tri[], b: Tri[]): number {
  let best = Infinity;
  const c = new THREE.Vector3();
  for (const p of a) {
    const P = new THREE.Triangle(p.a, p.b, p.c);
    for (const q of b) {
      const boxGap = Math.hypot(
        Math.max(0, p.box.min.x - q.box.max.x, q.box.min.x - p.box.max.x),
        Math.max(0, p.box.min.y - q.box.max.y, q.box.min.y - p.box.max.y),
        Math.max(0, p.box.min.z - q.box.max.z, q.box.min.z - p.box.max.z),
      );
      if (boxGap > best) continue;
      const Q = new THREE.Triangle(q.a, q.b, q.c);
      for (const v of [q.a, q.b, q.c]) { P.closestPointToPoint(v, c); best = Math.min(best, c.distanceTo(v)); }
      for (const v of [p.a, p.b, p.c]) { Q.closestPointToPoint(v, c); best = Math.min(best, c.distanceTo(v)); }
    }
  }
  return Math.round(best * 10000) / 10;
}

/**
 * The triangles of a cover part whose outward normal faces the camera: outboard
 * (`outboard` is -1 for a left-hand part, +1 for a right-hand one), up, fore or
 * aft. The inboard and underside faces are the ones the covered part is meant
 * to hide, and an overlap there is authoring, not a defect.
 */
export function visibleSkin(cover: Tri[], outboard: number): Tri[] {
  return cover.filter((t) => t.n.z * outboard > 0.3 || t.n.y > 0.3 || Math.abs(t.n.x) > 0.3);
}

/**
 * How far, in mm, `inner` pokes past the outboard extreme of `cover`, counting
 * only the region `cover` actually spans in x and y. 0 means the cover still
 * hides it; anything above 0 is the covered part breaking out through the face
 * a buyer looks at.
 */
export function outboardOvershootMm(inner: Tri[], cover: Tri[], outboard: number): number {
  let face = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  let xLo = Infinity;
  let xHi = -Infinity;
  for (const t of cover) {
    for (const p of [t.a, t.b, t.c]) {
      face = Math.max(face, p.z * outboard);
      yLo = Math.min(yLo, p.y); yHi = Math.max(yHi, p.y);
      xLo = Math.min(xLo, p.x); xHi = Math.max(xHi, p.x);
    }
  }
  let worst = 0;
  for (const t of inner) {
    for (const p of [t.a, t.b, t.c]) {
      if (p.y < yLo || p.y > yHi || p.x < xLo || p.x > xHi) continue;
      worst = Math.max(worst, (p.z * outboard - face) * 1000);
    }
  }
  return Math.round(worst * 100) / 100;
}

/** Lowest world Y over a subtree, instances expanded, helpers dropped, in mm. */
export function lowestMm(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  let low = Infinity;
  const p = new THREE.Vector3();
  root.traverse((object) => {
    const m = object as THREE.Mesh & { isInstancedMesh?: boolean; count?: number; getMatrixAt?: (i: number, t: THREE.Matrix4) => void };
    if (!m.isMesh || HELPER.test(m.name)) return;
    const transforms: THREE.Matrix4[] = [];
    if (m.isInstancedMesh) {
      for (let k = 0; k < (m.count ?? 0); k += 1) {
        const instance = new THREE.Matrix4();
        m.getMatrixAt!(k, instance);
        transforms.push(new THREE.Matrix4().multiplyMatrices(m.matrixWorld, instance));
      }
    } else transforms.push(m.matrixWorld);
    const position = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const X of transforms) {
      for (let i = 0; i < position.count; i += 1) {
        low = Math.min(low, p.fromBufferAttribute(position, i).applyMatrix4(X).y);
      }
    }
  });
  return Math.round(low * 10000) / 10;
}

/** Pose the scene at one phase of one clip; returns a disposer. */
export function atPhase(scene: THREE.Object3D, clip: THREE.AnimationClip, phase: number): () => void {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(0);
  mixer.setTime(clip.duration * Math.min(phase, 1 - 1e-6));
  scene.updateMatrixWorld(true);
  return () => { action.stop(); mixer.uncacheClip(clip); };
}

export const PHASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

/** The same triangles translated by `d`. Used to test a candidate node move. */
export function shift(tris: Tri[], d: THREE.Vector3): Tri[] {
  return tris.map((t) => {
    const a = t.a.clone().add(d);
    const b = t.b.clone().add(d);
    const c = t.c.clone().add(d);
    return { mesh: t.mesh, a, b, c, n: t.n, box: new THREE.Box3().setFromPoints([a, b, c]) };
  });
}

/**
 * Smallest translation, in the plane spanned by `axisA` and `axisB` and with
 * both components positive, that leaves `moving` cutting nothing in `fixed`.
 * Coarse grid first, then a fine pass around the winner; both are exhaustive, so
 * the answer does not depend on the search starting anywhere sensible.
 */
export function shortestClearMove(
  moving: Tri[][],
  fixed: Tri[],
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
  limitA: number,
  limitB: number,
): { a: number; b: number; offset: THREE.Vector3 } | null {
  const clear = (offset: THREE.Vector3): boolean => {
    for (const pose of moving) {
      const shifted = shift(pose, offset);
      let box = new THREE.Box3();
      for (const t of shifted) box.union(t.box);
      const near = fixed.filter((t) => t.box.intersectsBox(box));
      for (const p of shifted) for (const q of near) {
        if (!p.box.intersectsBox(q.box)) continue;
        if (triTri(p, q)) return false;
      }
    }
    return true;
  };
  const search = (aFrom: number, aTo: number, bFrom: number, bTo: number, step: number) => {
    let best: { a: number; b: number; offset: THREE.Vector3 } | null = null;
    for (let a = Math.max(0, aFrom); a <= aTo + 1e-9; a += step) {
      for (let b = Math.max(0, bFrom); b <= bTo + 1e-9; b += step) {
        if (best && Math.hypot(a, b) >= Math.hypot(best.a, best.b)) continue;
        const offset = axisA.clone().multiplyScalar(a).addScaledVector(axisB, b);
        if (!clear(offset)) continue;
        best = { a, b, offset };
      }
    }
    return best;
  };
  const coarse = search(0, limitA, 0, limitB, 0.02);
  if (!coarse) return null;
  const fine = search(coarse.a - 0.02, coarse.a + 0.001, coarse.b - 0.02, coarse.b + 0.001, 0.002);
  return fine ?? coarse;
}
