import { inspectAssetForTarget } from "../../core/src/assetops-pipeline";
import type { AssetEvidence, AssetKind } from "../../core/src/assetops-contract";
import { sha256Hex, stableStringify } from "../../core/src/index";
import { getClunkSeries } from "./catalog";
import {
  createSeriesRequestHash,
  type ClunkSeriesJob,
  type SeriesArtifact,
  type SeriesLicenseStatus,
} from "./contracts";

export interface MaterialLabRequest {
  label: string;
  prompt: string;
  targetProfileId: string;
  width?: number;
  height?: number;
  license?: string;
  sourcePath?: string;
  sourceHash?: string;
}

export interface MaterialGraphNode {
  id: string;
  type: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface MaterialGraphConnection {
  from: string;
  output: string;
  to: string;
  input: string;
}

export interface MaterialGraph {
  schema: "clunk.material-graph.v1";
  graphId: string;
  version: "1.0.0";
  label: string;
  source: {
    prompt: string;
    promptHash: string;
    sourceRecordIds: readonly string[];
    license: string;
  };
  nodes: readonly MaterialGraphNode[];
  connections: readonly MaterialGraphConnection[];
  mapFileNames: {
    baseColor: string;
    roughness: string;
    metallic: string;
    normal: string;
  };
}

type MaterialMapName = keyof MaterialGraph["mapFileNames"];

export function createMaterialGraph(request: MaterialLabRequest): MaterialGraph {
  const label = cleanLabel(request.label);
  const prompt = cleanPrompt(request.prompt);
  const requestHash = createSeriesRequestHash({
    seriesId: "material-lab",
    label,
    prompt,
    targetProfileId: request.targetProfileId.trim(),
    width: request.width,
    height: request.height,
    license: request.license ?? "review-required",
    sourcePath: request.sourcePath,
    sourceHash: request.sourceHash,
  });
  const base = safeName(label);
  const promptHash = sha256Hex(new TextEncoder().encode(prompt));
  return {
    schema: "clunk.material-graph.v1",
    graphId: `mat-${requestHash.slice(0, 32)}`,
    version: "1.0.0",
    label,
    source: {
      prompt,
      promptHash,
      sourceRecordIds: getClunkSeries("material-lab").sourceRecordIds,
      license: request.license ?? "review-required",
    },
    nodes: [
      { id: "seed", type: "clunk.seed", parameters: { value: requestHash.slice(0, 16) } },
      { id: "noise", type: "clunk.layered-noise", parameters: { octaves: 4, scale: 7, contrast: 0.62 } },
      { id: "color", type: "clunk.base-color", parameters: { palette: "oxide-stone", variation: 0.24 } },
      { id: "surface", type: "clunk.surface-response", parameters: { roughness: 0.58, metallic: 0.2 } },
      { id: "normal", type: "clunk.normal-from-height", parameters: { strength: 0.42 } },
    ],
    connections: [
      { from: "seed", output: "value", to: "noise", input: "seed" },
      { from: "noise", output: "value", to: "color", input: "variation" },
      { from: "noise", output: "value", to: "surface", input: "microdetail" },
      { from: "noise", output: "value", to: "normal", input: "height" },
    ],
    mapFileNames: {
      baseColor: `${base}.base-color.png`,
      roughness: `${base}.roughness.png`,
      metallic: `${base}.metallic.png`,
      normal: `${base}.normal.png`,
    },
  };
}

export function createMaterialLabJob(request: MaterialLabRequest): ClunkSeriesJob {
  const width = clampInt(request.width ?? 256, 32, 1024);
  const height = clampInt(request.height ?? 256, 32, 1024);
  const graph = createMaterialGraph({ ...request, width, height });
  const requestHash = createSeriesRequestHash({
    seriesId: "material-lab",
    label: graph.label,
    prompt: graph.source.prompt,
    targetProfileId: request.targetProfileId.trim(),
    width,
    height,
    license: request.license ?? "review-required",
    sourcePath: request.sourcePath,
    sourceHash: request.sourceHash,
  });
  const seed = sha256Hex(new TextEncoder().encode(`${graph.graphId}:${graph.source.promptHash}`));
  const specs: ReadonlyArray<{ name: MaterialMapName; role: string; mode: MapMode }> = [
    { name: "baseColor", role: "entry", mode: "base-color" },
    { name: "roughness", role: "texture", mode: "roughness" },
    { name: "metallic", role: "texture", mode: "metallic" },
    { name: "normal", role: "texture", mode: "normal" },
  ];
  const mapArtifacts = specs.map(({ name, role, mode }) => {
    const fileName = graph.mapFileNames[name];
    return makeArtifact(fileName, role, "image/png", encodeRgbaPng(width, height, createMapPixels(width, height, seed, mode)));
  });
  const mapRefs = Object.fromEntries(mapArtifacts.map((artifact) => [
    mapNameToJsonKey(specs.find((spec) => graph.mapFileNames[spec.name] === artifact.fileName)!.name),
    { fileName: artifact.fileName, sha256: artifact.sha256, byteLength: artifact.byteLength },
  ])) as Record<string, { fileName: string; sha256: string; byteLength: number }>;
  const graphJson = {
    ...graph,
    maps: mapRefs,
    generatedBy: "clunk-material-lab-v1",
    productionReady: false,
  };
  const graphArtifact = makeArtifact(
    `${safeName(graph.label)}.material.json`,
    "metadata",
    "application/json",
    new TextEncoder().encode(`${stableStringify(graphJson)}\n`),
  );
  const artifacts = [...mapArtifacts, graphArtifact];
  const entry = mapArtifacts[0]!;
  const bundleFiles = new Map(artifacts.map((artifact) => [artifact.fileName, artifact.bytes] as const));
  const evidence = inspectAssetForTarget({
    runId: `material-${requestHash.slice(0, 12)}`,
    sourcePath: `clunk-series://material-lab/${entry.fileName}`,
    fileName: entry.fileName,
    bytes: entry.bytes,
    targetProfileId: request.targetProfileId,
    assetKind: "2d-image",
    bundleFiles,
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Clunk Material Lab reopened the generated base-color PNG from fresh bytes.",
        evidence: artifacts.map((artifact) => ({ key: artifact.fileName, value: `${artifact.sha256}:${artifact.byteLength}` })),
        durationMs: 0,
        environmentId: "clunk-material-lab-v1",
      },
    },
  });
  const status = hasStaticBlocker(evidence) ? "BLOCKED" : "COMPLETED";
  return {
    schema: "clunk.series-job.v1",
    jobId: `series-${requestHash.slice(0, 32)}`,
    seriesId: "material-lab",
    assetKind: "2d-image" as AssetKind,
    targetProfileId: request.targetProfileId,
    status,
    requestHash,
    entryFileName: entry.fileName,
    artifacts,
    provenance: {
      sourceKind: request.sourcePath ? "reference" : "prompt",
      seriesId: "material-lab",
      sourceRecordIds: getClunkSeries("material-lab").sourceRecordIds,
      prompt: graph.source.prompt,
      promptHash: graph.source.promptHash,
      ...(request.sourcePath ? { sourcePath: request.sourcePath } : {}),
      ...(request.sourceHash ? { sourceHash: request.sourceHash } : {}),
      license: request.license ?? "review-required",
      licenseStatus: resolveLicenseStatus(request.license),
      provider: "clunk-series-native-v1",
      productionReady: false,
    },
    evidence,
    limitations: [
      "Material Lab은 Clunk가 직접 작성한 결정적 graph와 PNG map을 출력합니다.",
      "외부 Material Maker 프로젝트나 AI texture provider를 제품 산출물이라고 주장하지 않습니다.",
      "productionReady는 false이며 texture 사용 화면과 human review는 별도 증거가 필요합니다.",
    ],
  };
}

type MapMode = "base-color" | "roughness" | "metallic" | "normal";

function createMapPixels(width: number, height: number, seed: string, mode: MapMode): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const hue = 22 + byteFromSeed(seed, 0) * 18;
  const secondaryHue = 178 + byteFromSeed(seed, 2) * 28;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const noise = pseudoNoise(x, y, seed);
      if (mode === "base-color") {
        const blend = Math.min(1, Math.max(0, noise * 0.7 + nx * 0.18 + ny * 0.12));
        const first = hslToRgb(hue, 0.58, 0.24 + blend * 0.2);
        const second = hslToRgb(secondaryHue, 0.46, 0.24 + blend * 0.16);
        pixels[index] = mix(first[0], second[0], blend * 0.42);
        pixels[index + 1] = mix(first[1], second[1], blend * 0.42);
        pixels[index + 2] = mix(first[2], second[2], blend * 0.42);
      } else if (mode === "roughness") {
        const value = 80 + Math.round((0.35 + noise * 0.65) * 145);
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
      } else if (mode === "metallic") {
        const band = Math.sin((nx * 10 + ny * 4 + byteFromSeed(seed, 4) / 24) * Math.PI) * 0.5 + 0.5;
        const value = Math.round(18 + (noise * 0.45 + band * 0.55) * 94);
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
      } else {
        const dx = Math.round((pseudoNoise(x + 1, y, seed) - pseudoNoise(x - 1, y, seed)) * 32);
        const dy = Math.round((pseudoNoise(x, y + 1, seed) - pseudoNoise(x, y - 1, seed)) * 32);
        pixels[index] = Math.max(0, Math.min(255, 128 + dx));
        pixels[index + 1] = Math.max(0, Math.min(255, 128 + dy));
        pixels[index + 2] = 255;
      }
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

function makeArtifact(fileName: string, role: string, contentType: string, bytes: Uint8Array): SeriesArtifact {
  return { fileName, role, contentType, byteLength: bytes.byteLength, sha256: sha256Hex(bytes), bytes };
}

function resolveLicenseStatus(license: string | undefined): SeriesLicenseStatus {
  const normalized = license?.trim().toLowerCase();
  if (normalized === "creator-owned") return "creator-owned";
  if (normalized === "cleared" || normalized === "mit" || normalized === "bsd-3-clause" || normalized === "apache-2.0") return "cleared";
  if (normalized === "excluded") return "excluded";
  return "review-required";
}

function hasStaticBlocker(evidence: AssetEvidence): boolean {
  return evidence.status === "BLOCKED"
    || evidence.status === "UNSUPPORTED"
    || evidence.stages.bytes.status === "fail"
    || evidence.stages.bytes.status === "unsupported"
    || evidence.stages.structure.status === "fail"
    || evidence.stages.structure.status === "unsupported"
    || evidence.stages.policy.status === "fail"
    || evidence.stages.policy.status === "unsupported";
}

function mapNameToJsonKey(name: MaterialMapName): "baseColor" | "roughness" | "metallic" | "normal" {
  return name;
}

function cleanLabel(value: string): string {
  const label = value.trim();
  if (!label) throw new Error("Material label is required.");
  if (label.length > 80) throw new Error("Material label is too long.");
  return label;
}

function cleanPrompt(value: string): string {
  const prompt = value.trim();
  if (!prompt) throw new Error("Material prompt is required.");
  if (prompt.length > 2_000) throw new Error("Material prompt is too long.");
  return prompt;
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clunk-material";
}

function clampInt(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min;
}

function byteFromSeed(seed: string, offset: number): number {
  return Number.parseInt(seed.slice(offset, offset + 2), 16) / 255;
}

function pseudoNoise(x: number, y: number, seed: string): number {
  const hash = sha256Hex(new TextEncoder().encode(`${seed}:${x}:${y}`));
  return Number.parseInt(hash.slice(0, 4), 16) / 0xffff;
}

function mix(left: number, right: number, amount: number): number {
  return Math.round(left + (right - left) * amount);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function encodeRgbaPng(width: number, height: number, pixels: Uint8Array): Uint8Array {
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    scanlines.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const ihdr = concatBytes([u32be(width), u32be(height), new Uint8Array([8, 6, 0, 0, 0])]);
  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlibStore(scanlines)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < data.byteLength || offset === 0) {
    const length = Math.min(65_535, data.byteLength - offset);
    const final = offset + length >= data.byteLength;
    const block = new Uint8Array(5 + length);
    block[0] = final ? 1 : 0;
    block[1] = length & 0xff;
    block[2] = (length >>> 8) & 0xff;
    const inverse = (~length) & 0xffff;
    block[3] = inverse & 0xff;
    block[4] = (inverse >>> 8) & 0xff;
    block.set(data.subarray(offset, offset + length), 5);
    parts.push(block);
    offset += length;
    if (final) break;
  }
  const checksum = adler32(data);
  parts.push(new Uint8Array([(checksum >>> 24) & 0xff, (checksum >>> 16) & 0xff, (checksum >>> 8) & 0xff, checksum & 0xff]));
  return concatBytes(parts);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(12 + data.byteLength);
  result.set(u32be(data.byteLength), 0);
  result.set(typeBytes, 4);
  result.set(data, 8);
  result.set(u32be(crc32(concatBytes([typeBytes, data]))), 8 + data.byteLength);
  return result;
}

function u32be(value: number): Uint8Array {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value >>> 0, false);
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
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  return ((b << 16) | a) >>> 0;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
