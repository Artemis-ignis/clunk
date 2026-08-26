import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  normalizeSpriteSheetReview,
  type SpriteFrame,
  type SpriteSheetMetrics,
  type SpriteSheetReviewManifest,
  type SpriteSheetReviewReport,
} from "../packages/core/src/sprite-sheet-review";
import { sha256Hex } from "../packages/core/src/index";

const TOOL_VERSION = "clunk-sprite-sheet-audit/1.0.0";
const EXIT = { pass: 0, failure: 2, unavailable: 4 } as const;
const [, , command = "validate", ...rawArgs] = process.argv;

type Arguments = { input?: string; out?: string; format: "json"; required: boolean };
type SharpRawResult = { data: Buffer; info: { width: number; height: number } };
type SharpPipeline = {
  ensureAlpha: () => SharpPipeline;
  raw: () => SharpPipeline;
  extract: (options: { left: number; top: number; width: number; height: number }) => SharpPipeline;
  toBuffer: (options?: { resolveWithObject?: boolean }) => Promise<Buffer | SharpRawResult>;
};
type SharpFactory = (input: Uint8Array, options?: { raw: { width: number; height: number; channels: 4 } }) => SharpPipeline;

class LocalUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalUnavailableError";
  }
}

try {
  const args = parseArgs(rawArgs);
  if (command !== "validate" && command !== "normalize") throw new Error("Usage: validate|normalize --input <manifest.json> [--format json] [--required] [--out report.json]");
  const raw = JSON.parse(await readFile(resolve(required(args, "input")), "utf8")) as unknown;
  const measured = await measureManifest(raw, resolve(required(args, "input")));
  const report = normalizeSpriteSheetReview(measured.manifest);
  const envelope = buildEnvelope(report, measured.actualHash, measured.actualBytes, args.required);
  if (args.out) await writeFile(resolve(args.out), `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  process.exitCode = exitCode(envelope, args.required);
} catch (error) {
  const args = safeParseArgs(rawArgs);
  const unavailable = error instanceof LocalUnavailableError;
  const envelope = {
    schema: "clunk.sprite-sheet-review.v1",
    toolVersion: TOOL_VERSION,
    status: unavailable ? "UNAVAILABLE" : "ERROR",
    capability: unavailable ? "unavailable" : "shipped",
    errorCode: unavailable ? EXIT.unavailable : EXIT.failure,
    error: error instanceof Error ? error.message : String(error),
    static: "FAIL",
    quality: "UNAVAILABLE",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
    reviewStatus: "NOT_EVALUATED",
    readiness: "unavailable",
    issues: [],
    ...(args.out ? { outputPath: resolve(args.out) } : {}),
  };
  try {
    if (args.out) await writeFile(resolve(args.out), `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  } catch {
    // Keep the primary audit error on stdout/stderr if an output path is also invalid.
  }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  process.exitCode = unavailable ? EXIT.unavailable : EXIT.failure;
}

async function measureManifest(value: unknown, manifestPath: string): Promise<{ manifest: SpriteSheetReviewManifest; actualHash: string; actualBytes: number }> {
  const source = record(value, "Sprite sheet manifest");
  const sheet = record(source.sheet, "sheet");
  const sheetPath = text(sheet.path, "sheet.path");
  const filePath = isAbsolute(sheetPath) ? sheetPath : resolve(dirname(manifestPath), sheetPath);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(filePath));
  } catch {
    throw new LocalUnavailableError(`Sprite sheet file is unavailable: ${filePath}`);
  }
  const actualHash = sha256Hex(bytes);
  const actualBytes = bytes.byteLength;
  const declaredHash = text(sheet.sha256, "sheet.sha256").toLowerCase();
  const declaredBytes = number(sheet.bytes, "sheet.bytes");
  if (declaredHash !== actualHash || declaredBytes !== actualBytes) {
    throw new Error(`Declared sheet identity does not match local bytes: expected ${declaredHash}/${declaredBytes}, measured ${actualHash}/${actualBytes}.`);
  }
  const sharpFactory = await loadSharp();
  const image = await decode(sharpFactory, bytes, filePath);
  const frames = parseFrameCoordinates(source.frames);
  const target = record(source.target, "target");
  const runtimeFramePx = target.runtimeFramePx === undefined ? undefined : {
    width: number(record(target.runtimeFramePx, "target.runtimeFramePx").width, "target.runtimeFramePx.width"),
    height: number(record(target.runtimeFramePx, "target.runtimeFramePx").height, "target.runtimeFramePx.height"),
  };
  const metrics = await measurePixels(sharpFactory, image.data, image.width, image.height, frames, actualHash, runtimeFramePx);
  return {
    manifest: { ...source, metrics } as unknown as SpriteSheetReviewManifest,
    actualHash,
    actualBytes,
  };
}

async function loadSharp(): Promise<SharpFactory> {
  try {
    const sharpModule = (await import("sharp")) as unknown as { default?: SharpFactory };
    return sharpModule.default ?? (sharpModule as unknown as SharpFactory);
  } catch (error) {
    throw new LocalUnavailableError(`Raster decoder is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function decode(sharpFactory: SharpFactory, bytes: Uint8Array, filePath: string): Promise<{ data: Buffer; width: number; height: number }> {
  try {
    const decoded = await sharpFactory(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!isSharpRawResult(decoded)) throw new Error("raw decoder returned no image metadata");
    return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
  } catch (error) {
    throw new LocalUnavailableError(`Raster decoder could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function measurePixels(
  sharpFactory: SharpFactory,
  data: Buffer,
  width: number,
  height: number,
  frames: readonly SpriteFrame[],
  sourceHash: string,
  runtimeFramePx?: { width: number; height: number },
): Promise<SpriteSheetMetrics> {
  const frameHashes: Record<string, string> = {};
  const frameAlphaCoverages: number[] = [];
  const emptyFrameIds: string[] = [];
  const opaqueBottomFrameIds: string[] = [];
  const clippingFrameIds: string[] = [];
  const borderTouchRatios: number[] = [];
  const silhouetteCoverages: number[] = [];
  let alphaSpillPixels = 0;
  for (const frame of frames) {
    const frameDataValue = await sharpFactory(data, { raw: { width, height, channels: 4 } })
      .extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height })
      .raw()
      .toBuffer();
    if (!Buffer.isBuffer(frameDataValue)) throw new Error(`Frame ${frame.id} did not produce raw pixels.`);
    const frameData = frameDataValue;
    frameHashes[frame.id] = sha256Hex(frameData);
    let opaque = 0;
    let hasVisible = false;
    let bottomOpaque = false;
    let clipped = false;
    let borderOpaque = 0;
    let borderPixels = 0;
    let frameAlphaSpill = 0;
    for (let localY = 0; localY < frame.height; localY += 1) {
      for (let localX = 0; localX < frame.width; localX += 1) {
        const pixel = (localY * frame.width + localX) * 4;
        const alpha = frameData[pixel + 3];
        const isBorder = localX === 0 || localY === 0 || localX === frame.width - 1 || localY === frame.height - 1;
        if (alpha >= 128) {
          opaque += 1;
          if (localY === frame.height - 1) bottomOpaque = true;
          if (isBorder) {
            clipped = true;
            borderOpaque += 1;
          }
        }
        if (isBorder) {
          borderPixels += 1;
          if (alpha > 0 && alpha < 128) frameAlphaSpill += 1;
        }
        if (alpha > 0) hasVisible = true;
      }
    }
    frameAlphaCoverages.push(opaque / (frame.width * frame.height));
    silhouetteCoverages.push(opaque / (frame.width * frame.height));
    borderTouchRatios.push(borderPixels ? borderOpaque / borderPixels : 0);
    if (bottomOpaque) opaqueBottomFrameIds.push(frame.id);
    if (clipped) clippingFrameIds.push(frame.id);
    alphaSpillPixels += frameAlphaSpill;
    if (!hasVisible) emptyFrameIds.push(frame.id);
  }

  const groupsByHash = new Map<string, string[]>();
  for (const frame of frames) {
    const hash = frameHashes[frame.id];
    const group = groupsByHash.get(hash) ?? [];
    group.push(frame.id);
    groupsByHash.set(hash, group);
  }
  const duplicateFrameGroups = [...groupsByHash.values()].filter((group) => group.length > 1);
  const distinctFrameRatio = frames.length ? groupsByHash.size / frames.length : 0;
  let transparentPixels = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) transparentPixels += 1;

  const frameBuffers = await Promise.all(frames.map(async (frame) => {
    const value = await sharpFactory(data, { raw: { width, height, channels: 4 } })
      .extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height })
      .raw()
      .toBuffer();
    if (!Buffer.isBuffer(value)) throw new Error(`Frame ${frame.id} did not produce raw pixels.`);
    return value;
  }));
  const deltas: number[] = [];
  for (let index = 1; index < frameBuffers.length; index += 1) {
    const left = frameBuffers[index - 1];
    const right = frameBuffers[index];
    let total = 0;
    for (let pixel = 0; pixel < left.length; pixel += 1) total += Math.abs(left[pixel] - right[pixel]);
    deltas.push(total / (left.length * 255));
  }
  const meanFrameDelta = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  return {
    sourceHash,
    sheetDimensions: { width, height },
    alphaCoverage: transparentPixels ? 1 - transparentPixels / (width * height) : 1,
    frameAlphaCoverages,
    frameHashes,
    duplicateFrameGroups,
    distinctFrameRatio,
    meanFrameDelta,
    hasTransparentPixels: transparentPixels > 0,
    emptyFrameIds,
    opaqueBottomFrameIds,
    clippingFrameIds,
    alphaSpillPixels,
    borderTouchRatios,
    silhouetteCoverages,
    ...(runtimeFramePx ? { runtimeFramePx } : {}),
  };
}

function buildEnvelope(report: SpriteSheetReviewReport, actualHash: string, actualBytes: number, required: boolean) {
  const normalized = report;
  const status = report.playerFacing === "NO_GO"
    ? "NO_GO"
    : report.quality === "BLOCKED"
      ? "FAIL"
      : report.quality === "UNAVAILABLE"
        ? "UNAVAILABLE"
        : report.reviewStatus !== "EVALUATED" && required && report.qualityPolicy.requireHumanReview === true
          ? "PENDING_REVIEW"
          : report.quality === "ADVISORY" || report.playerFacing === "PASS_WITH_FOLLOW_UP"
            ? "PASS_WITH_FOLLOW_UP"
            : "PASS";
  return {
    ...normalized,
    schema: "clunk.sprite-sheet-review.v1",
    toolVersion: TOOL_VERSION,
    status,
    capability: "shipped",
    auditScope: "sprite-sheet-pixel-and-contract",
    actualInput: { sha256: actualHash, bytes: actualBytes },
  };
}

function isSharpRawResult(value: Buffer | SharpRawResult): value is SharpRawResult {
  return !Buffer.isBuffer(value) && Boolean(value && typeof value === "object" && "data" in value && "info" in value);
}

function exitCode(envelope: { status: string; readiness: string }, required: boolean): number {
  if (envelope.status === "UNAVAILABLE" || (required && envelope.status === "PENDING_REVIEW")) return EXIT.unavailable;
  if (envelope.status === "FAIL" || envelope.status === "NO_GO") return EXIT.failure;
  return EXIT.pass;
}

function parseFrameCoordinates(value: unknown): SpriteFrame[] {
  if (!Array.isArray(value)) throw new Error("frames must be an array.");
  return value.map((item, index) => {
    const frame = record(item, `frames[${index}]`);
    return {
      id: text(frame.id, `frames[${index}].id`),
      index: number(frame.index, `frames[${index}].index`),
      x: number(frame.x, `frames[${index}].x`),
      y: number(frame.y, `frames[${index}].y`),
      width: number(frame.width, `frames[${index}].width`),
      height: number(frame.height, `frames[${index}].height`),
      state: text(frame.state, `frames[${index}].state`),
      anchor: { x: 0, y: 0 },
    };
  });
}

function parseArgs(values: readonly string[]): Arguments {
  const args = safeParseArgs(values);
  if (!args.input) throw new Error("Missing --input.");
  return args;
}

function safeParseArgs(values: readonly string[]): Arguments {
  const result: Arguments = { format: "json", required: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) throw new Error(`Unexpected argument: ${value ?? ""}`);
    const key = value.slice(2);
    if (key === "required") {
      result.required = true;
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    if (key === "input") result.input = next;
    else if (key === "out") result.out = next;
    else if (key === "format" && next === "json") result.format = "json";
    else throw new Error(`Unknown argument: --${key}`);
    index += 1;
  }
  return result;
}

function required(args: Arguments, key: "input"): string {
  const value = args[key];
  if (!value?.trim()) throw new Error(`Missing --${key}.`);
  return value;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function number(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}
