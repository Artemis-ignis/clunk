export type AssetKind =
  | "3d-model"
  | "2d-image"
  | "sprite-atlas"
  | "spine-project"
  | "animation-clip";

export type TargetEngine = "web-three" | "godot" | "unity" | "unreal";

export type TargetPlatform = "desktop" | "android" | "ios" | "web";

export interface TargetPlugin {
  id: string;
  version?: string;
  required: boolean;
}

export interface TargetProfile {
  id: string;
  label: string;
  engine: TargetEngine;
  engineVersion: string;
  platform: TargetPlatform;
  renderer?: string;
  importer?: { id: string; version?: string };
  plugins: readonly TargetPlugin[];
  acceptedFormats: readonly string[];
  assetKinds: readonly AssetKind[];
  coordinateSystem: {
    up: "x" | "y" | "z";
    forward: "x" | "y" | "z";
    unitMeters: number;
  };
  texturePolicy: {
    maxDimension: number;
    formats: readonly string[];
    memoryBudgetBytes?: number;
    compression?: readonly string[];
  };
  animationPolicy?: {
    requiredClips?: readonly string[];
    maxClipCount?: number;
    rootMotion?: "required" | "forbidden" | "any";
  };
  semanticRules?: readonly string[];
  requiresDeviceGate?: boolean;
}

export type GateStatus =
  | "pass"
  | "fail"
  | "blocked"
  | "notRun"
  | "environmentUnavailable"
  | "unsupported";

export interface GateEvidence {
  key: string;
  value: string | number | boolean | null;
}

export interface GateResult {
  status: GateStatus;
  message: string;
  evidence: readonly GateEvidence[];
  durationMs: number;
  logPath?: string;
  capturePath?: string;
  environmentId?: string;
}

export interface AssetEvidenceFinding {
  id: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  path?: string;
}

export interface AssetEvidenceSource {
  path: string;
  bytes: number;
  sha256: string;
  format: string;
}

export interface AssetEvidenceRecipe {
  id: string;
  version: string;
  recipeHash: string;
  inputHash?: string;
}

export interface AssetEvidenceArtifact {
  path: string;
  sha256: string;
  passportId: string;
}

export interface AssetEvidenceStages {
  bytes: GateResult;
  structure: GateResult;
  policy: GateResult;
  import: GateResult;
  runtime: GateResult;
  device?: GateResult;
  outputReopen?: GateResult;
}

export type AssetEvidenceStatus =
  | "READY"
  | "CONDITIONAL"
  | "BLOCKED"
  | "UNSUPPORTED"
  | "ENVIRONMENT_UNAVAILABLE";

export interface AssetEvidence {
  runId: string;
  assetKind: AssetKind;
  source: AssetEvidenceSource;
  recipe?: AssetEvidenceRecipe;
  target: TargetProfile;
  stages: AssetEvidenceStages;
  findings: readonly AssetEvidenceFinding[];
  artifact?: AssetEvidenceArtifact;
  status: AssetEvidenceStatus;
  productionReady: boolean;
}

export interface CreateEvidenceEnvelopeInput {
  runId: string;
  assetKind?: AssetKind;
  source: AssetEvidenceSource;
  recipe?: AssetEvidenceRecipe;
  target: TargetProfile;
  stages: AssetEvidenceStages;
  findings: readonly AssetEvidenceFinding[];
  artifact?: AssetEvidenceArtifact;
}

const BLOCKING_GATE_STATUSES = new Set<GateStatus>(["fail", "blocked"]);

function allStages(stages: AssetEvidenceStages): GateResult[] {
  return Object.values(stages).filter((stage): stage is GateResult => stage !== undefined);
}

function statusFor(input: CreateEvidenceEnvelopeInput): AssetEvidenceStatus {
  const stages = allStages(input.stages);
  if (stages.some((stage) => BLOCKING_GATE_STATUSES.has(stage.status))) return "BLOCKED";
  if (stages.some((stage) => stage.status === "unsupported")) return "UNSUPPORTED";
  if (stages.some((stage) => stage.status === "environmentUnavailable")) {
    return "ENVIRONMENT_UNAVAILABLE";
  }

  const required = [
    input.stages.bytes,
    input.stages.structure,
    input.stages.policy,
    input.stages.import,
    input.stages.runtime,
    input.target.requiresDeviceGate ? input.stages.device : undefined,
    input.artifact ? input.stages.outputReopen : undefined,
  ].filter((stage): stage is GateResult => stage !== undefined);
  if (required.some((stage) => stage.status === "notRun")) return "CONDITIONAL";
  return required.every((stage) => stage.status === "pass") ? "READY" : "CONDITIONAL";
}

export function createEvidenceEnvelope(input: CreateEvidenceEnvelopeInput): AssetEvidence {
  const status = statusFor(input);
  const hasBlockingFinding = input.findings.some(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  );
  return {
    runId: input.runId,
    assetKind: input.assetKind ?? "3d-model",
    source: input.source,
    ...(input.recipe ? { recipe: input.recipe } : {}),
    target: input.target,
    stages: input.stages,
    findings: input.findings,
    ...(input.artifact ? { artifact: input.artifact } : {}),
    status: hasBlockingFinding && status === "READY" ? "BLOCKED" : status,
    productionReady: status === "READY" && !hasBlockingFinding,
  };
}
