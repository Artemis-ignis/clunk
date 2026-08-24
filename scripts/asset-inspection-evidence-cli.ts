#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import {
  createAssetInspectionEvidenceV2,
  inspectAsset,
  normalizeAssetInspectionEvidenceV2,
  profileHashForReport,
  sha256Hex,
  validateAsset,
  type AssetCaptureEvidenceV2,
  type AudioEvidenceMetadataV2,
  type AssetInspectionEvidenceKind,
  type HumanDecision,
} from "../packages/core/src/index";
import { loadBundle } from "../integrations/shared/node-asset";
import { loadCustomProfile, resolveProfilePolicy } from "../integrations/shared/custom-profile";

class ParsedArgs {
  readonly positionals: string[] = [];
  private readonly map = new Map<string, string>();
  private readonly repeated = new Map<string, string[]>();
  has(key: string): boolean { return this.map.has(key) || this.repeated.has(key); }
  get(key: string): string | undefined { return this.map.get(key); }
  values(key: string): string[] { return this.repeated.get(key) ?? (this.map.has(key) ? [this.map.get(key)!] : []); }
  set(key: string, value: string): void { this.map.set(key, value); }
  add(key: string, value: string): void { this.repeated.set(key, [...(this.repeated.get(key) ?? []), value]); }
}

const [, , command, ...rawArgs] = process.argv;

try {
  const args = parseArgs(rawArgs);
  if (command === "normalize") {
    const input = required(args, "input");
    const value = normalizeAssetInspectionEvidenceV2(JSON.parse(await readFile(resolve(input), "utf8")) as unknown);
    await emit(value, args.get("out"));
    if (args.has("required") && !value.validation.valid) process.exitCode = 2;
  } else if (command === "inspect" || command === "validate") {
    const inputPath = args.positionals[0];
    if (!inputPath) throw new Error("Usage: asset:evidence inspect|validate <asset> [options].");
    const loaded = await loadBundle(inputPath);
    const policy = await resolveProfilePolicy({ profile: args.get("profile"), profileFile: args.get("profile-file") });
    const report = command === "validate" ? validateAsset(loaded.bundle, policy).report : inspectAsset(loaded.bundle, policy);
    const captureEvidence = await loadCaptures(args.values("capture"), false, args);
    const audioEvidence = await loadCaptures(args.values("audio"), true, args);
    const evidence = createAssetInspectionEvidenceV2(report, {
      operation: command,
      evidenceKind: (args.get("evidence-kind") as AssetInspectionEvidenceKind | undefined) ?? "CONTRACT_FIXTURE",
      inspectionRunId: args.get("inspection-run-id"),
      coreBuildId: args.get("core-build-id"),
      profileHash: await resolveProfileHash(args.get("profile-file"), report),
      sourcePath: loaded.absolutePath,
      captureEvidence,
      audioEvidence,
      byteVerification: {
        method: "LOCAL_CLI_READ",
        source: { sha256: report.inputHash, bytes: report.byteLength, verified: true },
        captures: captureEvidence.map(({ path, sha256, bytes }) => ({ path, sha256, bytes, verified: true as const })),
        audio: audioEvidence.map(({ path, sha256, bytes }) => ({ path, sha256, bytes, verified: true as const })),
      },
      humanDecision: (args.get("human-decision") as HumanDecision | undefined) ?? "NOT_EVALUATED",
    });
    await emit(evidence, args.get("out"));
    if (args.has("required") && !evidence.validation.valid) process.exitCode = 2;
  } else if (command === "passport") {
    const sourcePath = args.positionals[0];
    const outputPath = args.positionals[1];
    if (!sourcePath || !outputPath) throw new Error("Usage: asset:evidence passport <source> <output> [options].");
    const policy = await resolveProfilePolicy({ profile: args.get("profile"), profileFile: args.get("profile-file") });
    const [source, output] = await Promise.all([loadBundle(sourcePath), loadBundle(outputPath)]);
    const sourceReport = inspectAsset(source.bundle, policy);
    const outputReport = inspectAsset(output.bundle, policy);
    const evidence = createAssetInspectionEvidenceV2(sourceReport, {
      operation: "passport",
      evidenceKind: "CONTRACT_FIXTURE",
      inspectionRunId: args.get("inspection-run-id"),
      coreBuildId: args.get("core-build-id"),
      profileHash: await resolveProfileHash(args.get("profile-file"), sourceReport),
      sourcePath: source.absolutePath,
      sourceOutputRelation: {
        kind: "SOURCE_OUTPUT_PAIR",
        sourceHash: sourceReport.inputHash,
        sourceInspectionDigest: sourceReport.resultDigest,
        outputHash: outputReport.inputHash,
        outputInspectionDigest: outputReport.resultDigest,
      },
    });
    await emit({ ...evidence, outputReport }, args.get("out"));
  } else {
    throw new Error(usage());
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Asset inspection evidence failed."}\n`);
  process.exitCode = 2;
}

async function loadCaptures(paths: readonly string[], audioOnly: boolean, args: ParsedArgs): Promise<AssetCaptureEvidenceV2[]> {
  const renderer = args.get("renderer");
  const viewport = parseViewport(args.get("viewport"));
  const sourceTreeHash = args.get("source-tree-hash");
  const cameraPoseHash = args.get("camera-pose-hash");
  const shippedPath = args.has("shipped-path") ? true : undefined;
  const audioMetadata = audioOnly ? parseAudioMetadata(args.get("audio-metadata")) : undefined;
  const consoleEvidence = audioOnly ? undefined : parseConsole(args);
  const captures: AssetCaptureEvidenceV2[] = [];
  for (const path of paths) {
    const absolute = resolve(path);
    const bytes = new Uint8Array(await readFile(absolute));
    captures.push({
      media: audioOnly ? "audio" : mediaForPath(absolute),
      path: absolute,
      sha256: sha256Hex(bytes),
      bytes: bytes.byteLength,
      ...(renderer ? { renderer } : {}),
      ...(viewport ? { viewport } : {}),
      ...(sourceTreeHash ? { sourceTreeHash } : {}),
      ...(cameraPoseHash ? { cameraPoseHash } : {}),
      ...(shippedPath === undefined ? {} : { shippedPath }),
      ...(consoleEvidence ? { console: consoleEvidence } : {}),
      ...(audioMetadata ? { audio: audioMetadata } : {}),
    });
  }
  return captures;
}

function parseConsole(args: ParsedArgs): { errors: number; warnings: number } | undefined {
  const errors = args.get("console-errors");
  const warnings = args.get("console-warnings");
  if (errors === undefined && warnings === undefined) return undefined;
  return {
    errors: parseNonNegativeInteger(errors ?? "0", "--console-errors"),
    warnings: parseNonNegativeInteger(warnings ?? "0", "--console-warnings"),
  };
}

function parseNonNegativeInteger(value: string, flag: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} must be a non-negative integer.`);
  return Number(value);
}

function parseAudioMetadata(value: string | undefined): AudioEvidenceMetadataV2 | undefined {
  if (!value) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("--audio-metadata must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--audio-metadata must be a JSON object.");
  return parsed as AudioEvidenceMetadataV2;
}

function mediaForPath(path: string): "screenshot" | "frame" {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(extname(path).toLowerCase()) ? "screenshot" : "frame";
}

async function resolveProfileHash(profilePath: string | undefined, report: Parameters<typeof profileHashForReport>[0]): Promise<string> {
  if (!profilePath) return profileHashForReport(report);
  const profileBytes = new Uint8Array(await readFile(resolve(profilePath)));
  // The hash is over the exact profile file bytes so a CI run can prove which declaration it used.
  await loadCustomProfile(profilePath);
  return sha256Hex(profileBytes);
}

async function emit(value: unknown, outPath: string | undefined): Promise<void> {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  if (outPath) await writeFile(resolve(outPath), output, { encoding: "utf8", flag: "wx" });
  process.stdout.write(output);
}

function parseArgs(values: readonly string[]): ParsedArgs {
  const result = new ParsedArgs();
  const booleanFlags = new Set(["required", "shipped-path"]);
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith("--")) {
      result.positionals.push(token ?? "");
      continue;
    }
    const key = token.slice(2);
    if (booleanFlags.has(key)) {
      result.set(key, "true");
      continue;
    }
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    if (key === "capture" || key === "audio") result.add(key, value);
    else result.set(key, value);
    index += 1;
  }
  return result;
}

function required(args: ParsedArgs, key: string): string {
  const value = args.get(key);
  if (!value?.trim()) throw new Error(`Missing --${key}.`);
  return value;
}

function parseViewport(value: string | undefined): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) throw new Error("--viewport must be WIDTHxHEIGHT, for example 1920x1080.");
  return { width: Number(match[1]), height: Number(match[2]) };
}

function usage(): string {
  return [
    "Usage:",
    "  npm run asset:evidence -- inspect <asset> [--profile-file profile.json] [--evidence-kind CONTRACT_FIXTURE|PLAYER_FACING_CAPTURE]",
    "    [--inspection-run-id id] [--capture frame.png] [--audio capture.wav] [--renderer WEBGPU] [--viewport 1920x1080]",
    "    [--source-tree-hash sha256] [--camera-pose-hash sha256] [--shipped-path] [--console-errors 0] [--console-warnings 0]",
    "    [--audio-metadata '{\"channels\":2,\"sampleRateHz\":48000,\"durationMs\":1200,\"rmsDb\":-18,\"peakDb\":-1.2,\"leftRightBalanceDb\":-0.4,\"queueId\":\"hoe-r01\"}']",
    "  npm run asset:evidence -- validate <asset> [same options] [--required]",
    "  npm run asset:evidence -- passport <source> <output> [--profile-file profile.json]",
    "  npm run asset:evidence -- normalize --input evidence-v2.json",
  ].join("\n");
}
