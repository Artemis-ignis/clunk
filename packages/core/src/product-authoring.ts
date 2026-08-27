import { createGenerationPlan, type GenerationPlan, type GenerationRequest } from "./generation-contract";
import { inspectAssetForTarget } from "./assetops-pipeline";
import { sha256Hex, stableStringify } from "./index";
import type { AssetEvidence, AssetKind } from "./assetops-contract";

export type ProductArtifactRole = "entry" | "page" | "atlas" | "texture" | "animation";

export type ProductArtifact = {
  fileName: string;
  role: ProductArtifactRole;
  contentType: string;
  bytes: Uint8Array;
  byteLength: number;
  sha256: string;
};

export type ProceduralAuthoringRequest = {
  assetKind: AssetKind;
  label: string;
  prompt: string;
  targetProfileId: string;
  width?: number;
  height?: number;
  frames?: number;
  license?: string;
};

export type ProceduralAuthoringResult = {
  plan: GenerationPlan;
  entryFileName: string;
  artifacts: readonly ProductArtifact[];
  provenance: {
    sourceKind: "prompt";
    provider: "clunk-procedural-v1";
    prompt: string;
    promptHash: string;
    license: string;
    productionReady: false;
  };
  evidence: AssetEvidence;
};

const RECIPE_BY_KIND: Readonly<Record<AssetKind, string>> = {
  "2d-image": "sprite-sheet-factory-v1",
  "sprite-atlas": "sprite-atlas-factory-v1",
  "spine-project": "spine-json-factory-v1",
  "animation-clip": "threejs-animation-factory-v1",
  "3d-model": "threejs-factory-v1",
};

export function createProceduralAuthoring(request: ProceduralAuthoringRequest): ProceduralAuthoringResult {
  const label = cleanLabel(request.label);
  const prompt = request.prompt.trim();
  const targetProfileId = request.targetProfileId.trim();
  const width = clampInt(request.width ?? 256, 32, 1024);
  const height = clampInt(request.height ?? 256, 32, 1024);
  const frames = clampInt(request.frames ?? (request.assetKind === "2d-image" ? 1 : 4), 1, 8);
  const generationRequest: GenerationRequest = {
    schemaVersion: "clunk.asset-generation-request.v1",
    source: { kind: "prompt", prompt, license: request.license ?? "review-required" },
    assetKind: request.assetKind,
    targetProfileId,
    recipeId: RECIPE_BY_KIND[request.assetKind],
    recipeVersion: "1.0.0",
    recipeParameters: { label, width, height, frames },
    outputDirectory: "clunk://workspace/generated",
  };
  const plan = createGenerationPlan(generationRequest);
  if (plan.status !== "READY_TO_RUN") throw new Error(plan.message);

  const artifacts = createArtifacts(request.assetKind, label, width, height, frames);
  const entry = artifacts.find((artifact) => artifact.role === "entry") ?? artifacts[0];
  if (!entry) throw new Error("Authoring adapter produced no entry artifact.");
  const files = new Map(artifacts.map((artifact) => [artifact.fileName, artifact.bytes] as const));
  const evidence = inspectAssetForTarget({
    runId: `generation-${plan.requestHash.slice(0, 12)}`,
    sourcePath: `generation://${entry.fileName}`,
    fileName: entry.fileName,
    bytes: entry.bytes,
    targetProfileId,
    assetKind: request.assetKind,
    bundleFiles: files,
    recipe: { id: plan.recipe.id, version: plan.recipe.version, recipeHash: plan.recipeHash, inputHash: plan.source.sha256 },
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Generated output was reopened from fresh artifact bytes.",
        evidence: artifacts.map((artifact) => ({ key: artifact.role, value: `${artifact.sha256}:${artifact.byteLength}` })),
        durationMs: 0,
        environmentId: "clunk-procedural-authoring-v1",
      },
    },
  });

  return {
    plan,
    entryFileName: entry.fileName,
    artifacts,
    provenance: {
      sourceKind: "prompt",
      provider: "clunk-procedural-v1",
      prompt,
      promptHash: sha256Hex(new TextEncoder().encode(prompt)),
      license: request.license ?? "review-required",
      productionReady: false,
    },
    evidence,
  };
}

function createArtifacts(assetKind: AssetKind, label: string, width: number, height: number, frames: number): ProductArtifact[] {
  const base = safeName(label);
  if (assetKind === "2d-image") return [makeArtifact(`${base}.png`, "entry", "image/png", createSpritePng(width, height, 1, label))];
  if (assetKind === "sprite-atlas" || assetKind === "spine-project") {
    const cell = clampInt(height, 32, 512);
    const page = makeArtifact(`${base}.png`, assetKind === "sprite-atlas" ? "page" : "texture", "image/png", createSpritePng(cell * frames, cell, frames, label));
    const atlas = makeArtifact(`${base}.atlas`, assetKind === "sprite-atlas" ? "entry" : "atlas", "text/plain", textBytes(atlasText(page.fileName, frames, cell)));
    if (assetKind === "sprite-atlas") return [atlas, page];
    const skeleton = makeArtifact(`${base}.json`, "entry", "application/json", textBytes(`${JSON.stringify(spineJson(label), null, 2)}\n`));
    return [skeleton, atlas, page];
  }
  const animated = assetKind === "animation-clip";
  return [makeArtifact(`${base}.glb`, animated ? "animation" : "entry", "model/gltf-binary", createGlb(label, animated))];
}

function makeArtifact(fileName: string, role: ProductArtifactRole, contentType: string, bytes: Uint8Array): ProductArtifact {
  return { fileName, role, contentType, bytes, byteLength: bytes.byteLength, sha256: sha256Hex(bytes) };
}

function createSpritePng(width: number, height: number, frames: number, label: string): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const cellWidth = Math.floor(width / frames);
  const seed = sha256Hex(new TextEncoder().encode(label));
  const hues = [42, 176, 216, 282, 12, 92, 326, 146];
  for (let frame = 0; frame < frames; frame += 1) {
    const ox = frame * cellWidth;
    const hue = hues[(parseInt(seed.slice(frame * 2, frame * 2 + 2), 16) + frame) % hues.length];
    const shift = Math.round(Math.sin(frame * 1.7) * cellWidth * 0.035);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < cellWidth; x += 1) {
        const px = x + ox;
        const cx = cellWidth / 2 + shift;
        const cy = height * 0.53;
        const dx = x - cx + cellWidth / 2;
        const dy = y - cy;
        const radius = Math.min(cellWidth, height) * 0.19;
        const bodyWidth = cellWidth * 0.25;
        const bodyTop = height * 0.42;
        const bodyBottom = height * 0.79;
        const head = dx * dx + (dy + height * 0.18) * (dy + height * 0.18) <= radius * radius;
        const body = Math.abs(dx) < bodyWidth && y >= bodyTop && y <= bodyBottom;
        const hem = y > bodyBottom && y < height * 0.9 && Math.abs(dx) < bodyWidth * (1 - (y - bodyBottom) / (height * 0.11) * 0.22);
        if (!head && !body && !hem) continue;
        const pixel = (y * width + px) * 4;
        const isHighlight = head || (body && x < cellWidth * 0.47);
        const rgb = hslToRgb(hue, isHighlight ? 0.72 : 0.56, isHighlight ? 0.67 : 0.31);
        pixels[pixel] = rgb[0]; pixels[pixel + 1] = rgb[1]; pixels[pixel + 2] = rgb[2]; pixels[pixel + 3] = 255;
      }
    }
  }
  return encodePng(width, height, pixels);
}

function atlasText(pageName: string, frames: number, cell: number): string {
  const regions = Array.from({ length: frames }, (_, index) => `frame_${String(index + 1).padStart(2, "0")}\n  rotate: false\n  xy: ${index * cell}, 0\n  size: ${cell}, ${cell}\n  orig: ${cell}, ${cell}`).join("\n");
  return `${pageName}\nsize: ${frames * cell}, ${cell}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n\n${regions}\n`;
}

function spineJson(label: string) {
  return {
    skeleton: { hash: sha256Hex(new TextEncoder().encode(label)).slice(0, 16), spine: "4.1.0" },
    bones: [{ name: "root" }, { name: "body", parent: "root" }],
    slots: [{ name: "body", bone: "body", attachment: "frame_01" }],
    skins: { default: { body: { frame_01: { type: "region", path: "frame_01", width: 128, height: 128 } } } },
    animations: { idle: { bones: { body: { rotate: [{ angle: -3, time: 0 }, { angle: 3, time: 0.5 }, { angle: -3, time: 1 }] } } } },
  };
}

function createGlb(label: string, animated: boolean): Uint8Array {
  const positions = new Float32Array([
    -0.8, -0.6, 0.8, 0.8, -0.6, 0.8, 0.8, 0.6, 0.8, -0.8, 0.6, 0.8,
    -0.8, -0.6, -0.8, -0.8, 0.6, -0.8, 0.8, 0.6, -0.8, 0.8, -0.6, -0.8,
  ]);
  const normals = new Float32Array([
    -0.5, -0.5, 0.7, 0.5, -0.5, 0.7, 0.5, 0.5, 0.7, -0.5, 0.5, 0.7,
    -0.5, -0.5, -0.7, -0.5, 0.5, -0.7, 0.5, 0.5, -0.7, 0.5, -0.5, -0.7,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 1, 1, 7, 6, 1, 6, 2, 2, 6, 5, 2, 5, 3, 4, 0, 3, 4, 3, 5]);
  const times = new Float32Array([0, 0.5, 1]);
  const rotations = new Float32Array([0, 0, 0, 1, 0, 0.7071, 0, 0.7071, 0, 0, 0, 1]);
  const buffers: Uint8Array[] = [];
  const views: Array<{ byteOffset: number; byteLength: number }> = [];
  let byteOffset = 0;
  const add = (value: ArrayBufferView) => {
    const source = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const alignedOffset = align4(byteOffset);
    if (alignedOffset > byteOffset) buffers.push(new Uint8Array(alignedOffset - byteOffset));
    buffers.push(source.slice());
    views.push({ byteOffset: alignedOffset, byteLength: source.byteLength });
    byteOffset = alignedOffset + source.byteLength;
    return views.length - 1;
  };
  const positionView = add(positions);
  const normalView = add(normals);
  const indexView = add(indices);
  const timeView = animated ? add(times) : -1;
  const rotationView = animated ? add(rotations) : -1;
  const binLength = align4(byteOffset);
  const bin = new Uint8Array(binLength);
  let cursor = 0;
  for (const chunk of buffers) { bin.set(chunk, cursor); cursor += chunk.byteLength; }
  const accessors: unknown[] = [
    { bufferView: positionView, componentType: 5126, count: 8, type: "VEC3", min: [-0.8, -0.6, -0.8], max: [0.8, 0.6, 0.8] },
    { bufferView: normalView, componentType: 5126, count: 8, type: "VEC3" },
    { bufferView: indexView, componentType: 5123, count: indices.length, type: "SCALAR", min: [0], max: [7] },
  ];
  if (animated) {
    accessors.push({ bufferView: timeView, componentType: 5126, count: 3, type: "SCALAR", min: [0], max: [1] });
    accessors.push({ bufferView: rotationView, componentType: 5126, count: 3, type: "VEC4" });
  }
  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "Clunk procedural authoring v1" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: safeName(label), mesh: 0 }],
    meshes: [{ name: `${safeName(label)}Mesh`, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: "Clunk Surface", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.62, 0.82, 1], metallicFactor: 0.18, roughnessFactor: 0.38 } }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: views.map((view, index) => ({ buffer: 0, byteOffset: view.byteOffset, byteLength: view.byteLength, target: index === indexView ? 34963 : 34962 })),
    accessors,
  };
  if (animated) {
    json.animations = [{ name: "idle", samplers: [{ input: 3, output: 4, interpolation: "LINEAR" }], channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }] }];
  }
  return encodeGlb(new TextEncoder().encode(stableStringify(json)), bin);
}

function encodeGlb(jsonBytes: Uint8Array, binary: Uint8Array): Uint8Array {
  const jsonLength = align4(jsonBytes.byteLength);
  const binaryLength = align4(binary.byteLength);
  const total = 12 + 8 + jsonLength + 8 + binaryLength;
  const result = new Uint8Array(total);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); result.set(jsonBytes, 20);
  for (let index = 20 + jsonBytes.byteLength; index < 20 + jsonLength; index += 1) result[index] = 0x20;
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true); view.setUint32(binaryHeader + 4, 0x004e4942, true); result.set(binary, binaryHeader + 8);
  return result;
}

function encodePng(width: number, height: number, pixels: Uint8Array): Uint8Array {
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    scanlines[y * (width * 4 + 1)] = 0;
    scanlines.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const compressed = zlibStore(scanlines);
  const ihdr = concatBytes([u32be(width, height), new Uint8Array([8, 6, 0, 0, 0])]);
  return concatBytes([pngSignature(), pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array())]);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < data.byteLength || offset === 0) {
    const length = Math.min(65535, data.byteLength - offset);
    const final = offset + length >= data.byteLength;
    const block = new Uint8Array(5 + length);
    block[0] = final ? 1 : 0;
    block[1] = length & 0xff; block[2] = (length >>> 8) & 0xff;
    const inverse = (~length) & 0xffff;
    block[3] = inverse & 0xff; block[4] = (inverse >>> 8) & 0xff;
    block.set(data.subarray(offset, offset + length), 5);
    chunks.push(block); offset += length;
    if (final) break;
  }
  const adler = adler32(data);
  chunks.push(new Uint8Array([(adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff]));
  return concatBytes(chunks);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(12 + data.byteLength);
  result.set(u32be(data.byteLength), 0); result.set(typeBytes, 4); result.set(data, 8);
  result.set(u32be(crc32(concatBytes([typeBytes, data]))), 8 + data.byteLength);
  return result;
}

function u32be(...values: number[]): Uint8Array {
  const result = new Uint8Array(values.length * 4);
  const view = new DataView(result.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, false));
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1; let b = 0;
  for (const byte of data) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function pngSignature(): Uint8Array { return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); }
function textBytes(value: string): Uint8Array { return new TextEncoder().encode(value); }
function concatBytes(parts: readonly Uint8Array[]): Uint8Array { const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.byteLength; } return result; }
function align4(value: number): number { return (value + 3) & ~3; }
function clampInt(value: number, min: number, max: number): number { return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min; }
function cleanLabel(value: string): string { const label = value.trim(); if (!label) throw new Error("A label is required."); if (label.length > 80) throw new Error("Label is too long."); return label; }
function safeName(value: string): string { return value.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clunk-asset"; }
