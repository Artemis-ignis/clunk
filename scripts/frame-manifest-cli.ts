import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluatePlayerFacingSceneReview,
  mergeFrameManifestEvidence,
  normalizeFrameManifest,
  type FrameManifestWriteMode,
} from "../packages/core/src/collaboration-contract";

type Arguments = Map<string, string>;

const [, , command, ...rawArgs] = process.argv;

try {
  const args = parseArgs(rawArgs);
  const format = args.get("format") ?? "json";
  if (format !== "json") throw new Error("Only --format json is supported.");

  const result = command === "validate"
    ? await validate(args)
    : command === "merge"
      ? await merge(args)
      : command === "scene-review"
        ? await sceneReview(args)
      : (() => { throw new Error("Usage: validate --input <manifest.json> | merge --current <manifest.json> --incoming <manifest.json> --mode append|replace (API evidenceMode) | scene-review --input <manifest.json> [--required] (comparison.v1 + per-gap closeout supported)"); })();

  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outputPath = args.get("out");
  if (outputPath) await writeFile(resolve(outputPath), output, "utf8");
  process.stdout.write(output);
  if (command === "scene-review") {
    const sceneResult = result as Awaited<ReturnType<typeof sceneReview>>;
    process.exitCode = sceneResult.status === "NO_GO" ? 2 : sceneResult.status === "UNAVAILABLE" ? 4 : 0;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Frame manifest command failed."}\n`);
  process.exitCode = 2;
}

async function validate(args: Arguments) {
  return normalizeFrameManifest(await readJson(required(args, "input")));
}

async function merge(args: Arguments) {
  const mode = (args.get("mode") ?? "replace") as FrameManifestWriteMode;
  if (mode !== "append" && mode !== "replace") throw new Error("--mode must be append or replace.");
  const current = normalizeFrameManifest(await readJson(required(args, "current")));
  const incoming = normalizeFrameManifest(await readJson(required(args, "incoming")));
  return mergeFrameManifestEvidence(current, incoming, mode);
}

async function sceneReview(args: Arguments) {
  const manifest = normalizeFrameManifest(await readJson(required(args, "input")));
  return evaluatePlayerFacingSceneReview(manifest);
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(filePath), "utf8"));
}

function parseArgs(values: readonly string[]): Arguments {
  const booleanFlags = new Set(["required"]);
  const result: Arguments = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) throw new Error(`Unexpected argument: ${value ?? ""}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      if (booleanFlags.has(key)) {
        result.set(key, "true");
        continue;
      }
      throw new Error(`Missing value for --${key}.`);
    }
    result.set(key, next);
    index += 1;
  }
  return result;
}

function required(args: Arguments, key: string): string {
  const value = args.get(key);
  if (!value?.trim()) throw new Error(`Missing --${key}.`);
  return value;
}
