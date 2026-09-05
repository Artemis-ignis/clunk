/*
 * clunk.visual-evidence.v1 — the part of the pipeline that is safe everywhere.
 *
 * Everything re-exported here is pure JavaScript with no Node, filesystem, three or sharp import,
 * so `export * from "./visual-evidence"` in the package index cannot drag a native module into a
 * Workers bundle.
 *
 * The two Node-only modules are imported by path instead, by the CLI and by the MCP tool:
 *   ./glb-node      GLB bytes -> world-space triangles (three, meshopt, palette unbake)
 *   ./capture-node  the whole run: inspect, render, hash, measure, decide, write the envelope
 */

export * from "./types";
export * from "./views";
export {
  RASTER_BACKGROUND,
  FLOOR_Y,
  placeCamera,
  renderView,
  encodePng,
  storedDeflate,
  type DeflateFn,
  type RenderInput,
  type RenderOutput,
} from "./raster";
export {
  EDGE_THRESHOLD,
  LOCAL_CONTRAST_THRESHOLD,
  READABILITY_PX,
  PALETTE_BUCKET_MIN_SHARE,
  SUBJECT_ALPHA,
  digestScene,
  lowestVertexY,
  luma,
  measureCapture,
  measureGroundContact,
  measureMotion,
  measureReadability,
  measureSilhouetteChange,
  resampleRgb,
  rgbToLab,
  type GroundContactMeasurement,
  type MeasureOptions,
  type MotionMeasurement,
  type ReadabilityMetrics,
  type SilhouetteChangeMeasurement,
  type SilhouetteChangePair,
} from "./metrics";
export {
  VISUAL_THRESHOLDS,
  combineVerdicts,
  evaluateChecks,
  humanDecisionFor,
  laneVerdict,
  summarise,
  type EngineViewSample,
  type MachineHumanDecision,
  type PlayerViewSample,
  type VerdictInput,
} from "./verdict";
export {
  ASSET_INSPECTION_EVIDENCE_V3_SCHEMA,
  ASSET_INSPECTION_EVIDENCE_V3_VERSION,
  cameraPoseHash,
  createVisualAssetInspectionEvidenceV3,
  normalizeAssetInspectionEvidenceV3,
  playerFacingStatusFor,
  readAssetInspectionEvidence,
  toAssetInspectionEvidenceV2,
  visualRuntimeStatusFor,
  type AnyAssetInspectionEvidence,
  type AssetInspectionEvidenceKindV3,
  type AssetInspectionEvidenceStatusesV3,
  type AssetInspectionEvidenceV3,
  type CreateVisualEvidenceOptions,
  type DecisionAuthority,
  type HumanDecisionV3,
  type MachineCaptureEvidenceV3,
  type VisualRuntimeStatusV3,
} from "./evidence";
