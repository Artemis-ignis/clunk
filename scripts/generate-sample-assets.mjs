import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../public/samples/", import.meta.url);
const encoder = new TextEncoder();

function align4(value) {
  return Math.ceil(value / 4) * 4;
}

function makeGlb({ messy }) {
  const position = new Float32Array([
    -0.8, -0.8, 0,
    0.8, -0.8, 0,
    0.8, 0.8, 0,
    -0.8, 0.8, 0,
  ]);
  const normal = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const chunks = [];
  const add = (typed) => {
    const bytes = new Uint8Array(typed.buffer);
    const offset = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const aligned = align4(offset);
    if (aligned > offset) chunks.push(new Uint8Array(aligned - offset));
    chunks.push(bytes);
    return { byteOffset: aligned, byteLength: bytes.byteLength };
  };
  const positionView = add(position);
  const normalView = add(normal);
  const uvView = add(uv);
  const indexView = add(indices);
  const binaryLength = align4(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  const binary = new Uint8Array(binaryLength);
  let cursor = 0;
  for (const chunk of chunks) {
    binary.set(chunk, cursor);
    cursor += chunk.byteLength;
  }

  const primitive = {
    attributes: { POSITION: 0 },
    indices: messy ? 1 : 3,
    material: 0,
  };
  if (!messy) {
    primitive.attributes.NORMAL = 1;
    primitive.attributes.TEXCOORD_0 = 2;
  }
  const materials = messy
    ? [
        { name: "Paint primary", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.68, 0.88, 1], metallicFactor: 0.15, roughnessFactor: 0.35 } },
        { name: "Duplicate paint", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.68, 0.88, 1], metallicFactor: 0.15, roughnessFactor: 0.35 } },
      ]
    : [{ name: "Clunk cyan", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.68, 0.88, 1], metallicFactor: 0.15, roughnessFactor: 0.35 } }];
  const json = {
    asset: { version: "2.0", generator: "Clunk procedural sample generator" },
    scene: 0,
    scenes: [{ name: messy ? "Messy sample scene" : "Ready sample scene", nodes: messy ? [0, 1] : [0] }],
    nodes: messy ? [{ name: "Quad", mesh: 0 }, { name: "Unused identity node" }] : [{ name: "Quad", mesh: 0 }],
    meshes: [{ name: "Quad mesh", primitives: [primitive] }],
    materials,
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: positionView.byteOffset, byteLength: positionView.byteLength, target: 34962 },
      ...(messy ? [] : [{ buffer: 0, byteOffset: normalView.byteOffset, byteLength: normalView.byteLength, target: 34962 }]),
      ...(messy ? [] : [{ buffer: 0, byteOffset: uvView.byteOffset, byteLength: uvView.byteLength, target: 34962 }]),
      { buffer: 0, byteOffset: indexView.byteOffset, byteLength: indexView.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [-0.8, -0.8, 0], max: [0.8, 0.8, 0] },
    ],
  };
  if (!messy) {
    json.accessors.push({ bufferView: 1, componentType: 5126, count: 4, type: "VEC3" });
    json.accessors.push({ bufferView: 2, componentType: 5126, count: 4, type: "VEC2" });
    json.accessors.push({ bufferView: 3, componentType: 5123, count: 6, type: "SCALAR", min: [0], max: [3] });
  } else {
    json.accessors.push({ bufferView: 1, componentType: 5123, count: 6, type: "SCALAR", min: [0], max: [3] });
  }
  const jsonBytes = encoder.encode(JSON.stringify(json));
  const paddedJsonLength = align4(jsonBytes.byteLength);
  const paddedJson = new Uint8Array(paddedJsonLength).fill(0x20);
  paddedJson.set(jsonBytes);
  const totalLength = 12 + 8 + paddedJson.byteLength + 8 + binary.byteLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJson.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(paddedJson, 20);
  const binaryHeader = 20 + paddedJson.byteLength;
  view.setUint32(binaryHeader, binary.byteLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  output.set(binary, binaryHeader + 8);
  return output;
}

await mkdir(root, { recursive: true });
const files = [
  ["clunk-ready-sample.glb", makeGlb({ messy: false })],
  ["clunk-messy-sample.glb", makeGlb({ messy: true })],
];
const provenance = [];
for (const [name, bytes] of files) {
  await writeFile(new URL(name, root), bytes);
  provenance.push({
    file: name,
    source: "Clunk-authored deterministic procedural quad; no external reference",
    license: "Original work, permission granted for Clunk product demos and application evidence",
    generated: true,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength,
  });
}
await writeFile(new URL("provenance.json", root), `${JSON.stringify({ schemaVersion: "1.0", assets: provenance }, null, 2)}\n`);
console.log(JSON.stringify(provenance, null, 2));
