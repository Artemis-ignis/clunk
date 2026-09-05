/*
 * clunk.asset-inspection-evidence.v3
 *
 * v2 is kept and still read. v3 exists because two of v2's rules make it impossible to say
 * honestly what this pipeline actually does, and bending either one would mean writing something
 * untrue into the envelope:
 *
 *   1. v2 derives visualRuntime and playerFacing from humanDecision. A capture with no human
 *      decision is PENDING for ever, which is exactly the "사람이 직접 보고 판단해야 합니다"
 *      square this work exists to remove. v3 derives both lanes from the measurements, and
 *      records who decided in `decisionAuthority`.
 *   2. v2's PLAYER_FACING_CAPTURE requires `shippedPath: true`. These captures come from Clunk's
 *      own offline rasteriser, not from the game's rendering path, so claiming shippedPath would
 *      be a lie. v3 adds the evidenceKind MACHINE_VISUAL_CAPTURE, whose captures must carry
 *      `shippedPath: false` and a `renderKind`, so nobody can mistake one for an engine
 *      screenshot — and the machine can still finish the judgement.
 *
 * humanDecision therefore gains two values that say a person is not the gate:
 *   NOT_REQUIRED    the automatic verdict is PASS or FAIL; the decision is made.
 *   OPTIONAL_REVIEW the automatic verdict is REVIEW; a person may look, and need not.
 * The four v2 human values are still accepted, for the case where a person did record one.
 *
 * toAssetInspectionEvidenceV2 hands a v2 reader a valid v2 CONTRACT_FIXTURE of the same
 * inspection, with the visual report attached as an extra field. It is deliberately not a
 * PLAYER_FACING_CAPTURE: under v2's own definition these captures are not one.
 */

import {
  createAssetInspectionEvidenceV2,
  normalizeAssetInspectionEvidenceV2,
  type AssetCaptureEvidenceV2,
  type AssetInspectionEvidenceV2,
  type AssetInspectionOperation,
  type EvidenceByteVerificationV2,
  type EvidenceReadiness,
  type HumanDecision,
  type PlayerFacingStatus,
  type QualityPolicyEvaluationV2,
  type SourceOutputRelationV2,
  type StructuralEvidenceStatus,
  type StructuredEvidenceFindingV2,
} from "../asset-inspection-evidence";
import { sha256Hex, stableStringify, type InspectionReport, type QualityPolicy } from "../index";
import type { VisualEvidenceReport, VisualVerdict } from "./types";
import { humanDecisionFor, type MachineHumanDecision } from "./verdict";

export const ASSET_INSPECTION_EVIDENCE_V3_SCHEMA = "clunk.asset-inspection-evidence.v3" as const;
export const ASSET_INSPECTION_EVIDENCE_V3_VERSION = "3" as const;

export type AssetInspectionEvidenceKindV3 = "CONTRACT_FIXTURE" | "PLAYER_FACING_CAPTURE" | "MACHINE_VISUAL_CAPTURE";
export type VisualRuntimeStatusV3 = "APPROVED" | "REVIEW" | "GAP" | "NOT_EVALUATED" | "UNAVAILABLE";
export type HumanDecisionV3 = HumanDecision | MachineHumanDecision;
export type DecisionAuthority = "MACHINE" | "HUMAN";

/** A capture this pipeline made. Same shape as v2 plus the two fields that keep it honest. */
export interface MachineCaptureEvidenceV3 extends AssetCaptureEvidenceV2 {
  /** Always false for MACHINE_VISUAL_CAPTURE: this frame did not come from the game. */
  shippedPath: boolean;
  /** How the frame was produced, e.g. "clunk-software-raster". */
  renderKind: string;
}

export interface AssetInspectionEvidenceStatusesV3 {
  structural: StructuralEvidenceStatus;
  visualRuntime: VisualRuntimeStatusV3;
  playerFacing: PlayerFacingStatus;
  humanDecision: HumanDecisionV3;
  reviewStatus: "EVALUATED" | "PENDING" | "NOT_EVALUATED";
  /** The machine verdict the two lanes were derived from. */
  autoVerdict: VisualVerdict | "NOT_EVALUATED";
  decisionAuthority: DecisionAuthority;
}

export interface AssetInspectionEvidenceV3 {
  schema: typeof ASSET_INSPECTION_EVIDENCE_V3_SCHEMA;
  schemaVersion: typeof ASSET_INSPECTION_EVIDENCE_V3_VERSION;
  operation: AssetInspectionOperation;
  evidenceKind: AssetInspectionEvidenceKindV3;
  identity: AssetInspectionEvidenceV2["identity"];
  source: AssetInspectionEvidenceV2["source"];
  sourceOutputRelation: SourceOutputRelationV2;
  report: InspectionReport;
  findings: StructuredEvidenceFindingV2[];
  qualityPolicy: QualityPolicyEvaluationV2;
  captureEvidence: MachineCaptureEvidenceV3[];
  audioEvidence: AssetCaptureEvidenceV2[];
  byteVerification: EvidenceByteVerificationV2;
  statuses: AssetInspectionEvidenceStatusesV3;
  /** The measurements and the reasons the two lanes were set the way they were. */
  visualEvidence: VisualEvidenceReport;
  validation: AssetInspectionEvidenceV2["validation"];
  readiness: EvidenceReadiness;
  limitation: "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL";
  /** Restates, inside the envelope, that these frames are not engine screenshots. */
  captureLimitation: "OFFLINE_SOFTWARE_RASTER_IS_NOT_AN_ENGINE_SCREENSHOT";
}

export interface CreateVisualEvidenceOptions {
  operation?: AssetInspectionOperation;
  inspectionRunId?: string;
  coreBuildId?: string;
  profileHash?: string;
  sourcePath?: string;
  qualityPolicy?: QualityPolicy;
  captureEvidence: readonly MachineCaptureEvidenceV3[];
  byteVerification: EvidenceByteVerificationV2;
  visualEvidence: VisualEvidenceReport;
  /** Supply only when a person actually recorded one; otherwise the machine decides. */
  humanOverride?: HumanDecision;
}

export function visualRuntimeStatusFor(verdict: VisualVerdict): VisualRuntimeStatusV3 {
  if (verdict === "PASS") return "APPROVED";
  if (verdict === "REVIEW") return "REVIEW";
  return "GAP";
}

export function playerFacingStatusFor(verdict: VisualVerdict): PlayerFacingStatus {
  if (verdict === "PASS") return "PASS";
  if (verdict === "REVIEW") return "PASS_WITH_FOLLOW_UP";
  return "NO_GO";
}

/**
 * Stricter than v2 in one place, on purpose.
 *
 * v2 lets a CONDITIONAL structural report come out "ready" as long as the visual lanes are
 * approved, because in v2 those lanes could only be approved by a person who had presumably read
 * the findings. Here they are approved by a rasteriser that never read them, so a structural
 * report that is not itself clean keeps the envelope at "conditional". Measured case: h145 scores
 * 96/100 with eight WARNING findings and score.ready false while every visual check passes.
 */
function readinessFor(
  statuses: AssetInspectionEvidenceStatusesV3,
  quality: QualityPolicyEvaluationV2,
): EvidenceReadiness {
  if (statuses.structural === "BLOCKED" || quality.status === "BLOCKED" || statuses.autoVerdict === "FAIL") return "blocked";
  if (statuses.structural === "UNAVAILABLE") return "unavailable";
  if (
    statuses.structural !== "PASS"
    || statuses.visualRuntime !== "APPROVED"
    || statuses.playerFacing !== "PASS"
    || quality.status === "ADVISORY"
  ) return "conditional";
  return "ready";
}

/**
 * Builds the v3 envelope from a structural report and a finished visual report.
 *
 * The structural half is produced by createAssetInspectionEvidenceV2, so findings, quality policy
 * and identity are derived by exactly the same code v2 uses and cannot drift.
 */
export function createVisualAssetInspectionEvidenceV3(
  report: InspectionReport,
  options: CreateVisualEvidenceOptions,
): AssetInspectionEvidenceV3 {
  const base = createAssetInspectionEvidenceV2(report, {
    operation: options.operation ?? "inspect",
    evidenceKind: "CONTRACT_FIXTURE",
    inspectionRunId: options.inspectionRunId,
    coreBuildId: options.coreBuildId,
    profileHash: options.profileHash,
    sourcePath: options.sourcePath,
    qualityPolicy: options.qualityPolicy,
  });
  const visual = options.visualEvidence;
  const captures = options.captureEvidence.map((capture) => ({ ...capture }));
  assertMachineCaptures(captures);

  const humanOverride = options.humanOverride;
  const statuses: AssetInspectionEvidenceStatusesV3 = humanOverride && humanOverride !== "NOT_EVALUATED"
    ? {
        structural: base.statuses.structural,
        visualRuntime: humanOverride === "PASS" ? "APPROVED" : "GAP",
        playerFacing: humanOverride,
        humanDecision: humanOverride,
        reviewStatus: "EVALUATED",
        autoVerdict: visual.verdict,
        decisionAuthority: "HUMAN",
      }
    : {
        structural: base.statuses.structural,
        visualRuntime: visualRuntimeStatusFor(visual.lanes.visualRuntime.verdict),
        playerFacing: playerFacingStatusFor(visual.lanes.playerFacing.verdict),
        humanDecision: humanDecisionFor(visual.verdict),
        reviewStatus: "EVALUATED",
        autoVerdict: visual.verdict,
        decisionAuthority: "MACHINE",
      };

  const value: AssetInspectionEvidenceV3 = {
    schema: ASSET_INSPECTION_EVIDENCE_V3_SCHEMA,
    schemaVersion: ASSET_INSPECTION_EVIDENCE_V3_VERSION,
    operation: base.operation,
    evidenceKind: "MACHINE_VISUAL_CAPTURE",
    identity: base.identity,
    source: base.source,
    sourceOutputRelation: base.sourceOutputRelation,
    report: base.report,
    findings: base.findings,
    qualityPolicy: base.qualityPolicy,
    captureEvidence: captures,
    audioEvidence: [],
    byteVerification: options.byteVerification,
    statuses,
    visualEvidence: visual,
    validation: base.validation,
    readiness: readinessFor(statuses, base.qualityPolicy),
    limitation: "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL",
    captureLimitation: "OFFLINE_SOFTWARE_RASTER_IS_NOT_AN_ENGINE_SCREENSHOT",
  };
  return normalizeAssetInspectionEvidenceV3(value);
}

const HASH = /^[a-f0-9]{64}$/i;

function assertMachineCaptures(captures: readonly MachineCaptureEvidenceV3[]): void {
  if (captures.length === 0) throw new Error("MACHINE_VISUAL_CAPTURE requires at least one capture.");
  for (const [index, capture] of captures.entries()) {
    const field = `captureEvidence[${index}]`;
    if (capture.media !== "screenshot" && capture.media !== "frame") throw new Error(`${field}.media must be screenshot or frame.`);
    if (!capture.path?.trim()) throw new Error(`${field}.path is required.`);
    if (!HASH.test(capture.sha256 ?? "")) throw new Error(`${field}.sha256 must be a 64-character SHA-256 hex string.`);
    if (!Number.isInteger(capture.bytes) || capture.bytes < 0) throw new Error(`${field}.bytes must be an integer of 0 or more.`);
    if (!capture.renderer?.trim()) throw new Error(`${field}.renderer is required.`);
    if (!capture.viewport) throw new Error(`${field}.viewport is required.`);
    if (!HASH.test(capture.cameraPoseHash ?? "")) throw new Error(`${field}.cameraPoseHash is required.`);
    if (!HASH.test(capture.sourceTreeHash ?? "")) throw new Error(`${field}.sourceTreeHash is required.`);
    if (!capture.renderKind?.trim()) throw new Error(`${field}.renderKind is required for a machine capture.`);
    if (capture.shippedPath !== false) {
      throw new Error(`${field}.shippedPath must be false: an offline raster did not come from the shipped rendering path.`);
    }
    if (!capture.console || !Number.isInteger(capture.console.errors) || !Number.isInteger(capture.console.warnings)) {
      throw new Error(`${field}.console errors/warnings are required.`);
    }
  }
}

/** Strict boundary used before an envelope is written or trusted. */
export function normalizeAssetInspectionEvidenceV3(value: unknown): AssetInspectionEvidenceV3 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Asset inspection evidence must be an object.");
  const record = value as Record<string, unknown>;
  if (record.schema !== ASSET_INSPECTION_EVIDENCE_V3_SCHEMA) throw new Error(`schema must be ${ASSET_INSPECTION_EVIDENCE_V3_SCHEMA}.`);
  if (record.schemaVersion !== ASSET_INSPECTION_EVIDENCE_V3_VERSION) throw new Error("schemaVersion must be 3.");
  const kind = record.evidenceKind;
  if (kind !== "CONTRACT_FIXTURE" && kind !== "PLAYER_FACING_CAPTURE" && kind !== "MACHINE_VISUAL_CAPTURE") {
    throw new Error("evidenceKind must be CONTRACT_FIXTURE, PLAYER_FACING_CAPTURE or MACHINE_VISUAL_CAPTURE.");
  }
  const statuses = record.statuses as AssetInspectionEvidenceStatusesV3 | undefined;
  if (!statuses || typeof statuses !== "object") throw new Error("statuses is required.");
  if (statuses.decisionAuthority !== "MACHINE" && statuses.decisionAuthority !== "HUMAN") {
    throw new Error("statuses.decisionAuthority must be MACHINE or HUMAN.");
  }
  const allowedHuman: HumanDecisionV3[] = ["PASS", "PASS_WITH_FOLLOW_UP", "NO_GO", "NOT_EVALUATED", "NOT_REQUIRED", "OPTIONAL_REVIEW"];
  if (!allowedHuman.includes(statuses.humanDecision)) throw new Error("statuses.humanDecision is invalid.");
  if (statuses.decisionAuthority === "MACHINE" && statuses.humanDecision !== "NOT_REQUIRED" && statuses.humanDecision !== "OPTIONAL_REVIEW") {
    throw new Error("A machine-decided envelope must record humanDecision as NOT_REQUIRED or OPTIONAL_REVIEW.");
  }
  const visual = record.visualEvidence as VisualEvidenceReport | undefined;
  if (!visual || visual.schema !== "clunk.visual-evidence.v1") throw new Error("visualEvidence must be a clunk.visual-evidence.v1 report.");
  if (statuses.decisionAuthority === "MACHINE") {
    if (statuses.visualRuntime !== visualRuntimeStatusFor(visual.lanes.visualRuntime.verdict)) {
      throw new Error("statuses.visualRuntime must match the measured visualRuntime lane verdict.");
    }
    if (statuses.playerFacing !== playerFacingStatusFor(visual.lanes.playerFacing.verdict)) {
      throw new Error("statuses.playerFacing must match the measured playerFacing lane verdict.");
    }
    if (statuses.humanDecision !== humanDecisionFor(visual.verdict)) {
      throw new Error("statuses.humanDecision must follow the automatic verdict.");
    }
  }
  if (kind === "MACHINE_VISUAL_CAPTURE") assertMachineCaptures(record.captureEvidence as MachineCaptureEvidenceV3[]);
  if (record.captureLimitation !== "OFFLINE_SOFTWARE_RASTER_IS_NOT_AN_ENGINE_SCREENSHOT") {
    throw new Error("captureLimitation must state that an offline raster is not an engine screenshot.");
  }
  return record as unknown as AssetInspectionEvidenceV3;
}

/**
 * A v2 view of the same inspection, for readers that only speak v2.
 *
 * It is a CONTRACT_FIXTURE on purpose. Under v2's own definition a PLAYER_FACING_CAPTURE is a
 * frame from the shipped rendering path; an offline raster is not one, and dressing it up as one
 * to make an older reader show a green light would be the exact dishonesty this contract exists
 * to prevent. The visual report rides along as an extra field, so nothing is lost — but a v2
 * reader will still show the runtime lane as a gap. That is the reason to read v3.
 */
export function toAssetInspectionEvidenceV2(value: AssetInspectionEvidenceV3): AssetInspectionEvidenceV2 & { visualEvidence: VisualEvidenceReport } {
  const v2 = createAssetInspectionEvidenceV2(value.report, {
    operation: value.operation,
    evidenceKind: "CONTRACT_FIXTURE",
    inspectionRunId: value.identity.inspectionRunId,
    coreBuildId: value.identity.coreBuildId,
    profileHash: value.identity.profileHash,
    sourcePath: value.source.path,
    qualityPolicy: value.qualityPolicy.declared ?? undefined,
  });
  return { ...v2, visualEvidence: value.visualEvidence };
}

export type AnyAssetInspectionEvidence =
  | { schemaVersion: "2"; value: AssetInspectionEvidenceV2 }
  | { schemaVersion: "3"; value: AssetInspectionEvidenceV3 };

/** Reads either version. The v2 reader is kept exactly as it was. */
export function readAssetInspectionEvidence(value: unknown): AnyAssetInspectionEvidence {
  const schema = (value as { schema?: unknown } | null)?.schema;
  if (schema === ASSET_INSPECTION_EVIDENCE_V3_SCHEMA) {
    return { schemaVersion: "3", value: normalizeAssetInspectionEvidenceV3(value) };
  }
  return { schemaVersion: "2", value: normalizeAssetInspectionEvidenceV2(value) };
}

/** Stable hash of a camera pose declaration, for captureEvidence.cameraPoseHash. */
export function cameraPoseHash(pose: unknown): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(pose)));
}
