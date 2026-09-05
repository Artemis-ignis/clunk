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
/**
 * Bumped whenever a raster or metric change would move a capture hash.
 *
 * 1.1.0 (2026-09-05): skinned meshes are posed on the CPU by their skeleton before they are
 * drawn, so every capture of a rigged file moves — it used to be the bind pose no matter what the
 * clip said. A file with no skin renders byte-for-byte what 1.0.0 rendered, verified on
 * hf-tractor-compact and cozy-fence-gate, but it still reports the new version, because a version
 * that only sometimes changes is worse than useless for deciding whether two runs are comparable.
 */
export const VISUAL_EVIDENCE_RENDERER_VERSION = "1.1.0" as const;

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
  /** Where in the clip this pose was taken, as a fraction of its length. */
  phase: number;
  scene: VisualScene;
  /** Lowest world-space vertex in this pose, metres. The floor is y = 0. */
  minGroundYMetres: number;
}

/** How the clip behind the motion phases was picked. */
export type AnimationClipChoice =
  /** Rigid files: the first clip the file declares, as before skinning existed. */
  | "declaration-order"
  /** A caller (a listing, `--clip`) named it. */
  | "requested"
  /** Skinned default: the looping clip whose joints travel farthest. */
  | "widest-moving-loop"
  /** Skinned, nothing loops: the clip whose joints travel farthest. */
  | "widest-moving";

export interface AnimationSceneSet {
  clip: string;
  durationSeconds: number;
  trackCount: number;
  phases: AnimationPhaseScene[];
  /** True when the clip had to be applied to vertices through a skeleton. */
  skinned: boolean;
  clipChoice: AnimationClipChoice;
  /** The fractions of the clip the phases were taken at. */
  phaseFractions: readonly number[];
  /** glTF interpolation modes present in the chosen clip: LINEAR, STEP, CUBICSPLINE. */
  interpolations: readonly string[];
  /** Anything the choice had to fall back on, in Korean, for the evidence file. */
  notes: readonly string[];
}

/** Everything the renderer needs. Produced by a decoder; consumed by pure code. */
export interface VisualSceneSet {
  rest: VisualScene;
  bounds: SceneBounds;
  /** Rest-pose size in metres, x/y/z. */
  sizeMetres: Vec3;
  meshCount: number;
  vertexColouredMeshCount: number;
  /** Meshes the decoder had to skin on the CPU, and what they cost. */
  skinnedMeshCount: number;
  skinnedVertexCount: number;
  /** Unique joints across every skeleton in the file. */
  jointCount: number;
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
    /** Where in the clip the three phases were taken. */
    phases: readonly number[];
    /** True when the pose had to be pushed through a skeleton onto the vertices. */
    skinned: boolean;
    jointCount: number;
    skinnedVertexCount: number;
    clipChoice: AnimationClipChoice;
    /** Clips the file declares, so a reader can see what was not shown. */
    declaredClips: readonly string[];
    interpolations: readonly string[];
    /**
     * Largest share of the union silhouette that changes between two phases: the outline moved,
     * not just the shading. Interior-only motion (a spinning wheel) reads near zero here and
     * shows up in movedPixelRatio instead.
     */
    silhouetteChangeRatio: number;
    /** Every phase pair, so an aliased sample is visible rather than averaged away. */
    silhouetteChangePairs: readonly { from: number; to: number; ratio: number }[];
    /** The lowest vertex any phase reached. Negative means it sank through the floor. */
    minPhaseGroundYMetres: number;
    /** "frozen" when the three phases share one camera solve so a pose change cannot be reframed away. */
    framing: "per-phase" | "frozen";
    notes: readonly string[];
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
    /** The slice of decodeMs spent sampling clips and skinning vertices. */
    poseMs: number;
    renderMs: number;
    measureMs: number;
    totalMs: number;
    peakHeapBytes: number | null;
  };
  limits: string[];
  limits_ko: string[];
}
