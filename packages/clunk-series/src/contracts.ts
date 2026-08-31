import { sha256Hex, stableStringify } from "../../core/src/index";
import type { AssetEvidence, AssetKind } from "../../core/src/assetops-contract";

export type ClunkSeriesId =
  | "asset-forge"
  | "sprite-lab"
  | "material-lab"
  | "motion-lab"
  | "game-ready"
  | "market";

export type ClunkSeriesIntegration = "adopted" | "adapted" | "research-only" | "excluded-license";

export type ClunkSeriesAvailability = "native" | "research-only" | "planned";

export interface ClunkSeriesDescriptor {
  id: ClunkSeriesId;
  name: string;
  description: string;
  availability: ClunkSeriesAvailability;
  assetKinds: readonly AssetKind[];
  sourceRecordIds: readonly string[];
  capabilities: readonly string[];
}

export interface ClunkSourceRecord {
  id: string;
  repository: string;
  commit: string;
  license: string;
  clonePath: string;
  integration: ClunkSeriesIntegration;
  notes: string;
}

export type SeriesLicenseStatus = "creator-owned" | "cleared" | "review-required" | "excluded";

export type ClunkSeriesJobStatus = "COMPLETED" | "BLOCKED" | "ENVIRONMENT_UNAVAILABLE";

export interface SeriesArtifact {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface SeriesProvenance {
  sourceKind: "prompt" | "reference" | "existing-asset";
  seriesId: ClunkSeriesId;
  sourceRecordIds: readonly string[];
  prompt?: string;
  promptHash?: string;
  sourcePath?: string;
  sourceHash?: string;
  license: string;
  licenseStatus: SeriesLicenseStatus;
  provider: "clunk-series-native-v1";
  productionReady: false;
}

export interface ClunkSeriesJob {
  schema: "clunk.series-job.v1";
  jobId: string;
  seriesId: ClunkSeriesId;
  assetKind: AssetKind;
  targetProfileId: string;
  status: ClunkSeriesJobStatus;
  requestHash: string;
  entryFileName: string;
  artifacts: readonly SeriesArtifact[];
  provenance: SeriesProvenance;
  evidence?: AssetEvidence;
  limitations: readonly string[];
}

export interface SeriesBundleManifest {
  schema: "clunk.series-bundle.v1";
  jobId: string;
  seriesId: ClunkSeriesId;
  assetKind: AssetKind;
  targetProfileId: string;
  requestHash: string;
  entryFileName: string;
  artifacts: readonly Omit<SeriesArtifact, "bytes">[];
  provenance: SeriesProvenance;
  productionReady: false;
}

export function createSeriesRequestHash(input: unknown): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(input)));
}

export function seriesArtifactManifest(job: ClunkSeriesJob): SeriesBundleManifest {
  return {
    schema: "clunk.series-bundle.v1",
    jobId: job.jobId,
    seriesId: job.seriesId,
    assetKind: job.assetKind,
    targetProfileId: job.targetProfileId,
    requestHash: job.requestHash,
    entryFileName: job.entryFileName,
    artifacts: job.artifacts.map(({ fileName, role, contentType, byteLength, sha256 }) => ({
      fileName,
      role,
      contentType,
      byteLength,
      sha256,
    })),
    provenance: job.provenance,
    productionReady: false,
  };
}
