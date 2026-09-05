/**
 * 판매 중인 GLB를 그 자리에서 고치기 위한 수술 도구.
 *
 * `machine-lib.mjs` 는 three 로 읽고 three 로 다시 써낸다. 그 경로는 2026-09-03 판까지는
 * 맞았지만 지금 팔고 있는 파일에는 쓸 수 없다:
 *
 *   1. seeder.compact.m1.glb 와 cultivator.compact.m1.glb 에는 이미지가 1장 들어 있다
 *      (팔레트 텍스처). three 의 GLTFLoader 는 이미지를 만나면 `self.URL` 을 찾다가
 *      Node 에서 `ReferenceError: self is not defined` 로 죽는다 — 실측으로 확인했다.
 *   2. 설령 읽어냈다 해도 GLTFExporter 는 모든 버퍼를 다시 써낸다. 이번 수리는
 *      "삼각형 수는 그대로여야 한다"가 합격 조건이라, 건드리지 않은 정점까지 재인코딩
 *      되는 경로는 위험을 스스로 만드는 셈이다.
 *
 * 그래서 이 모듈은 파일을 만든 것과 같은 도구(glTF-Transform v4.2.1, 파일의
 * `asset.generator` 가 그렇게 적혀 있다)로 문서를 열고, 노드의 translation 과 고른
 * 정점만 고친 뒤 그대로 다시 쓴다. 손대지 않은 accessor 는 바이트가 그대로 남는다.
 *
 * 주의: 이 파일들은 accessor 가 공유된다. 예를 들어 시더의 `pivotrowUnit01..04_metal`
 * 네 노드는 POSITION accessor 하나(9,828 정점)를 함께 쓴다. 그래서 한 줄기의 게이지 암을
 * 고치면 네 줄기가 같이 고쳐진다 — 이 수리에서는 그것이 원하는 결과다. 반대로 일부만
 * 바꾸고 싶을 때 쓰면 안 된다.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

export const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

export const mm = (v) => Math.round(v * 10000) / 10;
export const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** 열 우선(column-major) 4x4 곱. glTF 의 행렬 규약이 그렇다. */
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}
export const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
/** 아핀 행렬의 역. 회전+균등스케일+이동만 쓰는 파일이라 3x3 역행렬이면 충분하다. */
export function invert(m) {
  const r = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const det = r[0] * (r[4] * r[8] - r[5] * r[7]) - r[3] * (r[1] * r[8] - r[2] * r[7]) + r[6] * (r[1] * r[5] - r[2] * r[4]);
  const i = [
    (r[4] * r[8] - r[5] * r[7]) / det, -(r[1] * r[8] - r[2] * r[7]) / det, (r[1] * r[5] - r[2] * r[4]) / det,
    -(r[3] * r[8] - r[5] * r[6]) / det, (r[0] * r[8] - r[2] * r[6]) / det, -(r[0] * r[5] - r[2] * r[3]) / det,
    (r[3] * r[7] - r[4] * r[6]) / det, -(r[0] * r[7] - r[1] * r[6]) / det, (r[0] * r[4] - r[1] * r[3]) / det,
  ];
  const t = [m[12], m[13], m[14]];
  return [
    i[0], i[1], i[2], 0, i[3], i[4], i[5], 0, i[6], i[7], i[8], 0,
    -(i[0] * t[0] + i[3] * t[1] + i[6] * t[2]), -(i[1] * t[0] + i[4] * t[1] + i[7] * t[2]), -(i[2] * t[0] + i[5] * t[1] + i[8] * t[2]), 1,
  ];
}

/** 첫 씬의 모든 노드 + 월드 행렬, 깊이 우선. */
export function flatten(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const out = [];
  const walk = (n, parent, depth) => {
    const world = mul(parent, n.getMatrix());
    out.push({ node: n, name: n.getName() || '(anon)', world, parentWorld: parent, depth });
    for (const c of n.listChildren()) walk(c, world, depth + 1);
  };
  for (const n of scene.listChildren()) walk(n, ID, 0);
  return out;
}
export function entry(list, name) {
  const hit = list.find((e) => e.name === name);
  if (!hit) throw new Error(`node "${name}" is not in this file`);
  return hit;
}
export function descendants(e) {
  const set = new Set();
  (function collect(n) { set.add(n); for (const c of n.listChildren()) collect(c); })(e.node);
  return set;
}

/** 노드 자신의 메시가 만드는 월드 좌표 삼각형. */
export function ownTris(e, world = e.world) {
  const mesh = e.node.getMesh();
  if (!mesh) return [];
  const out = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const a = pos.getArray();
    const idx = prim.getIndices();
    const ix = idx ? idx.getArray() : null;
    const n = ix ? ix.length : pos.getCount();
    for (let i = 0; i < n; i += 3) {
      out.push([0, 1, 2].map((k) => {
        const v = ix ? ix[i + k] : i + k;
        return apply(world, [a[v * 3], a[v * 3 + 1], a[v * 3 + 2]]);
      }));
    }
  }
  return out;
}
export function ownVerts(e, world = e.world) {
  const mesh = e.node.getMesh();
  if (!mesh) return [];
  const out = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const a = pos.getArray();
    for (let i = 0; i < pos.getCount(); i += 1) out.push(apply(world, [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]));
  }
  return out;
}
export function subtree(list, e, fn) {
  const want = descendants(e);
  const out = [];
  for (const x of list) if (want.has(x.node)) out.push(...fn(x));
  return out;
}
export const bounds = (vs) => {
  if (!vs.length) return null;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of vs) for (let i = 0; i < 3; i += 1) { if (v[i] < lo[i]) lo[i] = v[i]; if (v[i] > hi[i]) hi[i] = v[i]; }
  return { lo, hi };
};
export const triangleCount = (doc) => doc.getRoot().listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((s, p) => {
  const idx = p.getIndices();
  return s + (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
}, 0), 0);

/**
 * 병합된 메시 안의 "붙어 있는 덩어리" 목록.
 *
 * mergeByAnchor 가 부품 수십 개를 한 메시로 녹였기 때문에, 포크나 지지대 하나만
 * 옮기려면 그 부품에 해당하는 정점을 다시 찾아내야 한다. 정점은 위치로 용접해서
 * 잇는다 — 병합 때 mergeVertices(1e-5) 를 거쳤으니, 서로 닿아 있던 부품은 이미 한
 * 덩어리이고 떨어져 있던 부품은 확실히 갈라진다.
 */
export function componentsOf(e) {
  const mesh = e.node.getMesh();
  if (!mesh) return [];
  const out = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const a = pos.getArray();
    const idx = prim.getIndices();
    const ix = idx ? idx.getArray() : Array.from({ length: pos.getCount() }, (_, i) => i);
    const world = [];
    for (let i = 0; i < pos.getCount(); i += 1) world.push(apply(e.world, [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]));
    const key = (v) => v.map((x) => Math.round(x * 1000)).join(',');
    const rep = new Map();
    const weld = world.map((v) => { const k = key(v); if (!rep.has(k)) rep.set(k, rep.size); return rep.get(k); });
    const par = Array.from({ length: rep.size }, (_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const uni = (x, y) => { x = find(x); y = find(y); if (x !== y) par[x] = y; };
    for (let i = 0; i < ix.length; i += 3) { uni(weld[ix[i]], weld[ix[i + 1]]); uni(weld[ix[i + 1]], weld[ix[i + 2]]); }
    const buckets = new Map();
    for (let i = 0; i < ix.length; i += 3) {
      const g = find(weld[ix[i]]);
      if (!buckets.has(g)) buckets.set(g, { prim, tris: 0, verts: new Set() });
      const B = buckets.get(g);
      B.tris += 1;
      for (let k = 0; k < 3; k += 1) B.verts.add(ix[i + k]);
    }
    for (const B of buckets.values()) {
      const vs = [...B.verts].map((v) => world[v]);
      out.push({ prim: B.prim, tris: B.tris, verts: [...B.verts], box: bounds(vs) });
    }
  }
  return out;
}

/** 고른 정점만 월드 좌표에서 delta 만큼 민다. 노드의 프레임으로 되돌려 기록한다. */
export function shiftVerts(e, prim, vertIndices, worldDelta) {
  const inv = invert(e.world);
  const local = [
    inv[0] * worldDelta[0] + inv[4] * worldDelta[1] + inv[8] * worldDelta[2],
    inv[1] * worldDelta[0] + inv[5] * worldDelta[1] + inv[9] * worldDelta[2],
    inv[2] * worldDelta[0] + inv[6] * worldDelta[1] + inv[10] * worldDelta[2],
  ];
  const a = prim.getAttribute('POSITION').getArray();
  for (const v of vertIndices) { a[v * 3] += local[0]; a[v * 3 + 1] += local[1]; a[v * 3 + 2] += local[2]; }
  return local;
}

/* ------------------------------------------------------------------ 접촉 측정 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
export const triBox = (t) => ({
  lo: [0, 1, 2].map((i) => Math.min(t[0][i], t[1][i], t[2][i])),
  hi: [0, 1, 2].map((i) => Math.max(t[0][i], t[1][i], t[2][i])),
});
export function boxGap(a, b) {
  let s = 0;
  for (let i = 0; i < 3; i += 1) { const d = Math.max(a.lo[i] - b.hi[i], b.lo[i] - a.hi[i], 0); s += d * d; }
  return Math.sqrt(s);
}
function triPoint(p, t) {
  const [a, b, c] = t;
  const ab = sub(b, a); const ac = sub(c, a); const ap = sub(p, a);
  const d1 = dot(ab, ap); const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b); const d3 = dot(ab, bp); const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scl(ab, d1 / (d1 - d3)));
  const cp = sub(p, c); const d5 = dot(ab, cp); const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scl(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) return add(b, scl(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return add(a, add(scl(ab, vb * den), scl(ac, vc * den)));
}
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1); const d2 = sub(q2, p2); const r = sub(p1, p2);
  const a = dot(d1, d1); const e = dot(d2, d2); const f = dot(d2, r);
  let s; let t;
  if (a < 1e-18 && e < 1e-18) return len(r);
  if (a < 1e-18) { s = 0; t = Math.max(0, Math.min(1, f / e)); } else {
    const c = dot(d1, r);
    if (e < 1e-18) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else {
      const b = dot(d1, d2); const den = a * e - b * b;
      s = den > 1e-18 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  return len(sub(add(p1, scl(d1, s)), add(p2, scl(d2, t))));
}
/** Moller 삼각형-삼각형 교차. 상자가 겹치는 것과 실제로 뚫는 것은 다르다. */
export function triTri(t1, t2) {
  const n2 = cross(sub(t2[1], t2[0]), sub(t2[2], t2[0]));
  if (dot(n2, n2) < 1e-24) return false;
  const k2 = -dot(n2, t2[0]);
  const d = t1.map((p) => dot(n2, p) + k2);
  if ((d[0] > 1e-9 && d[1] > 1e-9 && d[2] > 1e-9) || (d[0] < -1e-9 && d[1] < -1e-9 && d[2] < -1e-9)) return false;
  const n1 = cross(sub(t1[1], t1[0]), sub(t1[2], t1[0]));
  if (dot(n1, n1) < 1e-24) return false;
  const k1 = -dot(n1, t1[0]);
  const e = t2.map((p) => dot(n1, p) + k1);
  if ((e[0] > 1e-9 && e[1] > 1e-9 && e[2] > 1e-9) || (e[0] < -1e-9 && e[1] < -1e-9 && e[2] < -1e-9)) return false;
  const D = cross(n1, n2);
  if (dot(D, D) < 1e-24) return false;
  const span = (t, dd) => {
    const P = t.map((p) => dot(D, p));
    const hits = [];
    for (let i = 0; i < 3; i += 1) {
      const j = (i + 1) % 3;
      if (dd[i] * dd[j] < 0) hits.push(P[i] + (P[j] - P[i]) * (dd[i] / (dd[i] - dd[j])));
      else if (Math.abs(dd[i]) < 1e-12) hits.push(P[i]);
    }
    return hits.length < 2 ? null : [Math.min(...hits), Math.max(...hits)];
  };
  const i1 = span(t1, d); const i2 = span(t2, e);
  if (!i1 || !i2) return false;
  return i1[0] <= i2[1] + 1e-9 && i2[0] <= i1[1] + 1e-9;
}
export function triTriDist(t1, t2) {
  if (triTri(t1, t2)) return 0;
  let best = Infinity;
  for (const p of t1) { const d = len(sub(p, triPoint(p, t2))); if (d < best) best = d; }
  for (const p of t2) { const d = len(sub(p, triPoint(p, t1))); if (d < best) best = d; }
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const d = segSeg(t1[i], t1[(i + 1) % 3], t2[j], t2[(j + 1) % 3]);
      if (d < best) best = d;
    }
  }
  return best;
}
/** 두 삼각형 더미 사이의 최소 거리. 겹치면 0. `cap` 보다 먼 쌍은 상자로 미리 버린다. */
export function soupDist(A, B, cap = Infinity) {
  const bA = A.map(triBox); const bB = B.map(triBox);
  let best = cap;
  for (let i = 0; i < A.length; i += 1) {
    for (let j = 0; j < B.length; j += 1) {
      if (boxGap(bA[i], bB[j]) >= best) continue;
      const d = triTriDist(A[i], B[j]);
      if (d < best) { best = d; if (best === 0) return 0; }
    }
  }
  return best;
}

/**
 * 닫힌 삼각형 더미 안으로 점들이 얼마나 깊이 들어가 있는가.
 *
 * 접촉 여부(soupDist === 0)만으로는 "고쳐서 더 나빠졌는지"를 말할 수 없다. 게이지 휠은
 * 원래부터 오프너 원판에 닿아 있고(실제 파종기가 그렇다), 이 수리가 물어야 하는 것은
 * 그 겹침이 깊어졌는가다. +x 방향 광선의 교차 횟수로 안팎을 가르고, 안쪽 점에서 표면까지의
 * 최단 거리를 깊이로 쓴다.
 */
export function insideDepth(points, tris) {
  const boxes = tris.map(triBox);
  let deepest = 0;
  let count = 0;
  for (const p of points) {
    let hits = 0;
    for (let i = 0; i < tris.length; i += 1) {
      const b = boxes[i];
      if (p[1] < b.lo[1] || p[1] > b.hi[1] || p[2] < b.lo[2] || p[2] > b.hi[2] || p[0] > b.hi[0]) continue;
      const t = tris[i];
      const e1 = sub(t[1], t[0]); const e2 = sub(t[2], t[0]);
      const h = cross([1, 0, 0], e2); const a = dot(e1, h);
      if (Math.abs(a) < 1e-12) continue;
      const f = 1 / a; const s = sub(p, t[0]);
      const u = f * dot(s, h); if (u < 0 || u > 1) continue;
      const q = cross(s, e1); const v = f * dot([1, 0, 0], q); if (v < 0 || u + v > 1) continue;
      if (f * dot(e2, q) > 1e-9) hits += 1;
    }
    if (hits % 2 === 0) continue;
    count += 1;
    let d = Infinity;
    for (const t of tris) { const dd = len(sub(p, triPoint(p, t))); if (dd < d) d = dd; }
    if (d > deepest) deepest = d;
  }
  return { verticesInside: count, deepestMm: Math.round(deepest * 10000) / 10 };
}
