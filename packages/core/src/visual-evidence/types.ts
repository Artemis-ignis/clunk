/*
 * clunk.visual-evidence.v1 — shared shapes.
 *
 * Nothing in this file imports Node, three, sharp or the filesystem. A caller hands over a
 * decoded scene (triangles already in world space) and receives captures plus a machine
 * verdict. The Node-only decode adapter lives in glb-node.ts and is deliberately not part of
 * the package index, so a Workers bundle that imports Clunk Core never pulls a native module in.
 */

export const VISUAL_EVIDENCE_SCHEMA = "clunk.visual-evidence.v1" as const;
export const VISUAL_EVIDENCE_TOOL_VERSION = "clunk-visual-evidence/1.0.0" as const;
/** Bumped whenever a raster or metric change would move a capture hash. */
export const VISUAL_EVIDENCE_RENDERER_VERSION = "1.0.0" as const;

export type Vec3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

/** One pose of one asset, flattened to world-space triangles. 9 floats of position per triangle. */
export interface VisualScene {
  triangleCount: number;
  /** 9 floats per triangle: ax ay az bx by bz cx cy cz. */
  positions: Float32Array;
  /** 3 floats per triangle, linear-to-sRGB already applied, 0..1. */
  colors: Float32Array;
}

export interface SceneBounds {
  min: Vec3;
  max: Vec3;
}

export interface AnimationPhaseScene {
  /** 0, 1/3, 2/3 of the clip. */
  phase: number;
  scene: VisualScene;
}

export interface AnimationSceneSet {
  clip: string;
  durationSeconds: number;
  trackCount: number;
  phases: AnimationPhaseScene[];
}

/** Everything the renderer needs. Produced by a decoder; consumed by pure code. */
export interface VisualSceneSet {
  rest: VisualScene;
  bounds: SceneBounds;
  /** Rest-pose size in metres, x/y/z. */
  sizeMetres: Vec3;
  meshCount: number;
  vertexColouredMeshCount: number;
  /** Null when the file carries no animation, or when the decoder could not pose it. */
  animation: AnimationSceneSet | null;
  /** Every clip the file declares, whether or not it was sampled. */
  declaredClips: readonly { name: string; seconds: number; tracks: number }[];
}

export type CaptureLane = "visualRuntime" | "playerFacing";

export interface CameraPose {
  eye: Vec3;
  target: Vec3;
  fovYDeg: number;
}

export interface CaptureViewSpec {
  id: string;
  lane: CaptureLane;
  label: string;
  label_ko: string;
  width: number;
  height: number;
  supersample: number;
  /**
   * "orbit": the camera sits on a unit direction from the subject centre and the framing is
   * solved so the subject fills `targetFill` of the frame — a product photograph.
   * "player": the camera sits at a fixed eye height and a fixed ground distance and does not
   * reframe, because the whole point is how large the asset actually looks from there.
   */
  kind: "orbit" | "player";
  /** orbit only. */
  direction?: Vec3;
  targetFill?: number;
  /** player only, in metres. */
  eyeHeightMetres?: number;
  distanceMetres?: number;
  fovYDeg: number;
  shadow: boolean;
  /** Motion phases render the same view three times; only the first writes the still capture. */
  motion?: boolean;
}

export interface RasterResult {
  width: number;
  height: number;
  /** Final-size RGB8, three bytes per pixel. */
  rgb: Uint8Array;
  /** Final-size subject coverage, 0..1 (a supersample-averaged mask, not the shadow). */
  alpha: Float32Array;
  /** Subject pixel count measured at supersample resolution, divided by the supersampled area. */
  coverageRatio: number;
  /** Subject bounding box in final-size pixels; null when nothing was drawn. */
  bbox: { x: number; y: number; width: number; height: number } | null;
  clipped: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  /**
   * Per final-size column: how far, in final-size pixels, the lowest drawn pixel of the asset
   * sits above the floor directly beneath it, read back through the z-buffer. NaN where the
   * column holds no asset.
   */
  groundGapPx: Float32Array;
  drawnTriangleCount: number;
}

export type VisualCheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
export type VisualVerdict = "PASS" | "REVIEW" | "FAIL";

export type VisualCheckId =
  | "silhouette"
  | "framing"
  | "groundContact"
  | "exposure"
  | "palette"
  | "readability46"
  | "motion";

export interface VisualCheck {
  id: VisualCheckId;
  lane: CaptureLane;
  status: VisualCheckStatus;
  /** The measured numbers this status was decided from. Never a rounded-away zero. */
  observed: Record<string, number | null>;
  /** The rule, written out, so a reader can recompute the status from `observed`. */
  threshold: string;
  reason: string;
  reason_ko: string;
  captureIds: string[];
}

export interface CaptureMetrics {
  silhouetteFillRatio: number;
  boundingFillRatio: number;
  clippedEdgeCount: number;
  subjectMeanLuma: number;
  subjectLumaP05: number;
  subjectLumaP95: number;
  subjectLumaRange: number;
  crushedBlackRatio: number;
  blownWhiteRatio: number;
  paletteColorCount: number;
  backgroundSeparationDeltaE76: number;
  /** Ground band, measured only on the player view the rig picked; null elsewhere. */
  groundContactColumnRatio: number | null;
  groundMedianGapRatio: number | null;
  groundMaxGapRatio: number | null;
  /** The 46 px raster the UI readability contract uses, run on this capture. */
  readability46: {
    luminanceRange: number;
    edgeDensity: number;
    meanGradient: number;
    localContrastCoverage: number;
  };
}

export interface VisualCaptureRecord {
  id: string;
  lane: CaptureLane;
  label: string;
  label_ko: string;
  path: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  camera: {
    eyeMetres: Vec3;
    targetMetres: Vec3;
    fovYDeg: number;
    eyeHeightMetres: number | null;
    groundDistanceMetres: number | null;
  };
  cameraPoseHash: string;
  /**
   * True when the fixed player distance put the camera inside the asset's own bounding box — a
   * 13.6 m airframe photographed from 5 m away. The frame is still written, because it is a true
   * picture of what that camera saw, but no check is decided from it and a gallery should not
   * lead with it.
   */
  cameraInsideAsset: boolean;
  metrics: CaptureMetrics;
}

export interface MotionPhaseRecord {
  clip: string;
  phase: number;
  path: string;
  sha256: string;
  bytes: number;
}

export interface VisualEvidenceReport {
  schema: typeof VISUAL_EVIDENCE_SCHEMA;
  toolVersion: typeof VISUAL_EVIDENCE_TOOL_VERSION;
  renderer: {
    id: string;
    version: string;
    kind: "software-rasteriser";
    gpu: false;
    shading: string;
    note: string;
    note_ko: string;
  };
  /** sha256 over the decoded triangle stream. Same file, same decoder ⇒ same digest. */
  sceneDigest: string;
  /** sha256 over the camera rig declaration, so two runs with different rigs never compare. */
  cameraRigHash: string;
  sizeMetres: Vec3;
  triangleCount: number;
  captures: VisualCaptureRecord[];
  motionPhases: MotionPhaseRecord[];
  motion: {
    clip: string;
    durationSeconds: number;
    movedPixelRatio: number;
    meanAbsLumaDelta: number;
  } | null;
  checks: VisualCheck[];
  lanes: {
    visualRuntime: { verdict: VisualVerdict; checkIds: VisualCheckId[] };
    playerFacing: { verdict: VisualVerdict; checkIds: VisualCheckId[] };
  };
  verdict: VisualVerdict;
  summary: string;
  summary_ko: string;
  timings: {
    decodeMs: number;
    renderMs: number;
    measureMs: number;
    totalMs: number;
    peakHeapBytes: number | null;
  };
  limits: string[];
  limits_ko: string[];
}
