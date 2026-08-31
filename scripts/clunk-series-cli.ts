#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { runClunkMeshLab } from "../packages/clunk-series/src/mesh-lab";

const USAGE = [
  "Usage: npm run series:mesh -- game-ready <input.glb> --out <output.glb> [options]",
  "",
  "  --out, --output <path>        Separate output GLB path. Existing files are never overwritten.",
  "  --target-profile <id>         Clunk target profile. Defaults to web-three-mobile.",
  "  --license <value>             Declared input license. Defaults to review-required.",
  "  --source-path <value>         Provenance path for the input asset.",
  "  --source-hash <sha256>        Expected input hash; mismatches are refused.",
  "  --run-id <value>              Immutable evidence run identifier.",
].join("\n");

const [command, inputPath, ...rawArgs] = process.argv.slice(2);

try {
  if (command !== "game-ready" || !inputPath) throw new Error(USAGE);
  const args = parseArgs(rawArgs);
  const outputPath = required(args, "out", "output");
  const absoluteInputPath = resolve(inputPath);
  const absoluteOutputPath = resolve(outputPath);
  if (absoluteInputPath.toLowerCase() === absoluteOutputPath.toLowerCase()) {
    throw new Error("Input and output paths must be different; Clunk never overwrites an input asset.");
  }
  const sidecarPath = `${absoluteOutputPath}.clunk.json`;
  await assertAbsent(absoluteOutputPath, "Output already exists; choose a new path.");
  await assertAbsent(sidecarPath, "Output evidence sidecar already exists; choose a new path.");
  const inputBytes = new Uint8Array(await readFile(absoluteInputPath));
  const result = await runClunkMeshLab({
    seriesId: "game-ready",
    assetKind: "3d-model",
    targetProfileId: args.get("target-profile") ?? "web-three-mobile",
    fileName: absoluteInputPath.split(/[\\/]/).pop() ?? "input.glb",
    bytes: inputBytes,
    sourcePath: args.get("source-path") ?? absoluteInputPath,
    ...(args.get("source-hash") ? { sourceHash: args.get("source-hash") } : {}),
    ...(args.get("license") ? { license: args.get("license") } : {}),
    ...(args.get("run-id") ? { runId: args.get("run-id") } : {}),
  });
  await mkdir(dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, result.outputBytes, { flag: "wx" });
  const { outputBytes, ...report } = result;
  void outputBytes;
  const envelope = {
    ...report,
    schema: "clunk.series-mesh-result.v1",
    inputPath: absoluteInputPath,
    outputPath: absoluteOutputPath,
    inputHash: report.inputHash,
    outputHash: report.outputHash,
    sourceHash: report.provenance.sourceHash ?? null,
  };
  await writeFile(sidecarPath, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${JSON.stringify({ ...envelope, evidencePath: sidecarPath }, null, 2)}\n`);
  process.exitCode = result.status === "COMPLETED" ? 0 : 2;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Clunk Series mesh pass failed."}\n`);
  process.exitCode = 2;
}

async function assertAbsent(path: string, message: string): Promise<void> {
  try {
    await access(path, constants.F_OK);
    throw new Error(message);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

function parseArgs(values: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token ?? ""}\n${USAGE}`);
    const key = token.slice(2);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.\n${USAGE}`);
    result.set(key, value);
    index += 1;
  }
  if (result.has("output") && !result.has("out")) result.set("out", result.get("output")!);
  return result;
}

function required(args: Map<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = args.get(key);
    if (value?.trim()) return value;
  }
  throw new Error(`Missing --${keys.join(" or --")}.\n${USAGE}`);
}
