/**
 * Ground truth for the "how big is this model?" number.
 *
 * Loads every GLB through three.js' GLTFLoader (the same decode path the storefront hero
 * renderer uses: meshopt decompression on, EXT_mesh_gpu_instancing expanded, node world
 * transforms applied) and prints the decoded world-space bounding box. Compared against
 * outputs/dogfood/inspect-matrix.json, this says whether Clunk's own inspector reports the
 * size a player would actually see.
 *
 * Usage: node scripts/dogfood-bounds-truth.mjs [matrix.json] [out.json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const ROOT = resolve(import.meta.dirname, "..");
const matrixPath = resolve(process.argv[2] ?? join(ROOT, "outputs/dogfood/inspect-matrix.json"));
const outPath = resolve(process.argv[3] ?? join(ROOT, "outputs/dogfood/bounds-truth.json"));

const matrix = JSON.parse(await readFile(matrixPath, "utf8"));

async function decodedBounds(absolutePath) {
  const buffer = await readFile(absolutePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(arrayBuffer, "", ok, fail);
  });
  gltf.scene.updateMatrixWorld(true);
  // Two measures, because they differ for GPU-instanced files and Clunk can only produce one:
  //   drawn        - every instance placed at its own transform: what a player sees.
  //   nodePlaced   - the mesh placed at its node's transform, instances ignored: what a reader
  //                  that cannot decode a compressed instance buffer can honestly say.
  const drawn = new THREE.Box3();
  const nodePlaced = new THREE.Box3();
  let sawGeometry = false;
  let instancedNodeCount = 0;
  gltf.scene.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const geometry = node.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    sawGeometry = true;
    nodePlaced.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
    if (node.isInstancedMesh) {
      instancedNodeCount += 1;
      for (let index = 0; index < node.count; index += 1) {
        const matrix = new THREE.Matrix4();
        node.getMatrixAt(index, matrix);
        drawn.union(
          geometry.boundingBox
            .clone()
            .applyMatrix4(new THREE.Matrix4().multiplyMatrices(node.matrixWorld, matrix)),
        );
      }
    } else {
      drawn.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
    }
  });
  if (!sawGeometry) return null;
  const size = (box) => {
    const vector = new THREE.Vector3();
    box.getSize(vector);
    return [vector.x, vector.y, vector.z].map((v) => Number(v.toFixed(4)));
  };
  return {
    min: [drawn.min.x, drawn.min.y, drawn.min.z].map((v) => Number(v.toFixed(4))),
    max: [drawn.max.x, drawn.max.y, drawn.max.z].map((v) => Number(v.toFixed(4))),
    dimensions: size(drawn),
    nodePlacedDimensions: size(nodePlaced),
    instancedNodeCount,
  };
}

const results = [];
for (const row of matrix.rows) {
  const absolutePath = join(ROOT, row.file);
  let truth = null;
  let error = null;
  try {
    truth = await decodedBounds(absolutePath);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const reported = row.metrics.bounds.dimensions;
  const ratio =
    truth && reported
      ? reported.map((value, index) => (truth.dimensions[index] === 0 ? null : Number((value / truth.dimensions[index]).toFixed(4))))
      : null;
  const worstRelError =
    truth && reported
      ? Math.max(
          ...reported.map((value, index) =>
            truth.dimensions[index] === 0 ? 0 : Math.abs(value - truth.dimensions[index]) / truth.dimensions[index],
          ),
        )
      : null;
  results.push({
    slug: row.slug,
    file: row.file,
    reportedDimensions: reported,
    truthDimensions: truth?.dimensions ?? null,
    nodePlacedDimensions: truth?.nodePlacedDimensions ?? null,
    instancedNodeCount: truth?.instancedNodeCount ?? 0,
    ratio,
    worstRelError: worstRelError === null ? null : Number(worstRelError.toFixed(4)),
    error,
  });
}

await writeFile(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

const bad = results.filter((r) => r.worstRelError !== null && r.worstRelError > 0.01);
for (const r of results) {
  const rep = r.reportedDimensions ? r.reportedDimensions.map((v) => v.toFixed(2)).join("x") : "n/a";
  const tru = r.truthDimensions ? r.truthDimensions.map((v) => v.toFixed(2)).join("x") : r.error ?? "n/a";
  const mark = r.worstRelError === null ? "?" : r.worstRelError > 0.01 ? "WRONG" : "ok";
  process.stdout.write(`${mark.padEnd(6)} ${r.slug.padEnd(38)} reported ${rep.padEnd(28)} decoded ${tru}\n`);
}
process.stdout.write(`\n${bad.length}/${results.length} file(s) report a size that is more than 1% off the decoded size.\n`);
process.stdout.write(`-> ${outPath}\n`);
