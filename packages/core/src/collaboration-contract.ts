export type AuditStatus = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";

export type RuntimeReviewStatus = "NOT_RUN" | "PASS" | "GAP" | "BLOCKED";

export type ProductReadiness =
  | "ASSET_READY"
  | "ASSET_CONDITIONAL"
  | "SCENE_GAP"
  | "PLAYER_FACING_READY"
  | "BLOCKED";

export const FRAME_MANIFEST_SCHEMA = "clunk.frame-manifest.v1" as const;

export type FrameHudState = "on" | "off" | "unknown";
export type FrameReviewStatus = "NOT_EVALUATED";
export type SceneGapSeverity = "blocker" | "major" | "minor";

export interface FrameViewport {
  width: number;
  height: number;
  dpr?: number;
}

export interface FrameManifestFrame {
  id: string;
  path: string;
  sha256?: string;
  viewport?: FrameViewport;
  renderer?: string;
  hud: FrameHudState;
  scene?: string;
  note?: string;
}

export interface SceneGapNote {
  id: string;
  severity: SceneGapSeverity;
  category: string;
  note: string;
  frameIds?: readonly string[];
}

export interface FrameManifest {
  schema: typeof FRAME_MANIFEST_SCHEMA;
  runId: string;
  sourceProject: string;
  sourceCommit: string;
  reviewStatus: FrameReviewStatus;
  frames: readonly FrameManifestFrame[];
  sceneGaps: readonly SceneGapNote[];
}

export interface CollaborationStatusInput {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  previousInputHash?: string;
}

export interface CollaborationStatus {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  readiness: ProductReadiness;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  stale: boolean;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requiredText(record: JsonRecord, key: string, label: string, maxLength = 240): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${label}.${key} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

function optionalText(record: JsonRecord, key: string, label: string, maxLength = 1000): string | undefined {
  if (record[key] === undefined || record[key] === null) return undefined;
  if (typeof record[key] !== "string" || record[key].length > maxLength) {
    throw new Error(`${label}.${key} must be a string of at most ${maxLength} characters`);
  }
  return record[key].trim();
}

function positiveNumber(record: JsonRecord, key: string, label: string, integer = false): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`${label}.${key} must be a positive ${integer ? "integer" : "number"}`);
  }
  return value;
}

function normalizeViewport(value: unknown, label: string): FrameViewport {
  const record = asRecord(value, label);
  const viewport: FrameViewport = {
    width: positiveNumber(record, "width", label, true),
    height: positiveNumber(record, "height", label, true),
  };
  if (record.dpr !== undefined) viewport.dpr = positiveNumber(record, "dpr", label);
  return viewport;
}

function normalizeFrame(value: unknown, index: number): FrameManifestFrame {
  const label = `frames[${index}]`;
  const record = asRecord(value, label);
  const hud = record.hud ?? "unknown";
  if (hud !== "on" && hud !== "off" && hud !== "unknown") {
    throw new Error(`${label}.hud must be on, off, or unknown`);
  }
  const frame: FrameManifestFrame = {
    id: requiredText(record, "id", label, 120),
    path: requiredText(record, "path", label, 1000),
    hud,
  };
  if (record.sha256 !== undefined) {
    const sha256 = requiredText(record, "sha256", label, 128).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${label}.sha256 must be a 64-character hexadecimal hash`);
    frame.sha256 = sha256;
  }
  if (record.viewport !== undefined) frame.viewport = normalizeViewport(record.viewport, `${label}.viewport`);
  const renderer = optionalText(record, "renderer", label, 120);
  if (renderer) frame.renderer = renderer;
  const scene = optionalText(record, "scene", label, 240);
  if (scene) frame.scene = scene;
  const note = optionalText(record, "note", label, 1000);
  if (note) frame.note = note;
  return frame;
}

function normalizeSceneGap(value: unknown, index: number): SceneGapNote {
  const label = `sceneGaps[${index}]`;
  const record = asRecord(value, label);
  const severity = record.severity;
  if (severity !== "blocker" && severity !== "major" && severity !== "minor") {
    throw new Error(`${label}.severity must be blocker, major, or minor`);
  }
  const gap: SceneGapNote = {
    id: requiredText(record, "id", label, 120),
    severity,
    category: requiredText(record, "category", label, 120),
    note: requiredText(record, "note", label, 2000),
  };
  if (record.frameIds !== undefined) {
    if (!Array.isArray(record.frameIds) || record.frameIds.length > 32) {
      throw new Error(`${label}.frameIds must be an array of at most 32 frame ids`);
    }
    const frameIds = record.frameIds.map((frameId, frameIndex) => {
      if (typeof frameId !== "string" || frameId.trim().length === 0 || frameId.length > 120) {
        throw new Error(`${label}.frameIds[${frameIndex}] must be a non-empty string`);
      }
      return frameId.trim();
    });
    if (new Set(frameIds).size !== frameIds.length) throw new Error(`${label}.frameIds must not contain duplicates`);
    gap.frameIds = frameIds;
  }
  return gap;
}

export function normalizeFrameManifest(value: unknown): FrameManifest {
  const record = asRecord(value, "manifest");
  if (record.schema !== FRAME_MANIFEST_SCHEMA) {
    throw new Error(`manifest.schema must be ${FRAME_MANIFEST_SCHEMA}`);
  }
  if (record.reviewStatus !== "NOT_EVALUATED") {
    throw new Error("manifest.reviewStatus must be NOT_EVALUATED");
  }
  if (!Array.isArray(record.frames) || record.frames.length === 0 || record.frames.length > 128) {
    throw new Error("manifest.frames must contain between 1 and 128 frames");
  }
  if (!Array.isArray(record.sceneGaps) || record.sceneGaps.length > 128) {
    throw new Error("manifest.sceneGaps must be an array of at most 128 notes");
  }
  const frames = record.frames.map(normalizeFrame);
  const frameIds = frames.map((frame) => frame.id);
  if (new Set(frameIds).size !== frameIds.length) throw new Error("manifest.frames must not contain duplicate ids");
  const sceneGaps = record.sceneGaps.map(normalizeSceneGap);
  for (const gap of sceneGaps) {
    for (const frameId of gap.frameIds ?? []) {
      if (!frameIds.includes(frameId)) throw new Error(`scene gap references unknown frame ${frameId}`);
    }
  }
  return {
    schema: FRAME_MANIFEST_SCHEMA,
    runId: requiredText(record, "runId", "manifest", 160),
    sourceProject: requiredText(record, "sourceProject", "manifest", 160),
    sourceCommit: requiredText(record, "sourceCommit", "manifest", 160),
    reviewStatus: "NOT_EVALUATED",
    frames,
    sceneGaps,
  };
}

export function resolveCollaborationStatus(input: CollaborationStatusInput): CollaborationStatus {
  let readiness: ProductReadiness;
  if (input.assetAudit === "FAIL" || input.assetAudit === "BLOCKED" || input.visualRuntime === "BLOCKED") {
    readiness = "BLOCKED";
  } else if (input.assetAudit !== "PASS") {
    readiness = "ASSET_CONDITIONAL";
  } else if (input.visualRuntime === "GAP") {
    readiness = "SCENE_GAP";
  } else if (input.visualRuntime === "PASS") {
    readiness = "PLAYER_FACING_READY";
  } else {
    readiness = "ASSET_READY";
  }

  return {
    assetAudit: input.assetAudit,
    visualRuntime: input.visualRuntime,
    readiness,
    profileId: input.profileId,
    ...(input.baseProfileId ? { baseProfileId: input.baseProfileId } : {}),
    ruleSetId: input.ruleSetId,
    inputHash: input.inputHash,
    stale: Boolean(input.previousInputHash && input.previousInputHash !== input.inputHash),
  };
}
