/*
 * clunk.sprite-sheet-review.v1
 *
 * A sprite sheet is not production-ready merely because it has a valid PNG and a grid. This
 * contract keeps the pixel/structure checks, shipped runtime capture, and human art decision as
 * separate lanes so an agent cannot turn repeated placeholder frames into an approval.
 *
 * Rule set 2.0.0 (wire schema still v1 / schemaVersion "1"):
 *  - `static` is derived from real structural cross-checks. Without measured pixels it degrades to
 *    PARSED_ONLY instead of claiming a PASS it never earned.
 *  - the declared `animations` block is evaluated (`animationPlayback` + `framesObserved`) instead of
 *    being parsed, stored, and ignored.
 *  - measured cell geometry (`metrics.measuredCellPx`) is compared against the declared grid and
 *    logical frame size, so a square mis-declaration cannot self-compare its way to a PASS.
 *  - declared duplicate/motion/silhouette thresholds are clamped to the calibrated floors below.
 *  - pixel-art discipline indicators are always recorded; the gate is opt-in via
 *    `qualityPolicy.strictChecks` (the texture-audit declaration convention).
 * Any change to the rules above must bump SPRITE_SHEET_REVIEW_RULESET_VERSION, because it moves the
 * verdict for identical bytes.
 */

export const SPRITE_SHEET_REVIEW_SCHEMA = "clunk.sprite-sheet-review.v1" as const;
export const SPRITE_SHEET_REVIEW_RULESET_ID = "clunk-sprite-sheet-review" as const;
export const SPRITE_SHEET_REVIEW_RULESET_VERSION = "2.0.0" as const;

/**
 * Calibrated floors. A consumer may declare a stricter threshold, never a laxer one: measured
 * distributions on shipped 2D sheets showed 0.002 silhouette / 0.005 motion-delta policies passing
 * frames that are visually empty or visually static at runtime size.
 */
export const SPRITE_QUALITY_CALIBRATION = {
  minSilhouetteCoverage: 0.08,
  minMeanFrameDelta: 0.03,
} as const;

/** Applied only when `qualityPolicy.strictChecks` opts the pixel-discipline group in. */
export const SPRITE_PIXEL_DISCIPLINE_DEFAULTS = {
  minHardAlphaRatio: 0.98,
  maxUniqueColorCount: 256,
  maxOffGridPixelRatio: 0.02,
} as const;

export type SpriteStrictCheck = "pixel-discipline";

export type SpriteSheetEvidenceKind = "CONTRACT_FIXTURE" | "PLAYER_FACING_CAPTURE";
export type SpriteSourceOrigin = "imagegen" | "reference" | "hand-authored" | "procedural" | "runtime-generated";
export type SpriteStaticStatus = "PASS" | "FAIL" | "PARSED_ONLY";
export type SpriteAnimationStatus = "PASS" | "FAIL" | "NOT_EVALUATED";
export type SpriteQualityStatus = "OFF" | "PASS" | "ADVISORY" | "BLOCKED" | "UNAVAILABLE";
export type SpriteVisualRuntimeStatus = "PASS" | "GAP" | "PENDING" | "UNAVAILABLE";
export type SpritePlayerFacingStatus = "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "NOT_EVALUATED";
export type SpriteHumanDecision = SpritePlayerFacingStatus;
export type SpriteReviewStatus = "EVALUATED" | "PENDING" | "NOT_EVALUATED";
export type SpriteReadiness = "ready" | "conditional" | "blocked" | "unavailable";
export type SpriteIssueSeverity = "INFO" | "ADVISORY" | "BLOCKING";
export type SpriteIssueOwnership = "asset" | "runtime" | "content" | "unknown";
export type SpriteIssueEnforcement = "OFF" | "ADVISORY" | "BLOCKING";

export interface SpritePoint {
  x: number;
  y: number;
}

export interface SpriteSource {
  path: string;
  origin: SpriteSourceOrigin;
  sha256: string;
  bytes: number;
  licenseStatus?: string;
  referenceRole?: string;
}

export interface SpriteTarget {
  engine: string;
  renderer: string;
  platform: string;
  logicalFramePx: { width: number; height: number };
  runtimeFramePx?: { width: number; height: number };
}

export interface SpriteSheetFile {
  path: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
}

export interface SpriteSheetGrid {
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  padding: SpritePoint;
  spacing: SpritePoint;
}

export interface SpriteHitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteFrame {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: string;
  direction?: string;
  anchor: SpritePoint;
  pivot?: SpritePoint;
  hitbox?: SpriteHitbox;
}

export interface SpriteAnimation {
  id: string;
  state: string;
  direction?: string;
  fps: number;
  loop: boolean;
  holdLast?: boolean;
  frameIds: readonly string[];
  required?: boolean;
}

export interface SpriteQualityPolicy {
  mode: "OFF" | "ADVISORY" | "BLOCKING";
  strictChecks?: readonly SpriteStrictCheck[];
  requiredStates?: readonly string[];
  minDistinctFrameRatio?: number;
  maxDuplicateFrameRatio?: number;
  minMeanFrameDelta?: number;
  requireTransparentBackground?: boolean;
  requireOpaqueBottom?: boolean;
  maxClippingPixels?: number;
  maxAlphaSpillPixels?: number;
  maxBorderTouchRatio?: number;
  minSilhouetteCoverage?: number;
  minAlphaCoverage?: number;
  maxAlphaCoverage?: number;
  minHardAlphaRatio?: number;
  maxUniqueColorCount?: number;
  minDominantRunLength?: number;
  maxOffGridPixelRatio?: number;
  pixelGridSize?: number;
  runtimeFramePx?: { width: number; height: number };
  requireRuntimeCapture?: boolean;
  requireHumanReview?: boolean;
}

/** Thresholds actually applied after calibration floors and strict-check opt-ins are resolved. */
export interface SpriteEffectiveThresholds {
  minDistinctFrameRatio?: number;
  maxDuplicateFrameRatio?: number;
  minMeanFrameDelta?: number;
  minSilhouetteCoverage?: number;
  minAlphaCoverage?: number;
  maxAlphaCoverage?: number;
  minHardAlphaRatio?: number;
  maxUniqueColorCount?: number;
  minDominantRunLength?: number;
  maxOffGridPixelRatio?: number;
}

export interface SpriteSheetMetrics {
  sourceHash: string;
  sheetDimensions: { width: number; height: number };
  alphaCoverage: number;
  frameAlphaCoverages: readonly number[];
  frameHashes?: Readonly<Record<string, string>>;
  duplicateFrameGroups?: readonly (readonly string[])[];
  distinctFrameRatio?: number;
  meanFrameDelta?: number;
  hasTransparentPixels?: boolean;
  emptyFrameIds?: readonly string[];
  opaqueBottomFrameIds?: readonly string[];
  clippingFrameIds?: readonly string[];
  alphaSpillPixels?: number;
  borderTouchRatios?: readonly number[];
  silhouetteCoverages?: readonly number[];
  /** Cell footprint derived from the decoded sheet and the declared grid — never copied from target. */
  measuredCellPx?: { width: number; height: number };
  /** Share of pixels whose alpha is fully 0 or fully 255. */
  hardAlphaRatio?: number;
  /** Distinct RGBA values among visible pixels. */
  uniqueColorCount?: number;
  /** Most frequent horizontal same-colour run length; the observed pixel scale. */
  dominantRunLength?: number;
  /** Share of visible pixels that break the declared/inferred pixel grid. */
  offGridPixelRatio?: number;
  runtimeFramePx?: { width: number; height: number };
}

export interface SpriteRuntimeCapture {
  media: "screenshot" | "frame";
  path: string;
  sha256: string;
  bytes: number;
  renderer: string;
  viewport: { width: number; height: number };
  sourceTreeHash: string;
  shippedPath: boolean;
  frameRole?: string;
}

export interface SpriteHumanReview {
  decision: SpriteHumanDecision;
  reviewer?: string;
  notes?: string;
}

export interface SpriteSheetReviewManifest {
  schema: typeof SPRITE_SHEET_REVIEW_SCHEMA;
  schemaVersion: "1";
  evidenceKind: SpriteSheetEvidenceKind;
  assetId: string;
  source: SpriteSource;
  target: SpriteTarget;
  sheet: SpriteSheetFile;
  grid: SpriteSheetGrid;
  frames: readonly SpriteFrame[];
  animations: readonly SpriteAnimation[];
  qualityPolicy: SpriteQualityPolicy;
  metrics?: SpriteSheetMetrics;
  captures?: readonly SpriteRuntimeCapture[];
  humanReview?: SpriteHumanReview;
}

export interface SpriteReviewIssue {
  code: string;
  severity: SpriteIssueSeverity;
  path?: string;
  observed: string | number | boolean | null | readonly string[];
  threshold: string | number | boolean | null | readonly string[];
  rationale: string;
  recommendation: string;
  ownership: SpriteIssueOwnership;
  enforcement: SpriteIssueEnforcement;
}

export interface SpriteSheetReviewReport extends SpriteSheetReviewManifest {
  ruleSetId: typeof SPRITE_SHEET_REVIEW_RULESET_ID;
  ruleSetVersion: typeof SPRITE_SHEET_REVIEW_RULESET_VERSION;
  static: SpriteStaticStatus;
  quality: SpriteQualityStatus;
  animationPlayback: SpriteAnimationStatus;
  /** Frame ids backed by a measurement; empty means nothing about playback was observed. */
  framesObserved: readonly string[];
  effectiveThresholds: SpriteEffectiveThresholds;
  visualRuntime: SpriteVisualRuntimeStatus;
  playerFacing: SpritePlayerFacingStatus;
  humanDecision: SpriteHumanDecision;
  reviewStatus: SpriteReviewStatus;
  readiness: SpriteReadiness;
  issues: readonly SpriteReviewIssue[];
  limitation: "STRUCTURAL_AND_PIXEL_PASS_IS_NOT_PLAYER_FACING_APPROVAL";
}

export class SpriteSheetReviewInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpriteSheetReviewInputError";
  }
}

export function normalizeSpriteSheetReview(value: unknown): SpriteSheetReviewReport {
  const manifest = parseManifest(value);
  return evaluateSpriteSheetReview(manifest);
}

export function evaluateSpriteSheetReview(manifest: SpriteSheetReviewManifest): SpriteSheetReviewReport {
  const issues: SpriteReviewIssue[] = [];
  const policy = manifest.qualityPolicy;
  const enforcement = policy.mode === "BLOCKING" ? "BLOCKING" : policy.mode === "ADVISORY" ? "ADVISORY" : "OFF";
  const frameIds = new Set(manifest.frames.map((frame) => frame.id));
  const states = new Set(manifest.frames.map((frame) => frame.state));
  let qualityViolations = 0;
  let qualityUnavailable = false;
  let staticViolations = 0;
  const thresholds = resolveThresholds(policy, issues, enforcement);

  staticViolations += evaluateSheetGeometry(manifest, issues);

  for (const requiredState of policy.requiredStates ?? []) {
    if (!states.has(requiredState)) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-REQUIRED-STATE-MISSING",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        requiredState,
        "required",
        `Required animation state ${requiredState} is not represented by a frame.`,
        "Add authored frames and an animation clip for this state before release.",
        "content",
        enforcement,
        "frames",
      ));
    }
  }

  const metrics = manifest.metrics;
  const needsMetrics = policy.mode !== "OFF" && (
    thresholds.minDistinctFrameRatio !== undefined
    || thresholds.maxDuplicateFrameRatio !== undefined
    || thresholds.minMeanFrameDelta !== undefined
    || policy.requireTransparentBackground === true
    || policy.requireOpaqueBottom === true
    || policy.maxClippingPixels !== undefined
    || policy.maxAlphaSpillPixels !== undefined
    || policy.maxBorderTouchRatio !== undefined
    || thresholds.minSilhouetteCoverage !== undefined
    || thresholds.minAlphaCoverage !== undefined
    || thresholds.maxAlphaCoverage !== undefined
    || thresholds.minHardAlphaRatio !== undefined
    || thresholds.maxUniqueColorCount !== undefined
    || thresholds.minDominantRunLength !== undefined
    || thresholds.maxOffGridPixelRatio !== undefined
    || policy.runtimeFramePx !== undefined
  );
  if (needsMetrics && !metrics) {
    qualityUnavailable = true;
    issues.push(issue(
      "SPRITE-PIXEL-METRICS-UNAVAILABLE",
      enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
      null,
      "declared pixel metrics",
      "Pixel-level duplicate, delta, and transparency checks cannot run without measured metrics.",
      "Run the local sprite-sheet audit against the declared sheet path and commit its JSON artifact.",
      "asset",
      enforcement,
      "metrics",
    ));
  }

  if (metrics) {
    staticViolations += evaluateMeasuredGeometry(manifest, metrics, issues);
    if (metrics.sourceHash !== manifest.sheet.sha256) {
      qualityViolations += 1;
      staticViolations += 1;
      issues.push(issue(
        "SPRITE-SOURCE-HASH-MISMATCH",
        "BLOCKING",
        metrics.sourceHash,
        manifest.sheet.sha256,
        "Measured pixels do not belong to the declared sheet bytes.",
        "Re-run the audit from the exact sheet file and replace the stale metrics artifact.",
        "asset",
        "BLOCKING",
        "metrics.sourceHash",
      ));
    }
    if (metrics.sheetDimensions.width !== manifest.sheet.width || metrics.sheetDimensions.height !== manifest.sheet.height) {
      qualityViolations += 1;
      staticViolations += 1;
      issues.push(issue(
        "SPRITE-SHEET-DIMENSIONS-MISMATCH",
        "BLOCKING",
        `${metrics.sheetDimensions.width}x${metrics.sheetDimensions.height}`,
        `${manifest.sheet.width}x${manifest.sheet.height}`,
        "Measured sheet dimensions differ from the declared dimensions.",
        "Update the manifest from the same source bytes; do not crop or resize after measurement.",
        "asset",
        "BLOCKING",
        "metrics.sheetDimensions",
      ));
    }
    if (thresholds.minDistinctFrameRatio !== undefined && metrics.distinctFrameRatio !== undefined && metrics.distinctFrameRatio < thresholds.minDistinctFrameRatio) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-LOW-DISTINCT-FRAMES",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        metrics.distinctFrameRatio,
        thresholds.minDistinctFrameRatio,
        "Too many frame cells are identical or effectively repeated.",
        "Re-author the motion arc; do not duplicate a still pose to fill a sheet.",
        "asset",
        enforcement,
        "metrics.distinctFrameRatio",
      ));
    }
    const duplicateGroups = metrics.duplicateFrameGroups ?? [];
    const duplicateFrameCount = duplicateGroups.reduce((total, group) => total + Math.max(0, group.length - 1), 0);
    const duplicateRatio = manifest.frames.length ? duplicateFrameCount / manifest.frames.length : 1;
    if (thresholds.maxDuplicateFrameRatio !== undefined && duplicateRatio > thresholds.maxDuplicateFrameRatio) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-DUPLICATE-FRAMES",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        duplicateRatio,
        thresholds.maxDuplicateFrameRatio,
        "The measured sheet contains duplicate frame cells above the declared tolerance.",
        "Replace repeated cells with meaningful silhouette, limb, weapon, or anticipation changes and remeasure.",
        "asset",
        enforcement,
        "metrics.duplicateFrameGroups",
      ));
    }
    if (thresholds.minMeanFrameDelta !== undefined && metrics.meanFrameDelta !== undefined && metrics.meanFrameDelta < thresholds.minMeanFrameDelta) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-LOW-MEAN-FRAME-DELTA",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        metrics.meanFrameDelta,
        thresholds.minMeanFrameDelta,
        "Adjacent frames do not change enough to communicate the declared motion.",
        "Author a readable contact, passing, anticipation, or follow-through pose instead of changing only a small accessory pixel.",
        "asset",
        enforcement,
        "metrics.meanFrameDelta",
      ));
    }
    if (policy.requireTransparentBackground === true && metrics.hasTransparentPixels !== true) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-TRANSPARENCY-MISSING",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        metrics.hasTransparentPixels ?? false,
        true,
        "The sprite sheet does not contain transparent background pixels.",
        "Export the sheet with an actual alpha channel and verify the background is not baked into the sprite.",
        "asset",
        enforcement,
        "metrics.hasTransparentPixels",
      ));
    }
    const frameIdSet = (value: readonly string[] | undefined) => new Set(value ?? []);
    if (policy.requireOpaqueBottom === true) {
      if (metrics.opaqueBottomFrameIds === undefined) {
        qualityUnavailable = true;
        issues.push(issue(
          "SPRITE-OPAQUE-BOTTOM-METRICS-UNAVAILABLE",
          enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
          null,
          "opaque bottom metrics",
          "The opaque-bottom contract requires per-frame bottom-row measurements.",
          "Run the local RGBA sprite audit and keep its measured opaqueBottomFrameIds field.",
          "asset",
          enforcement,
          "metrics.opaqueBottomFrameIds",
        ));
      } else {
        const opaqueBottom = frameIdSet(metrics.opaqueBottomFrameIds);
        const missing = manifest.frames.filter((frame) => !opaqueBottom.has(frame.id)).map((frame) => frame.id);
        if (missing.length > 0) {
          qualityViolations += 1;
          issues.push(issue(
            "SPRITE-OPAQUE-BOTTOM",
            enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
            missing,
            "every declared frame has opaque bottom pixels",
            "One or more frames do not reach the declared ground/bottom anchor.",
            "Fix the feet/ground contact or declare a different pivot contract, then remeasure.",
            "asset",
            enforcement,
            "metrics.opaqueBottomFrameIds",
          ));
        }
      }
    }
    if (policy.maxClippingPixels !== undefined) {
      if (metrics.clippingFrameIds === undefined) {
        qualityUnavailable = true;
        issues.push(metricUnavailableIssue("SPRITE-CLIPPING-METRICS-UNAVAILABLE", "clippingFrameIds", enforcement));
      } else if (metrics.clippingFrameIds.length > 0) {
        qualityViolations += 1;
        issues.push(issue(
          "SPRITE-CLIPPING",
          enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
          metrics.clippingFrameIds,
          `no clipped frames; max pixels ${policy.maxClippingPixels}`,
          "Opaque pixels touch a cell boundary and may be visibly clipped in the runtime.",
          "Add cell padding or redraw the silhouette inside the declared frame bounds.",
          "asset",
          enforcement,
          "metrics.clippingFrameIds",
        ));
      }
    }
    if (policy.maxAlphaSpillPixels !== undefined) {
      if (metrics.alphaSpillPixels === undefined) {
        qualityUnavailable = true;
        issues.push(metricUnavailableIssue("SPRITE-ALPHA-SPILL-METRICS-UNAVAILABLE", "alphaSpillPixels", enforcement));
      } else if (metrics.alphaSpillPixels > policy.maxAlphaSpillPixels) {
        qualityViolations += 1;
        issues.push(issue(
          "SPRITE-ALPHA-SPILL",
          enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
          metrics.alphaSpillPixels,
          policy.maxAlphaSpillPixels,
          "Semi-transparent pixels spill beyond the measured silhouette edge.",
          "Clean the transparent border and remeasure premultiplied alpha at the frame edge.",
          "asset",
          enforcement,
          "metrics.alphaSpillPixels",
        ));
      }
    }
    if (policy.maxBorderTouchRatio !== undefined) {
      if (metrics.borderTouchRatios === undefined) {
        qualityUnavailable = true;
        issues.push(metricUnavailableIssue("SPRITE-BORDER-METRICS-UNAVAILABLE", "borderTouchRatios", enforcement));
      } else {
        const maximum = Math.max(...metrics.borderTouchRatios, 0);
        if (maximum > policy.maxBorderTouchRatio) {
          qualityViolations += 1;
          issues.push(issue(
            "SPRITE-BORDER-CONTACT",
            enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
            maximum,
            policy.maxBorderTouchRatio,
            "Too much opaque content touches the frame border and can shimmer or clip after packing.",
            "Leave a transparent safety border around the silhouette or raise the threshold deliberately.",
            "asset",
            enforcement,
            "metrics.borderTouchRatios",
          ));
        }
      }
    }
    if (thresholds.minSilhouetteCoverage !== undefined) {
      if (metrics.silhouetteCoverages === undefined) {
        qualityUnavailable = true;
        issues.push(metricUnavailableIssue("SPRITE-SILHOUETTE-METRICS-UNAVAILABLE", "silhouetteCoverages", enforcement));
      } else {
        const minimum = Math.min(...metrics.silhouetteCoverages, 1);
        if (minimum < thresholds.minSilhouetteCoverage) {
          qualityViolations += 1;
          issues.push(issue(
            "SPRITE-SILHOUETTE-COVERAGE",
            enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
            minimum,
            thresholds.minSilhouetteCoverage,
            "At least one frame has too little visible silhouette to read at runtime size.",
            "Increase the readable body/weapon silhouette or adjust the declared runtime size and remeasure.",
            "asset",
            enforcement,
            "metrics.silhouetteCoverages",
          ));
        }
      }
    }
    const pixelDiscipline = evaluatePixelDiscipline(thresholds, metrics, enforcement);
    issues.push(...pixelDiscipline.issues);
    qualityViolations += pixelDiscipline.violations;
    if (pixelDiscipline.unavailable) qualityUnavailable = true;
    if (policy.runtimeFramePx !== undefined) {
      if (metrics.runtimeFramePx === undefined) {
        qualityUnavailable = true;
        issues.push(metricUnavailableIssue("SPRITE-RUNTIME-SIZE-METRICS-UNAVAILABLE", "runtimeFramePx", enforcement));
      } else if (metrics.runtimeFramePx.width !== policy.runtimeFramePx.width || metrics.runtimeFramePx.height !== policy.runtimeFramePx.height) {
        qualityViolations += 1;
        issues.push(issue(
          "SPRITE-RUNTIME-SIZE",
          enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
          `${metrics.runtimeFramePx.width}x${metrics.runtimeFramePx.height}`,
          `${policy.runtimeFramePx.width}x${policy.runtimeFramePx.height}`,
          "Measured runtime frame size differs from the declared target size.",
          "Render and capture the sheet at the same logical/runtime pixel contract used by the target engine.",
          "runtime",
          enforcement,
          "metrics.runtimeFramePx",
        ));
      }
    }
    for (const emptyFrameId of metrics.emptyFrameIds ?? []) {
      qualityViolations += 1;
      issues.push(issue(
        "SPRITE-EMPTY-FRAME",
        enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
        emptyFrameId,
        "non-empty frame",
        "A declared animation frame has no opaque pixels.",
        "Author the missing frame or remove it from the animation sequence; do not ship an accidental blank cell.",
        "asset",
        enforcement,
        `frames.${emptyFrameId}`,
      ));
    }
  }

  const captures = [...(manifest.captures ?? [])];
  if (policy.requireRuntimeCapture === true && captures.length === 0) {
    qualityUnavailable = true;
    issues.push(issue(
      "SPRITE-RUNTIME-CAPTURE-MISSING",
      enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
      0,
      ">= 1 shipped capture",
      "The policy requires a runtime capture, but this evidence contains none.",
      "Run the target engine/browser flow and submit a hashed shipped-path capture separately from the contract fixture.",
      "runtime",
      enforcement,
      "captures",
    ));
  }

  const humanDecision = manifest.humanReview?.decision ?? "NOT_EVALUATED";
  if (policy.requireHumanReview === true && humanDecision === "NOT_EVALUATED") {
    issues.push(issue(
      "SPRITE-HUMAN-REVIEW-MISSING",
      "ADVISORY",
      "NOT_EVALUATED",
      "PASS | PASS_WITH_FOLLOW_UP | NO_GO",
      "A runtime capture without a human decision is not a player-facing approval.",
      "Record an art review decision with reviewer and notes; preserve NO_GO when the sheet is not acceptable.",
      "content",
      "ADVISORY",
      "humanReview.decision",
    ));
  }

  const animation = evaluateAnimations(manifest, frameIds, enforcement);
  issues.push(...animation.issues);
  qualityViolations += animation.qualityViolations;

  // The static lane only claims PASS when the declared structure was cross-checked against a real
  // measurement of the same bytes. Parsing alone is PARSED_ONLY, never a PASS.
  const measuredIdentity = manifest.metrics !== undefined
    && manifest.metrics.sourceHash === manifest.sheet.sha256
    && manifest.metrics.sheetDimensions.width === manifest.sheet.width
    && manifest.metrics.sheetDimensions.height === manifest.sheet.height;
  const staticStatus: SpriteStaticStatus = staticViolations > 0
    ? "FAIL"
    : measuredIdentity
      ? "PASS"
      : "PARSED_ONLY";
  const quality: SpriteQualityStatus = policy.mode === "OFF"
    ? "OFF"
    : qualityUnavailable && qualityViolations === 0
      ? "UNAVAILABLE"
      : qualityViolations > 0 && policy.mode === "BLOCKING"
        ? "BLOCKED"
        : qualityViolations > 0
          ? "ADVISORY"
          : "PASS";
  const hasShippedCapture = captures.length > 0 && captures.every((capture) => capture.shippedPath);
  const visualRuntime: SpriteVisualRuntimeStatus = captures.length === 0
    ? "GAP"
    : hasShippedCapture
      ? "PASS"
      : "PENDING";
  const playerFacing = manifest.evidenceKind === "PLAYER_FACING_CAPTURE" && humanDecision !== "NOT_EVALUATED"
    ? humanDecision
    : "NOT_EVALUATED";
  const reviewStatus: SpriteReviewStatus = humanDecision !== "NOT_EVALUATED"
    ? "EVALUATED"
    : captures.length > 0
      ? "PENDING"
      : "NOT_EVALUATED";
  const readiness: SpriteReadiness = quality === "BLOCKED" || staticStatus === "FAIL" || animation.status === "FAIL"
    ? "blocked"
    : quality === "UNAVAILABLE" || (policy.requireRuntimeCapture === true && captures.length === 0)
      ? "unavailable"
      : visualRuntime !== "PASS"
        || playerFacing !== "PASS"
        || quality !== "PASS"
        || staticStatus !== "PASS"
        || animation.status !== "PASS"
        ? "conditional"
        : "ready";

  // The local frame set is validated above; this is intentionally retained as a cheap invariant for
  // future callers that construct a typed manifest without going through parseManifest.
  if ([...frameIds].length !== manifest.frames.length) {
    throw new SpriteSheetReviewInputError("Sprite frame ids must be unique.");
  }

  return {
    ...manifest,
    ruleSetId: SPRITE_SHEET_REVIEW_RULESET_ID,
    ruleSetVersion: SPRITE_SHEET_REVIEW_RULESET_VERSION,
    static: staticStatus,
    quality,
    animationPlayback: animation.status,
    framesObserved: animation.framesObserved,
    effectiveThresholds: thresholds,
    visualRuntime,
    playerFacing,
    humanDecision,
    reviewStatus,
    readiness,
    issues,
    limitation: "STRUCTURAL_AND_PIXEL_PASS_IS_NOT_PLAYER_FACING_APPROVAL",
  };
}

/**
 * Declared thresholds are clamped up to the calibrated floor, and the pixel-discipline group is
 * filled in only when the profile opted into it. A laxer declaration cannot buy a PASS.
 */
function resolveThresholds(
  policy: SpriteQualityPolicy,
  issues: SpriteReviewIssue[],
  enforcement: SpriteIssueEnforcement,
): SpriteEffectiveThresholds {
  const calibrate = (declared: number | undefined, floor: number, path: string): number | undefined => {
    if (declared === undefined) return undefined;
    if (declared >= floor) return declared;
    issues.push(issue(
      "SPRITE-THRESHOLD-BELOW-CALIBRATION",
      "INFO",
      declared,
      floor,
      `The declared ${path} is below the calibrated floor; the floor was applied instead.`,
      `Declare ${path} at or above ${floor}, or raise the asset until it clears the floor.`,
      "content",
      enforcement,
      `qualityPolicy.${path}`,
    ));
    return floor;
  };
  const strict = new Set(policy.strictChecks ?? []);
  const pixelDiscipline = strict.has("pixel-discipline");
  const optIn = (declared: number | undefined, fallback: number): number | undefined =>
    declared ?? (pixelDiscipline ? fallback : undefined);
  return {
    ...(policy.minDistinctFrameRatio === undefined ? {} : { minDistinctFrameRatio: policy.minDistinctFrameRatio }),
    ...(policy.maxDuplicateFrameRatio === undefined ? {} : { maxDuplicateFrameRatio: policy.maxDuplicateFrameRatio }),
    ...(withValue("minMeanFrameDelta", calibrate(policy.minMeanFrameDelta, SPRITE_QUALITY_CALIBRATION.minMeanFrameDelta, "minMeanFrameDelta"))),
    ...(withValue("minSilhouetteCoverage", calibrate(policy.minSilhouetteCoverage, SPRITE_QUALITY_CALIBRATION.minSilhouetteCoverage, "minSilhouetteCoverage"))),
    ...(withValue("minAlphaCoverage", policy.minAlphaCoverage)),
    ...(withValue("maxAlphaCoverage", policy.maxAlphaCoverage)),
    ...(withValue("minHardAlphaRatio", optIn(policy.minHardAlphaRatio, SPRITE_PIXEL_DISCIPLINE_DEFAULTS.minHardAlphaRatio))),
    ...(withValue("maxUniqueColorCount", optIn(policy.maxUniqueColorCount, SPRITE_PIXEL_DISCIPLINE_DEFAULTS.maxUniqueColorCount))),
    ...(withValue("minDominantRunLength", policy.minDominantRunLength)),
    ...(withValue("maxOffGridPixelRatio", optIn(policy.maxOffGridPixelRatio, SPRITE_PIXEL_DISCIPLINE_DEFAULTS.maxOffGridPixelRatio))),
  };
}

function withValue(key: string, value: number | undefined): Record<string, number> {
  return value === undefined ? {} : { [key]: value };
}

/** Declared grid vs declared sheet, and declared frame placement vs the cell the index names. */
function evaluateSheetGeometry(manifest: SpriteSheetReviewManifest, issues: SpriteReviewIssue[]): number {
  const { grid, sheet } = manifest;
  let violations = 0;
  const requiredWidth = grid.padding.x * 2 + grid.columns * grid.frameWidth + Math.max(0, grid.columns - 1) * grid.spacing.x;
  const requiredHeight = grid.padding.y * 2 + grid.rows * grid.frameHeight + Math.max(0, grid.rows - 1) * grid.spacing.y;
  if (requiredWidth > sheet.width || requiredHeight > sheet.height) {
    violations += 1;
    issues.push(issue(
      "SPRITE-GRID-GEOMETRY",
      "BLOCKING",
      `${requiredWidth}x${requiredHeight}`,
      `<= ${sheet.width}x${sheet.height}`,
      "The declared grid, padding, and spacing cannot fit inside the declared sheet.",
      "Re-derive columns/rows/padding/spacing from the exported sheet instead of hand-writing them.",
      "asset",
      "BLOCKING",
      "grid",
    ));
  }
  for (const frame of manifest.frames) {
    const column = frame.index % grid.columns;
    const row = Math.floor(frame.index / grid.columns);
    const expectedX = grid.padding.x + column * (grid.frameWidth + grid.spacing.x);
    const expectedY = grid.padding.y + row * (grid.frameHeight + grid.spacing.y);
    if (frame.x !== expectedX || frame.y !== expectedY) {
      violations += 1;
      issues.push(issue(
        "SPRITE-FRAME-CELL-MISMATCH",
        "BLOCKING",
        `${frame.id}@${frame.x},${frame.y}`,
        `${frame.id}@${expectedX},${expectedY}`,
        "A frame is not placed on the cell its declared index names.",
        "Fix the frame index or the frame origin so the atlas and the grid describe the same cells.",
        "asset",
        "BLOCKING",
        `frames.${frame.id}`,
      ));
    }
  }
  return violations;
}

/** Measured cell footprint vs the declared cell and the declared logical frame. */
function evaluateMeasuredGeometry(
  manifest: SpriteSheetReviewManifest,
  metrics: SpriteSheetMetrics,
  issues: SpriteReviewIssue[],
): number {
  const measured = metrics.measuredCellPx;
  if (!measured) return 0;
  let violations = 0;
  const { grid, target } = manifest;
  if (measured.width !== grid.frameWidth || measured.height !== grid.frameHeight) {
    violations += 1;
    issues.push(issue(
      "SPRITE-CELL-SIZE-MISMATCH",
      "BLOCKING",
      `${measured.width}x${measured.height}`,
      `${grid.frameWidth}x${grid.frameHeight}`,
      "The cell measured from the sheet bytes is not the declared grid cell.",
      "Re-export the sheet at the declared cell size or correct grid.frameWidth/frameHeight.",
      "asset",
      "BLOCKING",
      "metrics.measuredCellPx",
    ));
  }
  if (measured.width !== target.logicalFramePx.width || measured.height !== target.logicalFramePx.height) {
    violations += 1;
    issues.push(issue(
      "SPRITE-LOGICAL-SIZE-MISMATCH",
      "BLOCKING",
      `${measured.width}x${measured.height}`,
      `${target.logicalFramePx.width}x${target.logicalFramePx.height}`,
      "The cell measured from the sheet bytes is not the declared logical frame size.",
      "Declare the real cell footprint; a square declaration over a non-square cell squashes the sprite at runtime.",
      "asset",
      "BLOCKING",
      "target.logicalFramePx",
    ));
  }
  return violations;
}

function evaluatePixelDiscipline(
  thresholds: SpriteEffectiveThresholds,
  metrics: SpriteSheetMetrics,
  enforcement: SpriteIssueEnforcement,
): { issues: SpriteReviewIssue[]; violations: number; unavailable: boolean } {
  const issues: SpriteReviewIssue[] = [];
  const severity: SpriteIssueSeverity = enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY";
  const missing: string[] = [];
  let violations = 0;
  const gate = (
    code: string,
    path: keyof SpriteSheetMetrics,
    observed: number | undefined,
    threshold: number,
    failed: boolean,
    rationale: string,
    recommendation: string,
  ) => {
    if (observed === undefined) {
      missing.push(path);
      return;
    }
    if (!failed) return;
    violations += 1;
    issues.push(issue(code, severity, observed, threshold, rationale, recommendation, "asset", enforcement, `metrics.${path}`));
  };
  if (thresholds.minAlphaCoverage !== undefined) {
    gate(
      "SPRITE-ALPHA-COVERAGE",
      "alphaCoverage",
      metrics.alphaCoverage,
      thresholds.minAlphaCoverage,
      metrics.alphaCoverage < thresholds.minAlphaCoverage,
      "The sheet carries less visible coverage than the declared minimum.",
      "Fill the declared cells with real artwork instead of shipping mostly empty pixels.",
    );
  }
  if (thresholds.maxAlphaCoverage !== undefined && metrics.alphaCoverage > thresholds.maxAlphaCoverage) {
    violations += 1;
    issues.push(issue(
      "SPRITE-ALPHA-COVERAGE",
      severity,
      metrics.alphaCoverage,
      thresholds.maxAlphaCoverage,
      "The sheet carries more opaque coverage than the declared maximum; the background is probably baked in.",
      "Export a real alpha channel or raise the declared maximum deliberately.",
      "asset",
      enforcement,
      "metrics.alphaCoverage",
    ));
  }
  if (thresholds.minHardAlphaRatio !== undefined) {
    gate(
      "SPRITE-PIXEL-HARD-ALPHA",
      "hardAlphaRatio",
      metrics.hardAlphaRatio,
      thresholds.minHardAlphaRatio,
      (metrics.hardAlphaRatio ?? 1) < thresholds.minHardAlphaRatio,
      "Too many pixels use partial alpha for art declared as pixel art.",
      "Author binary alpha (0 or 255); anti-aliased edges shimmer once the sheet is nearest-sampled.",
    );
  }
  if (thresholds.maxUniqueColorCount !== undefined) {
    gate(
      "SPRITE-PIXEL-COLOR-COUNT",
      "uniqueColorCount",
      metrics.uniqueColorCount,
      thresholds.maxUniqueColorCount,
      (metrics.uniqueColorCount ?? 0) > thresholds.maxUniqueColorCount,
      "The sheet uses more distinct colours than the declared palette discipline allows.",
      "Quantise to the declared palette; a photographic gradient is not a pixel-art sprite.",
    );
  }
  if (thresholds.minDominantRunLength !== undefined) {
    gate(
      "SPRITE-PIXEL-RUN-LENGTH",
      "dominantRunLength",
      metrics.dominantRunLength,
      thresholds.minDominantRunLength,
      (metrics.dominantRunLength ?? 0) < thresholds.minDominantRunLength,
      "The observed pixel scale is finer than the declared pixel size.",
      "Author at the declared logical resolution and upscale by an integer factor.",
    );
  }
  if (thresholds.maxOffGridPixelRatio !== undefined) {
    gate(
      "SPRITE-PIXEL-OFF-GRID",
      "offGridPixelRatio",
      metrics.offGridPixelRatio,
      thresholds.maxOffGridPixelRatio,
      (metrics.offGridPixelRatio ?? 0) > thresholds.maxOffGridPixelRatio,
      "Too many pixels break the declared pixel grid.",
      "Snap the art to the declared grid; a resampled sheet cannot be re-aligned after export.",
    );
  }
  if (missing.length > 0) {
    issues.push(issue(
      "SPRITE-PIXEL-DISCIPLINE-METRICS-UNAVAILABLE",
      severity,
      null,
      missing,
      "The pixel-art discipline gate was opted into, but these indicators were never measured.",
      "Run the local sprite-sheet audit with this rule set so the indicators are recorded from the real bytes.",
      "asset",
      enforcement,
      "metrics",
    ));
  }
  return { issues, violations, unavailable: missing.length > 0 };
}

/**
 * The declared animation block is evaluated, not merely stored. Playback can only be a PASS when the
 * frames it plays were actually observed.
 */
function evaluateAnimations(
  manifest: SpriteSheetReviewManifest,
  frameIds: ReadonlySet<string>,
  enforcement: SpriteIssueEnforcement,
): { status: SpriteAnimationStatus; framesObserved: readonly string[]; issues: SpriteReviewIssue[]; qualityViolations: number } {
  const issues: SpriteReviewIssue[] = [];
  const policy = manifest.qualityPolicy;
  const observed = observedFrameIds(manifest);
  const empty = new Set(manifest.metrics?.emptyFrameIds ?? []);
  const animationStates = new Set(manifest.animations.map((item) => item.state));
  let failures = 0;
  let qualityViolations = 0;

  for (const requiredState of policy.requiredStates ?? []) {
    if (animationStates.has(requiredState)) continue;
    if (policy.mode !== "OFF") failures += 1;
    qualityViolations += 1;
    issues.push(issue(
      "SPRITE-REQUIRED-ANIMATION-MISSING",
      enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
      [...animationStates],
      requiredState,
      `No animation clip drives the required state ${requiredState}; frames alone do not play.`,
      "Declare an animation clip for the required state with its frame order, fps, and loop contract.",
      "content",
      enforcement,
      "animations",
    ));
  }

  for (const animation of manifest.animations) {
    for (const frameId of animation.frameIds) {
      if (!frameIds.has(frameId)) {
        failures += 1;
        issues.push(issue(
          "SPRITE-ANIMATION-FRAME-MISSING",
          "BLOCKING",
          frameId,
          "a declared frame id",
          `Animation ${animation.id} plays a frame that the sheet does not declare.`,
          "Point the clip at real frame ids, or author the missing frame.",
          "content",
          "BLOCKING",
          `animations.${animation.id}`,
        ));
        continue;
      }
      if (empty.has(frameId)) {
        failures += 1;
        issues.push(issue(
          "SPRITE-ANIMATION-EMPTY-FRAME",
          "BLOCKING",
          frameId,
          "a frame with opaque pixels",
          `Animation ${animation.id} plays a cell measured as empty; the sprite disappears on that tick.`,
          "Author the missing frame or drop it from the clip; do not ship a blank playback frame.",
          "asset",
          "BLOCKING",
          `animations.${animation.id}`,
        ));
        continue;
      }
      if (observed.size > 0 && !observed.has(frameId)) {
        failures += 1;
        issues.push(issue(
          "SPRITE-ANIMATION-FRAME-UNOBSERVED",
          "BLOCKING",
          frameId,
          "a measured frame",
          `Animation ${animation.id} plays a frame with no measurement behind it.`,
          "Re-run the local audit so every played frame is measured from the same sheet bytes.",
          "asset",
          "BLOCKING",
          `animations.${animation.id}`,
        ));
      }
    }
    if (animation.fps < 1 || animation.fps > 240) {
      failures += 1;
      issues.push(issue(
        "SPRITE-ANIMATION-FPS-RANGE",
        "BLOCKING",
        animation.fps,
        "1 <= fps <= 240",
        `Animation ${animation.id} declares a frame rate that cannot play back on the target.`,
        "Declare the real playback rate the runtime uses for this clip.",
        "content",
        "BLOCKING",
        `animations.${animation.id}.fps`,
      ));
    }
    if (animation.loop && new Set(animation.frameIds).size < 2) {
      issues.push(issue(
        "SPRITE-ANIMATION-STATIC-LOOP",
        "INFO",
        [...new Set(animation.frameIds)],
        ">= 2 distinct frames for a looping clip",
        `Looping animation ${animation.id} repeats a single cell, so it cannot show motion.`,
        "Add distinct poses, or declare the clip as a non-looping hold instead of a loop.",
        "content",
        enforcement,
        `animations.${animation.id}.frameIds`,
      ));
    }
  }

  const framesObserved = [...observed];
  const status: SpriteAnimationStatus = failures > 0
    ? "FAIL"
    : framesObserved.length === 0
      ? "NOT_EVALUATED"
      : "PASS";
  return { status, framesObserved, issues, qualityViolations };
}

function observedFrameIds(manifest: SpriteSheetReviewManifest): ReadonlySet<string> {
  const metrics = manifest.metrics;
  if (!metrics) return new Set();
  if (metrics.frameHashes) return new Set(Object.keys(metrics.frameHashes));
  if (metrics.frameAlphaCoverages.length === manifest.frames.length) return new Set(manifest.frames.map((frame) => frame.id));
  return new Set();
}

function parseManifest(value: unknown): SpriteSheetReviewManifest {
  const source = object(value, "Sprite sheet review");
  if (source.schema !== SPRITE_SHEET_REVIEW_SCHEMA) throw new SpriteSheetReviewInputError(`schema must be ${SPRITE_SHEET_REVIEW_SCHEMA}.`);
  if (source.schemaVersion !== "1") throw new SpriteSheetReviewInputError("schemaVersion must be 1.");
  const evidenceKind = text(source.evidenceKind, "evidenceKind") as SpriteSheetEvidenceKind;
  if (evidenceKind !== "CONTRACT_FIXTURE" && evidenceKind !== "PLAYER_FACING_CAPTURE") {
    throw new SpriteSheetReviewInputError("evidenceKind must be CONTRACT_FIXTURE or PLAYER_FACING_CAPTURE.");
  }
  const assetId = text(source.assetId, "assetId");
  const sourceRecord = object(source.source, "source");
  const origin = text(sourceRecord.origin, "source.origin") as SpriteSourceOrigin;
  if (!["imagegen", "reference", "hand-authored", "procedural", "runtime-generated"].includes(origin)) {
    throw new SpriteSheetReviewInputError("source.origin is not recognized.");
  }
  const sourceValue: SpriteSource = {
    path: text(sourceRecord.path, "source.path"),
    origin,
    sha256: hash(sourceRecord.sha256, "source.sha256"),
    bytes: positiveInt(sourceRecord.bytes, "source.bytes"),
    ...(sourceRecord.licenseStatus === undefined ? {} : { licenseStatus: text(sourceRecord.licenseStatus, "source.licenseStatus") }),
    ...(sourceRecord.referenceRole === undefined ? {} : { referenceRole: text(sourceRecord.referenceRole, "source.referenceRole") }),
  };
  const targetRecord = object(source.target, "target");
  const target: SpriteTarget = {
    engine: text(targetRecord.engine, "target.engine"),
    renderer: text(targetRecord.renderer, "target.renderer"),
    platform: text(targetRecord.platform, "target.platform"),
    logicalFramePx: dimensions(targetRecord.logicalFramePx, "target.logicalFramePx"),
    ...(targetRecord.runtimeFramePx === undefined ? {} : { runtimeFramePx: dimensions(targetRecord.runtimeFramePx, "target.runtimeFramePx") }),
  };
  const sheetRecord = object(source.sheet, "sheet");
  const sheet: SpriteSheetFile = {
    path: text(sheetRecord.path, "sheet.path"),
    sha256: hash(sheetRecord.sha256, "sheet.sha256"),
    bytes: positiveInt(sheetRecord.bytes, "sheet.bytes"),
    width: positiveInt(sheetRecord.width, "sheet.width"),
    height: positiveInt(sheetRecord.height, "sheet.height"),
  };
  if (sourceValue.sha256 !== sheet.sha256 || sourceValue.bytes !== sheet.bytes) {
    throw new SpriteSheetReviewInputError("source and sheet identity must match.");
  }
  const gridRecord = object(source.grid, "grid");
  const grid: SpriteSheetGrid = {
    columns: positiveInt(gridRecord.columns, "grid.columns"),
    rows: positiveInt(gridRecord.rows, "grid.rows"),
    frameWidth: positiveInt(gridRecord.frameWidth, "grid.frameWidth"),
    frameHeight: positiveInt(gridRecord.frameHeight, "grid.frameHeight"),
    padding: point(gridRecord.padding, "grid.padding", true),
    spacing: point(gridRecord.spacing, "grid.spacing", true),
  };
  if (grid.padding.x < 0 || grid.padding.y < 0 || grid.spacing.x < 0 || grid.spacing.y < 0) {
    throw new SpriteSheetReviewInputError("grid padding and spacing cannot be negative.");
  }
  const frames = parseFrames(source.frames, grid, sheet);
  const frameIds = new Set(frames.map((frame) => frame.id));
  const animations = parseAnimations(source.animations, frameIds);
  const qualityPolicy = parseQualityPolicy(source.qualityPolicy);
  const metrics = source.metrics === undefined ? undefined : parseMetrics(source.metrics, frames);
  const captures = source.captures === undefined ? [] : parseCaptures(source.captures);
  const humanReview = source.humanReview === undefined ? undefined : parseHumanReview(source.humanReview);
  if (evidenceKind === "CONTRACT_FIXTURE" && captures.length > 0) {
    throw new SpriteSheetReviewInputError("CONTRACT_FIXTURE cannot carry runtime captures.");
  }
  if (evidenceKind === "CONTRACT_FIXTURE" && humanReview && humanReview.decision !== "NOT_EVALUATED") {
    throw new SpriteSheetReviewInputError("CONTRACT_FIXTURE cannot carry a player-facing human decision.");
  }
  if (evidenceKind === "PLAYER_FACING_CAPTURE" && captures.length === 0) {
    throw new SpriteSheetReviewInputError("PLAYER_FACING_CAPTURE requires at least one runtime capture.");
  }
  return {
    schema: SPRITE_SHEET_REVIEW_SCHEMA,
    schemaVersion: "1",
    evidenceKind,
    assetId,
    source: sourceValue,
    target,
    sheet,
    grid,
    frames,
    animations,
    qualityPolicy,
    ...(metrics ? { metrics } : {}),
    ...(captures.length ? { captures } : {}),
    ...(humanReview ? { humanReview } : {}),
  };
}

function parseFrames(value: unknown, grid: SpriteSheetGrid, sheet: SpriteSheetFile): SpriteFrame[] {
  if (!Array.isArray(value) || value.length === 0) throw new SpriteSheetReviewInputError("frames must be a non-empty array.");
  const ids = new Set<string>();
  const indexes = new Set<number>();
  const maxCells = grid.columns * grid.rows;
  return value.map((item, index) => {
    const frame = object(item, `frames[${index}]`);
    const id = text(frame.id, `frames[${index}].id`);
    if (ids.has(id)) throw new SpriteSheetReviewInputError(`Duplicate frame id: ${id}.`);
    ids.add(id);
    const frameIndex = nonNegativeInt(frame.index, `frames[${index}].index`);
    if (frameIndex >= maxCells) throw new SpriteSheetReviewInputError(`frames[${index}].index exceeds the declared grid.`);
    if (indexes.has(frameIndex)) throw new SpriteSheetReviewInputError(`Duplicate frame index: ${frameIndex}.`);
    indexes.add(frameIndex);
    const width = positiveInt(frame.width, `frames[${index}].width`);
    const height = positiveInt(frame.height, `frames[${index}].height`);
    if (width !== grid.frameWidth || height !== grid.frameHeight) {
      throw new SpriteSheetReviewInputError(`frames[${index}] does not match grid cell dimensions.`);
    }
    const x = nonNegativeInt(frame.x, `frames[${index}].x`);
    const y = nonNegativeInt(frame.y, `frames[${index}].y`);
    if (x + width > sheet.width || y + height > sheet.height) throw new SpriteSheetReviewInputError(`frames[${index}] is outside the sheet bounds.`);
    return {
      id,
      index: frameIndex,
      x,
      y,
      width,
      height,
      state: text(frame.state, `frames[${index}].state`),
      ...(frame.direction === undefined ? {} : { direction: text(frame.direction, `frames[${index}].direction`) }),
      anchor: point(frame.anchor, `frames[${index}].anchor`),
      ...(frame.pivot === undefined ? {} : { pivot: point(frame.pivot, `frames[${index}].pivot`) }),
      ...(frame.hitbox === undefined ? {} : { hitbox: hitbox(frame.hitbox, `frames[${index}].hitbox`) }),
    };
  });
}

function parseAnimations(value: unknown, frameIds: ReadonlySet<string>): SpriteAnimation[] {
  if (!Array.isArray(value) || value.length === 0) throw new SpriteSheetReviewInputError("animations must be a non-empty array.");
  const ids = new Set<string>();
  return value.map((item, index) => {
    const animation = object(item, `animations[${index}]`);
    const id = text(animation.id, `animations[${index}].id`);
    if (ids.has(id)) throw new SpriteSheetReviewInputError(`Duplicate animation id: ${id}.`);
    ids.add(id);
    const refs = strings(animation.frameIds, `animations[${index}].frameIds`);
    for (const frameId of refs) if (!frameIds.has(frameId)) throw new SpriteSheetReviewInputError(`animations[${index}] references missing frame ${frameId}.`);
    return {
      id,
      state: text(animation.state, `animations[${index}].state`),
      ...(animation.direction === undefined ? {} : { direction: text(animation.direction, `animations[${index}].direction`) }),
      fps: positiveNumber(animation.fps, `animations[${index}].fps`),
      loop: boolean(animation.loop, `animations[${index}].loop`),
      ...(animation.holdLast === undefined ? {} : { holdLast: boolean(animation.holdLast, `animations[${index}].holdLast`) }),
      frameIds: refs,
      ...(animation.required === undefined ? {} : { required: boolean(animation.required, `animations[${index}].required`) }),
    };
  });
}

function parseQualityPolicy(value: unknown): SpriteQualityPolicy {
  const source = value === undefined ? {} : object(value, "qualityPolicy");
  const mode = (source.mode ?? "OFF") as SpriteQualityPolicy["mode"];
  if (mode !== "OFF" && mode !== "ADVISORY" && mode !== "BLOCKING") throw new SpriteSheetReviewInputError("qualityPolicy.mode must be OFF, ADVISORY, or BLOCKING.");
  const ratio = (candidate: unknown, name: string): number | undefined => candidate === undefined ? undefined : boundedNumber(candidate, name, 0, 1);
  const result: SpriteQualityPolicy = {
    mode,
    ...(source.strictChecks === undefined ? {} : { strictChecks: strictChecks(source.strictChecks) }),
    ...(source.requiredStates === undefined ? {} : { requiredStates: strings(source.requiredStates, "qualityPolicy.requiredStates") }),
    ...(ratio(source.minDistinctFrameRatio, "qualityPolicy.minDistinctFrameRatio") === undefined ? {} : { minDistinctFrameRatio: ratio(source.minDistinctFrameRatio, "qualityPolicy.minDistinctFrameRatio") }),
    ...(ratio(source.maxDuplicateFrameRatio, "qualityPolicy.maxDuplicateFrameRatio") === undefined ? {} : { maxDuplicateFrameRatio: ratio(source.maxDuplicateFrameRatio, "qualityPolicy.maxDuplicateFrameRatio") }),
    ...(source.minMeanFrameDelta === undefined ? {} : { minMeanFrameDelta: boundedNumber(source.minMeanFrameDelta, "qualityPolicy.minMeanFrameDelta", 0, Number.POSITIVE_INFINITY) }),
    ...(source.requireTransparentBackground === undefined ? {} : { requireTransparentBackground: boolean(source.requireTransparentBackground, "qualityPolicy.requireTransparentBackground") }),
    ...(source.requireOpaqueBottom === undefined ? {} : { requireOpaqueBottom: boolean(source.requireOpaqueBottom, "qualityPolicy.requireOpaqueBottom") }),
    ...(source.maxClippingPixels === undefined ? {} : { maxClippingPixels: nonNegativeInt(source.maxClippingPixels, "qualityPolicy.maxClippingPixels") }),
    ...(source.maxAlphaSpillPixels === undefined ? {} : { maxAlphaSpillPixels: nonNegativeInt(source.maxAlphaSpillPixels, "qualityPolicy.maxAlphaSpillPixels") }),
    ...(source.maxBorderTouchRatio === undefined ? {} : { maxBorderTouchRatio: boundedNumber(source.maxBorderTouchRatio, "qualityPolicy.maxBorderTouchRatio", 0, 1) }),
    ...(source.minSilhouetteCoverage === undefined ? {} : { minSilhouetteCoverage: boundedNumber(source.minSilhouetteCoverage, "qualityPolicy.minSilhouetteCoverage", 0, 1) }),
    ...(source.minAlphaCoverage === undefined ? {} : { minAlphaCoverage: boundedNumber(source.minAlphaCoverage, "qualityPolicy.minAlphaCoverage", 0, 1) }),
    ...(source.maxAlphaCoverage === undefined ? {} : { maxAlphaCoverage: boundedNumber(source.maxAlphaCoverage, "qualityPolicy.maxAlphaCoverage", 0, 1) }),
    ...(source.minHardAlphaRatio === undefined ? {} : { minHardAlphaRatio: boundedNumber(source.minHardAlphaRatio, "qualityPolicy.minHardAlphaRatio", 0, 1) }),
    ...(source.maxUniqueColorCount === undefined ? {} : { maxUniqueColorCount: positiveInt(source.maxUniqueColorCount, "qualityPolicy.maxUniqueColorCount") }),
    ...(source.minDominantRunLength === undefined ? {} : { minDominantRunLength: positiveInt(source.minDominantRunLength, "qualityPolicy.minDominantRunLength") }),
    ...(source.maxOffGridPixelRatio === undefined ? {} : { maxOffGridPixelRatio: boundedNumber(source.maxOffGridPixelRatio, "qualityPolicy.maxOffGridPixelRatio", 0, 1) }),
    ...(source.pixelGridSize === undefined ? {} : { pixelGridSize: positiveInt(source.pixelGridSize, "qualityPolicy.pixelGridSize") }),
    ...(source.runtimeFramePx === undefined ? {} : { runtimeFramePx: dimensions(source.runtimeFramePx, "qualityPolicy.runtimeFramePx") }),
    ...(source.requireRuntimeCapture === undefined ? {} : { requireRuntimeCapture: boolean(source.requireRuntimeCapture, "qualityPolicy.requireRuntimeCapture") }),
    ...(source.requireHumanReview === undefined ? {} : { requireHumanReview: boolean(source.requireHumanReview, "qualityPolicy.requireHumanReview") }),
  };
  return result;
}

function parseMetrics(value: unknown, frames: readonly SpriteFrame[]): SpriteSheetMetrics {
  const source = object(value, "metrics");
  const dimensionsValue = dimensions(source.sheetDimensions, "metrics.sheetDimensions");
  const coverages = numbers(source.frameAlphaCoverages, "metrics.frameAlphaCoverages");
  if (coverages.length !== frames.length) throw new SpriteSheetReviewInputError("metrics.frameAlphaCoverages must match frames length.");
  const frameHashes = source.frameHashes === undefined ? undefined : hashRecord(source.frameHashes, "metrics.frameHashes");
  if (frameHashes && frames.some((frame) => frameHashes[frame.id] === undefined)) throw new SpriteSheetReviewInputError("metrics.frameHashes must include every frame id.");
  const duplicateGroups = source.duplicateFrameGroups === undefined ? undefined : stringsOfStrings(source.duplicateFrameGroups, "metrics.duplicateFrameGroups");
  return {
    sourceHash: hash(source.sourceHash, "metrics.sourceHash"),
    sheetDimensions: dimensionsValue,
    alphaCoverage: boundedNumber(source.alphaCoverage, "metrics.alphaCoverage", 0, 1),
    frameAlphaCoverages: coverages.map((coverage, index) => boundedNumber(coverage, `metrics.frameAlphaCoverages[${index}]`, 0, 1)),
    ...(frameHashes ? { frameHashes } : {}),
    ...(duplicateGroups ? { duplicateFrameGroups: duplicateGroups } : {}),
    ...(source.distinctFrameRatio === undefined ? {} : { distinctFrameRatio: boundedNumber(source.distinctFrameRatio, "metrics.distinctFrameRatio", 0, 1) }),
    ...(source.meanFrameDelta === undefined ? {} : { meanFrameDelta: boundedNumber(source.meanFrameDelta, "metrics.meanFrameDelta", 0, Number.POSITIVE_INFINITY) }),
    ...(source.hasTransparentPixels === undefined ? {} : { hasTransparentPixels: boolean(source.hasTransparentPixels, "metrics.hasTransparentPixels") }),
    ...(source.emptyFrameIds === undefined ? {} : { emptyFrameIds: stringArray(source.emptyFrameIds, "metrics.emptyFrameIds") }),
    ...(source.opaqueBottomFrameIds === undefined ? {} : { opaqueBottomFrameIds: stringArray(source.opaqueBottomFrameIds, "metrics.opaqueBottomFrameIds") }),
    ...(source.clippingFrameIds === undefined ? {} : { clippingFrameIds: stringArray(source.clippingFrameIds, "metrics.clippingFrameIds") }),
    ...(source.alphaSpillPixels === undefined ? {} : { alphaSpillPixels: nonNegativeInt(source.alphaSpillPixels, "metrics.alphaSpillPixels") }),
    ...(source.borderTouchRatios === undefined ? {} : { borderTouchRatios: numbers(source.borderTouchRatios, "metrics.borderTouchRatios").map((ratio, index) => boundedNumber(ratio, `metrics.borderTouchRatios[${index}]`, 0, 1)) }),
    ...(source.silhouetteCoverages === undefined ? {} : { silhouetteCoverages: numbers(source.silhouetteCoverages, "metrics.silhouetteCoverages").map((coverage, index) => boundedNumber(coverage, `metrics.silhouetteCoverages[${index}]`, 0, 1)) }),
    ...(source.measuredCellPx === undefined ? {} : { measuredCellPx: dimensions(source.measuredCellPx, "metrics.measuredCellPx") }),
    ...(source.hardAlphaRatio === undefined ? {} : { hardAlphaRatio: boundedNumber(source.hardAlphaRatio, "metrics.hardAlphaRatio", 0, 1) }),
    ...(source.uniqueColorCount === undefined ? {} : { uniqueColorCount: nonNegativeInt(source.uniqueColorCount, "metrics.uniqueColorCount") }),
    ...(source.dominantRunLength === undefined ? {} : { dominantRunLength: nonNegativeInt(source.dominantRunLength, "metrics.dominantRunLength") }),
    ...(source.offGridPixelRatio === undefined ? {} : { offGridPixelRatio: boundedNumber(source.offGridPixelRatio, "metrics.offGridPixelRatio", 0, 1) }),
    ...(source.runtimeFramePx === undefined ? {} : { runtimeFramePx: dimensions(source.runtimeFramePx, "metrics.runtimeFramePx") }),
  };
}

function parseCaptures(value: unknown): SpriteRuntimeCapture[] {
  if (!Array.isArray(value)) throw new SpriteSheetReviewInputError("captures must be an array.");
  return value.map((item, index) => {
    const capture = object(item, `captures[${index}]`);
    const media = text(capture.media, `captures[${index}].media`) as SpriteRuntimeCapture["media"];
    if (media !== "screenshot" && media !== "frame") throw new SpriteSheetReviewInputError(`captures[${index}].media must be screenshot or frame.`);
    const viewport = dimensions(capture.viewport, `captures[${index}].viewport`);
    return {
      media,
      path: text(capture.path, `captures[${index}].path`),
      sha256: hash(capture.sha256, `captures[${index}].sha256`),
      bytes: positiveInt(capture.bytes, `captures[${index}].bytes`),
      renderer: text(capture.renderer, `captures[${index}].renderer`),
      viewport,
      sourceTreeHash: hash(capture.sourceTreeHash, `captures[${index}].sourceTreeHash`),
      shippedPath: boolean(capture.shippedPath, `captures[${index}].shippedPath`),
      ...(capture.frameRole === undefined ? {} : { frameRole: text(capture.frameRole, `captures[${index}].frameRole`) }),
    };
  });
}

function parseHumanReview(value: unknown): SpriteHumanReview {
  const source = object(value, "humanReview");
  const decision = text(source.decision, "humanReview.decision") as SpriteHumanDecision;
  if (!["PASS", "PASS_WITH_FOLLOW_UP", "NO_GO", "NOT_EVALUATED"].includes(decision)) throw new SpriteSheetReviewInputError("humanReview.decision is not recognized.");
  return {
    decision,
    ...(source.reviewer === undefined ? {} : { reviewer: text(source.reviewer, "humanReview.reviewer") }),
    ...(source.notes === undefined ? {} : { notes: text(source.notes, "humanReview.notes") }),
  };
}

function issue(
  code: string,
  severity: SpriteIssueSeverity,
  observed: SpriteReviewIssue["observed"],
  threshold: SpriteReviewIssue["threshold"],
  rationale: string,
  recommendation: string,
  ownership: SpriteIssueOwnership,
  enforcement: SpriteIssueEnforcement,
  path?: string,
): SpriteReviewIssue {
  return { code, severity, ...(path ? { path } : {}), observed, threshold, rationale, recommendation, ownership, enforcement };
}

function metricUnavailableIssue(code: string, path: string, enforcement: SpriteIssueEnforcement): SpriteReviewIssue {
  return issue(
    code,
    enforcement === "BLOCKING" ? "BLOCKING" : "ADVISORY",
    null,
    "declared pixel metric",
    "The requested pixel gate cannot run without a fresh local RGBA measurement.",
    "Run the local sprite-sheet audit against the exact sheet bytes and preserve its JSON metrics.",
    "asset",
    enforcement,
    `metrics.${path}`,
  );
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SpriteSheetReviewInputError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new SpriteSheetReviewInputError(`${name} must be a non-empty string.`);
  return value.trim();
}

function hash(value: unknown, name: string): string {
  const result = text(value, name).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result)) throw new SpriteSheetReviewInputError(`${name} must be a 64-character SHA-256 hash.`);
  return result;
}

function hashRecord(value: unknown, name: string): Record<string, string> {
  const source = object(value, name);
  return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, hash(item, `${name}.${key}`)]));
}

function positiveInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new SpriteSheetReviewInputError(`${name} must be a positive integer.`);
  return value as number;
}

function nonNegativeInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new SpriteSheetReviewInputError(`${name} must be a non-negative integer.`);
  return value as number;
}

function positiveNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new SpriteSheetReviewInputError(`${name} must be a positive number.`);
  return value;
}

function boundedNumber(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new SpriteSheetReviewInputError(`${name} must be between ${minimum} and ${maximum}.`);
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new SpriteSheetReviewInputError(`${name} must be boolean.`);
  return value;
}

function dimensions(value: unknown, name: string): { width: number; height: number } {
  const source = object(value, name);
  return { width: positiveInt(source.width, `${name}.width`), height: positiveInt(source.height, `${name}.height`) };
}

function point(value: unknown, name: string, nonNegative = false): SpritePoint {
  const source = object(value, name);
  const x = typeof source.x === "number" && Number.isFinite(source.x) ? source.x : NaN;
  const y = typeof source.y === "number" && Number.isFinite(source.y) ? source.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (nonNegative && (x < 0 || y < 0))) throw new SpriteSheetReviewInputError(`${name}.x and ${name}.y must be finite${nonNegative ? " non-negative" : ""} numbers.`);
  return { x, y };
}

function hitbox(value: unknown, name: string): SpriteHitbox {
  const source = object(value, name);
  const pointValue = point(source, name);
  return { ...pointValue, width: positiveNumber(source.width, `${name}.width`), height: positiveNumber(source.height, `${name}.height`) };
}

function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new SpriteSheetReviewInputError(`${name} must be a non-empty string array.`);
  return value.map((item, index) => text(item, `${name}[${index}]`));
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new SpriteSheetReviewInputError(`${name} must be an array.`);
  return value.map((item, index) => text(item, `${name}[${index}]`));
}

function strictChecks(value: unknown): SpriteStrictCheck[] {
  if (!Array.isArray(value)) throw new SpriteSheetReviewInputError("qualityPolicy.strictChecks must be an array.");
  return value.map((item, index) => {
    const name = text(item, `qualityPolicy.strictChecks[${index}]`);
    if (name !== "pixel-discipline") throw new SpriteSheetReviewInputError(`qualityPolicy.strictChecks[${index}] is not a known strict check.`);
    return name;
  });
}

function stringsOfStrings(value: unknown, name: string): string[][] {
  if (!Array.isArray(value)) throw new SpriteSheetReviewInputError(`${name} must be an array.`);
  return value.map((group, index) => strings(group, `${name}[${index}]`));
}

function numbers(value: unknown, name: string): number[] {
  if (!Array.isArray(value)) throw new SpriteSheetReviewInputError(`${name} must be an array.`);
  return value.map((item, index) => {
    if (typeof item !== "number" || !Number.isFinite(item)) throw new SpriteSheetReviewInputError(`${name}[${index}] must be a finite number.`);
    return item;
  });
}
