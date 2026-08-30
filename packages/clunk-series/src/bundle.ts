import { sha256Hex, stableStringify } from "../../core/src/index";
import { seriesArtifactManifest } from "./contracts";
import type { ClunkSeriesJob, SeriesArtifact, SeriesBundleManifest } from "./contracts";

export interface SeriesBundle {
  manifest: SeriesBundleManifest;
  files: readonly SeriesArtifact[];
}

export function createSeriesBundle(job: ClunkSeriesJob): SeriesBundle {
  const manifest = seriesArtifactManifest(job);
  const bytes = new TextEncoder().encode(`${stableStringify(manifest)}\n`);
  const manifestArtifact: SeriesArtifact = {
    fileName: `${job.jobId}.clunk.json`,
    role: "manifest",
    contentType: "application/json",
    byteLength: bytes.byteLength,
    sha256: sha256Hex(bytes),
    bytes,
  };
  return { manifest, files: [...job.artifacts, manifestArtifact] };
}
