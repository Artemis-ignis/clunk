export type AssetKind =
  | "3d-model"
  | "2d-image"
  | "sprite-atlas"
  | "spine-project"
  | "animation-clip";

export type TargetEngine = "web-three" | "pixi-js" | "godot" | "unity" | "unreal";

export type TargetPlatform = "desktop" | "android" | "ios" | "web";

export interface TargetPlugin {
  id: string;
  version?: string;
  required: boolean;
}

export interface TargetInspectionPolicy {
  maxTriangles?: number;
  maxMaterials?: number;
  maxTextureMemoryBytes?: number;
  maxTextureDimension?: number;
  readyScoreThreshold?: number;
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
  inspectionPolicy?: TargetInspectionPolicy;
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
  /**
   * 규칙 id. `id` 는 `<ruleId>:<path>` 라 기계가 분류하려면 문자열을 잘라야 했다.
   *
   * 2026-09-05 마을 광장 키트 실측: 로컬 stdio 응답에는 이 값이 없어서, 결과를 분류하려고
   * 한국어 메시지를 정규식으로 긁어야 했다(`/교차/`). 원격 응답에는 들어 있었다.
   */
  ruleId?: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  path?: string;
}

/**
 * 구조 검사기가 낸 점수 요약.
 *
 * 2026-09-05 두 키트가 같은 것을 지적했다: 로컬 stdio 응답에서 점수를 꺼내려면
 * `stages.policy.evidence[]` 안의 `{key:"score"}` 를 배열에서 뒤져야 했고, 원격은
 * 최상위에 valid/score/hardBlockerCount 를 준다. 봉투가 직접 들고 있게 한다.
 */
export interface AssetEvidenceScore {
  score: number;
  threshold: number;
  ready: boolean;
  hardBlockerCount: number;
  ruleSetId: string;
}

export type AssetQualityWarningDomain = "texture" | "sprite" | "spine" | "animation" | "model";

export interface AssetQualityWarning {
  id: string;
  domain: AssetQualityWarningDomain;
  status: "NON_BLOCKING";
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

/*
 * 무엇이 돌았고 무엇이 못 돌았는가.
 *
 * 2026-09-05 실측(clunk.games 라이브): 같은 mine-cart.glb 를 unity·godot-4·unreal·
 * web-three-mobile 에 넣으면 `valid: true, score: 99`가 나가면서 evidence.status 는
 * "ENVIRONMENT_UNAVAILABLE" 이었다. 응답 어디에도 "점수는 파일만 보고 낸 것이고
 * 에디터 임포트와 런타임 캡처는 아예 돌지 않았다"는 말이 없었다. 위쪽만 읽는
 * 에이전트에게 그것은 통과로 읽힌다.
 *
 * 그래서 게이트를 두 갈래(레인)로 갈라 응답이 직접 말하게 한다:
 *   file-only          — 바이트만 있으면 끝까지 도는 것(형식·구조·예산·재질·텍스처·물리)
 *   engine-environment — 엔진 설치본이 있어야 도는 것(에디터 임포트, 런타임 캡처, 기기)
 * 상위 `valid`/`score`가 어느 레인의 결과인지는 `scoreBasis`가 이름으로 말한다.
 */
export type EvidenceLaneKind = "file-only" | "engine-environment";

export type EvidenceLaneStatus =
  | "RAN"
  | "FAILED"
  | "NOT_RUN"
  | "ENVIRONMENT_UNAVAILABLE"
  | "UNSUPPORTED";

export interface EvidenceLane {
  id: "bytes" | "structure" | "policy" | "import" | "runtime" | "device" | "outputReopen";
  kind: EvidenceLaneKind;
  status: EvidenceLaneStatus;
  /** 이 레인을 만든 게이트의 원래 상태. 기존 stages 와 1:1 로 대응한다. */
  gateStatus: GateStatus;
  message: string;
}

export interface AssetEvidenceCoverage {
  schema: "clunk.evidence-coverage.v1";
  lanes: readonly EvidenceLane[];
  /** 끝까지 돈 레인의 id. */
  ranLanes: readonly string[];
  /** 돌지 못한 레인. 이유는 각 레인의 status·message 에 있다. */
  skippedLanes: readonly EvidenceLane[];
  /** 파일만으로 도는 레인의 판정. */
  fileContract: "PASS" | "FAIL" | "NOT_RUN";
  /** 엔진 환경이 필요한 레인이 실제로 돌았는가. */
  engineEnvironment: "RAN" | "NOT_RUN";
  /** 상위 valid/score 가 무엇을 근거로 하는가. */
  scoreBasis: "FILE_ONLY" | "FILE_AND_ENGINE" | "NOT_SCORED";
  /** 이 바이트에 실제로 적용한 규칙 묶음의 id. */
  ruleSetsRun: readonly string[];
  /** 실제로 평가한 규칙 id 전부. 여기 없는 id 는 이 응답이 아무 말도 하지 않은 것이다. */
  ranRules: readonly string[];
  summary: string;
}

export interface AssetEvidence {
  /**
   * 이 봉투의 모양 이름.
   *
   * 2026-09-05 지적: 로컬 stdio 는 이 객체를 최상위로 돌려주고, 원격 HTTP 는
   * `clunk.asset-inspection-response.v2` 안의 `evidence` 로 한 겹 넣어 돌려준다.
   * 두 표면을 다 쓰는 코드가 모양을 분간할 수 있도록 봉투 자신이 이름을 갖는다.
   */
  schema: "clunk.asset-evidence.v1";
  runId: string;
  assetKind: AssetKind;
  source: AssetEvidenceSource;
  ruleSetId?: string;
  ruleSetVersion?: string;
  recipe?: AssetEvidenceRecipe;
  target: TargetProfile;
  stages: AssetEvidenceStages;
  findings: readonly AssetEvidenceFinding[];
  qualityWarnings: readonly AssetQualityWarning[];
  artifact?: AssetEvidenceArtifact;
  status: AssetEvidenceStatus;
  productionReady: boolean;
  /** 어느 검사가 돌았고 어느 검사가 못 돌았는지. 기존 필드는 그대로 두고 더한 것이다. */
  coverage: AssetEvidenceCoverage;
  /** 구조 검사기가 낸 점수. 3D 모델이 아니어서 점수를 내지 않았으면 없다. */
  score?: AssetEvidenceScore;
}

export interface CreateEvidenceEnvelopeInput {
  runId: string;
  assetKind?: AssetKind;
  source: AssetEvidenceSource;
  ruleSetId?: string;
  ruleSetVersion?: string;
  recipe?: AssetEvidenceRecipe;
  target: TargetProfile;
  stages: AssetEvidenceStages;
  findings: readonly AssetEvidenceFinding[];
  qualityWarnings?: readonly AssetQualityWarning[];
  artifact?: AssetEvidenceArtifact;
  score?: AssetEvidenceScore;
  /** 이 바이트에 실제로 적용한 규칙 묶음. 없으면 coverage 가 "알 수 없음"으로 나간다. */
  ruleSetsRun?: readonly string[];
  /** 실제로 평가한 규칙 id. 없으면 coverage.ranRules 는 빈 배열이다. */
  ranRules?: readonly string[];
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

const LANE_KIND: Record<EvidenceLane["id"], EvidenceLaneKind> = {
  bytes: "file-only",
  structure: "file-only",
  policy: "file-only",
  // 이 셋은 엔진 설치본이 있어야 돈다. 파일만 받은 검사는 이 칸을 채울 수 없다.
  import: "engine-environment",
  runtime: "engine-environment",
  device: "engine-environment",
  outputReopen: "file-only",
};

const LANE_ORDER: readonly EvidenceLane["id"][] = [
  "bytes",
  "structure",
  "policy",
  "import",
  "runtime",
  "device",
  "outputReopen",
];

function laneStatusOf(gate: GateStatus): EvidenceLaneStatus {
  if (gate === "pass") return "RAN";
  // fail/blocked 은 검사가 돌아서 답을 낸 것이다 — 안 돈 것과 섞지 않는다.
  if (gate === "fail" || gate === "blocked") return "FAILED";
  if (gate === "environmentUnavailable") return "ENVIRONMENT_UNAVAILABLE";
  if (gate === "unsupported") return "UNSUPPORTED";
  return "NOT_RUN";
}

/**
 * 게이트를 레인으로 옮겨 적고, 상위 점수가 어느 레인의 것인지 이름 붙인다.
 *
 * 여기서 판정을 새로 만들지 않는다. `stages` 에 이미 들어 있는 사실을 읽는 쪽이
 * 분간할 수 있는 모양으로 다시 적을 뿐이다.
 */
export function buildEvidenceCoverage(input: CreateEvidenceEnvelopeInput): AssetEvidenceCoverage {
  const lanes: EvidenceLane[] = [];
  for (const id of LANE_ORDER) {
    const gate = input.stages[id];
    if (!gate) continue;
    lanes.push({ id, kind: LANE_KIND[id], status: laneStatusOf(gate.status), gateStatus: gate.status, message: gate.message });
  }
  const fileLanes = lanes.filter((lane) => lane.kind === "file-only");
  const engineLanes = lanes.filter((lane) => lane.kind === "engine-environment");
  const ranLanes = lanes.filter((lane) => lane.status === "RAN" || lane.status === "FAILED");
  const skippedLanes = lanes.filter((lane) => lane.status !== "RAN" && lane.status !== "FAILED");
  const fileRan = fileLanes.filter((lane) => lane.status === "RAN" || lane.status === "FAILED");
  const fileContract: AssetEvidenceCoverage["fileContract"] = fileRan.length === 0
    ? "NOT_RUN"
    : fileRan.some((lane) => lane.status === "FAILED")
      ? "FAIL"
      : "PASS";
  const engineEnvironment: AssetEvidenceCoverage["engineEnvironment"] =
    engineLanes.length > 0 && engineLanes.every((lane) => lane.status === "RAN" || lane.status === "FAILED")
      ? "RAN"
      : "NOT_RUN";
  const scoreBasis: AssetEvidenceCoverage["scoreBasis"] = fileContract === "NOT_RUN"
    ? "NOT_SCORED"
    : engineEnvironment === "RAN"
      ? "FILE_AND_ENGINE"
      : "FILE_ONLY";
  const summary = scoreBasis === "NOT_SCORED"
    ? `No lane produced a verdict for ${input.target.id}: ${skippedLanes.map((lane) => lane.id).join(", ") || "none"} did not run.`
    : scoreBasis === "FILE_ONLY"
      ? `File-only lanes (${fileRan.map((lane) => lane.id).join(", ")}) ran and answered ${fileContract}. The ${input.target.engine} lanes (${engineLanes.map((lane) => lane.id).join(", ") || "none"}) did not run, so nothing here says the asset imports or renders in ${input.target.label}. Any score is the file contract's score only.`
      : `Every lane ran for ${input.target.label}.`;
  return {
    schema: "clunk.evidence-coverage.v1",
    lanes,
    ranLanes: ranLanes.map((lane) => lane.id),
    skippedLanes,
    fileContract,
    engineEnvironment,
    scoreBasis,
    ruleSetsRun: input.ruleSetsRun ?? (input.ruleSetId ? [input.ruleSetId] : []),
    ranRules: input.ranRules ?? [],
    summary,
  };
}

export function createEvidenceEnvelope(input: CreateEvidenceEnvelopeInput): AssetEvidence {
  const status = statusFor(input);
  const hasBlockingFinding = input.findings.some(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  );
  return {
    schema: "clunk.asset-evidence.v1",
    runId: input.runId,
    assetKind: input.assetKind ?? "3d-model",
    source: input.source,
    ...(input.ruleSetId ? { ruleSetId: input.ruleSetId } : {}),
    ...(input.ruleSetVersion ? { ruleSetVersion: input.ruleSetVersion } : {}),
    ...(input.recipe ? { recipe: input.recipe } : {}),
    target: input.target,
    stages: input.stages,
    findings: input.findings,
    qualityWarnings: input.qualityWarnings ?? [],
    ...(input.artifact ? { artifact: input.artifact } : {}),
    ...(input.score ? { score: input.score } : {}),
    status: hasBlockingFinding && status === "READY" ? "BLOCKED" : status,
    productionReady: status === "READY" && !hasBlockingFinding,
    coverage: buildEvidenceCoverage(input),
  };
}
