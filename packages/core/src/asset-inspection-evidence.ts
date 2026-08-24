/*
 * clunk.asset-inspection-evidence.v2
 *
 * This envelope is intentionally additive to the legacy inspect/validate report. It carries the
 * provenance needed to reproduce one inspection and the evidence needed to discuss player-facing
 * quality, without ever promoting a structural score to visual approval.
 */

import {
  CORE_VERSION,
  sha256Hex,
  stableStringify,
  type AssetPolicy,
  type CustomProfile,
  type FindingCategory,
  type InspectionReport,
  type QualityPolicy,
  type QualityPolicyMode,
  type Severity,
} from "./index";

export const ASSET_INSPECTION_EVIDENCE_SCHEMA = "clunk.asset-inspection-evidence.v2" as const;
export const ASSET_INSPECTION_EVIDENCE_VERSION = "2" as const;

export type AssetInspectionEvidenceKind = "CONTRACT_FIXTURE" | "PLAYER_FACING_CAPTURE";
export type AssetInspectionOperation = "inspect" | "validate" | "passport";
export type EvidenceEnforcement = QualityPolicyMode;
export type EvidenceOwnership = "asset" | "runtime" | "unknown";
export type StructuralEvidenceStatus = "PASS" | "FAIL" | "BLOCKED" | "CONDITIONAL" | "UNAVAILABLE";
export type VisualRuntimeStatus = "APPROVED" | "GAP" | "NOT_EVALUATED" | "UNAVAILABLE";
export type PlayerFacingStatus = "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "NOT_EVALUATED";
export type HumanDecision = "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "NOT_EVALUATED";
export type EvidenceReviewStatus = "EVALUATED" | "PENDING" | "NOT_EVALUATED";
export type EvidenceReadiness = "ready" | "conditional" | "blocked" | "unavailable";

export interface AssetInspectionIdentityV2 {
  inputHash: string;
  resultDigest: string;
  byteLength: number;
  coreBuildId: string;
  ruleSetId: string;
  ruleSetVersion: string;
  profileId: string;
  profileHash: string;
  inspectionRunId: string;
}

export interface AssetSourceRefV2 {
  path: string;
  fileName: string;
  bytes: number;
  sha256: string;
}

export interface SourceOutputRelationV2 {
  kind: "SOURCE" | "OUTPUT" | "SOURCE_OUTPUT_PAIR";
  sourceHash: string;
  sourceInspectionDigest?: string;
  outputHash?: string;
  outputInspectionDigest?: string;
}

export interface EvidenceViewportV2 {
  width: number;
  height: number;
}

export interface AssetCaptureEvidenceV2 {
  media: "screenshot" | "frame" | "audio";
  path: string;
  sha256: string;
  bytes: number;
  renderer?: string;
  viewport?: EvidenceViewportV2;
  cameraPoseHash?: string;
  sourceTreeHash?: string;
  shippedPath?: boolean;
  console?: { errors: number; warnings: number };
  titleHash?: string;
  hudHash?: string;
  walkHash?: string;
  audio?: AudioEvidenceMetadataV2;
}

export interface AudioEvidenceMetadataV2 {
  queueId?: string;
  channels: number;
  sampleRateHz: number;
  durationMs: number;
  rmsDb: number;
  peakDb: number;
  leftRightBalanceDb?: number;
  sideMidDb?: number;
  clippingSamples?: number;
}

export interface StructuredEvidenceFindingV2 {
  id: string;
  code: string;
  category: FindingCategory | "quality";
  severity: Severity;
  path?: string;
  title?: string;
  message?: string;
  observed: string | number | boolean | null | readonly number[];
  threshold: string | number | boolean | null | readonly number[];
  rationale: string;
  recommendation: string;
  ownership: EvidenceOwnership;
  enforcement: EvidenceEnforcement;
  autoFixable?: boolean;
}

export interface QualityPolicyEvaluationV2 {
  declared: QualityPolicy | null;
  status: "OFF" | "PASS" | "ADVISORY" | "BLOCKED";
  blockingViolationCount: number;
  advisoryViolationCount: number;
}

export interface AssetInspectionEvidenceStatusesV2 {
  structural: StructuralEvidenceStatus;
  visualRuntime: VisualRuntimeStatus;
  playerFacing: PlayerFacingStatus;
  humanDecision: HumanDecision;
  reviewStatus: EvidenceReviewStatus;
}

export interface AssetInspectionEvidenceV2 {
  schema: typeof ASSET_INSPECTION_EVIDENCE_SCHEMA;
  schemaVersion: typeof ASSET_INSPECTION_EVIDENCE_VERSION;
  operation: AssetInspectionOperation;
  evidenceKind: AssetInspectionEvidenceKind;
  identity: AssetInspectionIdentityV2;
  source: AssetSourceRefV2;
  sourceOutputRelation: SourceOutputRelationV2;
  report: InspectionReport;
  findings: StructuredEvidenceFindingV2[];
  qualityPolicy: QualityPolicyEvaluationV2;
  captureEvidence: AssetCaptureEvidenceV2[];
  audioEvidence: AssetCaptureEvidenceV2[];
  statuses: AssetInspectionEvidenceStatusesV2;
  validation: {
    valid: boolean;
    structuralValid: boolean;
    qualityPolicyValid: boolean;
  };
  outputReport?: InspectionReport;
  readiness: EvidenceReadiness;
  limitation: "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL";
}

export interface CreateAssetInspectionEvidenceOptions {
  operation?: AssetInspectionOperation;
  evidenceKind?: AssetInspectionEvidenceKind;
  inspectionRunId?: string;
  coreBuildId?: string;
  profileHash?: string;
  sourcePath?: string;
  sourceOutputRelation?: SourceOutputRelationV2;
  captureEvidence?: readonly AssetCaptureEvidenceV2[];
  audioEvidence?: readonly AssetCaptureEvidenceV2[];
  humanDecision?: HumanDecision;
  qualityPolicy?: QualityPolicy;
}

const HASH = /^[a-f0-9]{64}$/i;

/** Build a deterministic profile hash for built-in or already-normalized custom policy identity. */
export function profileHashForReport(report: InspectionReport, profile?: CustomProfile | AssetPolicy): string {
  const custom = profile && "customProfile" in profile ? profile.customProfile : profile;
  const identity = custom && "id" in custom
    ? { id: custom.id, version: custom.version, basedOn: custom.basedOn, thresholds: custom.thresholds, rules: custom.rules, qualityPolicy: custom.qualityPolicy ?? null }
    : {
        profileId: report.profileId,
        ruleSetId: report.ruleSetId,
        ruleSetVersion: report.ruleSetVersion,
        qualityPolicy: report.qualityPolicy ?? null,
      };
  return sha256Hex(new TextEncoder().encode(stableStringify(identity)));
}

export function createAssetInspectionEvidenceV2(
  report: InspectionReport,
  options: CreateAssetInspectionEvidenceOptions = {},
): AssetInspectionEvidenceV2 {
  const evidenceKind = options.evidenceKind ?? "CONTRACT_FIXTURE";
  const captureEvidence = [...(options.captureEvidence ?? [])];
  const audioEvidence = [...(options.audioEvidence ?? [])];
  validateCaptureEvidence(captureEvidence, "captureEvidence", false);
  validateCaptureEvidence(audioEvidence, "audioEvidence", true);
  if (evidenceKind === "CONTRACT_FIXTURE" && (captureEvidence.length || audioEvidence.length)) {
    throw new Error("CONTRACT_FIXTURE cannot carry PLAYER_FACING_CAPTURE or audio evidence.");
  }
  if (evidenceKind === "PLAYER_FACING_CAPTURE" && captureEvidence.length === 0) {
    throw new Error("PLAYER_FACING_CAPTURE requires at least one screenshot or frame capture.");
  }

  const identity: AssetInspectionIdentityV2 = {
    inputHash: requireHash(report.inputHash, "inputHash"),
    resultDigest: requireHash(report.resultDigest, "resultDigest"),
    byteLength: requireBytes(report.byteLength, "byteLength"),
    coreBuildId: nonEmpty(options.coreBuildId ?? report.coreVersion ?? CORE_VERSION, "coreBuildId"),
    ruleSetId: nonEmpty(report.ruleSetId, "ruleSetId"),
    ruleSetVersion: nonEmpty(report.ruleSetVersion, "ruleSetVersion"),
    profileId: nonEmpty(report.profileId, "profileId"),
    profileHash: requireHash(options.profileHash ?? profileHashForReport(report), "profileHash"),
    inspectionRunId: nonEmpty(options.inspectionRunId ?? report.analysisId, "inspectionRunId"),
  };

  const qualityPolicy = evaluateQualityPolicy(report, options.qualityPolicy ?? report.qualityPolicy, captureEvidence.length > 0);
  const findings = buildStructuredFindings(report, qualityPolicy, captureEvidence.length > 0);
  const humanDecision = options.humanDecision ?? "NOT_EVALUATED";
  const statuses = deriveStatuses(evidenceKind, captureEvidence.length > 0, humanDecision, report);
  const sourceOutputRelation = options.sourceOutputRelation ?? {
    kind: "SOURCE" as const,
    sourceHash: identity.inputHash,
    sourceInspectionDigest: identity.resultDigest,
  };
  if (sourceOutputRelation.sourceHash !== identity.inputHash) {
    throw new Error("sourceOutputRelation.sourceHash must match identity.inputHash for an inspection envelope.");
  }

  const value: AssetInspectionEvidenceV2 = {
    schema: ASSET_INSPECTION_EVIDENCE_SCHEMA,
    schemaVersion: ASSET_INSPECTION_EVIDENCE_VERSION,
    operation: options.operation ?? "inspect",
    evidenceKind,
    identity,
    source: {
      path: nonEmpty(options.sourcePath ?? report.fileName, "source.path"),
      fileName: report.fileName,
      bytes: identity.byteLength,
      sha256: identity.inputHash,
    },
    sourceOutputRelation,
    report,
    findings,
    qualityPolicy,
    captureEvidence,
    audioEvidence,
    statuses,
    validation: {
      valid: report.score.hardBlockerCount === 0 && qualityPolicy.status !== "BLOCKED",
      structuralValid: report.score.hardBlockerCount === 0,
      qualityPolicyValid: qualityPolicy.status !== "BLOCKED",
    },
    readiness: deriveReadiness(statuses, qualityPolicy),
    limitation: "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL",
  };
  return normalizeAssetInspectionEvidenceV2(value);
}

/** Strict boundary used by CLI/API consumers before saving an envelope. */
export function normalizeAssetInspectionEvidenceV2(value: unknown): AssetInspectionEvidenceV2 {
  if (!isRecord(value)) throw new Error("Asset inspection evidence must be an object.");
  if (value.schema !== ASSET_INSPECTION_EVIDENCE_SCHEMA) throw new Error(`schema must be ${ASSET_INSPECTION_EVIDENCE_SCHEMA}.`);
  if (value.schemaVersion !== ASSET_INSPECTION_EVIDENCE_VERSION) throw new Error("schemaVersion must be 2.");
  if (value.evidenceKind !== "CONTRACT_FIXTURE" && value.evidenceKind !== "PLAYER_FACING_CAPTURE") {
    throw new Error("evidenceKind must be CONTRACT_FIXTURE or PLAYER_FACING_CAPTURE.");
  }
  const identity = requireIdentity(value.identity);
  const source = requireSource(value.source, identity);
  const relation = requireSourceOutputRelation(value.sourceOutputRelation, identity);
  if (!isRecord(value.report)) throw new Error("report is required.");
  if (!Array.isArray(value.findings)) throw new Error("findings must be an array.");
  if (!isRecord(value.qualityPolicy)) throw new Error("qualityPolicy is required.");
  const captures = requireCaptureArray(value.captureEvidence, "captureEvidence", false);
  const audio = requireCaptureArray(value.audioEvidence, "audioEvidence", true);
  if (value.evidenceKind === "CONTRACT_FIXTURE" && (captures.length || audio.length)) {
    throw new Error("CONTRACT_FIXTURE cannot carry capture evidence.");
  }
  if (value.evidenceKind === "PLAYER_FACING_CAPTURE" && captures.length === 0) {
    throw new Error("PLAYER_FACING_CAPTURE requires captureEvidence.");
  }
  if (value.evidenceKind === "PLAYER_FACING_CAPTURE") validatePlayerFacingCaptures(captures);
  const statuses = deriveStatuses(
    value.evidenceKind,
    captures.length > 0,
    readHumanDecision(value.statuses),
    value.report as unknown as InspectionReport,
  );
  const normalized: AssetInspectionEvidenceV2 = {
    ...(value as unknown as AssetInspectionEvidenceV2),
    identity,
    source,
    sourceOutputRelation: relation,
    captureEvidence: captures,
    audioEvidence: audio,
    statuses,
    validation: requireValidation(value.validation, value.report as unknown as InspectionReport, value.qualityPolicy as unknown as QualityPolicyEvaluationV2),
    readiness: deriveReadiness(statuses, value.qualityPolicy as unknown as QualityPolicyEvaluationV2),
    limitation: "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL",
  };
  return normalized;
}

function requireValidation(
  value: unknown,
  report: InspectionReport,
  quality: QualityPolicyEvaluationV2,
): { valid: boolean; structuralValid: boolean; qualityPolicyValid: boolean } {
  const expected = {
    valid: report.score.hardBlockerCount === 0 && quality.status !== "BLOCKED",
    structuralValid: report.score.hardBlockerCount === 0,
    qualityPolicyValid: quality.status !== "BLOCKED",
  };
  if (!isRecord(value)) {
    return expected;
  }
  if (typeof value.valid !== "boolean" || typeof value.structuralValid !== "boolean" || typeof value.qualityPolicyValid !== "boolean") {
    throw new Error("validation.valid, validation.structuralValid and validation.qualityPolicyValid must be booleans.");
  }
  if (value.valid !== expected.valid || value.structuralValid !== expected.structuralValid || value.qualityPolicyValid !== expected.qualityPolicyValid) {
    throw new Error("validation fields must match the report hard blockers and qualityPolicy status.");
  }
  return expected;
}

function buildStructuredFindings(
  report: InspectionReport,
  quality: QualityPolicyEvaluationV2,
  runtimeEvidencePresent: boolean,
): StructuredEvidenceFindingV2[] {
  const findings: StructuredEvidenceFindingV2[] = report.findings.map((finding) => ({
    id: finding.id,
    code: finding.ruleId,
    category: finding.category,
    severity: finding.severity,
    path: finding.path,
    title: finding.title,
    message: finding.message,
    observed: finding.observed,
    threshold: finding.threshold,
    rationale: rationaleForCode(finding.ruleId),
    recommendation: finding.action,
    ownership: ownershipForCode(finding.ruleId),
    enforcement: "OFF" as const,
    autoFixable: finding.autoFixable,
  }));
  const policy = quality.declared;
  const observations: Array<{
    code: string;
    observed: string | number | boolean | null | readonly number[];
    threshold: string | number | boolean | null | readonly number[];
    policyKey?: keyof QualityPolicy;
    rationale: string;
    recommendation: string;
    ownership: EvidenceOwnership;
  }> = [
    { code: "OBS-DRAW-CALLS", observed: report.metrics.drawCallCount, threshold: policy?.maxDrawCalls?.value ?? "not declared", policyKey: "maxDrawCalls", rationale: "Draw calls are a runtime cost observation, not a visual approval signal.", recommendation: "Compare against the shipped renderer budget and capture the affected camera.", ownership: "runtime" },
    { code: "OBS-TRIANGLES", observed: report.metrics.triangleCount, threshold: policy?.maxTriangles?.value ?? "not declared", policyKey: "maxTriangles", rationale: "Triangle count describes static geometry complexity only.", recommendation: "Review the target camera, LOD and frame cost before changing source bytes.", ownership: "asset" },
    { code: "OBS-MISSING-NORMALS", observed: report.metrics.missingNormalPrimitiveCount, threshold: policy?.requireNormals?.value ? 0 : "not declared", policyKey: "requireNormals", rationale: "Missing normals can be intentional flat-shaded or procedural authoring; renderer ownership must be confirmed.", recommendation: "Confirm source shading and the target renderer before generating normals.", ownership: "unknown" },
    { code: "OBS-MISSING-UVS", observed: report.metrics.missingUvPrimitiveCount, threshold: policy?.requireUVs?.value ? 0 : "not declared", policyKey: "requireUVs", rationale: "Missing UVs may be valid for runtime-generated materials and are not automatically a texture defect.", recommendation: "Trace material ownership; add UVs only when the shipped material contract requires them.", ownership: "unknown" },
    { code: "OBS-TEXTURE-COUNT", observed: report.metrics.textureCount, threshold: policy?.requireTextures?.value ? 1 : "not declared", policyKey: "requireTextures", rationale: "A zero texture count can describe procedural/material authoring and is not a visual failure by itself.", recommendation: "Link the runtime material and a shipped frame before deciding whether a texture is missing.", ownership: "unknown" },
    { code: "OBS-NONUNIT-SCALE", observed: report.metrics.nonUnitScaleNodeCount, threshold: "not declared", rationale: "Non-unit transforms can be an authored pivot contract or an engine import risk.", recommendation: "Confirm the target engine import policy and preserve named pivots before changing source bytes.", ownership: "runtime" },
    { code: "OBS-BOUNDS-ABS", observed: maxAbsoluteBounds(report), threshold: policy?.maxAbsBounds?.value ?? "not declared", policyKey: "maxAbsBounds", rationale: "Extreme accessor bounds can be quantized/raw bounds and require decode-aware runtime context.", recommendation: "Compare decoded runtime bounds and scene scale; do not optimize blindly.", ownership: "unknown" },
    { code: "OBS-RUNTIME-EVIDENCE", observed: runtimeEvidencePresent, threshold: policy?.requireRuntimeEvidence?.value ?? "not declared", policyKey: "requireRuntimeEvidence", rationale: "A static inspection cannot prove that an asset is loaded or visible in a shipped frame.", recommendation: "Attach a shipped-path capture with renderer, viewport, camera and source-tree provenance.", ownership: "runtime" },
  ];
  for (const observation of observations) {
    const rule = observation.policyKey ? policy?.[observation.policyKey] : undefined;
    const violation = rule ? qualityViolation(observation.code, observation.observed, rule.value) : false;
    const enforcement = rule?.mode ?? "OFF";
    const severity: Severity = violation ? (enforcement === "BLOCKING" ? "ERROR" : enforcement === "ADVISORY" ? "WARNING" : "INFO") : "INFO";
    findings.push({
      id: `${observation.code}:/metrics`,
      code: observation.code,
      category: "quality",
      severity,
      path: "/metrics",
      title: observation.code,
      message: violation ? `Quality policy ${enforcement.toLowerCase()} check is outside its declared threshold.` : "Observation recorded; it is not visual approval.",
      observed: observation.observed,
      threshold: observation.threshold,
      rationale: rule?.rationale ?? observation.rationale,
      recommendation: observation.recommendation,
      ownership: observation.ownership,
      enforcement,
    });
  }
  return findings;
}

function evaluateQualityPolicy(
  report: InspectionReport,
  policy: QualityPolicy | undefined,
  runtimeEvidencePresent: boolean,
): QualityPolicyEvaluationV2 {
  if (!policy || Object.keys(policy).length === 0) return { declared: null, status: "OFF", blockingViolationCount: 0, advisoryViolationCount: 0 };
  let blockingViolationCount = 0;
  let advisoryViolationCount = 0;
  for (const [key, rule] of Object.entries(policy) as [keyof QualityPolicy, QualityPolicy[keyof QualityPolicy]][]) {
    if (!rule) continue;
    const observed = qualityObserved(key, report, runtimeEvidencePresent);
    const violation = qualityViolationForKey(key, observed, rule.value);
    if (!violation) continue;
    if (rule.mode === "BLOCKING") blockingViolationCount += 1;
    if (rule.mode === "ADVISORY") advisoryViolationCount += 1;
  }
  return {
    declared: policy,
    status: blockingViolationCount ? "BLOCKED" : advisoryViolationCount ? "ADVISORY" : "PASS",
    blockingViolationCount,
    advisoryViolationCount,
  };
}

function qualityObserved(key: keyof QualityPolicy, report: InspectionReport, runtimeEvidencePresent: boolean): number | boolean | null {
  switch (key) {
    case "maxDrawCalls": return report.metrics.drawCallCount;
    case "maxTriangles": return report.metrics.triangleCount;
    case "requireTextures": return report.metrics.textureCount > 0;
    case "requireNormals": return report.metrics.missingNormalPrimitiveCount === 0;
    case "requireUVs": return report.metrics.missingUvPrimitiveCount === 0;
    case "maxAbsBounds": return maxAbsoluteBounds(report);
    case "requireRuntimeEvidence": return runtimeEvidencePresent;
  }
}

function qualityViolation(code: string, observed: string | number | boolean | null | readonly number[], value: number | boolean): boolean {
  if (code === "OBS-DRAW-CALLS" || code === "OBS-TRIANGLES" || code === "OBS-BOUNDS-ABS") return typeof observed === "number" && typeof value === "number" && observed > value;
  if (code === "OBS-MISSING-NORMALS" || code === "OBS-MISSING-UVS") return typeof observed === "number" && value === true && observed > 0;
  if (code === "OBS-TEXTURE-COUNT") return typeof observed === "number" && value === true && observed < 1;
  if (code === "OBS-RUNTIME-EVIDENCE") return value === true && observed === false;
  return false;
}

function qualityViolationForKey(key: keyof QualityPolicy, observed: number | boolean | null, value: number | boolean): boolean {
  if (key === "maxDrawCalls" || key === "maxTriangles" || key === "maxAbsBounds") return typeof observed === "number" && typeof value === "number" && observed > value;
  return value === true && observed === false;
}

function maxAbsoluteBounds(report: InspectionReport): number | null {
  const bounds = report.metrics.bounds;
  if (!bounds.min || !bounds.max) return null;
  return Math.max(...bounds.min.map(Math.abs), ...bounds.max.map(Math.abs));
}

function deriveStatuses(
  kind: AssetInspectionEvidenceKind,
  capturePresent: boolean,
  humanDecision: HumanDecision,
  report: InspectionReport,
): AssetInspectionEvidenceStatusesV2 {
  const structural: StructuralEvidenceStatus = report.score.hardBlockerCount > 0
    ? "BLOCKED"
    : report.score.ready
      ? "PASS"
      : "CONDITIONAL";
  if (kind === "CONTRACT_FIXTURE" || !capturePresent) {
    return { structural, visualRuntime: "GAP", playerFacing: "NOT_EVALUATED", humanDecision: "NOT_EVALUATED", reviewStatus: "NOT_EVALUATED" };
  }
  if (humanDecision === "PASS") return { structural, visualRuntime: "APPROVED", playerFacing: "PASS", humanDecision, reviewStatus: "EVALUATED" };
  if (humanDecision === "PASS_WITH_FOLLOW_UP") return { structural, visualRuntime: "GAP", playerFacing: "PASS_WITH_FOLLOW_UP", humanDecision, reviewStatus: "EVALUATED" };
  if (humanDecision === "NO_GO") return { structural, visualRuntime: "GAP", playerFacing: "NO_GO", humanDecision, reviewStatus: "EVALUATED" };
  return { structural, visualRuntime: "GAP", playerFacing: "NOT_EVALUATED", humanDecision: "NOT_EVALUATED", reviewStatus: "PENDING" };
}

function deriveReadiness(statuses: AssetInspectionEvidenceStatusesV2, quality: QualityPolicyEvaluationV2): EvidenceReadiness {
  if (statuses.structural === "BLOCKED" || quality.status === "BLOCKED") return "blocked";
  if (statuses.visualRuntime !== "APPROVED" || statuses.playerFacing !== "PASS" || quality.status === "ADVISORY") return "conditional";
  return "ready";
}

function rationaleForCode(code: string): string {
  if (code === "GEO-MISSING-NORMALS") return "Normals affect lighting, but flat-shaded or procedural source authoring can intentionally omit them.";
  if (code === "SCENE-NONUNIT-SCALE") return "Non-unit transforms can be authored pivots or engine-import risks and need target-runtime context.";
  if (code === "TEX-MISSING-UV0") return "UV absence is only a defect when the shipped material contract requires UV coordinates.";
  if (code === "SCENE-EMPTY-NODES") return "Empty nodes may carry pivots, sockets or collider semantics.";
  return "The finding is a structural contract observation; it does not prove player-facing quality.";
}

function ownershipForCode(code: string): EvidenceOwnership {
  if (code.includes("NORMAL") || code.includes("UV") || code.includes("TEXTURE") || code.includes("BOUNDS")) return "unknown";
  if (code.includes("SCALE") || code.includes("RUNTIME") || code.includes("ANIMATION")) return "runtime";
  return "asset";
}

function validateCaptureEvidence(values: readonly AssetCaptureEvidenceV2[], field: string, audioOnly: boolean): void {
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) throw new Error(`${field}[${index}] must be an object.`);
    requireCapture(value, `${field}[${index}]`, audioOnly);
  }
}

function requireCaptureArray(value: unknown, field: string, audioOnly: boolean): AssetCaptureEvidenceV2[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  validateCaptureEvidence(value as AssetCaptureEvidenceV2[], field, audioOnly);
  return value as AssetCaptureEvidenceV2[];
}

function requireCapture(value: Record<string, unknown>, field: string, audioOnly: boolean): AssetCaptureEvidenceV2 {
  const media = value.media;
  if (media !== "screenshot" && media !== "frame" && media !== "audio") throw new Error(`${field}.media is invalid.`);
  if (audioOnly ? media !== "audio" : media === "audio") throw new Error(`${field}.media does not match its evidence lane.`);
  const path = nonEmpty(value.path, `${field}.path`);
  const sha256 = requireHash(value.sha256, `${field}.sha256`);
  const bytes = requireBytes(value.bytes, `${field}.bytes`);
  const viewport = value.viewport === undefined ? undefined : requireViewport(value.viewport, `${field}.viewport`);
  const audio = value.audio === undefined ? undefined : requireAudioMetadata(value.audio, `${field}.audio`);
  return { ...(value as unknown as AssetCaptureEvidenceV2), media, path, sha256, bytes, ...(viewport ? { viewport } : {}), ...(audio ? { audio } : {}) };
}

function validatePlayerFacingCaptures(values: readonly AssetCaptureEvidenceV2[]): void {
  for (const [index, capture] of values.entries()) {
    const field = `captureEvidence[${index}]`;
    if (!capture.renderer?.trim()) throw new Error(`${field}.renderer is required for PLAYER_FACING_CAPTURE.`);
    if (!capture.viewport) throw new Error(`${field}.viewport is required for PLAYER_FACING_CAPTURE.`);
    if (!capture.cameraPoseHash || !HASH.test(capture.cameraPoseHash)) throw new Error(`${field}.cameraPoseHash is required for PLAYER_FACING_CAPTURE.`);
    if (!capture.sourceTreeHash || !HASH.test(capture.sourceTreeHash)) throw new Error(`${field}.sourceTreeHash is required for PLAYER_FACING_CAPTURE.`);
    if (capture.shippedPath !== true) throw new Error(`${field}.shippedPath must be true for PLAYER_FACING_CAPTURE.`);
    if (!capture.console || !Number.isInteger(capture.console.errors) || capture.console.errors < 0 || !Number.isInteger(capture.console.warnings) || capture.console.warnings < 0) {
      throw new Error(`${field}.console errors/warnings are required for PLAYER_FACING_CAPTURE.`);
    }
  }
}

function requireAudioMetadata(value: unknown, field: string): AudioEvidenceMetadataV2 {
  if (!isRecord(value)) throw new Error(`${field} must be an object.`);
  const channels = value.channels;
  const sampleRateHz = value.sampleRateHz;
  const durationMs = value.durationMs;
  const rmsDb = value.rmsDb;
  const peakDb = value.peakDb;
  if (![channels, sampleRateHz, durationMs, rmsDb, peakDb].every(isFiniteNumber)) {
    throw new Error(`${field} requires finite channels, sampleRateHz, durationMs, rmsDb and peakDb.`);
  }
  const numericChannels = channels as number;
  const numericSampleRateHz = sampleRateHz as number;
  const numericDurationMs = durationMs as number;
  if (!Number.isInteger(numericChannels) || numericChannels < 1 || !Number.isInteger(numericSampleRateHz) || numericSampleRateHz < 1 || numericDurationMs < 0) {
    throw new Error(`${field} channels/sampleRateHz must be positive integers and durationMs must be non-negative.`);
  }
  const optionalNumbers = ["leftRightBalanceDb", "sideMidDb", "clippingSamples"] as const;
  for (const key of optionalNumbers) {
    if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) {
      throw new Error(`${field}.${key} must be finite when supplied.`);
    }
  }
  if (value.clippingSamples !== undefined && (typeof value.clippingSamples !== "number" || !Number.isInteger(value.clippingSamples) || value.clippingSamples < 0)) {
    throw new Error(`${field}.clippingSamples must be an integer of 0 or more.`);
  }
  if (value.queueId !== undefined && (typeof value.queueId !== "string" || !value.queueId.trim())) {
    throw new Error(`${field}.queueId must be non-empty text when supplied.`);
  }
  return value as unknown as AudioEvidenceMetadataV2;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireViewport(value: unknown, field: string): EvidenceViewportV2 {
  if (!isRecord(value)) throw new Error(`${field} must be an object.`);
  const width = value.width;
  const height = value.height;
  if (typeof width !== "number" || typeof height !== "number" || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error(`${field} width and height must be positive integers.`);
  return { width, height };
}

function requireIdentity(value: unknown): AssetInspectionIdentityV2 {
  if (!isRecord(value)) throw new Error("identity is required.");
  return {
    inputHash: requireHash(value.inputHash, "identity.inputHash"),
    resultDigest: requireHash(value.resultDigest, "identity.resultDigest"),
    byteLength: requireBytes(value.byteLength, "identity.byteLength"),
    coreBuildId: nonEmpty(value.coreBuildId, "identity.coreBuildId"),
    ruleSetId: nonEmpty(value.ruleSetId, "identity.ruleSetId"),
    ruleSetVersion: nonEmpty(value.ruleSetVersion, "identity.ruleSetVersion"),
    profileId: nonEmpty(value.profileId, "identity.profileId"),
    profileHash: requireHash(value.profileHash, "identity.profileHash"),
    inspectionRunId: nonEmpty(value.inspectionRunId, "identity.inspectionRunId"),
  };
}

function requireSource(value: unknown, identity: AssetInspectionIdentityV2): AssetSourceRefV2 {
  if (!isRecord(value)) throw new Error("source is required.");
  const source = {
    path: nonEmpty(value.path, "source.path"),
    fileName: nonEmpty(value.fileName, "source.fileName"),
    bytes: requireBytes(value.bytes, "source.bytes"),
    sha256: requireHash(value.sha256, "source.sha256"),
  };
  if (source.bytes !== identity.byteLength || source.sha256 !== identity.inputHash) throw new Error("source bytes/hash must match identity.");
  return source;
}

function requireSourceOutputRelation(value: unknown, identity: AssetInspectionIdentityV2): SourceOutputRelationV2 {
  if (!isRecord(value)) throw new Error("sourceOutputRelation is required.");
  if (value.kind !== "SOURCE" && value.kind !== "OUTPUT" && value.kind !== "SOURCE_OUTPUT_PAIR") throw new Error("sourceOutputRelation.kind is invalid.");
  const sourceHash = requireHash(value.sourceHash, "sourceOutputRelation.sourceHash");
  if (sourceHash !== identity.inputHash) throw new Error("sourceOutputRelation.sourceHash must match identity.inputHash.");
  return value as unknown as SourceOutputRelationV2;
}

function readHumanDecision(value: unknown): HumanDecision {
  if (!isRecord(value)) return "NOT_EVALUATED";
  const decision = value.humanDecision;
  return decision === "PASS" || decision === "PASS_WITH_FOLLOW_UP" || decision === "NO_GO" ? decision : "NOT_EVALUATED";
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${field} must be a 64-character SHA-256 hex string.`);
  return value.toLowerCase();
}

function requireBytes(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${field} must be an integer of 0 or more.`);
  return value;
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
