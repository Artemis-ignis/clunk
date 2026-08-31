/**
 * clunk.player-facing-quality.v1
 *
 * A small, product-neutral contract for carrying the quality loop back into
 * asset authoring. Structural inspection answers "can the bytes be parsed?";
 * this envelope answers "was the asset actually reviewed in the shipped
 * renderer at the intended size and cadence?" without turning a fixture into
 * a visual approval.
 */

import type { AssetKind } from "./assetops-contract";

export const PLAYER_FACING_QUALITY_SCHEMA = "clunk.player-facing-quality.v1" as const;
export const PLAYER_FACING_QUALITY_VERSION = 1 as const;

export type PlayerFacingEvidenceKind = "CONTRACT_FIXTURE" | "PLAYER_FACING_CAPTURE";
export type PlayerFacingQualityDecision = "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "NOT_EVALUATED";
export type PlayerFacingQualityStatus = PlayerFacingQualityDecision;
export type PlayerFacingCheckStatus = "PASS" | "FAIL" | "NOT_CHECKED";
export type PlayerFacingQualityCheckId =
  | "silhouette"
  | "proportions"
  | "materials"
  | "lighting"
  | "scale"
  | "readability"
  | "composition";

export interface PlayerFacingVerifiedFile {
  path: string;
  bytes: number;
  sha256: string;
  verified: true;
}

export interface PlayerFacingQualityCheck {
  status: PlayerFacingCheckStatus;
  observation: string;
  threshold?: string | number | boolean | null;
}

export interface PlayerFacingViewport {
  width: number;
  height: number;
}

export interface PlayerFacingFixedFpsEvidence {
  targetHz: number;
  sampleIntervalMs: number;
  sampledFrameCount: number;
}

export interface PlayerFacingCapture {
  screenshot: PlayerFacingVerifiedFile;
  renderer: string;
  viewport: PlayerFacingViewport;
  imageSize: PlayerFacingViewport;
  originalSize: boolean;
  fixedFps: PlayerFacingFixedFpsEvidence;
  cameraPoseHash: string;
  sourceTreeHash: string;
  shippedPath: true;
  console: {
    errors: number;
    warnings: number;
  };
}

export interface PlayerFacingMeasurements {
  silhouetteIoU?: number;
  aspectRatioDelta?: number;
  screenCoverage?: number;
}

export interface PlayerFacingQualityEvidence {
  schema: typeof PLAYER_FACING_QUALITY_SCHEMA;
  version: typeof PLAYER_FACING_QUALITY_VERSION;
  evidenceKind: PlayerFacingEvidenceKind;
  runId: string;
  assetId: string;
  assetKind: AssetKind;
  targetProfileId: string;
  reference: PlayerFacingVerifiedFile;
  runtime: PlayerFacingVerifiedFile;
  captures: PlayerFacingCapture[];
  checks: Record<PlayerFacingQualityCheckId, PlayerFacingQualityCheck>;
  measurements?: PlayerFacingMeasurements;
  humanDecision: PlayerFacingQualityDecision;
  reviewer?: string;
  notes?: string;
  status: PlayerFacingQualityStatus;
  /** Human and runtime gates are deliberately separate from product approval. */
  productionReady: false;
}

export interface PlayerFacingQualityEvidenceInput {
  evidenceKind: PlayerFacingEvidenceKind;
  runId: string;
  assetId: string;
  assetKind: AssetKind;
  targetProfileId: string;
  reference: PlayerFacingVerifiedFile;
  runtime: PlayerFacingVerifiedFile;
  captures?: readonly PlayerFacingCapture[];
  checks: Record<PlayerFacingQualityCheckId, PlayerFacingQualityCheck>;
  measurements?: PlayerFacingMeasurements;
  humanDecision?: PlayerFacingQualityDecision;
  reviewer?: string;
  notes?: string;
}

const HASH = /^[a-f0-9]{64}$/i;
const CHECK_IDS: readonly PlayerFacingQualityCheckId[] = [
  "silhouette",
  "proportions",
  "materials",
  "lighting",
  "scale",
  "readability",
  "composition",
];

export function createPlayerFacingQualityEvidence(
  input: PlayerFacingQualityEvidenceInput,
): PlayerFacingQualityEvidence {
  const value: PlayerFacingQualityEvidence = {
    schema: PLAYER_FACING_QUALITY_SCHEMA,
    version: PLAYER_FACING_QUALITY_VERSION,
    evidenceKind: input.evidenceKind,
    runId: input.runId,
    assetId: input.assetId,
    assetKind: input.assetKind,
    targetProfileId: input.targetProfileId,
    reference: input.reference,
    runtime: input.runtime,
    captures: [...(input.captures ?? [])],
    checks: { ...input.checks },
    ...(input.measurements ? { measurements: { ...input.measurements } } : {}),
    humanDecision: input.humanDecision ?? "NOT_EVALUATED",
    ...(input.reviewer ? { reviewer: input.reviewer } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    status: input.humanDecision ?? "NOT_EVALUATED",
    productionReady: false,
  };
  return normalizePlayerFacingQualityEvidence(value);
}

/** Strict boundary for files received from a consumer, API, or evidence folder. */
export function normalizePlayerFacingQualityEvidence(value: unknown): PlayerFacingQualityEvidence {
  if (!isRecord(value)) throw new Error("Player-facing quality evidence must be an object.");
  if (value.schema !== PLAYER_FACING_QUALITY_SCHEMA) throw new Error(`schema must be ${PLAYER_FACING_QUALITY_SCHEMA}.`);
  if (value.version !== PLAYER_FACING_QUALITY_VERSION) throw new Error("version is unsupported.");
  const evidenceKind = value.evidenceKind;
  if (evidenceKind !== "CONTRACT_FIXTURE" && evidenceKind !== "PLAYER_FACING_CAPTURE") {
    throw new Error("evidenceKind must be CONTRACT_FIXTURE or PLAYER_FACING_CAPTURE.");
  }
  const runId = nonEmpty(value.runId, "runId");
  const assetId = nonEmpty(value.assetId, "assetId");
  const assetKind = value.assetKind;
  if (!isAssetKind(assetKind)) throw new Error("assetKind is invalid.");
  const targetProfileId = nonEmpty(value.targetProfileId, "targetProfileId");
  const reference = requireFile(value.reference, "reference");
  const runtime = requireFile(value.runtime, "runtime");
  const captures = requireCaptures(value.captures, "captures");
  const checks = requireChecks(value.checks);
  const measurements = value.measurements === undefined ? undefined : requireMeasurements(value.measurements);
  const humanDecision = value.humanDecision;
  if (!isDecision(humanDecision)) throw new Error("humanDecision is invalid.");
  if (value.productionReady !== false) throw new Error("productionReady must remain false in player-facing evidence.");
  const reviewer = value.reviewer === undefined ? undefined : nonEmpty(value.reviewer, "reviewer");
  const notes = value.notes === undefined ? undefined : nonEmpty(value.notes, "notes");

  if (evidenceKind === "CONTRACT_FIXTURE") {
    if (captures.length > 0) throw new Error("CONTRACT_FIXTURE cannot carry player-facing captures.");
    if (humanDecision !== "NOT_EVALUATED") throw new Error("CONTRACT_FIXTURE cannot carry a human approval decision.");
  } else {
    if (captures.length === 0) throw new Error("PLAYER_FACING_CAPTURE requires at least one capture.");
    if (humanDecision === "PASS") {
      if (!reviewer) throw new Error("PASS requires reviewer.");
      if (captures.some((capture) => !isCompleteCapture(capture))) {
        throw new Error("PASS requires original-size, fixed-FPS, shipped-path captures with zero console errors.");
      }
      if (CHECK_IDS.some((id) => checks[id].status !== "PASS")) {
        throw new Error("PASS requires every player-facing quality check to be PASS.");
      }
    }
    if (humanDecision === "PASS_WITH_FOLLOW_UP" && !reviewer) throw new Error("PASS_WITH_FOLLOW_UP requires reviewer.");
    if (humanDecision === "NO_GO" && !reviewer && !notes) throw new Error("NO_GO requires reviewer or notes.");
  }

  const status = deriveStatus(evidenceKind, humanDecision);
  if (value.status !== status) throw new Error(`status must be ${status} for the supplied evidence lane and decision.`);
  return {
    schema: PLAYER_FACING_QUALITY_SCHEMA,
    version: PLAYER_FACING_QUALITY_VERSION,
    evidenceKind,
    runId,
    assetId,
    assetKind,
    targetProfileId,
    reference,
    runtime,
    captures,
    checks,
    ...(measurements ? { measurements } : {}),
    humanDecision,
    ...(reviewer ? { reviewer } : {}),
    ...(notes ? { notes } : {}),
    status,
    productionReady: false,
  };
}

function deriveStatus(kind: PlayerFacingEvidenceKind, decision: PlayerFacingQualityDecision): PlayerFacingQualityStatus {
  return kind === "CONTRACT_FIXTURE" ? "NOT_EVALUATED" : decision;
}

function isCompleteCapture(capture: PlayerFacingCapture): boolean {
  return capture.originalSize
    && capture.imageSize.width === capture.viewport.width
    && capture.imageSize.height === capture.viewport.height
    && capture.fixedFps.sampledFrameCount >= 2
    && capture.shippedPath
    && capture.console.errors === 0;
}

function requireCaptures(value: unknown, label: string): PlayerFacingCapture[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => requireCapture(item, `${label}[${index}]`));
}

function requireCapture(value: unknown, label: string): PlayerFacingCapture {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const viewport = requireViewport(value.viewport, `${label}.viewport`);
  const imageSize = requireViewport(value.imageSize, `${label}.imageSize`);
  if (typeof value.originalSize !== "boolean") throw new Error(`${label}.originalSize must be boolean.`);
  if (value.originalSize && (imageSize.width !== viewport.width || imageSize.height !== viewport.height)) {
    throw new Error(`${label}.originalSize requires imageSize to match viewport.`);
  }
  if (typeof value.renderer !== "string" || !value.renderer.trim()) throw new Error(`${label}.renderer is required.`);
  if (!isRecord(value.fixedFps)) throw new Error(`${label}.fixedFps must be an object.`);
  const fixedFps = {
    targetHz: positiveNumber(value.fixedFps.targetHz, `${label}.fixedFps.targetHz`),
    sampleIntervalMs: positiveNumber(value.fixedFps.sampleIntervalMs, `${label}.fixedFps.sampleIntervalMs`),
    sampledFrameCount: positiveInteger(value.fixedFps.sampledFrameCount, `${label}.fixedFps.sampledFrameCount`),
  };
  if (fixedFps.sampledFrameCount < 2) throw new Error(`${label}.fixedFps.sampledFrameCount must be at least 2.`);
  const cameraPoseHash = requireHash(value.cameraPoseHash, `${label}.cameraPoseHash`);
  const sourceTreeHash = requireHash(value.sourceTreeHash, `${label}.sourceTreeHash`);
  if (value.shippedPath !== true) throw new Error(`${label}.shippedPath must be true.`);
  if (!isRecord(value.console)) throw new Error(`${label}.console must be an object.`);
  const consoleEvidence = {
    errors: nonNegativeInteger(value.console.errors, `${label}.console.errors`),
    warnings: nonNegativeInteger(value.console.warnings, `${label}.console.warnings`),
  };
  return {
    screenshot: requireFile(value.screenshot, `${label}.screenshot`),
    renderer: value.renderer,
    viewport,
    imageSize,
    originalSize: value.originalSize,
    fixedFps,
    cameraPoseHash,
    sourceTreeHash,
    shippedPath: true,
    console: consoleEvidence,
  };
}

function requireChecks(value: unknown): Record<PlayerFacingQualityCheckId, PlayerFacingQualityCheck> {
  if (!isRecord(value)) throw new Error("checks must be an object.");
  const checks = {} as Record<PlayerFacingQualityCheckId, PlayerFacingQualityCheck>;
  for (const id of CHECK_IDS) {
    const raw = value[id];
    if (!isRecord(raw)) throw new Error(`checks.${id} must be an object.`);
    const status = raw.status;
    if (status !== "PASS" && status !== "FAIL" && status !== "NOT_CHECKED") throw new Error(`checks.${id}.status is invalid.`);
    checks[id] = {
      status,
      observation: nonEmpty(raw.observation, `checks.${id}.observation`),
      ...(raw.threshold === undefined ? {} : { threshold: scalar(raw.threshold, `checks.${id}.threshold`) }),
    };
  }
  return checks;
}

function requireMeasurements(value: unknown): PlayerFacingMeasurements {
  if (!isRecord(value)) throw new Error("measurements must be an object.");
  const result: PlayerFacingMeasurements = {};
  for (const key of ["silhouetteIoU", "aspectRatioDelta", "screenCoverage"] as const) {
    if (value[key] !== undefined) {
      const number = finiteNumber(value[key], `measurements.${key}`);
      if (key === "silhouetteIoU" || key === "screenCoverage") {
        if (number < 0 || number > 1) throw new Error(`measurements.${key} must be between 0 and 1.`);
      } else if (number < 0) {
        throw new Error("measurements.aspectRatioDelta must be 0 or greater.");
      }
      result[key] = number;
    }
  }
  return result;
}

function requireFile(value: unknown, label: string): PlayerFacingVerifiedFile {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return {
    path: nonEmpty(value.path, `${label}.path`),
    bytes: nonNegativeInteger(value.bytes, `${label}.bytes`),
    sha256: requireHash(value.sha256, `${label}.sha256`),
    verified: requireVerified(value.verified, `${label}.verified`),
  };
}

function requireViewport(value: unknown, label: string): PlayerFacingViewport {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return {
    width: positiveInteger(value.width, `${label}.width`),
    height: positiveInteger(value.height, `${label}.height`),
  };
}

function isAssetKind(value: unknown): value is AssetKind {
  return value === "3d-model"
    || value === "2d-image"
    || value === "sprite-atlas"
    || value === "spine-project"
    || value === "animation-clip";
}

function isDecision(value: unknown): value is PlayerFacingQualityDecision {
  return value === "PASS" || value === "PASS_WITH_FOLLOW_UP" || value === "NO_GO" || value === "NOT_EVALUATED";
}

function requireVerified(value: unknown, label: string): true {
  if (value !== true) throw new Error(`${label} must be true.`);
  return true;
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a 64-character hexadecimal hash.`);
  return value.toLowerCase();
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) throw new Error(`${label} must be non-empty text.`);
  return value.trim();
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function scalar(value: unknown, label: string): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  throw new Error(`${label} must be a scalar.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
