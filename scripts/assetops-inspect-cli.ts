#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  inspectAssetForTarget,
  normalizeInjectedGate,
  type AssetKind,
  type AssetEvidenceStatus,
  type AssetOpsGateOverrides,
  type InjectableGateStage,
} from "../packages/core/src/index";
import { loadAssetOpsInput } from "../integrations/shared/node-asset";

const [, , ...rawArgs] = process.argv;

try {
  const args = parseArgs(rawArgs);
  if ((args.get("format") ?? "json") !== "json") throw new Error("Only --format json is supported.");
  const inputPath = required(args, "path");
  const absolutePath = resolve(inputPath);
  const input = await loadAssetOpsInput(absolutePath);
  const stageOverrides: AssetOpsGateOverrides = {
    ...(await loadGate(args.get("import-gate"), "import")),
    ...(await loadGate(args.get("runtime-gate"), "runtime")),
  };
  const evidence = inspectAssetForTarget({
    runId: args.get("run-id"),
    sourcePath: absolutePath,
    fileName: input.fileName,
    bytes: input.bytes,
    targetProfileId: required(args, "target-profile"),
    assetKind: args.get("kind") as AssetKind | undefined,
    bundleFiles: input.bundleFiles,
    ...(Object.keys(stageOverrides).length ? { stageOverrides } : {}),
  });
  const output = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.get("out")) await writeFile(resolve(args.get("out")!), output, "utf8");
  process.stdout.write(output);
  process.exitCode = exitCodeFor(evidence.status);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "AssetOps inspection failed."}\n`);
  process.exitCode = 2;
}

/**
 * `--import-gate` / `--runtime-gate` accept a JSON file produced by a real runner. The honesty guard
 * lives in the core: an unattested payload is recorded as `notRun` and the reason is printed, so a
 * fabricated file can never turn an unrun stage into a PASS.
 */
async function loadGate(path: string | undefined, stage: InjectableGateStage): Promise<AssetOpsGateOverrides> {
  if (!path) return {};
  const absolutePath = resolve(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read the ${stage} gate file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = normalizeInjectedGate(parsed, stage);
  if (!result.accepted) {
    process.stderr.write(`[assetops-inspect] Injected ${stage} gate refused (recorded as notRun): ${result.rejections.join("; ")}\n`);
  }
  return { [stage]: result.gate };
}

function exitCodeFor(status: AssetEvidenceStatus): number {
  if (status === "READY") return 0;
  if (status === "ENVIRONMENT_UNAVAILABLE") return 4;
  if (status === "UNSUPPORTED") return 3;
  return 2;
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
