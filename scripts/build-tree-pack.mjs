#!/usr/bin/env node
/**
 * Builds the one file `grove-tree-pack-vol1` is sold as.
 *
 * The listing is titled "그로브 트리 팩 Vol.1 (6 템플릿)" and its facts say
 * 11,008 triangles and 6 members -- but its `entryFileName` was
 * `broadleaf-round-full.glb` and its `byteLength` 198,464, which is ONE of the
 * six and 1,810 of the triangles. Every number on the card described a pack and
 * the file behind the download button was a single tree. The other five were
 * registered as artifacts in D1, so they could be fetched by name, but nothing
 * in the API said so and no buyer would guess.
 *
 * This writes a real pack: all six trees in one scene, each under a node named
 * after the file it came from, standing in a row along +X with a 1.5 m gap
 * between their bounding boxes and each one keeping its OWN authored height
 * above and below y = 0 (several of these root below the ground on purpose;
 * the listing says so and that is not silently "corrected" here). The six
 * single-tree files stay on sale beside it as artifacts, unchanged.
 *
 *   node scripts/build-tree-pack.mjs [out.glb]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";

// GLTFExporter asks for a DOM FileReader when it writes a binary GLB. Same shim
// as scripts/hf-export/lib.mts installs, for the same reason.
class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); })
      .catch((error) => this.onerror?.(error));
  }
}
if (typeof globalThis.FileReader === "undefined") Object.assign(globalThis, { FileReader: NodeFileReader });

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = join(ROOT, "examples/generated/harvest-frontier-trees");
const OUT = resolve(process.argv[2] ?? join(ROOT, "examples/generated/harvest-frontier-trees/grove-tree-pack-vol1.glb"));
/** The six, in the order the listing describes them: four broadleaf, two conifer. */
const MEMBERS = [
  "broadleaf-round-full",
  "broadleaf-round-forked",
  "broadleaf-column-flame",
  "broadleaf-column-tiered",
  "conifer-spire",
  "conifer-umbrella",
];
const GAP = 1.5;

async function load(file) {
  const bytes = await readFile(file);
  const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(array, "", ok, fail);
  });
}

const pack = new THREE.Group();
pack.name = "grove-tree-pack-vol1";
const placed = [];
let cursor = 0;
for (const member of MEMBERS) {
  const file = join(SOURCE, `${member}.glb`);
  const gltf = await load(file);
  const holder = new THREE.Group();
  holder.name = `grove-${member}`;
  for (const child of [...gltf.scene.children]) holder.add(child);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  // Its own X extent decides where it stands, so the gap between two trees is
  // a real 1.5 m of air rather than 1.5 m between two origins.
  holder.position.x = cursor - box.min.x;
  pack.add(holder);
  holder.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(holder);
  placed.push({
    member,
    node: holder.name,
    sourceBytes: (await readFile(file)).byteLength,
    triangles: (() => { let t = 0; holder.traverse((n) => { if (n.isMesh) { const i = n.geometry.getIndex(); t += (i ? i.count : n.geometry.getAttribute("position").count) / 3; } }); return t; })(),
    sizeMetres: [size.x, size.y, size.z].map((v) => +v.toFixed(4)),
    standsAtXmetres: +worldBox.min.x.toFixed(4),
    lowestYmetres: +worldBox.min.y.toFixed(4),
  });
  cursor += size.x + GAP;
}
pack.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(pack, { binary: true, onlyVisible: false, trs: true });
const staged = `${OUT}.staged.glb`;
await writeFile(staged, Buffer.from(binary));

// dedup + prune only. The six single files are plain glTF with no compression
// extension, and the pack stays that way so it loads in exactly the places they do.
const io = new NodeIO();
const document = await io.read(staged);
await document.transform(dedup(), prune());
await io.write(OUT, document);

const bytes = await readFile(OUT);
const total = new THREE.Box3().setFromObject(pack);
const size = total.getSize(new THREE.Vector3());
const materials = new Set();
pack.traverse((n) => { if (n.isMesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => materials.add(m.uuid)); });
process.stdout.write(`${JSON.stringify({
  output: OUT,
  members: placed,
  memberCount: placed.length,
  triangles: placed.reduce((sum, m) => sum + m.triangles, 0),
  sourceBytesTotal: placed.reduce((sum, m) => sum + m.sourceBytes, 0),
  packBytes: bytes.byteLength,
  packSizeMetres: [size.x, size.y, size.z].map((v) => +v.toFixed(4)),
  packLowestYmetres: +total.min.y.toFixed(4),
  materialsInScene: materials.size,
  gapMetres: GAP,
}, null, 2)}\n`);
