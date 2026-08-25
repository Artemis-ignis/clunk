import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  createGenerationPlan,
  inspectAssetForTarget,
  sha256Hex,
  type AssetKind,
  type AssetEvidenceStatus,
  type GenerationRequest,
  type GenerationSourceKind,
} from "../packages/core/src/index";

type GeneratedArtifact = {
  path: string;
  role: "entry" | "page" | "atlas" | "texture" | "animation";
  bytes: number;
  sha256: string;
};

type AuthoringResult = {
  schema: "clunk.asset-generation-result.v1";
  generationStatus: "GENERATED" | "AUTHORING_UNAVAILABLE" | "UNSUPPORTED";
  status: AssetEvidenceStatus | "AUTHORING_UNAVAILABLE" | "UNSUPPORTED";
  plan: ReturnType<typeof createGenerationPlan>;
  artifacts?: GeneratedArtifact[];
  entryFileName?: string;
  evidence?: ReturnType<typeof inspectAssetForTarget>;
  passport: null;
  limitations: string[];
};

const SUPPORTED_KINDS = new Set<AssetKind>(["2d-image", "sprite-atlas", "spine-project", "animation-clip"]);

const args = parseArgs(process.argv.slice(2));
const output = await author();
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = exitCodeFor(output.status);

async function author(): Promise<AuthoringResult> {
  const assetKind = requiredAssetKind(args.get("asset-kind") ?? "2d-image");
  const targetProfileId = required(args, "target-profile");
  const recipeId = required(args, "recipe-id");
  const recipeVersion = args.get("recipe-version") ?? "1.0.0";
  const outputDirectory = resolve(required(args, "output-directory"));
  const sourceKind = requiredSourceKind(args.get("source-kind") ?? "prompt");
  const prompt = args.get("prompt") ?? `Clunk authored ${assetKind} asset.`;
  const sourcePath = args.get("source-path") ? resolve(args.get("source-path")!) : undefined;
  const sourceBytes = sourcePath ? new Uint8Array(await readFile(sourcePath)) : undefined;
  const request: GenerationRequest = {
    schemaVersion: "clunk.asset-generation-request.v1",
    source: sourceKind === "prompt"
      ? { kind: sourceKind, prompt, ...(args.get("license") ? { license: args.get("license") } : {}) }
      : {
          kind: sourceKind,
          path: sourcePath ?? required(args, "source-path"),
          ...(sourceBytes ? { sha256: sha256Hex(sourceBytes) } : {}),
          ...(args.get("license") ? { license: args.get("license") } : {}),
        },
    assetKind,
    targetProfileId,
    recipeId,
    recipeVersion,
    recipeParameters: {
      width: integerArg("width", 256),
      height: integerArg("height", 256),
      frames: integerArg("frames", assetKind === "2d-image" ? 1 : 4),
      label: args.get("label") ?? assetKind,
      ...(args.get("params") ? parseParameters(args.get("params")!) : {}),
    },
    outputDirectory,
  };
  const plan = createGenerationPlan(request);
  await mkdir(outputDirectory, { recursive: true });
  if (plan.status !== "READY_TO_RUN") {
    const result: AuthoringResult = {
      schema: "clunk.asset-generation-result.v1",
      generationStatus: plan.status === "AUTHORING_UNAVAILABLE" ? "AUTHORING_UNAVAILABLE" : "UNSUPPORTED",
      status: plan.status,
      plan,
      passport: null,
      limitations: [plan.message, "No pretend artifact is written when an authoring adapter is unavailable."],
    };
    await writeSidecar(result, args.get("out"));
    return result;
  }

  const parameters = request.recipeParameters ?? {};
  const label = String(parameters.label ?? assetKind);
  const frames = Math.max(1, Math.min(8, Number(parameters.frames ?? 4)));
  const width = Math.max(32, Math.min(2048, Number(parameters.width ?? 256)));
  const height = Math.max(32, Math.min(2048, Number(parameters.height ?? 256)));
  const generated = await writeAsset(assetKind, outputDirectory, { label, frames, width, height });
  const entry = generated.find((artifact) => artifact.role === "entry") ?? generated[0];
  if (!entry) throw new Error("Authoring adapter produced no entry artifact.");
  const bundleFiles = new Map<string, Uint8Array>();
  for (const artifact of generated) bundleFiles.set(relative(outputDirectory, artifact.path).replaceAll(sep, "/"), new Uint8Array(await readFile(artifact.path)));
  const entryFileName = relative(outputDirectory, entry.path).replaceAll(sep, "/");
  const evidence = inspectAssetForTarget({
    runId: `author-${plan.requestHash.slice(0, 12)}`,
    sourcePath: entry.path,
    fileName: entryFileName,
    bytes: bundleFiles.get(entryFileName)!,
    targetProfileId,
    assetKind,
    bundleFiles,
    recipe: { id: plan.recipe.id, version: plan.recipe.version, recipeHash: plan.recipeHash, inputHash: plan.source.sha256 },
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Generated output bundle was reopened from fresh bytes.",
        evidence: generated.map((artifact) => ({ key: artifact.role, value: `${artifact.sha256}:${artifact.bytes}` })),
        durationMs: 0,
        environmentId: "clunk-author-reopen-v1",
      },
    },
  });
  const result: AuthoringResult = {
    schema: "clunk.asset-generation-result.v1",
    generationStatus: "GENERATED",
    status: evidence.status,
    plan,
    artifacts: generated,
    entryFileName,
    evidence,
    passport: null,
    limitations: [
      "Authoring output is procedural/authored source evidence, not a human player-facing approval.",
      "Engine import/runtime remains ENVIRONMENT_UNAVAILABLE until a real target runner is supplied.",
      "Run clunk_passport when a source artifact and a separately reviewed output artifact must be compared.",
    ],
  };
  await writeSidecar(result, args.get("out"));
  return result;
}

async function writeAsset(
  assetKind: AssetKind,
  outputDirectory: string,
  options: { label: string; frames: number; width: number; height: number },
): Promise<GeneratedArtifact[]> {
  const base = safeName(options.label);
  if (assetKind === "2d-image") {
    const path = resolve(outputDirectory, `${base}.png`);
    const bytes = await renderPng(options.width, options.height, options.frames, options.label);
    await writeFile(path, bytes, { flag: "wx" });
    return [artifact(path, "entry", bytes)];
  }
  if (assetKind === "sprite-atlas" || assetKind === "spine-project") {
    const cell = Math.max(32, Math.min(512, Math.floor(options.height)));
    const pageWidth = cell * options.frames;
    const pageName = `${base}.png`;
    const pagePath = resolve(outputDirectory, pageName);
    const pageBytes = await renderPng(pageWidth, cell, options.frames, options.label);
    await writeFile(pagePath, pageBytes, { flag: "wx" });
    const atlasName = `${base}.atlas`;
    const atlasPath = resolve(outputDirectory, atlasName);
    const atlas = atlasText(pageName, options.frames, cell);
    const atlasBytes = Buffer.from(atlas, "utf8");
    await writeFile(atlasPath, atlasBytes, { flag: "wx" });
    if (assetKind === "sprite-atlas") return [artifact(atlasPath, "entry", atlasBytes), artifact(pagePath, "page", pageBytes)];
    const skeletonName = `${base}.json`;
    const skeletonPath = resolve(outputDirectory, skeletonName);
    const skeleton = spineJson(options.label);
    const skeletonBytes = Buffer.from(`${JSON.stringify(skeleton, null, 2)}\n`, "utf8");
    await writeFile(skeletonPath, skeletonBytes, { flag: "wx" });
    return [artifact(skeletonPath, "entry", skeletonBytes), artifact(atlasPath, "atlas", atlasBytes), artifact(pagePath, "texture", pageBytes)];
  }
  const path = resolve(outputDirectory, `${base}.glb`);
  const bytes = await animationGlb(options.label);
  await writeFile(path, bytes, { flag: "wx" });
  return [artifact(path, "entry", bytes)];
}

function artifact(path: string, role: GeneratedArtifact["role"], bytes: Uint8Array): GeneratedArtifact {
  return { path, role, bytes: bytes.byteLength, sha256: sha256Hex(bytes) };
}

async function renderPng(width: number, height: number, frames: number, label: string): Promise<Buffer> {
  const cellWidth = Math.floor(width / frames);
  const shapes = Array.from({ length: frames }, (_, index) => {
    const x = index * cellWidth;
    const hue = 186 + index * 23;
    const cy = height / 2;
    return `<g transform="translate(${x} 0)"><rect x="8" y="8" width="${cellWidth - 16}" height="${height - 16}" rx="${Math.max(10, cellWidth * 0.1)}" fill="hsl(${hue} 48% 24%)" stroke="hsl(${hue} 75% 68%)" stroke-width="3"/><circle cx="${cellWidth / 2}" cy="${cy - height * 0.08}" r="${Math.min(cellWidth, height) * 0.2}" fill="hsl(${hue} 82% 68%)"/><path d="M ${cellWidth * 0.25} ${height * 0.78} Q ${cellWidth * 0.5} ${height * (0.52 + (index % 2) * 0.04)} ${cellWidth * 0.75} ${height * 0.78}" fill="none" stroke="hsl(${(hue + 48) % 360} 70% 72%)" stroke-width="${Math.max(4, cellWidth * 0.06)}" stroke-linecap="round"/><text x="${cellWidth / 2}" y="${height * 0.92}" fill="#effcff" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(10, Math.floor(cellWidth * 0.08))}">${escapeXml(label)} ${index + 1}</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0b1622"/>${shapes}</svg>`;
  type SharpFactory = (input: Buffer) => { png: () => { toBuffer: () => Promise<Buffer> } };
  const sharpModule = (await import("sharp")) as unknown as { default?: SharpFactory };
  const sharp = sharpModule.default ?? (sharpModule as unknown as SharpFactory);
  return sharp(Buffer.from(svg)).png().toBuffer();
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
    animations: {
      idle: { bones: { body: { rotate: [{ angle: -3, time: 0 }, { angle: 3, time: 0.5 }, { angle: -3, time: 1 }] } } },
    },
  };
}

async function animationGlb(label: string): Promise<Buffer> {
  if (typeof globalThis.FileReader === "undefined") {
    globalThis.FileReader = class NodeFileReader {
      result: ArrayBuffer | string | null = null;
      onloadend?: () => void;
      readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.(); }); }
      readAsDataURL(blob: Blob) { void blob.arrayBuffer().then((value) => { this.result = `data:application/octet-stream;base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
    } as unknown as typeof FileReader;
  }
  const root = new THREE.Group();
  root.name = safeName(label);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2ec4f0 }));
  mesh.name = "AnimatedBody";
  root.add(mesh);
  const clip = new THREE.AnimationClip("idle", 1, [
    new THREE.QuaternionKeyframeTrack(
      `${mesh.name}.quaternion`,
      [0, 0.5, 1],
      [0, 0, 0, 1, 0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4), 0, 0, 0, 1],
    ),
  ]);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, animations: [clip] });
  if (!(result instanceof ArrayBuffer)) throw new Error("Animation authoring expected a binary GLB.");
  return Buffer.from(result);
}

async function writeSidecar(result: AuthoringResult, requestedPath: string | undefined): Promise<void> {
  const sidecar = resolve(requestedPath ?? `${result.plan.outputDirectory}/${safeName(result.plan.recipe.id)}.clunk-generation.json`);
  await writeFile(sidecar, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function parseParameters(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--params must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function parseArgs(values: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token ?? ""}`);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}.`);
    result.set(token.slice(2), value);
    index += 1;
  }
  return result;
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value?.trim()) throw new Error(`Missing --${key}.`);
  return value;
}

function requiredAssetKind(value: string): AssetKind {
  if (!SUPPORTED_KINDS.has(value as AssetKind)) throw new Error(`Unsupported authoring asset kind: ${value}`);
  return value as AssetKind;
}

function requiredSourceKind(value: string): GenerationSourceKind {
  if (value !== "prompt" && value !== "reference" && value !== "existing-asset") throw new Error(`Unsupported source kind: ${value}`);
  return value;
}

function integerArg(key: string, fallback: number): number {
  const value = args.get(key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${key} must be a positive integer.`);
  return parsed;
}

function safeName(value: string): string {
  const result = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!result || result === "." || result === "..") throw new Error("Label or recipe id cannot produce a safe output name.");
  return result;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function exitCodeFor(status: AuthoringResult["status"]): number {
  if (status === "READY") return 0;
  if (status === "ENVIRONMENT_UNAVAILABLE" || status === "AUTHORING_UNAVAILABLE") return 4;
  if (status === "UNSUPPORTED") return 3;
  return 2;
}
