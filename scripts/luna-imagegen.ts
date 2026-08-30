#!/usr/bin/env node
// Local codex-luna runner: the only place the codex-luna provider is allowed to
// execute. Worker routes never spawn processes, so they stay ENVIRONMENT_UNAVAILABLE
// and this CLI injects the real runner into the same provider contract instead.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  executeProviderRun,
  getProviderEnvironment,
  type ProviderArtifactInput,
  type ProviderEnvironment,
  type ProviderRunInput,
} from "../packages/clunk-series/src/provider-runtime";

const USAGE = [
  "Usage: npm run asset:luna -- --prompt \"...\" --label <name> [options]",
  "",
  "  --prompt <text>          Image prompt (or --prompt-file <path>).",
  "  --label <name>           Output name. Required.",
  "  --width / --height <px>  Requested size. Defaults to 1024x1024.",
  "  --target <profileId>     Clunk target profile. Defaults to yeongheo-pixi-2d.",
  "  --out <dir>              Output root. Defaults to outputs/luna.",
  "  --model <id>             Codex model. Defaults to CODEX_LUNA_MODEL or gpt-5.6-luna.",
  "  --timeout <ms>           Codex exec timeout. Defaults to 300000.",
  "",
  "The result is provider evidence, not a shipped product: productionReady stays",
  "false until license, runtime, player-facing, and human review gates run.",
].join("\n");

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function safeLabel(value: string): string {
  const label = value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  if (!label) throw new Error("--label must contain letters, digits, '-' or '_'.");
  return label.slice(0, 64);
}

// Windows PATH shims for npm CLIs are .cmd files, which Node cannot spawn
// directly without a shell. Wrapping in cmd.exe keeps the argv array intact;
// every codex argument here is token-safe because the prompt travels on stdin.
function spawnSpec(bin: string, commandArgs: string[]): { command: string; args: string[] } {
  if (process.platform === "win32" && !/[/\\]/.test(bin) && !/\.(exe|cmd|bat)$/i.test(bin)) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", bin, ...commandArgs] };
  }
  return { command: bin, args: commandArgs };
}

function runCommand(command: string, commandArgs: string[], cwd: string, timeoutMs: number, stdinText?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const spec = spawnSpec(command, commandArgs);
    const child = spawn(spec.command, spec.args, { cwd, windowsHide: true, stdio: [stdinText === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`codex exec timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    if (stdinText !== undefined && child.stdin) {
      child.stdin.write(stdinText);
      child.stdin.end();
    }
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => { clearTimeout(timer); rejectPromise(error); });
    child.on("close", (code) => { clearTimeout(timer); resolvePromise({ code: code ?? 1, stdout, stderr }); });
  });
}

function assertPngBytes(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength <= PNG_SIGNATURE.length || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error("Codex luna output is not a valid PNG (signature 137, 80, 78, 71 mismatch).");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

async function gitHeadCommit(): Promise<string> {
  try {
    const result = await runCommand("git", ["rev-parse", "HEAD"], process.cwd(), 15_000);
    const commit = result.stdout.trim();
    return result.code === 0 && /^[0-9a-f]{40}$/.test(commit) ? commit : "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const promptFile = flag("--prompt-file");
  const prompt = (flag("--prompt") ?? (promptFile ? await readFile(resolve(promptFile), "utf8") : "")).trim();
  const labelInput = flag("--label");
  if (!prompt || !labelInput) throw new Error(USAGE);
  const label = safeLabel(labelInput);
  const width = Math.max(64, Math.min(4096, Number(flag("--width") ?? 1024) || 1024));
  const height = Math.max(64, Math.min(4096, Number(flag("--height") ?? 1024) || 1024));
  const targetProfileId = flag("--target") ?? "yeongheo-pixi-2d";
  const outRoot = resolve(flag("--out") ?? "outputs/luna");
  const timeoutMs = Math.max(30_000, Math.min(900_000, Number(flag("--timeout") ?? 300_000) || 300_000));
  const codexBin = process.env.CODEX_BIN?.trim() || "codex";
  const model = flag("--model")?.trim() || process.env.CODEX_LUNA_MODEL?.trim() || "gpt-5.6-luna";

  const environment: ProviderEnvironment = getProviderEnvironment({ CODEX_BIN: codexBin, CODEX_LUNA_MODEL: model });

  const runCodexLuna = async (input: ProviderRunInput, runtimeEnvironment: ProviderEnvironment): Promise<readonly ProviderArtifactInput[]> => {
    const workDir = await mkdtemp(join(tmpdir(), "clunk-luna-"));
    try {
      const outputPath = join(workDir, `${label}.png`);
      const instruction = [
        "Generate exactly one image with your built-in image generation tool.",
        `Prompt: ${input.prompt}`,
        `Save the final PNG to exactly this path: ${outputPath}`,
        `Requested size: ${width}x${height}. If only preset sizes exist, pick the closest.`,
        "Do nothing else: no source code, no extra files, no edits outside that path.",
      ].join("\n");
      const bin = runtimeEnvironment.CODEX_BIN?.trim() || "codex";
      const result = await runCommand(bin, ["exec", "--skip-git-repo-check", "-m", model, "-"], workDir, timeoutMs, instruction);
      if (!existsSync(outputPath)) {
        const tail = `${result.stderr}\n${result.stdout}`.trim().split("\n").slice(-4).join(" | ");
        throw new Error(`Codex luna run (exit ${result.code}) finished without writing the requested PNG. ${tail}`);
      }
      const bytes = new Uint8Array(await readFile(outputPath));
      assertPngBytes(bytes);
      return [{ fileName: `${label}.png`, role: "entry", contentType: "image/png", bytes }];
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  };

  const input: ProviderRunInput = {
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId,
    label,
    prompt,
    width,
    height,
    license: flag("--license") ?? "review-required",
  };

  const runResult = await executeProviderRun(input, { environment, runCodexLuna });
  if (runResult.status !== "COMPLETED") {
    process.stdout.write(`${JSON.stringify({
      schema: "clunk.luna-imagegen-record.v1",
      status: runResult.status,
      error: runResult.error ?? null,
      limitations: runResult.evidence.limitations,
      productionReady: false,
    }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const entry = runResult.artifacts[0];
  const dimensions = assertPngBytes(entry.bytes);
  const outDir = join(outRoot, label);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, entry.fileName), entry.bytes);
  const record = {
    schema: "clunk.luna-imagegen-record.v1",
    generatedAt: new Date().toISOString(),
    runner: { codexBin, model, runnerCommit: await gitHeadCommit(), timeoutMs },
    request: { label, prompt, targetProfileId, requestedWidth: width, requestedHeight: height },
    requestHash: runResult.evidence.requestHash,
    provenance: runResult.provenance,
    evidence: {
      freshReinspection: runResult.evidence.freshReinspection,
      inspectedArtifacts: runResult.evidence.inspectedArtifacts.map((artifact) => ({
        fileName: artifact.fileName,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        status: artifact.status,
      })),
      limitations: runResult.evidence.limitations,
      productionReady: false,
    },
    image: { fileName: entry.fileName, width: dimensions.width, height: dimensions.height, byteLength: entry.byteLength, sha256: entry.sha256 },
  };
  await writeFile(join(outDir, `${label}.luna-record.json`), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: "COMPLETED", outDir, image: record.image, freshReinspection: record.evidence.freshReinspection, productionReady: false }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
