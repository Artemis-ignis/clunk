/**
 * Contract for proving that Clunk output is consumed by real game projects.
 *
 * This is deliberately stricter than a gallery or a screenshot. It keeps source,
 * runtime, Clunk inspection, provenance, and player-facing review as separate
 * signals so a static PASS can never silently become a release approval.
 */

import { normalizePlayerFacingQualityEvidence, type PlayerFacingQualityEvidence } from "./player-facing-quality";

export const CONSUMER_VALIDATION_SCHEMA = "clunk.consumer-validation.v1" as const;
export const CONSUMER_VALIDATION_VERSION = 1 as const;

export type ConsumerProjectId = "harvest-frontier" | "forge-front";
export type ConsumerAssetKind = "3d-model" | "2d-image";
export type ConsumerProjectStatus = "PASS" | "PASS_WITH_GAPS" | "FAIL";
export type ConsumerRuntimeStatus = "PASS" | "GAP" | "FAIL" | "UNAVAILABLE";
export type ConsumerAttachmentStatus = "PASS" | "GAP" | "FAIL" | "UNAVAILABLE";
export type ConsumerAttachmentObservation = "LOADED" | "PATH_ONLY" | "NOT_OBSERVED";
export type ConsumerInspectionStatus =
  | "READY"
  | "CONDITIONAL"
  | "BLOCKED"
  | "UNSUPPORTED"
  | "ENVIRONMENT_UNAVAILABLE";
export type ConsumerHumanReview = "PASS" | "NO_GO" | "NOT_EVALUATED";
export type ConsumerIntegrityStatus = "PASS" | "FAIL";
export type ConsumerCheckStatus = "PASS" | "FAIL" | "NOT_CHECKED";
export type ConsumerReadiness = "VALIDATED" | "VALIDATED_WITH_GAPS" | "BLOCKED";

export interface ConsumerFileRef {
  path: string;
  bytes: number;
  sha256: string;
  hashVerified: boolean;
}

export interface ConsumerClunkInspection {
  input: "source" | "derived" | "runtime";
  targetProfileId: string;
  ruleSetId: string;
  status: ConsumerInspectionStatus;
  productionReady: boolean;
  inputHash: string;
  resultDigest?: string;
  evidencePath?: string;
  warningCount?: number;
  hardBlockerCount?: number;
}

export interface ConsumerRuntimeAttachment {
  status: ConsumerAttachmentStatus;
  pathPresent: boolean;
  observation: ConsumerAttachmentObservation;
  loaded?: boolean;
  externalRequests?: boolean;
  evidencePath?: string;
  note?: string;
}

export interface ConsumerProvenance {
  status: "PASS" | "GAP" | "FAIL";
  refs: readonly string[];
  manifestHash?: string;
  note?: string;
}

export interface ConsumerIntegrity {
  status: ConsumerIntegrityStatus;
  checks: Readonly<Record<string, ConsumerCheckStatus>>;
}

export interface ConsumerAssetRecord {
  id: string;
  projectId: ConsumerProjectId;
  kind: ConsumerAssetKind;
  role: string;
  source: ConsumerFileRef;
  derived?: ConsumerFileRef;
  runtime: ConsumerFileRef;
  clunk: ConsumerClunkInspection;
  runtimeInspection?: ConsumerClunkInspection;
  /** Optional per-asset visual evidence; absence remains a gap, never a pass. */
  playerFacingQuality?: PlayerFacingQualityEvidence;
  runtimeAttachment: ConsumerRuntimeAttachment;
  provenance: ConsumerProvenance;
  integrity: ConsumerIntegrity;
}

export interface ConsumerRuntimeEvidence {
  status: ConsumerRuntimeStatus;
  scope: "project" | "asset";
  runId?: string;
  evidencePath?: string;
  sourceCommit?: string | null;
  shippedPath?: boolean;
  expectedAssetCount?: number;
  loadedAssetCount?: number;
  externalRequests?: boolean;
  pageErrors?: number;
  pageWarnings?: number;
  humanReview: ConsumerHumanReview;
  productionReady: boolean;
  note?: string;
  evidenceFiles?: readonly ConsumerFileRef[];
}

export interface ConsumerProjectRecord {
  id: ConsumerProjectId;
  name: string;
  root: string;
  gitHead: string | null;
  dirty: boolean;
  readOnly: true;
  runtime: ConsumerRuntimeEvidence;
  checks: Readonly<Record<string, ConsumerCheckStatus>>;
  assets: ConsumerAssetRecord[];
  status: ConsumerProjectStatus;
  limitations: readonly string[];
}

export interface ConsumerValidationSummary {
  projectCount: number;
  assetCount: number;
  sourceHashVerifiedCount: number;
  derivedHashVerifiedCount: number;
  runtimeHashVerifiedCount: number;
  clunkInspectionCount: number;
  clunkEnvironmentUnavailableCount: number;
  runtimeEvidencePassCount: number;
  runtimeAttachmentPassCount: number;
  humanReviewPendingCount: number;
  integrityFailureCount: number;
  readiness: ConsumerReadiness;
  productionReady: false;
}

export interface ConsumerValidationReport {
  schema: typeof CONSUMER_VALIDATION_SCHEMA;
  version: typeof CONSUMER_VALIDATION_VERSION;
  runId: string;
  generatedAt: string;
  clunk: {
    root: string;
    gitHead: string | null;
    coreBuildId: string;
  };
  projects: ConsumerProjectRecord[];
  summary: ConsumerValidationSummary;
  readOnly: true;
  limitations: readonly string[];
}

export interface ConsumerValidationReportInput {
  runId: string;
  generatedAt: string;
  clunk: ConsumerValidationReport["clunk"];
  projects: ConsumerProjectRecord[];
  readOnly: true;
  limitations?: readonly string[];
}

const HASH = /^[a-f0-9]{64}$/i;
const REQUIRED_PROJECTS: readonly ConsumerProjectId[] = ["harvest-frontier", "forge-front"];

export function createConsumerValidationReport(
  input: ConsumerValidationReportInput,
): ConsumerValidationReport {
  const projects = input.projects.map((project) => ({
    ...project,
    assets: project.assets.map((asset) => ({ ...asset })),
    status: deriveProjectStatus(project),
  }));
  const report: ConsumerValidationReport = {
    schema: CONSUMER_VALIDATION_SCHEMA,
    version: CONSUMER_VALIDATION_VERSION,
    runId: input.runId,
    generatedAt: input.generatedAt,
    clunk: { ...input.clunk },
    projects,
    summary: summarizeConsumerValidation(projects),
    readOnly: input.readOnly,
    limitations: input.limitations ?? [
      "Clunk static inspection and consumer runtime evidence are separate gates.",
      "Human visual review is never inferred from hashes, screenshots, or automated PASS results.",
    ],
  };
  validateReport(report);
  return report;
}

export function normalizeConsumerValidationReport(value: unknown): ConsumerValidationReport {
  const report = asRecord(value, "report") as unknown as ConsumerValidationReport;
  validateReport(report);
  return {
    ...report,
    projects: report.projects.map((project) => ({
      ...project,
      status: deriveProjectStatus(project),
    })),
    summary: summarizeConsumerValidation(report.projects),
  };
}

export function summarizeConsumerValidation(
  projects: readonly ConsumerProjectRecord[],
): ConsumerValidationSummary {
  const assets = projects.flatMap((project) => project.assets);
  const integrityFailureCount = projects.filter((project) => project.runtime.status === "FAIL"
    || Object.values(project.checks).some((status) => status === "FAIL")).length
    + assets.filter((asset) => asset.integrity.status === "FAIL" || asset.provenance.status === "FAIL" || asset.runtimeAttachment.status === "FAIL").length;
  const hasGap = projects.some((project) => deriveProjectStatus(project) === "PASS_WITH_GAPS");
  return {
    projectCount: projects.length,
    assetCount: assets.length,
    sourceHashVerifiedCount: assets.filter((asset) => asset.source.hashVerified).length,
    derivedHashVerifiedCount: assets.filter((asset) => asset.derived?.hashVerified === true).length,
    runtimeHashVerifiedCount: assets.filter((asset) => asset.runtime.hashVerified).length,
    clunkInspectionCount: assets.length,
    clunkEnvironmentUnavailableCount: assets.filter((asset) => asset.clunk.status === "ENVIRONMENT_UNAVAILABLE").length,
    runtimeEvidencePassCount: projects.filter((project) => project.runtime.status === "PASS").length,
    runtimeAttachmentPassCount: assets.filter((asset) => asset.runtimeAttachment.status === "PASS").length,
    humanReviewPendingCount: projects.filter((project) => project.runtime.humanReview !== "PASS").length,
    integrityFailureCount,
    readiness: integrityFailureCount > 0 ? "BLOCKED" : hasGap ? "VALIDATED_WITH_GAPS" : "VALIDATED",
    productionReady: false,
  };
}

function deriveProjectStatus(project: ConsumerProjectRecord): ConsumerProjectStatus {
  const projectCheckFailure = Object.values(project.checks).some((status) => status === "FAIL");
  const assetFailure = project.assets.some((asset) => (
    asset.integrity.status === "FAIL"
    || asset.provenance.status === "FAIL"
    || asset.runtimeAttachment.status === "FAIL"
    || asset.playerFacingQuality?.status === "NO_GO"
  ));
  if (project.runtime.status === "FAIL" || projectCheckFailure || assetFailure) return "FAIL";

  const gap = project.runtime.status !== "PASS"
    || project.runtime.humanReview !== "PASS"
    || !project.runtime.productionReady
    || project.assets.some((asset) => (
      asset.clunk.status !== "READY"
      || !asset.clunk.productionReady
      || asset.runtimeAttachment.status !== "PASS"
      || asset.provenance.status !== "PASS"
      || asset.playerFacingQuality?.status !== "PASS"
    ));
  return gap ? "PASS_WITH_GAPS" : "PASS";
}

function validateReport(report: ConsumerValidationReport): void {
  if (report.schema !== CONSUMER_VALIDATION_SCHEMA) throw new Error(`report.schema must be ${CONSUMER_VALIDATION_SCHEMA}`);
  if (report.version !== CONSUMER_VALIDATION_VERSION) throw new Error("report.version is unsupported");
  requiredText(report.runId, "report.runId", 120);
  requiredText(report.generatedAt, "report.generatedAt", 80);
  if (report.readOnly !== true) throw new Error("report.readOnly must be true");
  requiredText(report.clunk.root, "report.clunk.root", 1000);
  requiredText(report.clunk.coreBuildId, "report.clunk.coreBuildId", 120);
  if (report.clunk.gitHead !== null) requiredText(report.clunk.gitHead, "report.clunk.gitHead", 120);
  if (!Array.isArray(report.projects) || report.projects.length < REQUIRED_PROJECTS.length) {
    throw new Error("report.projects must include Harvest Frontier and FORGE FRONT");
  }

  const projectIds = new Set<ConsumerProjectId>();
  const assetIds = new Set<string>();
  for (const required of REQUIRED_PROJECTS) {
    if (!report.projects.some((project) => project.id === required)) {
      throw new Error(`report.projects is missing ${required}`);
    }
  }
  for (const project of report.projects) {
    if (projectIds.has(project.id)) throw new Error(`Duplicate consumer project: ${project.id}`);
    projectIds.add(project.id);
    requiredText(project.name, `projects.${project.id}.name`, 200);
    requiredText(project.root, `projects.${project.id}.root`, 1000);
    if (project.gitHead !== null) requiredText(project.gitHead, `projects.${project.id}.gitHead`, 120);
    if (project.readOnly !== true) throw new Error(`projects.${project.id}.readOnly must be true`);
    validateChecks(project.checks, `projects.${project.id}.checks`);
    validateRuntime(project.runtime, `projects.${project.id}.runtime`);
    if (!Array.isArray(project.assets) || project.assets.length === 0) {
      throw new Error(`projects.${project.id}.assets must not be empty`);
    }
    for (const asset of project.assets) {
      if (assetIds.has(asset.id)) throw new Error(`Duplicate consumer asset: ${asset.id}`);
      assetIds.add(asset.id);
      if (asset.projectId !== project.id) throw new Error(`Asset ${asset.id} has the wrong projectId`);
      requiredText(asset.id, `assets.${asset.id}.id`, 200);
      requiredText(asset.role, `assets.${asset.id}.role`, 240);
      validateFile(asset.source, `assets.${asset.id}.source`);
      if (asset.derived) validateFile(asset.derived, `assets.${asset.id}.derived`);
      validateFile(asset.runtime, `assets.${asset.id}.runtime`);
      validateInspection(asset, `assets.${asset.id}.clunk`);
      if (asset.runtimeInspection) validateInspection(asset, `assets.${asset.id}.runtimeInspection`);
      if (asset.playerFacingQuality) {
        const visual = normalizePlayerFacingQualityEvidence(asset.playerFacingQuality);
        if (visual.assetId !== asset.id) throw new Error(`Player-facing evidence ${asset.id} has the wrong assetId.`);
        if (visual.runtime.path !== asset.runtime.path || visual.runtime.sha256 !== asset.runtime.sha256 || visual.runtime.bytes !== asset.runtime.bytes) {
          throw new Error(`Player-facing evidence ${asset.id}.runtime must match the consumer runtime file.`);
        }
      }
      validateAttachment(asset.runtimeAttachment, `assets.${asset.id}.runtimeAttachment`);
      validateProvenance(asset.provenance, `assets.${asset.id}.provenance`);
      validateIntegrity(asset.integrity, `assets.${asset.id}.integrity`);
    }
  }
}

function validateRuntime(runtime: ConsumerRuntimeEvidence, label: string): void {
  if (!runtime || !["PASS", "GAP", "FAIL", "UNAVAILABLE"].includes(runtime.status)) throw new Error(`${label}.status is invalid`);
  if (!["project", "asset"].includes(runtime.scope)) throw new Error(`${label}.scope is invalid`);
  if (runtime.runId !== undefined) requiredText(runtime.runId, `${label}.runId`, 160);
  if (runtime.evidencePath !== undefined) requiredText(runtime.evidencePath, `${label}.evidencePath`, 2000);
  if (runtime.sourceCommit !== undefined && runtime.sourceCommit !== null) requiredText(runtime.sourceCommit, `${label}.sourceCommit`, 120);
  if (runtime.expectedAssetCount !== undefined) nonNegativeInteger(runtime.expectedAssetCount, `${label}.expectedAssetCount`);
  if (runtime.loadedAssetCount !== undefined) nonNegativeInteger(runtime.loadedAssetCount, `${label}.loadedAssetCount`);
  if (runtime.pageErrors !== undefined) nonNegativeInteger(runtime.pageErrors, `${label}.pageErrors`);
  if (runtime.pageWarnings !== undefined) nonNegativeInteger(runtime.pageWarnings, `${label}.pageWarnings`);
  if (!["PASS", "NO_GO", "NOT_EVALUATED"].includes(runtime.humanReview)) throw new Error(`${label}.humanReview is invalid`);
  if (runtime.productionReady && runtime.humanReview !== "PASS") {
    throw new Error("productionReady cannot be true while humanReview is NOT_EVALUATED");
  }
  if (runtime.productionReady && runtime.status !== "PASS") throw new Error(`${label}.productionReady requires runtime PASS`);
}

function validateFile(file: ConsumerFileRef, label: string): void {
  requiredText(file.path, `${label}.path`, 2000);
  nonNegativeInteger(file.bytes, `${label}.bytes`);
  validateHash(file.sha256, `${label}.sha256`);
  if (typeof file.hashVerified !== "boolean") throw new Error(`${label}.hashVerified must be boolean`);
}

function validateInspection(asset: ConsumerAssetRecord, label: string): void {
  if (!["source", "derived", "runtime"].includes(asset.clunk.input)) throw new Error(`${label}.input is invalid`);
  requiredText(asset.clunk.targetProfileId, `${label}.targetProfileId`, 200);
  requiredText(asset.clunk.ruleSetId, `${label}.ruleSetId`, 200);
  if (!["READY", "CONDITIONAL", "BLOCKED", "UNSUPPORTED", "ENVIRONMENT_UNAVAILABLE"].includes(asset.clunk.status)) {
    throw new Error(`${label}.status is invalid`);
  }
  if (typeof asset.clunk.productionReady !== "boolean") throw new Error(`${label}.productionReady must be boolean`);
  validateHash(asset.clunk.inputHash, `${label}.inputHash`);
  const inspectedFile = asset.clunk.input === "source" ? asset.source : asset.clunk.input === "derived" ? asset.derived : asset.runtime;
  if (!inspectedFile || inspectedFile.sha256 !== asset.clunk.inputHash) {
    throw new Error(`${label}.inputHash must match the selected file hash`);
  }
  if (asset.clunk.resultDigest !== undefined) validateHash(asset.clunk.resultDigest, `${label}.resultDigest`);
  if (asset.clunk.evidencePath !== undefined) requiredText(asset.clunk.evidencePath, `${label}.evidencePath`, 2000);
  if (asset.clunk.warningCount !== undefined) nonNegativeInteger(asset.clunk.warningCount, `${label}.warningCount`);
  if (asset.clunk.hardBlockerCount !== undefined) nonNegativeInteger(asset.clunk.hardBlockerCount, `${label}.hardBlockerCount`);
}

function validateAttachment(attachment: ConsumerRuntimeAttachment, label: string): void {
  if (!["PASS", "GAP", "FAIL", "UNAVAILABLE"].includes(attachment.status)) throw new Error(`${label}.status is invalid`);
  if (typeof attachment.pathPresent !== "boolean") throw new Error(`${label}.pathPresent must be boolean`);
  if (!["LOADED", "PATH_ONLY", "NOT_OBSERVED"].includes(attachment.observation)) throw new Error(`${label}.observation is invalid`);
  if (attachment.status === "PASS" && attachment.pathPresent !== true) throw new Error(`${label}.PASS requires pathPresent`);
  if (attachment.observation === "LOADED" && attachment.loaded !== true) throw new Error(`${label}.LOADED requires loaded=true`);
  if (attachment.evidencePath !== undefined) requiredText(attachment.evidencePath, `${label}.evidencePath`, 2000);
}

function validateProvenance(provenance: ConsumerProvenance, label: string): void {
  if (!["PASS", "GAP", "FAIL"].includes(provenance.status)) throw new Error(`${label}.status is invalid`);
  if (!Array.isArray(provenance.refs) || provenance.refs.length === 0) throw new Error(`${label}.refs must not be empty`);
  provenance.refs.forEach((ref, index) => requiredText(ref, `${label}.refs[${index}]`, 2000));
  if (provenance.manifestHash !== undefined) validateHash(provenance.manifestHash, `${label}.manifestHash`);
}

function validateIntegrity(integrity: ConsumerIntegrity, label: string): void {
  if (!["PASS", "FAIL"].includes(integrity.status)) throw new Error(`${label}.status is invalid`);
  if (!integrity.checks || typeof integrity.checks !== "object" || Array.isArray(integrity.checks)) throw new Error(`${label}.checks must be an object`);
  for (const [key, value] of Object.entries(integrity.checks)) {
    requiredText(key, `${label}.checks key`, 120);
    if (!["PASS", "FAIL", "NOT_CHECKED"].includes(value)) throw new Error(`${label}.checks.${key} is invalid`);
  }
}

function validateChecks(checks: Readonly<Record<string, ConsumerCheckStatus>>, label: string): void {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) throw new Error(`${label} must be an object`);
  for (const [key, value] of Object.entries(checks)) {
    requiredText(key, `${label} key`, 120);
    if (!["PASS", "FAIL", "NOT_CHECKED"].includes(value)) throw new Error(`${label}.${key} is invalid`);
  }
}

function validateHash(value: string, label: string): void {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a 64-character hexadecimal hash`);
}

function requiredText(value: string, label: string, maxLength: number): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength || /[\r\n]/.test(value)) {
    throw new Error(`${label} must be a non-empty string of at most ${maxLength} characters`);
  }
}

function nonNegativeInteger(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
