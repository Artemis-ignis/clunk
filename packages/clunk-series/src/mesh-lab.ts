import { Logger, WebIO } from "@gltf-transform/core";
import { EXTMeshGPUInstancing, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { inspectAssetForTarget } from "../../core/src/assetops-pipeline";
import { sha256Hex } from "../../core/src/index";
import type { AssetEvidence, AssetKind } from "../../core/src/assetops-contract";
import type { ClunkSeriesId, SeriesProvenance } from "./contracts";
import { getClunkSeries } from "./catalog";

export interface ClunkMeshLabRequest {
  seriesId: Extract<ClunkSeriesId, "asset-forge" | "game-ready">;
  assetKind: Extract<AssetKind, "3d-model" | "animation-clip">;
  targetProfileId: string;
  fileName: string;
  bytes: Uint8Array;
  sourcePath?: string;
  sourceHash?: string;
  license?: string;
  runId?: string;
}

export interface ClunkMeshLabResult {
  status: "COMPLETED" | "BLOCKED";
  inputHash: string;
  outputHash: string;
  inputByteLength: number;
  outputByteLength: number;
  outputBytes: Uint8Array;
  transforms: readonly string[];
  provenance: SeriesProvenance;
  evidence: AssetEvidence;
  limitations: readonly string[];
}

/**
 * Clunk's native Game Ready mesh pass.
 *
 * The GitHub glTF-Transform and meshoptimizer projects are audited source
 * material. This boundary uses their installed libraries to write a separate
 * output and then reopens those output bytes through Clunk Core.
 */
export async function runClunkMeshLab(request: ClunkMeshLabRequest): Promise<ClunkMeshLabResult> {
  if (!request.fileName.toLowerCase().endsWith(".glb")) {
    throw new Error("Clunk mesh pass currently requires a GLB input.");
  }
  if (request.bytes.byteLength === 0) throw new Error("Clunk mesh pass requires non-empty input bytes.");

  const inputBytes = new Uint8Array(request.bytes);
  const inputHash = sha256Hex(inputBytes);
  if (request.sourceHash && request.sourceHash.toLowerCase() !== inputHash) {
    throw new Error("sourceHash does not match the supplied input bytes.");
  }

  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new WebIO()
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    // Harvest Frontier runtime assets may use GPU instancing. Register the
    // extension so the optimization rail can preserve and reopen those real
    // assets instead of failing before it reaches Game Ready inspection.
    .registerExtensions([EXTMeshGPUInstancing, EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const document = await io.readBinary(inputBytes);
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  await document.transform(
    prune(),
    dedup(),
    resample(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const outputBytes = new Uint8Array(await io.writeBinary(document));
  const outputHash = sha256Hex(outputBytes);
  const series = getClunkSeries(request.seriesId);
  const provenance: SeriesProvenance = {
    sourceKind: "existing-asset",
    seriesId: request.seriesId,
    sourceRecordIds: series.sourceRecordIds,
    sourcePath: request.sourcePath ?? `clunk-input://${request.fileName}`,
    sourceHash: inputHash,
    license: request.license ?? "review-required",
    licenseStatus: request.license === "creator-owned" ? "creator-owned" : "review-required",
    provider: "clunk-series-native-v1",
    productionReady: false,
  };
  const evidence = inspectAssetForTarget({
    runId: request.runId ?? `clunk-mesh-lab-${outputHash.slice(0, 16)}`,
    sourcePath: request.sourcePath ?? `clunk-input://${request.fileName}`,
    fileName: request.fileName,
    bytes: outputBytes,
    targetProfileId: request.targetProfileId,
    assetKind: request.assetKind,
    stageOverrides: {
      outputReopen: {
        status: "pass",
        message: "Clunk Game Ready reopened the optimized GLB output bytes for a fresh inspection.",
        evidence: [
          { key: "inputHash", value: inputHash },
          { key: "outputHash", value: outputHash },
          { key: "inputBytes", value: inputBytes.byteLength },
          { key: "outputBytes", value: outputBytes.byteLength },
        ],
        durationMs: 0,
        environmentId: "clunk-series-native-v1",
      },
    },
  });
  const status = evidence.status === "BLOCKED"
    || evidence.status === "UNSUPPORTED"
    || evidence.stages.bytes.status === "fail"
    || evidence.stages.bytes.status === "unsupported"
    || evidence.stages.structure.status === "fail"
    || evidence.stages.structure.status === "unsupported"
    || evidence.stages.policy.status === "fail"
    || evidence.stages.policy.status === "unsupported"
    ? "BLOCKED"
    : "COMPLETED";

  return {
    status,
    inputHash,
    outputHash,
    inputByteLength: inputBytes.byteLength,
    outputByteLength: outputBytes.byteLength,
    outputBytes,
    transforms: ["gltf-transform:prune", "gltf-transform:dedup", "gltf-transform:resample", "meshoptimizer:meshopt"],
    provenance,
    evidence,
    limitations: [
      "원본 입력 bytes는 보존되고 최적화 결과는 별도 output으로 작성됩니다.",
      "meshopt 압축은 geometry 전송 최적화이며 polygon 수나 런타임 시각 품질 승인을 의미하지 않습니다.",
      ...(evidence.stages.runtime.status === "environmentUnavailable" ? ["target runtime capture 환경이 없어 runtime evidence는 미제공입니다."] : []),
    ],
  };
}
