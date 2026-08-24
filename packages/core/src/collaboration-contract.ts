export type AuditStatus = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";

export type RuntimeReviewStatus = "NOT_RUN" | "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE";

export type ProductReadiness =
  | "ASSET_READY"
  | "ASSET_CONDITIONAL"
  | "SCENE_GAP"
  | "PLAYER_FACING_READY"
  | "BLOCKED";

/** Stable machine-readable explanation for the product readiness enum. */
export type CollaborationReadinessReason =
  | "STATIC_AUDIT_NOT_RUN"
  | "STATIC_AUDIT_FAILED"
  | "STATIC_AUDIT_BLOCKED"
  | "VISUAL_RUNTIME_NOT_EVALUATED"
  | "ENGINE_ENVIRONMENT_UNAVAILABLE"
  | "PLAYER_FACING_REVIEW_INPUT_INCOMPLETE"
  | "PLAYER_FACING_SCENE_GAP"
  | "VISUAL_RUNTIME_BLOCKED"
  | "PLAYER_FACING_REVIEW_PASS";

export const FRAME_MANIFEST_SCHEMA = "clunk.frame-manifest.v1" as const;

export type FrameHudState = "on" | "off" | "unknown";
export type FrameReviewStatus = "NOT_EVALUATED";
export type FrameManifestVisualRuntimeStatus = "GAP";
export type FrameManifestPlayerFacingStatus = "NOT_EVALUATED";
export type NumericRuntimeCheckStatus = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED" | "UNAVAILABLE";
export type SceneGapSeverity = "blocker" | "major" | "minor";
export type SceneGapOwnership = "asset" | "runtime" | "scene" | "camera" | "environment" | "mixed" | "unknown";
export const PLAYER_FACING_SCENE_REVIEW_SCHEMA = "clunk.player-facing-scene-review.v1" as const;
export type SceneReviewDisposition = "PASS_WITH_FOLLOW_UP" | "NO_GO" | "UNAVAILABLE";
export type EvidencePrescriptionPriority = "P1" | "P2" | "P3";
export type FrameManifestWriteMode = "replace" | "append";
export type FrameManifestAssetKind = "3d-model" | "2d-image" | "sprite-atlas" | "spine-project" | "animation-clip";
export type FrameManifestAssetOrigin = "file" | "procedural" | "runtime-generated";
export type FrameManifestAssetOwnership = "asset" | "runtime" | "unknown";
export type FrameManifestAssetRuntimeUsage = "USED_IN_FRAME" | "NOT_USED_IN_FRAME" | "UNKNOWN";
export type FrameManifestAssetEvidenceStatus = "READY" | "CONDITIONAL" | "BLOCKED" | "UNSUPPORTED" | "ENVIRONMENT_UNAVAILABLE";
export type FrameManifestNumericContractStatus = "PASS" | "FAIL" | "UNAVAILABLE";

export interface FrameViewport {
  width: number;
  height: number;
  dpr?: number;
}

export interface FrameConsoleSummary {
  errors: number;
  warnings: number;
}

export interface FrameManifestFrame {
  id: string;
  path: string;
  sha256?: string;
  bytes?: number;
  frameSourceCommit?: string;
  viewport?: FrameViewport;
  renderer?: string;
  /** Stable id from the producer's camera/distance evaluation profile. */
  distanceBandId?: string;
  distanceM?: number;
  hud: FrameHudState;
  shippedPath?: boolean;
  console?: FrameConsoleSummary;
  scene?: string;
  note?: string;
}

export interface SceneGapNote {
  id: string;
  severity: SceneGapSeverity;
  category: string;
  note: string;
  /** Optional enriched scene-review ownership; legacy v1 notes may omit it. */
  ownership?: SceneGapOwnership;
  affectedScene?: string;
  affectedAssetIds?: readonly string[];
  nextStep?: string;
  evidence?: SceneGapEvidence;
  frameIds?: readonly string[];
}

export interface SceneGapEvidence {
  path: string;
  sha256: string;
  bytes?: number;
}

export interface EvidencePrescription {
  id: string;
  kind: string;
  status: "NON_BLOCKING";
  priority: EvidencePrescriptionPriority;
  observation: string;
  action: string;
  frameIds?: readonly string[];
}

export type RuntimeCheckValue = string | number | boolean;

export interface FrameRuntimeCheck {
  id: string;
  kind: string;
  status: NumericRuntimeCheckStatus;
  renderer?: string;
  evidencePath?: string;
  frameIds?: readonly string[];
  checks: Readonly<Record<string, RuntimeCheckValue>>;
}

export interface FrameManifestAssetInspection {
  id: string;
  sourcePath: string;
  inputHash: string;
  assetKind: FrameManifestAssetKind;
  targetProfileId: string;
  inspectionRunId: string;
  evidenceStatus: FrameManifestAssetEvidenceStatus;
  productionReady: boolean;
  /** `file` is a byte artifact; other origins must carry source provenance. */
  origin: FrameManifestAssetOrigin;
  /** Explicit ownership of the observed surface; never infer from textureCount alone. */
  ownership?: FrameManifestAssetOwnership;
  /** Do not infer loader usage from sourcePath or frameIds; producers must state it. */
  runtimeUsage?: FrameManifestAssetRuntimeUsage;
  provenance?: FrameManifestAssetProvenance;
  frameIds?: readonly string[];
  qualityWarningIds?: readonly string[];
  numericContract?: FrameManifestNumericContract;
}

export interface FrameManifestAssetProvenance {
  sourceRef: string;
  sourceCommit?: string;
  generator?: string;
  recipeId?: string;
}

export type NumericContractValue = string | number | boolean;

export interface FrameManifestNumericContract {
  status: FrameManifestNumericContractStatus;
  valid?: boolean;
  score?: number;
  threshold?: number;
  hardBlockerCount?: number;
  findingIds?: readonly string[];
  observations?: Readonly<Record<string, NumericContractValue>>;
}

export interface FrameManifest {
  schema: typeof FRAME_MANIFEST_SCHEMA;
  runId: string;
  sourceProject: string;
  sourceCommit: string;
  reviewStatus: FrameReviewStatus;
  /** Evidence defaults to an open visual gap; status promotion belongs to the thread review contract. */
  visualRuntime: FrameManifestVisualRuntimeStatus;
  playerFacing: FrameManifestPlayerFacingStatus;
  frames: readonly FrameManifestFrame[];
  sceneGaps: readonly SceneGapNote[];
  prescriptions?: readonly EvidencePrescription[];
  runtimeChecks?: readonly FrameRuntimeCheck[];
  assetInspections?: readonly FrameManifestAssetInspection[];
}

export interface PlayerFacingSceneReview {
  schema: typeof PLAYER_FACING_SCENE_REVIEW_SCHEMA;
  status: SceneReviewDisposition;
  readiness: "conditional" | "blocked";
  readinessReason: "PLAYER_FACING_SCENE_GAP" | "PLAYER_FACING_REVIEW_INPUT_INCOMPLETE" | "VISUAL_RUNTIME_NOT_EVALUATED";
  reviewStatus: "NOT_EVALUATED";
  visualRuntime: "GAP";
  playerFacing: "NOT_EVALUATED";
  humanReview: "PENDING";
  source: { runId: string; sourceProject: string; sourceCommit: string };
  captureSummary: {
    totalFrames: number;
    shippedFrames: number;
    consoleErrors: number;
    consoleWarnings: number;
  };
  sceneGaps: readonly SceneGapNote[];
  linkedAssets: readonly {
    id: string;
    sourcePath: string;
    inputHash: string;
    assetKind: FrameManifestAssetKind;
    origin: FrameManifestAssetOrigin;
    ownership: FrameManifestAssetOwnership;
    evidenceStatus: FrameManifestAssetEvidenceStatus;
    runtimeUsage: FrameManifestAssetRuntimeUsage;
    numericContract?: Pick<FrameManifestNumericContract, "status" | "score" | "hardBlockerCount">;
  }[];
  issues?: readonly string[];
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
  readinessReason: CollaborationReadinessReason;
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

function nonNegativeInteger(record: JsonRecord, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label}.${key} must be a non-negative integer`);
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
  if (record.bytes !== undefined) frame.bytes = positiveNumber(record, "bytes", label, true);
  const frameSourceCommit = optionalText(record, "frameSourceCommit", label, 160);
  if (frameSourceCommit) frame.frameSourceCommit = frameSourceCommit;
  const distanceBandId = optionalText(record, "distanceBandId", label, 120);
  if (distanceBandId) frame.distanceBandId = distanceBandId;
  if (record.distanceM !== undefined) frame.distanceM = positiveNumber(record, "distanceM", label);
  if (record.viewport !== undefined) frame.viewport = normalizeViewport(record.viewport, `${label}.viewport`);
  const renderer = optionalText(record, "renderer", label, 120);
  if (renderer) frame.renderer = renderer;
  if (record.shippedPath !== undefined) {
    if (typeof record.shippedPath !== "boolean") throw new Error(`${label}.shippedPath must be a boolean`);
    frame.shippedPath = record.shippedPath;
  }
  if (record.console !== undefined) {
    const consoleSummary = asRecord(record.console, `${label}.console`);
    frame.console = {
      errors: nonNegativeInteger(consoleSummary, "errors", `${label}.console`),
      warnings: nonNegativeInteger(consoleSummary, "warnings", `${label}.console`),
    };
  }
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
  const ownership = record.ownership;
  if (ownership !== undefined) {
    if (ownership !== "asset" && ownership !== "runtime" && ownership !== "scene" && ownership !== "camera" && ownership !== "environment" && ownership !== "mixed" && ownership !== "unknown") {
      throw new Error(`${label}.ownership is not supported`);
    }
    gap.ownership = ownership;
  }
  const affectedScene = optionalText(record, "affectedScene", label, 240);
  if (affectedScene) gap.affectedScene = affectedScene;
  const affectedAssetIds = normalizeStringArray(record.affectedAssetIds, `${label}.affectedAssetIds`, 64);
  if (affectedAssetIds) gap.affectedAssetIds = affectedAssetIds;
  const nextStep = optionalText(record, "nextStep", label, 2000);
  if (nextStep) gap.nextStep = nextStep;
  if (record.evidence !== undefined) gap.evidence = normalizeSceneGapEvidence(record.evidence, `${label}.evidence`);
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

function normalizeSceneGapEvidence(value: unknown, label: string): SceneGapEvidence {
  const record = asRecord(value, label);
  const sha256 = requiredText(record, "sha256", label, 128).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${label}.sha256 must be a 64-character hexadecimal hash`);
  const evidence: SceneGapEvidence = {
    path: requiredText(record, "path", label, 1000),
    sha256,
  };
  if (record.bytes !== undefined) evidence.bytes = nonNegativeInteger(record, "bytes", label);
  return evidence;
}

function normalizePrescription(value: unknown, index: number): EvidencePrescription {
  const label = `prescriptions[${index}]`;
  const record = asRecord(value, label);
  const status = record.status;
  const priority = record.priority;
  if (status !== "NON_BLOCKING") throw new Error(`${label}.status must be NON_BLOCKING`);
  if (priority !== "P1" && priority !== "P2" && priority !== "P3") {
    throw new Error(`${label}.priority must be P1, P2, or P3`);
  }
  const prescription: EvidencePrescription = {
    id: requiredText(record, "id", label, 120),
    kind: requiredText(record, "kind", label, 120),
    status: "NON_BLOCKING",
    priority,
    observation: requiredText(record, "observation", label, 2000),
    action: requiredText(record, "action", label, 2000),
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
    prescription.frameIds = frameIds;
  }
  return prescription;
}

function normalizeRuntimeCheck(value: unknown, index: number): FrameRuntimeCheck {
  const label = `runtimeChecks[${index}]`;
  const record = asRecord(value, label);
  const status = record.status;
  if (status !== "NOT_RUN" && status !== "PASS" && status !== "FAIL" && status !== "BLOCKED" && status !== "UNAVAILABLE") {
    throw new Error(`${label}.status is not supported`);
  }
  const checksRecord = asRecord(record.checks, `${label}.checks`);
  const checks: Record<string, RuntimeCheckValue> = {};
  for (const [key, rawValue] of Object.entries(checksRecord)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(key)) throw new Error(`${label}.checks has an invalid key`);
    if (typeof rawValue === "boolean") checks[key] = rawValue;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) checks[key] = rawValue;
    else if (typeof rawValue === "string" && rawValue.trim().length > 0 && rawValue.length <= 240) checks[key] = rawValue.trim();
    else throw new Error(`${label}.checks.${key} must be a finite number, boolean, or short string`);
  }
  if (Object.keys(checks).length === 0) throw new Error(`${label}.checks must contain at least one numeric contract value`);
  if (checks.poseFocusCoverage !== undefined && (typeof checks.poseFocusCoverage !== "number" || checks.poseFocusCoverage < 0 || checks.poseFocusCoverage > 1)) {
    throw new Error(`${label}.checks.poseFocusCoverage must be between 0 and 1`);
  }
  const runtimeCheck: FrameRuntimeCheck = {
    id: requiredText(record, "id", label, 160),
    kind: requiredText(record, "kind", label, 120),
    status,
    checks,
  };
  const renderer = optionalText(record, "renderer", label, 120);
  if (renderer) runtimeCheck.renderer = renderer;
  const evidencePath = optionalText(record, "evidencePath", label, 1000);
  if (evidencePath) runtimeCheck.evidencePath = evidencePath;
  const frameIds = normalizeStringArray(record.frameIds, `${label}.frameIds`, 32);
  if (frameIds) runtimeCheck.frameIds = frameIds;
  return runtimeCheck;
}

function normalizeAssetInspection(value: unknown, index: number): FrameManifestAssetInspection {
  const label = `assetInspections[${index}]`;
  const record = asRecord(value, label);
  const assetKind = record.assetKind;
  const evidenceStatus = record.evidenceStatus;
  if (assetKind !== "3d-model" && assetKind !== "2d-image" && assetKind !== "sprite-atlas" && assetKind !== "spine-project" && assetKind !== "animation-clip") {
    throw new Error(`${label}.assetKind is not supported`);
  }
  if (evidenceStatus !== "READY" && evidenceStatus !== "CONDITIONAL" && evidenceStatus !== "BLOCKED" && evidenceStatus !== "UNSUPPORTED" && evidenceStatus !== "ENVIRONMENT_UNAVAILABLE") {
    throw new Error(`${label}.evidenceStatus is not supported`);
  }
  const origin = record.origin ?? "file";
  if (origin !== "file" && origin !== "procedural" && origin !== "runtime-generated") {
    throw new Error(`${label}.origin must be file, procedural, or runtime-generated`);
  }
  const inputHash = requiredText(record, "inputHash", label, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(inputHash)) throw new Error(`${label}.inputHash must be a 64-character hexadecimal hash`);
  const inspection: FrameManifestAssetInspection = {
    id: requiredText(record, "id", label, 120),
    sourcePath: requiredText(record, "sourcePath", label, 1000),
    inputHash,
    assetKind,
    targetProfileId: requiredText(record, "targetProfileId", label, 160),
    inspectionRunId: requiredText(record, "inspectionRunId", label, 160),
    evidenceStatus,
    productionReady: record.productionReady === true,
    origin,
  };
  if (record.productionReady !== true && record.productionReady !== false) throw new Error(`${label}.productionReady must be a boolean`);
  const runtimeUsage = record.runtimeUsage;
  if (runtimeUsage !== undefined) {
    if (runtimeUsage !== "USED_IN_FRAME" && runtimeUsage !== "NOT_USED_IN_FRAME" && runtimeUsage !== "UNKNOWN") {
      throw new Error(`${label}.runtimeUsage must be USED_IN_FRAME, NOT_USED_IN_FRAME, or UNKNOWN`);
    }
    inspection.runtimeUsage = runtimeUsage;
  }
  const ownership = record.ownership;
  if (ownership !== undefined) {
    if (ownership !== "asset" && ownership !== "runtime" && ownership !== "unknown") {
      throw new Error(`${label}.ownership must be asset, runtime, or unknown`);
    }
    inspection.ownership = ownership;
  }
  if (record.provenance !== undefined) inspection.provenance = normalizeAssetProvenance(record.provenance, `${label}.provenance`);
  if (origin !== "file" && !inspection.provenance) {
    throw new Error(`${label}.provenance.sourceRef is required for ${origin} assets`);
  }
  const frameIds = normalizeStringArray(record.frameIds, `${label}.frameIds`, 32);
  if (frameIds) inspection.frameIds = frameIds;
  const qualityWarningIds = normalizeStringArray(record.qualityWarningIds, `${label}.qualityWarningIds`, 128);
  if (qualityWarningIds) inspection.qualityWarningIds = qualityWarningIds;
  if (record.numericContract !== undefined) inspection.numericContract = normalizeNumericContract(record.numericContract, `${label}.numericContract`);
  return inspection;
}

function normalizeAssetProvenance(value: unknown, label: string): FrameManifestAssetProvenance {
  const record = asRecord(value, label);
  const provenance: FrameManifestAssetProvenance = {
    sourceRef: requiredText(record, "sourceRef", label, 1000),
  };
  const sourceCommit = optionalText(record, "sourceCommit", label, 160);
  if (sourceCommit) provenance.sourceCommit = sourceCommit;
  const generator = optionalText(record, "generator", label, 240);
  if (generator) provenance.generator = generator;
  const recipeId = optionalText(record, "recipeId", label, 160);
  if (recipeId) provenance.recipeId = recipeId;
  return provenance;
}

function normalizeNumericContract(value: unknown, label: string): FrameManifestNumericContract {
  const record = asRecord(value, label);
  const status = record.status;
  if (status !== "PASS" && status !== "FAIL" && status !== "UNAVAILABLE") {
    throw new Error(`${label}.status must be PASS, FAIL, or UNAVAILABLE`);
  }
  const contract: FrameManifestNumericContract = { status };
  if (record.valid !== undefined) {
    if (typeof record.valid !== "boolean") throw new Error(`${label}.valid must be a boolean`);
    contract.valid = record.valid;
  }
  for (const key of ["score", "threshold"] as const) {
    if (record[key] !== undefined) {
      if (typeof record[key] !== "number" || !Number.isFinite(record[key]) || record[key] < 0) {
        throw new Error(`${label}.${key} must be a non-negative number`);
      }
      contract[key] = record[key];
    }
  }
  if (record.hardBlockerCount !== undefined) {
    if (typeof record.hardBlockerCount !== "number" || !Number.isInteger(record.hardBlockerCount) || record.hardBlockerCount < 0) {
      throw new Error(`${label}.hardBlockerCount must be a non-negative integer`);
    }
    contract.hardBlockerCount = record.hardBlockerCount;
  }
  const findingIds = normalizeStringArray(record.findingIds, `${label}.findingIds`, 128);
  if (findingIds) contract.findingIds = findingIds;
  if (record.observations !== undefined) {
    const observations = asRecord(record.observations, `${label}.observations`);
    const normalized: Record<string, NumericContractValue> = {};
    for (const [key, rawValue] of Object.entries(observations)) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(key)) throw new Error(`${label}.observations has an invalid key`);
      if (typeof rawValue === "boolean") normalized[key] = rawValue;
      else if (typeof rawValue === "number" && Number.isFinite(rawValue)) normalized[key] = rawValue;
      else if (typeof rawValue === "string" && rawValue.trim().length > 0 && rawValue.length <= 240) normalized[key] = rawValue.trim();
      else throw new Error(`${label}.observations.${key} must be a finite number, boolean, or short string`);
    }
    if (Object.keys(normalized).length === 0) throw new Error(`${label}.observations must contain at least one value`);
    contract.observations = normalized;
  }
  return contract;
}

function normalizeStringArray(value: unknown, label: string, maxLength: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxLength) throw new Error(`${label} must be an array of at most ${maxLength} ids`);
  const values = value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0 || item.length > 160) throw new Error(`${label}[${index}] must be a non-empty string`);
    return item.trim();
  });
  if (new Set(values).size !== values.length) throw new Error(`${label} must not contain duplicates`);
  return values;
}

export function normalizeFrameManifest(value: unknown): FrameManifest {
  const record = asRecord(value, "manifest");
  if (record.schema !== FRAME_MANIFEST_SCHEMA) {
    throw new Error(`manifest.schema must be ${FRAME_MANIFEST_SCHEMA}`);
  }
  if (record.reviewStatus !== "NOT_EVALUATED") {
    throw new Error("manifest.reviewStatus must be NOT_EVALUATED");
  }
  if (record.visualRuntime !== undefined && record.visualRuntime !== "GAP") {
    throw new Error("manifest.visualRuntime must be GAP until human review is implemented");
  }
  if (record.playerFacing !== undefined && record.playerFacing !== "NOT_EVALUATED") {
    throw new Error("manifest.playerFacing must be NOT_EVALUATED");
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
  const prescriptions = record.prescriptions === undefined
    ? undefined
    : (!Array.isArray(record.prescriptions) || record.prescriptions.length > 128
      ? (() => { throw new Error("manifest.prescriptions must be an array of at most 128 items"); })()
      : record.prescriptions.map(normalizePrescription));
  const runtimeChecks = record.runtimeChecks === undefined
    ? undefined
    : (!Array.isArray(record.runtimeChecks) || record.runtimeChecks.length > 128
      ? (() => { throw new Error("manifest.runtimeChecks must be an array of at most 128 items"); })()
      : record.runtimeChecks.map(normalizeRuntimeCheck));
  const assetInspections = record.assetInspections === undefined
    ? undefined
    : (!Array.isArray(record.assetInspections) || record.assetInspections.length > 128
      ? (() => { throw new Error("manifest.assetInspections must be an array of at most 128 items"); })()
      : record.assetInspections.map(normalizeAssetInspection));
  for (const gap of sceneGaps) {
    for (const frameId of gap.frameIds ?? []) {
      if (!frameIds.includes(frameId)) throw new Error(`scene gap references unknown frame ${frameId}`);
    }
  }
  for (const prescription of prescriptions ?? []) {
    for (const frameId of prescription.frameIds ?? []) {
      if (!frameIds.includes(frameId)) throw new Error(`prescription references unknown frame ${frameId}`);
    }
  }
  const runtimeCheckIds = (runtimeChecks ?? []).map((check) => check.id);
  if (new Set(runtimeCheckIds).size !== runtimeCheckIds.length) throw new Error("manifest.runtimeChecks must not contain duplicate ids");
  for (const check of runtimeChecks ?? []) {
    for (const frameId of check.frameIds ?? []) {
      if (!frameIds.includes(frameId)) throw new Error(`runtime check references unknown frame ${frameId}`);
    }
  }
  const assetInspectionIds = (assetInspections ?? []).map((inspection) => inspection.id);
  if (new Set(assetInspectionIds).size !== assetInspectionIds.length) throw new Error("manifest.assetInspections must not contain duplicate ids");
  for (const inspection of assetInspections ?? []) {
    for (const frameId of inspection.frameIds ?? []) {
      if (!frameIds.includes(frameId)) throw new Error(`asset inspection references unknown frame ${frameId}`);
    }
  }
  return {
    schema: FRAME_MANIFEST_SCHEMA,
    runId: requiredText(record, "runId", "manifest", 160),
    sourceProject: requiredText(record, "sourceProject", "manifest", 160),
    sourceCommit: requiredText(record, "sourceCommit", "manifest", 160),
    reviewStatus: "NOT_EVALUATED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    frames,
    sceneGaps,
    ...(prescriptions ? { prescriptions } : {}),
    ...(runtimeChecks ? { runtimeChecks } : {}),
    ...(assetInspections ? { assetInspections } : {}),
  };
}

/**
 * Evaluate the evidence contract for a player-facing scene review.
 *
 * This is deliberately not a renderer or computer-vision approval. It checks that a
 * producer supplied a real shipped capture, linked hashes, ownership, and an actionable
 * scene note. The returned visual verdict remains GAP/NOT_EVALUATED until a human review.
 */
export function evaluatePlayerFacingSceneReview(manifest: FrameManifest): PlayerFacingSceneReview {
  const shippedFrames = manifest.frames.filter((frame) => frame.shippedPath === true);
  const frameById = new Map(manifest.frames.map((frame) => [frame.id, frame]));
  const assetById = new Map((manifest.assetInspections ?? []).map((asset) => [asset.id, asset]));
  const issues: string[] = [];

  if (shippedFrames.length === 0) issues.push("no shippedPath frame was submitted");
  for (const gap of manifest.sceneGaps) {
    if (!gap.ownership) issues.push(`sceneGaps.${gap.id}.ownership is required for scene review`);
    if (!gap.nextStep) issues.push(`sceneGaps.${gap.id}.nextStep is required for scene review`);
    if (!gap.affectedScene && !(gap.affectedAssetIds && gap.affectedAssetIds.length > 0)) {
      issues.push(`sceneGaps.${gap.id} must identify affectedScene or affectedAssetIds`);
    }
    if (!gap.evidence) issues.push(`sceneGaps.${gap.id}.evidence with path and sha256 is required for scene review`);
    for (const assetId of gap.affectedAssetIds ?? []) {
      if (!assetById.has(assetId)) issues.push(`sceneGaps.${gap.id} references unknown asset ${assetId}`);
    }
    for (const frameId of gap.frameIds ?? []) {
      const frame = frameById.get(frameId);
      if (!frame) continue;
      if (frame.shippedPath !== true || !frame.sha256 || frame.bytes === undefined || !frame.viewport || !frame.renderer || !frame.console) {
        issues.push(`sceneGaps.${gap.id} frame ${frameId} lacks shipped capture metadata`);
      }
    }
  }

  const knownEvidence = new Map<string, { sha256?: string; bytes?: number }>();
  for (const frame of manifest.frames) knownEvidence.set(frame.path, { sha256: frame.sha256, bytes: frame.bytes });
  for (const check of manifest.runtimeChecks ?? []) {
    if (check.evidencePath) knownEvidence.set(check.evidencePath, {});
  }
  for (const asset of manifest.assetInspections ?? []) knownEvidence.set(asset.sourcePath, { sha256: asset.inputHash });
  for (const gap of manifest.sceneGaps) {
    if (!gap.evidence) continue;
    const linked = knownEvidence.get(gap.evidence.path);
    if (!linked) issues.push(`sceneGaps.${gap.id}.evidence.path is not linked to a frame, runtime check, or asset`);
    else if (linked.sha256 && linked.sha256 !== gap.evidence.sha256) issues.push(`sceneGaps.${gap.id}.evidence.sha256 does not match its linked source`);
    else if (linked.bytes !== undefined && gap.evidence.bytes !== undefined && linked.bytes !== gap.evidence.bytes) issues.push(`sceneGaps.${gap.id}.evidence.bytes does not match its linked source`);
  }

  const status: SceneReviewDisposition = issues.length > 0
    ? "UNAVAILABLE"
    : manifest.sceneGaps.some((gap) => gap.severity === "blocker" || gap.severity === "major")
      ? "NO_GO"
      : "PASS_WITH_FOLLOW_UP";
  const linkedAssets = (manifest.assetInspections ?? []).map((asset) => ({
    id: asset.id,
    sourcePath: asset.sourcePath,
    inputHash: asset.inputHash,
    assetKind: asset.assetKind,
    origin: asset.origin,
    ownership: asset.ownership ?? "unknown",
    evidenceStatus: asset.evidenceStatus,
    runtimeUsage: asset.runtimeUsage ?? "UNKNOWN" as const,
    ...(asset.numericContract
      ? { numericContract: {
        status: asset.numericContract.status,
        ...(asset.numericContract.score !== undefined ? { score: asset.numericContract.score } : {}),
        ...(asset.numericContract.hardBlockerCount !== undefined ? { hardBlockerCount: asset.numericContract.hardBlockerCount } : {}),
      } }
      : {}),
  }));
  const consoleErrors = manifest.frames.reduce((total, frame) => total + (frame.console?.errors ?? 0), 0);
  const consoleWarnings = manifest.frames.reduce((total, frame) => total + (frame.console?.warnings ?? 0), 0);
  return {
    schema: PLAYER_FACING_SCENE_REVIEW_SCHEMA,
    status,
    readiness: "conditional",
    readinessReason: issues.length > 0
      ? "PLAYER_FACING_REVIEW_INPUT_INCOMPLETE"
      : manifest.sceneGaps.length > 0
        ? "PLAYER_FACING_SCENE_GAP"
        : "VISUAL_RUNTIME_NOT_EVALUATED",
    reviewStatus: "NOT_EVALUATED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanReview: "PENDING",
    source: { runId: manifest.runId, sourceProject: manifest.sourceProject, sourceCommit: manifest.sourceCommit },
    captureSummary: {
      totalFrames: manifest.frames.length,
      shippedFrames: shippedFrames.length,
      consoleErrors,
      consoleWarnings,
    },
    sceneGaps: manifest.sceneGaps,
    linkedAssets,
    ...(issues.length > 0 ? { issues } : {}),
  };
}

/**
 * Merge a new normalized frame snapshot into the current collaboration evidence.
 *
 * `replace` is an explicit full-snapshot replacement. `append` keeps existing items,
 * upserts incoming items by their stable `id`, and rejects a cross-run merge so one
 * manifest cannot silently mix unrelated browser runs. Incoming top-level source
 * metadata is authoritative for both modes.
 */
export function mergeFrameManifestEvidence(
  current: FrameManifest | null | undefined,
  incoming: FrameManifest,
  mode: FrameManifestWriteMode = "replace",
): FrameManifest {
  if (mode === "replace" || !current) return incoming;
  if (current.schema !== incoming.schema) {
    throw new Error("Frame manifest append requires the same schema.");
  }
  if (current.runId !== incoming.runId || current.sourceProject !== incoming.sourceProject) {
    throw new Error("Frame manifest append requires the same runId and sourceProject.");
  }

  return normalizeFrameManifest({
    ...incoming,
    frames: upsertById(current.frames, incoming.frames),
    sceneGaps: upsertById(current.sceneGaps, incoming.sceneGaps),
    ...(current.prescriptions || incoming.prescriptions
      ? { prescriptions: upsertById(current.prescriptions ?? [], incoming.prescriptions ?? []) }
      : {}),
    ...(current.runtimeChecks || incoming.runtimeChecks
      ? { runtimeChecks: upsertById(current.runtimeChecks ?? [], incoming.runtimeChecks ?? []) }
      : {}),
    ...(current.assetInspections || incoming.assetInspections
      ? { assetInspections: upsertById(current.assetInspections ?? [], incoming.assetInspections ?? []) }
      : {}),
  });
}

function upsertById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const merged = [...current];
  const indexById = new Map(merged.map((item, index) => [item.id, index]));
  for (const item of incoming) {
    const index = indexById.get(item.id);
    if (index === undefined) {
      indexById.set(item.id, merged.length);
      merged.push(item);
    } else {
      merged[index] = item;
    }
  }
  return merged;
}

export function resolveCollaborationStatus(input: CollaborationStatusInput): CollaborationStatus {
  let readiness: ProductReadiness;
  let readinessReason: CollaborationReadinessReason;
  if (input.assetAudit === "FAIL" || input.assetAudit === "BLOCKED" || input.visualRuntime === "BLOCKED") {
    readiness = "BLOCKED";
    readinessReason = input.assetAudit === "BLOCKED"
      ? "STATIC_AUDIT_BLOCKED"
      : input.assetAudit === "FAIL"
        ? "STATIC_AUDIT_FAILED"
        : "VISUAL_RUNTIME_BLOCKED";
  } else if (input.assetAudit !== "PASS") {
    readiness = "ASSET_CONDITIONAL";
    readinessReason = "STATIC_AUDIT_NOT_RUN";
  } else if (input.visualRuntime === "GAP") {
    readiness = "SCENE_GAP";
    readinessReason = "PLAYER_FACING_SCENE_GAP";
  } else if (input.visualRuntime === "UNAVAILABLE") {
    readiness = "ASSET_READY";
    readinessReason = "ENGINE_ENVIRONMENT_UNAVAILABLE";
  } else if (input.visualRuntime === "PASS") {
    readiness = "PLAYER_FACING_READY";
    readinessReason = "PLAYER_FACING_REVIEW_PASS";
  } else {
    readiness = "ASSET_READY";
    readinessReason = "VISUAL_RUNTIME_NOT_EVALUATED";
  }

  return {
    assetAudit: input.assetAudit,
    visualRuntime: input.visualRuntime,
    readiness,
    readinessReason,
    profileId: input.profileId,
    ...(input.baseProfileId ? { baseProfileId: input.baseProfileId } : {}),
    ruleSetId: input.ruleSetId,
    inputHash: input.inputHash,
    stale: Boolean(input.previousInputHash && input.previousInputHash !== input.inputHash),
  };
}

/**
 * Presentation-level label for product surfaces. Static PASS with an unreviewed or gapped
 * player-facing surface is conditional; only an explicit runtime PASS is ready.
 */
export type CollaborationReadinessLevel = "ready" | "conditional" | "blocked";

export function collaborationReadinessLevel(status: Pick<CollaborationStatus, "readiness">): CollaborationReadinessLevel {
  if (status.readiness === "BLOCKED") return "blocked";
  if (status.readiness === "PLAYER_FACING_READY") return "ready";
  return "conditional";
}
