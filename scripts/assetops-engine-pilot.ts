import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import {
  inspectAssetForTarget,
  type AssetEvidence,
} from "../packages/core/src/index";
import { discoverEngineEnvironments } from "../integrations/engines/discover";
import { loadAssetOpsInput } from "../integrations/shared/node-asset";

const execFileAsync = promisify(execFile);
const [, , ...rawArgs] = process.argv;

try {
  const args = parseArgs(rawArgs);
  const workspaceRoot = resolve(args.get("workspace-root") ?? "C:\\Users\\50106\\Desktop\\Harvest Frontier");
  const runtimeRoot = resolve(args.get("runtime-root") ?? resolve(workspaceRoot, "public/assets/runtime"));
  const profileId = args.get("profile") ?? "harvest-frontier-web-three";
  const reportPath = resolve(args.get("report") ?? resolve(process.cwd(), "docs/pilot/harvest-frontier-engine-assetops.ko.md"));
  const runId = args.get("run-id") ?? `hf-engine-pilot-${(await gitText(workspaceRoot, ["rev-parse", "HEAD"])).slice(0, 12) || "uncommitted"}`;
  if (isWithin(reportPath, workspaceRoot)) throw new Error("Pilot report must be outside the Harvest Frontier workspace.");
  const before = await snapshotWorkspace(workspaceRoot);
  const files = await listGlbFiles(runtimeRoot);
  if (!files.length) throw new Error(`No GLB files were found under ${runtimeRoot}.`);
  const assets: AssetEvidence[] = [];
  for (const path of files) {
    const input = await loadAssetOpsInput(path);
    assets.push(inspectAssetForTarget({
      runId: `${runId}:${basename(path)}`,
      sourcePath: path,
      fileName: input.fileName,
      bytes: input.bytes,
      targetProfileId: profileId,
      bundleFiles: input.bundleFiles,
    }));
  }
  const environments = await discoverEngineEnvironments();
  const after = await snapshotWorkspace(workspaceRoot);
  if (before.status !== after.status || before.diffStat !== after.diffStat) throw new Error("Harvest Frontier changed during the read-only pilot.");
  const report = {
    schema: "clunk.assetops-engine-pilot.v1",
    runId,
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    sourceCommit: before.head || "UNCOMMITTED",
    targetProfileId: profileId,
    environments,
    sourceAssets: assets.map(serializeAsset),
    visualRuntime: "NOT_EVALUATED",
    playerFacing: "NOT_EVALUATED",
    readiness: "SCENE_GAP",
    productionReady: false,
    readOnlyVerification: { before, after, unchanged: true },
  };
  const output = reportPath.toLowerCase().endsWith(".json")
    ? `${JSON.stringify(report, null, 2)}\n`
    : markdownReport(report);
  await writeFile(reportPath, output, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "AssetOps engine pilot failed."}\n`);
  process.exitCode = 2;
}

function serializeAsset(asset: AssetEvidence) {
  return {
    runId: asset.runId,
    sourcePath: asset.source.path,
    sourceHash: asset.source.sha256,
    bytes: asset.source.bytes,
    assetKind: asset.assetKind,
    targetProfileId: asset.target.id,
    status: asset.status,
    productionReady: asset.productionReady,
    stages: asset.stages,
    findings: asset.findings,
    qualityWarnings: asset.qualityWarnings,
  };
}

async function listGlbFiles(root: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(root, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) paths.push(...await listGlbFiles(path));
    else if (entry.isFile() && path.toLowerCase().endsWith(".glb")) paths.push(path);
  }
  return paths;
}

async function snapshotWorkspace(root: string) {
  return {
    head: await gitText(root, ["rev-parse", "HEAD"]),
    status: await gitText(root, ["status", "--short", "--branch"]),
    diffStat: await gitText(root, ["diff", "--stat"]),
  };
}

async function gitText(root: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", ["-C", root, ...args], { windowsHide: true, timeout: 5_000, maxBuffer: 256_000 });
    return String(result.stdout).trim();
  } catch {
    return "";
  }
}

function isWithin(candidate: string, root: string): boolean {
  const candidateRelative = relative(root, candidate);
  return candidateRelative === "" || (!candidateRelative.startsWith(`..${sep}`) && candidateRelative !== "..");
}

function markdownReport(report: Record<string, unknown>): string {
  return `# Clunk engine-aware AssetOps pilot\n\nRead-only report. Source assets were not modified.\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
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
