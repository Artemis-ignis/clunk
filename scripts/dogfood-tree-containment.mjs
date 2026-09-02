/**
 * Asset-quality check for the Grove tree pack: is the woody geometry actually inside the leaves?
 *
 * Two failures this measures, both real and both from this catalogue:
 *   1. TRUNK TOP — conifer-spire's leaning stem once pushed a brown stub out through the needle
 *      apex, and broadleaf-column-tiered's trunk stood 6 cm above its whole crown.
 *   2. BRANCH TIPS — a branch shorter than the gap between the trunk and the foliage ends in
 *      mid-air. On screen the leaves and the branches then read as separate objects, which is
 *      exactly the complaint that prompted this check.
 *
 * Method: fire rays outward from the geometry in question — 24 evenly spaced horizontal
 * directions, straight up, and 16 diagonals — and count the rays that leave the model without
 * ever crossing canopy geometry. One escaping ray is one line of sight from a camera to bare
 * wood where foliage should be. Zero escapes means the point is enclosed from every direction
 * tested.
 *
 *   trunk top   - the topmost ring of vertices of the `trunk` node's mesh.
 *   branch tips - the last 20% of every branch axis (5 samples, tip included), taken from the
 *                 factory itself via `branchAxisSamples` in tree-kit.mjs, so the numbers describe
 *                 the branch the GLB actually contains rather than a second copy of the maths.
 *
 * Usage: node scripts/dogfood-tree-containment.mjs [dir] [out.json]
 * Exit code 2 if any tree fails, so this can gate a build.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  TREE_TEMPLATES,
  branchAxisSamples,
  createTree,
} from "../examples/generated/harvest-frontier-trees/tree-kit.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DIR = resolve(process.argv[2] ?? join(ROOT, "examples/generated/harvest-frontier-trees"));
const OUT = resolve(process.argv[3] ?? join(ROOT, "outputs/dogfood/tree-containment.json"));
const HORIZONTAL_RAYS = 24;
const TOP_BAND = 0.05; // metres below the trunk's highest point that count as "the trunk top"
const BRANCH_FROM_U = 0.8; // measure the last 20% of each branch
const BRANCH_SAMPLES = 5;

/**
 * Probe directions: a full ring of horizontals plus an evenly spread Fibonacci set over every
 * direction a player can look from (down to 25 degrees below the horizon; nobody buys a tree to
 * look at it from underground).
 *
 * Density matters. A first cut used 41 directions and reported the round-full trunk fully hidden
 * while the back-view render plainly showed the pale trunk cap through a gap between two lobes:
 * the gap simply fell between two sampled rays. Coarse sampling turns a real defect into a pass.
 */
function probeDirections() {
  const directions = [];
  for (let index = 0; index < HORIZONTAL_RAYS; index += 1) {
    const angle = (index / HORIZONTAL_RAYS) * Math.PI * 2;
    directions.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = 240;
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 1.42; // 1 down to -0.42
    if (y < -0.42) break;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    directions.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize());
  }
  return directions;
}

const DIRECTIONS = probeDirections();

async function load(path) {
  const buffer = await readFile(path);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((ok, fail) => new GLTFLoader().parse(arrayBuffer, "", ok, fail));
}

function meshesUnder(root, name) {
  const meshes = [];
  const node = root.getObjectByName(name);
  if (!node) return meshes;
  node.updateMatrixWorld(true);
  node.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

function worldPoints(meshes) {
  const points = [];
  const vector = new THREE.Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      vector.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      points.push(vector.clone());
    }
  }
  return points;
}

/** How many probe directions leave `point` without crossing `targets`. */
function escapes(point, targets, raycaster) {
  let escaped = 0;
  for (const direction of DIRECTIONS) {
    raycaster.set(point.clone().addScaledVector(direction, 0.001), direction);
    if (raycaster.intersectObjects(targets, false).length === 0) escaped += 1;
  }
  return escaped;
}

const results = [];
for (const name of (await readdir(DIR)).filter((file) => file.endsWith(".glb")).sort()) {
  const gltf = await load(join(DIR, name));
  gltf.scene.updateMatrixWorld(true);
  const trunkMeshes = meshesUnder(gltf.scene, "trunk");
  const canopyMeshes = meshesUnder(gltf.scene, "canopy");
  if (!trunkMeshes.length || !canopyMeshes.length) {
    results.push({ file: name, skipped: "no trunk/canopy node pair" });
    continue;
  }
  for (const mesh of canopyMeshes) mesh.material.side = THREE.DoubleSide;
  const raycaster = new THREE.Raycaster();
  raycaster.far = 100;

  // --- trunk top ------------------------------------------------------------------------
  const trunkPoints = worldPoints(trunkMeshes);
  const trunkTopY = Math.max(...trunkPoints.map((point) => point.y));
  const topRing = trunkPoints.filter((point) => point.y >= trunkTopY - TOP_BAND);
  let trunkEscaped = 0;
  let trunkCast = 0;
  for (const point of topRing) {
    trunkEscaped += escapes(point, canopyMeshes, raycaster);
    trunkCast += DIRECTIONS.length;
  }

  // --- branch tips ----------------------------------------------------------------------
  const template = TREE_TEMPLATES[basename(name, ".glb")];
  const branches = template ? branchAxisSamples(THREE, template, BRANCH_FROM_U, BRANCH_SAMPLES) : [];
  /*
   * A leaf clump sitting on a branch tip passes the ray test on its own -- rays fired from inside
   * a ball always hit that ball. So the tip is measured a second time against a crown rebuilt
   * WITHOUT the tip clumps. That second number says whether the branch actually reaches the
   * canopy mass or only carries its own bauble out into the open air, which is the same complaint
   * in a different shape.
   */
  const crownOnly = template ? createTree(THREE, template, { boughTufts: false }) : null;
  const crownOnlyMeshes = crownOnly ? meshesUnder(crownOnly, "canopy") : [];
  for (const mesh of crownOnlyMeshes) mesh.material.side = THREE.DoubleSide;
  const branchRows = branches.map((branch) => {
    let escaped = 0;
    let cast = 0;
    let tipEscaped = 0;
    for (const [order, point] of branch.points.entries()) {
      const count = escapes(point, canopyMeshes, raycaster);
      escaped += count;
      cast += DIRECTIONS.length;
      if (order === branch.points.length - 1) tipEscaped = count;
    }
    const crownEscaped = crownOnlyMeshes.length ? escapes(branch.tip, crownOnlyMeshes, raycaster) : null;
    return {
      index: branch.index,
      length: Number(branch.length.toFixed(4)),
      tip: [branch.tip.x, branch.tip.y, branch.tip.z].map((value) => Number(value.toFixed(4))),
      raysCast: cast,
      raysEscaped: escaped,
      tipRaysEscaped: tipEscaped,
      tipRaysEscapedCrownOnly: crownEscaped,
      reachesCrownWithoutTuft: crownEscaped === 0,
      verdict: escaped === 0 ? "INSIDE" : "OUTSIDE",
    };
  });

  const canopyTopY = Math.max(...worldPoints(canopyMeshes).map((point) => point.y));
  results.push({
    file: name,
    trunk: {
      trunkTopY: Number(trunkTopY.toFixed(4)),
      canopyTopY: Number(canopyTopY.toFixed(4)),
      topRingVertices: topRing.length,
      raysCast: trunkCast,
      raysEscaped: trunkEscaped,
      verdict: trunkEscaped === 0 ? "HIDDEN" : "EXPOSED",
    },
    branches: branchRows,
    branchesOutside: branchRows.filter((branch) => branch.verdict === "OUTSIDE").length,
    branchesNeedingTheirOwnTuft: branchRows.filter((branch) => !branch.reachesCrownWithoutTuft).length,
    pass: trunkEscaped === 0 && branchRows.every((branch) => branch.verdict === "INSIDE"),
  });
}

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      probeDirections: DIRECTIONS.length,
      topBandMetres: TOP_BAND,
      branchFromU: BRANCH_FROM_U,
      branchSamples: BRANCH_SAMPLES,
      results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

let failures = 0;
for (const row of results) {
  if (row.skipped) {
    process.stdout.write(`${row.file.padEnd(34)} skipped (${row.skipped})\n`);
    continue;
  }
  if (!row.pass) failures += 1;
  const branchText = row.branches.length
    ? row.branches
        .map((branch) => {
          if (branch.verdict !== "INSIDE") return `#${branch.index}:OUT ${branch.raysEscaped}/${branch.raysCast}`;
          return branch.reachesCrownWithoutTuft ? `#${branch.index}:in` : `#${branch.index}:in(tuft-only)`;
        })
        .join(" ")
    : "(no branches)";
  process.stdout.write(
    `${row.file.padEnd(34)} ${(row.pass ? "PASS" : "FAIL").padEnd(5)} trunk ${row.trunk.verdict.padEnd(8)} ${row.trunk.raysEscaped}/${row.trunk.raysCast}  branches ${branchText}\n`,
  );
}
process.stdout.write(
  `\n${results.length - failures}/${results.length} tree(s) pass: trunk top hidden and every branch tip inside the canopy.\n`,
);
process.stdout.write(`-> ${OUT}\n`);
process.exitCode = failures ? 2 : 0;
