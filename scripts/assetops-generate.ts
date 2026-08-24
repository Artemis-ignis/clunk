#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  createGenerationPlan,
  inspectAssetForTarget,
  sha256Hex,
  type AssetEvidenceStatus,
  type AssetKind,
  type GenerationRequest,
  type GenerationSourceKind,
} from "../packages/core/src/index";

const execFile = promisify(execFileCallback);
const GENERATOR = fileURLToPath(new URL("./threejs-to-glb.mjs", import.meta.url));
const ASSET_KINDS = new Set<AssetKind>([
  "3d-model",
  "2d-image",
  "sprite-atlas",
  "spine-project",
  "animation-clip",
]);

type GenerationOutput = {
  schema: "clunk.asset-generation-result.v1";
  generationStatus: "GENERATED" | "AUTHORING_UNAVAILABLE" | "UNSUPPORTED";
  status: AssetEvidenceStatus | "AUTHORING_UNAVAILABLE" | "UNSUPPORTED";
  plan: ReturnType<typeof createGenerationPlan>;
  artifact?: {
    path: string;
    bytes: number;
    sha256: string;
  };
  evidence?: ReturnType<typeof inspectAssetForTarget>;
  passport: null;
  limitations: string[];
};

try {
  const output = await generate();
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = exitCodeFor(output.status);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "AssetOps generation failed."}\n`);
  process.exitCode = 2;
}

async function generate(): Promise<GenerationOutput> {
  const args = parseArgs(process.argv.slice(2));
  const factoryPath = resolve(required(args, "factory"));
  const assetKind = requiredAssetKind(args.get("asset-kind") ?? "3d-model");
  const sourceKind = requiredSourceKind(args.get("source-kind") ?? "reference");
  const sourcePath = resolve(args.get("source-path") ?? factoryPath);
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = args.get("source-hash") ?? sha256Hex(new Uint8Array(sourceBytes));
  const recipeParameters = parseParameters(args.get("params"));
  const request: GenerationRequest = {
    schemaVersion: "clunk.asset-generation-request.v1",
    source: {
      kind: sourceKind,
      path: sourcePath,
      sha256: sourceHash,
      ...(args.get("license") ? { license: args.get("license") } : {}),
      ...(args.get("prompt") ? { prompt: args.get("prompt") } : {}),
    },
    assetKind,
    targetProfileId: required(args, "target-profile"),
    recipeId: required(args, "recipe-id"),
    recipeVersion: args.get("recipe-version") ?? "1.0.0",
    ...(recipeParameters ? { recipeParameters } : {}),
    outputDirectory: resolve(required(args, "output-directory")),
  };
  const plan = createGenerationPlan(request);
  if (plan.status !== "READY_TO_RUN") {
    return {
      schema: "clunk.asset-generation-result.v1",
      generationStatus: plan.status === "AUTHORING_UNAVAILABLE" ? "AUTHORING_UNAVAILABLE" : "UNSUPPORTED",
      status: plan.status,
      plan,
      passport: null,
      limitations: [plan.message, "No pretend artifact is written when an authoring adapter is unavailable."],
    };
  }

  assertSeparateOutput(factoryPath, plan.outputDirectory);
  await mkdir(plan.outputDirectory, { recursive: true });
  const artifactPath = resolve(plan.outputDirectory, `${safeName(plan.recipe.id)}.glb`);
  await execFile(process.execPath, [GENERATOR, factoryPath, artifactPath], { maxBuffer: 4 * 1024 * 1024 });
  const artifactBytes = new Uint8Array(await readFile(artifactPath));
  const artifactHash = sha256Hex(artifactBytes);
  const evidence = inspectAssetForTarget({
    runId: `generation-${plan.requestHash.slice(0, 12)}`,
    sourcePath: artifactPath,
    fileName: artifactPath.slice(artifactPath.lastIndexOf(sep) + 1),
    bytes: artifactBytes,
    targetProfileId: plan.targetProfileId,
    assetKind: plan.assetKind,
    recipe: {
      id: plan.recipe.id,
      version: plan.recipe.version,
      recipeHash: plan.recipeHash,
      inputHash: plan.source.sha256,
    },
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Generated output was read in a fresh inspection step.",
        evidence: [
          { key: "path", value: artifactPath },
          { key: "sha256", value: artifactHash },
          { key: "bytes", value: artifactBytes.byteLength },
        ],
        durationMs: 0,
        environmentId: "clunk-node-reopen-v1",
      },
    },
  });
  const result: GenerationOutput = {
    schema: "clunk.asset-generation-result.v1",
    generationStatus: "GENERATED",
    status: evidence.status,
    plan,
    artifact: { path: artifactPath, bytes: artifactBytes.byteLength, sha256: artifactHash },
    evidence,
    passport: null,
    limitations: [
      "The three.js factory rail is texture-free and does not author 2D or Spine bytes.",
      "A Passport is not fabricated for a procedural source; provide a real source artifact and run clunk_passport after output reopen.",
      "Environment-unavailable import/runtime stages remain non-PASS until a real runner is supplied.",
    ],
  };
  const sidecarPath = resolve(args.get("out") ?? `${artifactPath}.clunk-generation.json`);
  await writeFile(sidecarPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return result;
}

function assertSeparateOutput(factoryPath: string, outputDirectory: string): void {
  const factoryDirectory = dirname(factoryPath);
  if (pathsOverlap(factoryDirectory, outputDirectory)) {
    throw new Error("Generation outputDirectory must be separate from the factory source directory.");
  }
}

function pathsOverlap(first: string, second: string): boolean {
  const a = resolve(first);
  const b = resolve(second);
  return isWithin(a, b) || isWithin(b, a);
}

function isWithin(parent: string, child: string): boolean {
  const value = relative(parent, child);
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`));
}

function safeName(value: string): string {
  const result = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!result || result === "." || result === "..") throw new Error("Recipe id cannot produce a safe output name.");
  return result;
}

function parseParameters(value: string | undefined): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--params must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function requiredAssetKind(value: string): AssetKind {
  if (!ASSET_KINDS.has(value as AssetKind)) throw new Error(`Unsupported asset kind: ${value}`);
  return value as AssetKind;
}

function requiredSourceKind(value: string): GenerationSourceKind {
  if (value !== "reference" && value !== "existing-asset" && value !== "prompt") {
    throw new Error(`Unsupported source kind: ${value}`);
  }
  return value;
}

function parseArgs(values: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token ?? ""}`);
    const key = token.slice(2);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    result.set(key, value);
    index += 1;
  }
  return result;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value?.trim()) throw new Error(`Missing --${key}.`);
  return value;
}

function exitCodeFor(status: GenerationOutput["status"]): number {
  if (status === "READY") return 0;
  if (status === "AUTHORING_UNAVAILABLE" || status === "ENVIRONMENT_UNAVAILABLE") return 4;
  if (status === "UNSUPPORTED") return 3;
  return 2;
}
