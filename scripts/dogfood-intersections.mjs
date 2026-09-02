/**
 * Part-versus-part interpenetration check for GLB assets.
 *
 * A kitbashed low-poly model is built by pushing parts into each other, so *some* overlap is
 * normal and desirable: that is how a blade is attached to a hub. What is not normal is a part
 * buried inside another one — a windmill blade sunk through the body, an axle pushed out through
 * the roof. From outside they look the same until the camera moves, which is why this is measured
 * rather than eyeballed.
 *
 * For every pair of parts in a file:
 *
 *   1. BROAD PHASE — the world-space axis-aligned boxes. `boxOverlapRatio` is the volume of the
 *      shared box divided by the volume of the smaller part's box. Cheap, and it throws away
 *      almost every pair.
 *
 *   2. NARROW PHASE — for pairs whose boxes overlap:
 *      a. `insideRatio`: points sampled uniformly over one part's surface (area-weighted) are
 *         classified against the other part by parity ray casting — cast a ray, count crossings,
 *         an odd number means the point is inside. Three directions vote, so one grazing hit does
 *         not flip an answer. The reported figure is the larger of the two directions (A inside B,
 *         B inside A): a small part swallowed by a big one shows up on one side only.
 *      b. `crossingTriangles`: actual triangle-triangle intersections (Möller's test), counted
 *         through a uniform grid so a 15,000-triangle pair does not become 225 million tests.
 *
 * A pair is flagged SUSPECT when `insideRatio` > 2% or `crossingTriangles` > 0 — the thresholds
 * the request specified. Read the two numbers together: joined parts show crossing triangles with
 * a small inside ratio, a buried part shows a large inside ratio.
 *
 * Usage:
 *   node scripts/dogfood-intersections.mjs [--out <dir>] [--only <substring>] [--samples 400]
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MODELS } from "../outputs/market-launch/wave1/tools/assets.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const flag = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const OUT_DIR = resolve(flag("--out") ?? join(ROOT, "outputs/dogfood"));
const ONLY = flag("--only");
const SURFACE_SAMPLES = Number(flag("--samples") ?? 400);
const INSIDE_RATIO_THRESHOLD = 0.02;
const BOX_OVERLAP_FLOOR = 1e-4; // ignore boxes that merely graze
const NARROW_PAIR_BUDGET = 60; // per file, highest box overlap first
const GRID_CELL_TARGET = 12; // average triangles per grid cell

// --------------------------------------------------------------------- loading

async function loadScene(path) {
  const buffer = await readFile(path);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(arrayBuffer, "", ok, fail);
  });
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/**
 * One entry per drawable part, in world space. GPU-instanced parts are kept as a single entry at
 * the node transform: their per-instance matrices live in a compressed buffer, and pretending
 * otherwise would invent geometry.
 */
function collectParts(scene) {
  const parts = [];
  scene.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const source = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry;
    const position = source.getAttribute("position");
    /*
     * Read every vertex through Vector3 and transform the vector, then write a fresh float
     * buffer. The obvious `geometry.applyMatrix4(node.matrixWorld)` is wrong here: a quantized
     * (KHR_mesh_quantization) mesh stores positions as normalized integers, and writing
     * transformed metres back into that integer array clamps them. That silently collapsed
     * every part of a meshopt build onto the origin, and the checker then reported the whole
     * model as one giant self-intersection.
     */
    const world = new Float32Array(position.count * 3);
    const vector = new THREE.Vector3();
    const box = new THREE.Box3();
    for (let index = 0; index < position.count; index += 1) {
      vector.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld);
      world[index * 3] = vector.x;
      world[index * 3 + 1] = vector.y;
      world[index * 3 + 2] = vector.z;
      box.expandByPoint(vector);
    }
    const triangles = [];
    for (let index = 0; index + 2 < position.count; index += 3) {
      triangles.push([
        new THREE.Vector3(world[index * 3], world[index * 3 + 1], world[index * 3 + 2]),
        new THREE.Vector3(world[index * 3 + 3], world[index * 3 + 4], world[index * 3 + 5]),
        new THREE.Vector3(world[index * 3 + 6], world[index * 3 + 7], world[index * 3 + 8]),
      ]);
    }
    if (!triangles.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(world, 3));
    parts.push({
      name: node.name || `mesh${parts.length}`,
      instanced: Boolean(node.isInstancedMesh),
      triangles,
      box,
      mesh: new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    });
  });
  return parts;
}

// --------------------------------------------------------------------- geometry helpers

function boxVolume(box) {
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(0, size.x) * Math.max(0, size.y) * Math.max(0, size.z);
}

/** Shared-box volume over the smaller box's volume. 1 means one box is inside the other. */
function boxOverlapRatio(a, b) {
  const shared = a.clone().intersect(b);
  if (shared.isEmpty()) return { ratio: 0, shared };
  const smaller = Math.min(boxVolume(a), boxVolume(b));
  if (smaller <= 0) return { ratio: 0, shared };
  return { ratio: boxVolume(shared) / smaller, shared };
}

function triangleArea(triangle) {
  return new THREE.Triangle(triangle[0], triangle[1], triangle[2]).getArea();
}

/** Area-weighted surface samples, deterministic for a given part. */
function sampleSurface(part, count, seed) {
  const cumulative = [];
  let total = 0;
  for (const triangle of part.triangles) {
    total += triangleArea(triangle);
    cumulative.push(total);
  }
  if (total <= 0) return [];
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const target = random() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    const [a, b, c] = part.triangles[low];
    let u = random();
    let v = random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    points.push(
      new THREE.Vector3()
        .copy(a)
        .addScaledVector(new THREE.Vector3().subVectors(b, a), u)
        .addScaledVector(new THREE.Vector3().subVectors(c, a), v),
    );
  }
  return points;
}

const PARITY_DIRECTIONS = [
  new THREE.Vector3(0.5773, 0.5773, 0.5773),
  new THREE.Vector3(-0.7071, 0.3162, 0.6325).normalize(),
  new THREE.Vector3(0.2673, -0.8018, 0.5345).normalize(),
];

/**
 * Parity test: an odd number of crossings means the point is inside the closed mesh.
 *
 * `points` is the whole area-weighted sample of the source part and `region` is the shared box.
 * Points outside the shared box cannot be inside the other part, so they skip the ray casts —
 * but they stay in the denominator. Dividing by only the points inside the box was the first
 * cut, and it made the answer depend on how much of the part happened to sit in the box: the
 * same windmill reported 4.5% and 62% for one pair in its plain and its compressed build.
 * The figure that means something is "what fraction of this part's surface is buried".
 */
function insideRatio(points, region, target, raycaster) {
  if (!points.length) return { ratio: 0, tested: 0, inside: 0 };
  let inside = 0;
  let tested = 0;
  for (const point of points) {
    if (!region.containsPoint(point)) continue;
    tested += 1;
    let votes = 0;
    for (const direction of PARITY_DIRECTIONS) {
      raycaster.set(point, direction);
      const hits = raycaster.intersectObject(target.mesh, false);
      if (hits.length % 2 === 1) votes += 1;
    }
    if (votes >= 2) inside += 1;
  }
  return { ratio: inside / points.length, tested, inside };
}

// --- Möller's triangle-triangle overlap test -------------------------------------------------

function signedDistances(triangle, normal, offset) {
  return triangle.map((vertex) => normal.dot(vertex) + offset);
}

function sameSide(distances, epsilon) {
  return (
    (distances[0] > epsilon && distances[1] > epsilon && distances[2] > epsilon) ||
    (distances[0] < -epsilon && distances[1] < -epsilon && distances[2] < -epsilon)
  );
}

/** Interval on the intersection line covered by one triangle. */
function interval(triangle, distances, axis) {
  const projected = triangle.map((vertex) => axis.dot(vertex));
  const positive = [];
  const negative = [];
  for (let index = 0; index < 3; index += 1) (distances[index] >= 0 ? positive : negative).push(index);
  const minority = positive.length === 1 ? positive : negative;
  const majority = positive.length === 1 ? negative : positive;
  if (!minority.length || minority.length === 3) return null;
  const lone = minority[0];
  const values = majority.map((other) => {
    const t = distances[lone] / (distances[lone] - distances[other]);
    return projected[lone] + (projected[other] - projected[lone]) * t;
  });
  return [Math.min(...values), Math.max(...values)];
}

function trianglesIntersect(a, b, epsilon = 1e-9) {
  const normalB = new THREE.Vector3()
    .subVectors(b[1], b[0])
    .cross(new THREE.Vector3().subVectors(b[2], b[0]));
  if (normalB.lengthSq() < epsilon) return false;
  const offsetB = -normalB.dot(b[0]);
  const distancesA = signedDistances(a, normalB, offsetB);
  if (sameSide(distancesA, epsilon)) return false;

  const normalA = new THREE.Vector3()
    .subVectors(a[1], a[0])
    .cross(new THREE.Vector3().subVectors(a[2], a[0]));
  if (normalA.lengthSq() < epsilon) return false;
  const offsetA = -normalA.dot(a[0]);
  const distancesB = signedDistances(b, normalA, offsetA);
  if (sameSide(distancesB, epsilon)) return false;

  const axis = new THREE.Vector3().crossVectors(normalA, normalB);
  if (axis.lengthSq() < epsilon) return false; // coplanar: treated as no crossing
  const intervalA = interval(a, distancesA, axis);
  const intervalB = interval(b, distancesB, axis);
  if (!intervalA || !intervalB) return false;
  return intervalA[0] <= intervalB[1] + epsilon && intervalB[0] <= intervalA[1] + epsilon;
}

function triangleBox(triangle) {
  return new THREE.Box3().setFromPoints(triangle);
}

/** Triangles whose own box meets `box`, with their boxes cached. */
function trianglesInBox(part, box) {
  const kept = [];
  for (const triangle of part.triangles) {
    const bounds = triangleBox(triangle);
    if (bounds.intersectsBox(box)) kept.push({ triangle, box: bounds });
  }
  return kept;
}

/** Uniform grid over `box` so the crossing count does not become a full cross product. */
function countCrossings(listA, listB, box) {
  if (!listA.length || !listB.length) return 0;
  const size = new THREE.Vector3();
  box.getSize(size);
  const cells = Math.max(1, Math.round(Math.cbrt(listB.length / GRID_CELL_TARGET)));
  const step = new THREE.Vector3(
    Math.max(size.x / cells, 1e-6),
    Math.max(size.y / cells, 1e-6),
    Math.max(size.z / cells, 1e-6),
  );
  const key = (x, y, z) => `${x}|${y}|${z}`;
  const cellOf = (point) => [
    Math.floor((point.x - box.min.x) / step.x),
    Math.floor((point.y - box.min.y) / step.y),
    Math.floor((point.z - box.min.z) / step.z),
  ];
  const grid = new Map();
  for (const entry of listB) {
    const [x0, y0, z0] = cellOf(entry.box.min);
    const [x1, y1, z1] = cellOf(entry.box.max);
    for (let x = x0; x <= x1; x += 1)
      for (let y = y0; y <= y1; y += 1)
        for (let z = z0; z <= z1; z += 1) {
          const id = key(x, y, z);
          if (!grid.has(id)) grid.set(id, []);
          grid.get(id).push(entry);
        }
  }
  let crossings = 0;
  for (const entry of listA) {
    const [x0, y0, z0] = cellOf(entry.box.min);
    const [x1, y1, z1] = cellOf(entry.box.max);
    const seen = new Set();
    let hit = false;
    for (let x = x0; x <= x1 && !hit; x += 1)
      for (let y = y0; y <= y1 && !hit; y += 1)
        for (let z = z0; z <= z1 && !hit; z += 1) {
          for (const other of grid.get(key(x, y, z)) ?? []) {
            if (seen.has(other)) continue;
            seen.add(other);
            if (!entry.box.intersectsBox(other.box)) continue;
            if (trianglesIntersect(entry.triangle, other.triangle)) {
              hit = true;
              break;
            }
          }
        }
    if (hit) crossings += 1;
  }
  return crossings;
}

// --------------------------------------------------------------------- per-file analysis

async function analyse(path) {
  const started = performance.now();
  const scene = await loadScene(path);
  const parts = collectParts(scene);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 1000;

  const candidates = [];
  for (let a = 0; a < parts.length; a += 1) {
    for (let b = a + 1; b < parts.length; b += 1) {
      const { ratio, shared } = boxOverlapRatio(parts[a].box, parts[b].box);
      if (ratio > BOX_OVERLAP_FLOOR) candidates.push({ a, b, ratio, shared });
    }
  }
  candidates.sort((left, right) => right.ratio - left.ratio);
  const examined = candidates.slice(0, NARROW_PAIR_BUDGET);

  const pairs = [];
  for (const candidate of examined) {
    const partA = parts[candidate.a];
    const partB = parts[candidate.b];
    const pointsA = sampleSurface(partA, SURFACE_SAMPLES, 1013 + candidate.a * 7919 + candidate.b);
    const pointsB = sampleSurface(partB, SURFACE_SAMPLES, 2027 + candidate.a * 6271 + candidate.b);
    const aInB = insideRatio(pointsA, candidate.shared, partB, raycaster);
    const bInA = insideRatio(pointsB, candidate.shared, partA, raycaster);
    const listA = trianglesInBox(partA, candidate.shared);
    const listB = trianglesInBox(partB, candidate.shared);
    const crossings = countCrossings(listA, listB, candidate.shared);
    const worst = Math.max(aInB.ratio, bInA.ratio);
    pairs.push({
      a: partA.name,
      b: partB.name,
      boxOverlapRatio: Number(candidate.ratio.toFixed(4)),
      insideRatioAinB: Number(aInB.ratio.toFixed(4)),
      insideRatioBinA: Number(bInA.ratio.toFixed(4)),
      insideRatio: Number(worst.toFixed(4)),
      samples: SURFACE_SAMPLES,
      rayTestedAinB: aInB.tested,
      rayTestedBinA: bInA.tested,
      crossingTriangles: crossings,
      trianglesInOverlap: listA.length + listB.length,
      suspect: worst > INSIDE_RATIO_THRESHOLD || crossings > 0,
    });
  }
  pairs.sort((left, right) => right.insideRatio - left.insideRatio || right.crossingTriangles - left.crossingTriangles);

  return {
    file: relative(ROOT, path).split(sep).join("/"),
    parts: parts.length,
    instancedParts: parts.filter((part) => part.instanced).length,
    boxOverlapPairs: candidates.length,
    examinedPairs: examined.length,
    truncated: candidates.length > examined.length,
    suspectPairs: pairs.filter((pair) => pair.suspect).length,
    worstInsideRatio: pairs.length ? pairs[0].insideRatio : 0,
    pairs,
    elapsedMs: Number((performance.now() - started).toFixed(1)),
  };
}

// --------------------------------------------------------------------- targets

async function listGlb(directory) {
  const out = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await listGlb(path)));
    else if (entry.isFile() && /\.glb$/i.test(entry.name)) out.push(path);
  }
  return out;
}

async function targets() {
  const seen = new Set();
  const list = [];
  const push = (path) => {
    const absolute = resolve(path);
    if (seen.has(absolute.toLowerCase())) return;
    seen.add(absolute.toLowerCase());
    list.push(absolute);
  };
  for (const model of MODELS) push(join(ROOT, model.dir, model.entry));
  for (const path of await listGlb(join(ROOT, "examples/harvest-frontier/exports"))) push(path);
  // Clunk's own factory output that is not in the wave-1 list yet -- the windmill demo the HF
  // export was adapted from lives here, and a defect in the factory is the one thing this pass
  // is allowed to fix.
  for (const path of await listGlb(join(ROOT, "examples/generated"))) push(path);
  return list.filter((path) => !ONLY || path.includes(ONLY));
}

// --------------------------------------------------------------------- run

const files = await targets();
await mkdir(OUT_DIR, { recursive: true });
const results = [];
for (const path of files) {
  const result = await analyse(path);
  results.push(result);
  process.stdout.write(
    `${basename(result.file).padEnd(34)} parts ${String(result.parts).padStart(4)}  boxPairs ${String(result.boxOverlapPairs).padStart(5)}  examined ${String(result.examinedPairs).padStart(3)}  suspect ${String(result.suspectPairs).padStart(3)}  worstInside ${(result.worstInsideRatio * 100).toFixed(1)}%  ${result.elapsedMs}ms\n`,
  );
}
await writeFile(
  join(OUT_DIR, "intersections.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      surfaceSamples: SURFACE_SAMPLES,
      insideRatioThreshold: INSIDE_RATIO_THRESHOLD,
      narrowPairBudget: NARROW_PAIR_BUDGET,
      results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
const flagged = results.filter((result) => result.suspectPairs > 0);
process.stdout.write(`\n${flagged.length}/${results.length} file(s) have at least one suspect pair.\n`);
process.stdout.write(`-> ${join(OUT_DIR, "intersections.json")}\n`);
