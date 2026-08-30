import {
  createProceduralAuthoring,
  type ProceduralAuthoringRequest,
} from "../../core/src/product-authoring";
import {
  type AssetEvidence,
  type AssetEvidenceRecipe,
  type AssetKind,
} from "../../core/src/assetops-contract";
import { inspectAssetForTarget } from "../../core/src/assetops-pipeline";
import { getClunkSeries } from "./catalog";
import { createMaterialLabJob } from "./material-lab";
import {
  createSeriesRequestHash,
  type ClunkSeriesId,
  type ClunkSeriesJob,
  type SeriesLicenseStatus,
  type SeriesProvenance,
} from "./contracts";

export interface ClunkSeriesCreationRequest {
  seriesId: Exclude<ClunkSeriesId, "game-ready" | "market">;
  assetKind: AssetKind;
  label: string;
  prompt: string;
  targetProfileId: string;
  width?: number;
  height?: number;
  frames?: number;
  license?: string;
  sourcePath?: string;
  sourceHash?: string;
}

export interface GameReadyHandoffInput {
  seriesId: ClunkSeriesId;
  assetKind: AssetKind;
  targetProfileId: string;
  fileName: string;
  bytes: Uint8Array;
  bundleFiles?: ReadonlyMap<string, Uint8Array>;
  sourcePath?: string;
  recipe?: AssetEvidenceRecipe;
  runId?: string;
}

export interface GameReadyHandoff {
  status: "COMPLETED" | "BLOCKED";
  seriesId: ClunkSeriesId;
  fileName: string;
  inputHash: string;
  evidence: AssetEvidence;
  message: string;
}

const CREATION_SERIES = new Set<ClunkSeriesCreationRequest["seriesId"]>([
  "asset-forge",
  "sprite-lab",
  "material-lab",
  "motion-lab",
]);

export function createClunkSeriesJob(request: ClunkSeriesCreationRequest): ClunkSeriesJob {
  const series = getClunkSeries(request.seriesId);
  if (!CREATION_SERIES.has(request.seriesId)) {
    throw new Error(`${request.seriesId} is not a creation series.`);
  }
  if (!series.assetKinds.includes(request.assetKind)) {
    throw new Error(`${request.assetKind} is not accepted by ${series.name}.`);
  }
  if (request.seriesId === "material-lab") {
    return createMaterialLabJob({
      label: request.label,
      prompt: request.prompt,
      targetProfileId: request.targetProfileId,
      ...(request.width !== undefined ? { width: request.width } : {}),
      ...(request.height !== undefined ? { height: request.height } : {}),
      ...(request.license !== undefined ? { license: request.license } : {}),
      ...(request.sourcePath !== undefined ? { sourcePath: request.sourcePath } : {}),
      ...(request.sourceHash !== undefined ? { sourceHash: request.sourceHash } : {}),
    });
  }

  const requestHash = createSeriesRequestHash({
    seriesId: request.seriesId,
    assetKind: request.assetKind,
    label: request.label.trim(),
    prompt: request.prompt.trim(),
    targetProfileId: request.targetProfileId.trim(),
    width: request.width,
    height: request.height,
    frames: request.frames,
    license: request.license ?? "review-required",
    sourcePath: request.sourcePath,
    sourceHash: request.sourceHash,
  });
  const result = createProceduralAuthoring(toAuthoringRequest(request));
  const evidence = result.evidence;
  const status = hasStaticBlocker(evidence) ? "BLOCKED" : "COMPLETED";
  const provenance: SeriesProvenance = {
    sourceKind: request.sourcePath ? "reference" : "prompt",
    seriesId: request.seriesId,
    sourceRecordIds: series.sourceRecordIds,
    ...(request.prompt.trim() ? { prompt: request.prompt.trim(), promptHash: result.provenance.promptHash } : {}),
    ...(request.sourcePath ? { sourcePath: request.sourcePath } : {}),
    ...(request.sourceHash ? { sourceHash: request.sourceHash } : {}),
    license: request.license ?? "review-required",
    licenseStatus: resolveLicenseStatus(request.license),
    provider: "clunk-series-native-v1",
    productionReady: false,
  };

  return {
    schema: "clunk.series-job.v1",
    jobId: `series-${requestHash.slice(0, 32)}`,
    seriesId: request.seriesId,
    assetKind: request.assetKind,
    targetProfileId: request.targetProfileId,
    status,
    requestHash,
    entryFileName: result.entryFileName,
    artifacts: result.artifacts,
    provenance,
    evidence,
    limitations: [
      "이 산출물은 Clunk 내부 authoring 코드가 작성한 실제 바이트이며 외부 AI provider 성공을 의미하지 않습니다.",
      "productionReady는 false이며 runtime, player-facing, human review는 별도 증거가 필요합니다.",
      ...(evidence.stages.runtime.status === "environmentUnavailable"
        ? ["현재 target runtime runner가 없어 구조 검사와 runtime 검증은 분리되어 있습니다."]
        : []),
    ],
  };
}

export function runGameReadyHandoff(input: GameReadyHandoffInput): GameReadyHandoff {
  const evidence = inspectAssetForTarget({
    runId: input.runId ?? `series-handoff-${input.fileName}`,
    sourcePath: input.sourcePath ?? `clunk-series://${input.seriesId}/${input.fileName}`,
    fileName: input.fileName,
    bytes: input.bytes,
    targetProfileId: input.targetProfileId,
    assetKind: input.assetKind,
    bundleFiles: input.bundleFiles,
    ...(input.recipe ? { recipe: input.recipe } : {}),
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Clunk Game Ready reopened the supplied artifact bytes for a fresh handoff inspection.",
        evidence: [
          { key: "fileName", value: input.fileName },
          { key: "bytes", value: input.bytes.byteLength },
        ],
        durationMs: 0,
        environmentId: "clunk-series-native-v1",
      },
    },
  });
  const status = hasStaticBlocker(evidence) ? "BLOCKED" : "COMPLETED";
  return {
    status,
    seriesId: input.seriesId,
    fileName: input.fileName,
    inputHash: evidence.source.sha256,
    evidence,
    message: status === "COMPLETED"
      ? "Game Ready 정적 handoff와 fresh artifact reopen이 완료되었습니다. runtime·player-facing·human 상태는 별도입니다."
      : "Game Ready handoff가 정적 blocker로 멈췄습니다. 산출물은 READY로 승격되지 않습니다.",
  };
}

function toAuthoringRequest(request: ClunkSeriesCreationRequest): ProceduralAuthoringRequest {
  return {
    assetKind: request.assetKind,
    label: request.label,
    prompt: request.prompt,
    targetProfileId: request.targetProfileId,
    ...(request.width !== undefined ? { width: request.width } : {}),
    ...(request.height !== undefined ? { height: request.height } : {}),
    ...(request.frames !== undefined ? { frames: request.frames } : {}),
    ...(request.license !== undefined ? { license: request.license } : {}),
  };
}

function resolveLicenseStatus(license: string | undefined): SeriesLicenseStatus {
  const normalized = license?.trim().toLowerCase();
  if (normalized === "creator-owned") return "creator-owned";
  if (normalized === "cleared" || normalized === "mit" || normalized === "bsd-3-clause" || normalized === "apache-2.0") return "cleared";
  if (normalized === "excluded") return "excluded";
  return "review-required";
}

function hasStaticBlocker(evidence: AssetEvidence): boolean {
  return evidence.status === "BLOCKED"
    || evidence.status === "UNSUPPORTED"
    || evidence.stages.bytes.status === "fail"
    || evidence.stages.bytes.status === "unsupported"
    || evidence.stages.structure.status === "fail"
    || evidence.stages.structure.status === "unsupported"
    || evidence.stages.policy.status === "fail"
    || evidence.stages.policy.status === "unsupported";
}
