import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSpriteSheetReview,
  SPRITE_SHEET_REVIEW_RULESET_ID,
  SPRITE_SHEET_REVIEW_RULESET_VERSION,
  type SpriteSheetReviewManifest,
} from "../packages/core/src/sprite-sheet-review";

const SOURCE_HASH = "a".repeat(64);
const CAPTURE_HASH = "b".repeat(64);

function metrics(overrides: Record<string, unknown> = {}) {
  return {
    sourceHash: SOURCE_HASH,
    sheetDimensions: { width: 256, height: 256 },
    alphaCoverage: 0.42,
    frameAlphaCoverages: [0.42, 0.41, 0.43, 0.4],
    frameHashes: {
      idle0: "1".repeat(64),
      idle1: "1".repeat(64),
      walk0: "2".repeat(64),
      walk1: "3".repeat(64),
    },
    duplicateFrameGroups: [["idle0", "idle1"]],
    distinctFrameRatio: 0.75,
    meanFrameDelta: 0.18,
    hasTransparentPixels: true,
    ...overrides,
  };
}

function baseManifest(overrides: Partial<SpriteSheetReviewManifest> = {}): SpriteSheetReviewManifest {
  return {
    schema: "clunk.sprite-sheet-review.v1",
    schemaVersion: "1",
    evidenceKind: "CONTRACT_FIXTURE",
    assetId: "xianxia-hero-sprite-sheet",
    source: {
      path: "output/hero.png",
      origin: "imagegen",
      sha256: SOURCE_HASH,
      bytes: 4096,
      licenseStatus: "review-required",
      referenceRole: "style-reference",
    },
    target: {
      engine: "pixijs",
      renderer: "WebGL2",
      platform: "web",
      logicalFramePx: { width: 64, height: 64 },
      runtimeFramePx: { width: 46, height: 46 },
    },
    sheet: {
      path: "output/hero.png",
      sha256: SOURCE_HASH,
      bytes: 4096,
      width: 256,
      height: 256,
    },
    grid: {
      columns: 4,
      rows: 4,
      frameWidth: 64,
      frameHeight: 64,
      padding: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 },
    },
    frames: [
      { id: "idle0", index: 0, x: 0, y: 0, width: 64, height: 64, state: "idle", anchor: { x: 0.5, y: 0.9 } },
      { id: "idle1", index: 1, x: 64, y: 0, width: 64, height: 64, state: "idle", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk0", index: 2, x: 128, y: 0, width: 64, height: 64, state: "walk", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk1", index: 3, x: 192, y: 0, width: 64, height: 64, state: "walk", anchor: { x: 0.5, y: 0.9 } },
    ],
    animations: [
      { id: "idle", state: "idle", fps: 8, loop: true, frameIds: ["idle0", "idle1"], required: true },
      { id: "walk", state: "walk", fps: 10, loop: true, frameIds: ["walk0", "walk1"], required: true },
    ],
    qualityPolicy: {
      mode: "BLOCKING",
      requiredStates: ["idle", "walk"],
      minDistinctFrameRatio: 0.75,
      maxDuplicateFrameRatio: 0.3,
      minMeanFrameDelta: 0.1,
      requireTransparentBackground: true,
      requireRuntimeCapture: true,
      requireHumanReview: true,
    },
    metrics: metrics(),
    ...overrides,
  };
}

function manifestWithoutMetrics(): SpriteSheetReviewManifest {
  const manifest = baseManifest();
  delete (manifest as { metrics?: unknown }).metrics;
  return manifest;
}

test("duplicate sprite frames are structured quality blockers, not visual approval", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    metrics: metrics({
      distinctFrameRatio: 0.5,
      duplicateFrameGroups: [["idle0", "idle1"], ["walk0", "walk1"]],
    }),
  }));

  assert.equal(report.static, "PASS");
  assert.equal(report.quality, "BLOCKED");
  assert.equal(report.readiness, "blocked");
  assert.equal(report.visualRuntime, "GAP");
  assert.equal(report.playerFacing, "NOT_EVALUATED");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-DUPLICATE-FRAMES"));
  assert.equal(report.issues.find((issue) => issue.code === "SPRITE-DUPLICATE-FRAMES")?.ownership, "asset");
  assert.equal(report.issues.find((issue) => issue.code === "SPRITE-DUPLICATE-FRAMES")?.enforcement, "BLOCKING");
});

test("a CONTRACT_FIXTURE can pass its pixel contract but never becomes a runtime or player-facing pass", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: { mode: "ADVISORY", maxDuplicateFrameRatio: 0.2, requireRuntimeCapture: false, requireHumanReview: false },
  }));

  assert.equal(report.static, "PASS");
  assert.equal(report.quality, "ADVISORY");
  assert.equal(report.visualRuntime, "GAP");
  assert.equal(report.playerFacing, "NOT_EVALUATED");
  assert.equal(report.humanDecision, "NOT_EVALUATED");
  assert.equal(report.reviewStatus, "NOT_EVALUATED");
  assert.equal(report.readiness, "conditional");
});

test("a PLAYER_FACING_CAPTURE needs an explicit human decision before readiness can be ready", () => {
  const capture = {
    media: "screenshot" as const,
    path: "captures/hero-webgl2.png",
    sha256: CAPTURE_HASH,
    bytes: 12345,
    renderer: "WebGL2",
    viewport: { width: 1920, height: 1080 },
    sourceTreeHash: "c".repeat(64),
    shippedPath: true,
    frameRole: "player-facing-sprite",
  };
  const reviewed = normalizeSpriteSheetReview(baseManifest({
    evidenceKind: "PLAYER_FACING_CAPTURE",
    captures: [capture],
    humanReview: { decision: "PASS", reviewer: "art-review", notes: "Silhouette and motion read at 46px." },
    qualityPolicy: capturePolicy(),
  }));

  assert.equal(reviewed.visualRuntime, "PASS");
  assert.equal(reviewed.playerFacing, "PASS");
  assert.equal(reviewed.humanDecision, "PASS");
  assert.equal(reviewed.reviewStatus, "EVALUATED");
  assert.equal(reviewed.readiness, "ready");

  const noGo = normalizeSpriteSheetReview(baseManifest({
    evidenceKind: "PLAYER_FACING_CAPTURE",
    captures: [capture],
    humanReview: { decision: "NO_GO", reviewer: "art-review", notes: "Frames remain too similar." },
    qualityPolicy: capturePolicy(),
  }));
  assert.equal(noGo.visualRuntime, "PASS");
  assert.equal(noGo.playerFacing, "NO_GO");
  assert.equal(noGo.humanDecision, "NO_GO");
  assert.equal(noGo.readiness, "conditional");
});

function capturePolicy() {
  return {
    mode: "BLOCKING" as const,
    requiredStates: ["idle", "walk"],
    minDistinctFrameRatio: 0.75,
    maxDuplicateFrameRatio: 0.3,
    minMeanFrameDelta: 0.1,
    requireTransparentBackground: true,
    requireRuntimeCapture: true,
    requireHumanReview: true,
  };
}

test("malformed grid dimensions are rejected with an explicit contract error", () => {
  assert.throws(
    () => normalizeSpriteSheetReview(baseManifest({
      grid: {
        columns: 4,
        rows: 4,
        frameWidth: 63,
        frameHeight: 64,
        padding: { x: 0, y: 0 },
        spacing: { x: 0, y: 0 },
      },
    })),
    /does not match grid cell dimensions/,
  );
});

test("sprite contract preserves direction, hold-last, pivot, hitbox, and opaque-bottom policy", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    frames: [
      { id: "idle0", index: 0, x: 0, y: 0, width: 64, height: 64, state: "idle", direction: "south", anchor: { x: 0.5, y: 0.9 }, pivot: { x: 0.5, y: 0.9 }, hitbox: { x: 20, y: 24, width: 24, height: 36 } },
      { id: "idle1", index: 1, x: 64, y: 0, width: 64, height: 64, state: "idle", direction: "south", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk0", index: 2, x: 128, y: 0, width: 64, height: 64, state: "walk", direction: "south", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk1", index: 3, x: 192, y: 0, width: 64, height: 64, state: "walk", direction: "south", anchor: { x: 0.5, y: 0.9 } },
    ],
    animations: [
      { id: "idle", state: "idle", direction: "south", fps: 8, loop: true, holdLast: true, frameIds: ["idle0", "idle1"], required: true },
      { id: "walk", state: "walk", direction: "south", fps: 10, loop: true, holdLast: false, frameIds: ["walk0", "walk1"], required: true },
    ],
    qualityPolicy: {
      mode: "BLOCKING",
      requiredStates: ["idle", "walk"],
      minDistinctFrameRatio: 0.75,
      maxDuplicateFrameRatio: 0.2,
      minMeanFrameDelta: 0.1,
      requireTransparentBackground: true,
      requireOpaqueBottom: true,
      maxClippingPixels: 0,
      maxAlphaSpillPixels: 0,
      maxBorderTouchRatio: 0,
      minSilhouetteCoverage: 0.05,
      runtimeFramePx: { width: 46, height: 46 },
      requireRuntimeCapture: false,
      requireHumanReview: false,
    },
    metrics: metrics({
      frameAlphaCoverages: [0.42, 0.41, 0.43, 0.4],
      duplicateFrameGroups: [],
      opaqueBottomFrameIds: ["idle0", "idle1", "walk0", "walk1"],
      clippingFrameIds: [],
      alphaSpillPixels: 0,
      borderTouchRatios: [0, 0, 0, 0],
      silhouetteCoverages: [0.42, 0.41, 0.43, 0.4],
      runtimeFramePx: { width: 46, height: 46 },
    }),
  }));

  assert.equal(report.frames[0].direction, "south");
  assert.equal(report.frames[0].pivot?.x, 0.5);
  assert.equal(report.frames[0].hitbox?.height, 36);
  assert.equal(report.animations[0].holdLast, true);
  assert.equal(report.animations[0].direction, "south");
  assert.equal(report.quality, "PASS");
});

test("sprite pixel gates block clipping, alpha spill, border contact, silhouette, opaque-bottom, and runtime-size failures", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: {
      mode: "BLOCKING",
      requiredStates: ["idle", "walk"],
      requireOpaqueBottom: true,
      maxClippingPixels: 0,
      maxAlphaSpillPixels: 0,
      maxBorderTouchRatio: 0.05,
      minSilhouetteCoverage: 0.2,
      runtimeFramePx: { width: 46, height: 46 },
      requireRuntimeCapture: false,
      requireHumanReview: false,
    },
    metrics: metrics({
      opaqueBottomFrameIds: ["walk0"],
      clippingFrameIds: ["idle0"],
      alphaSpillPixels: 3,
      borderTouchRatios: [0.2, 0, 0, 0],
      silhouetteCoverages: [0.1, 0.4, 0.4, 0.4],
      runtimeFramePx: { width: 32, height: 32 },
    }),
  }));

  assert.equal(report.quality, "BLOCKED");
  for (const code of [
    "SPRITE-OPAQUE-BOTTOM",
    "SPRITE-CLIPPING",
    "SPRITE-ALPHA-SPILL",
    "SPRITE-BORDER-CONTACT",
    "SPRITE-SILHOUETTE-COVERAGE",
    "SPRITE-RUNTIME-SIZE",
  ]) assert.ok(report.issues.some((issue) => issue.code === code), code);
});

// ---------------------------------------------------------------------------
// Repair 1 — the static lane is measured, not a constant PASS.
// ---------------------------------------------------------------------------

test("a manifest without measured pixels reports PARSED_ONLY instead of a static PASS", () => {
  const withoutMetrics = manifestWithoutMetrics();
  const report = normalizeSpriteSheetReview({
    ...withoutMetrics,
    qualityPolicy: { mode: "OFF" },
  });

  assert.equal(report.static, "PARSED_ONLY");
  assert.notEqual(report.readiness, "ready");
});

test("static lane fails when the declared grid cannot fit inside the declared sheet", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    grid: { columns: 4, rows: 4, frameWidth: 64, frameHeight: 64, padding: { x: 8, y: 0 }, spacing: { x: 0, y: 0 } },
    qualityPolicy: { mode: "OFF" },
  }));

  assert.equal(report.static, "FAIL");
  assert.equal(report.readiness, "blocked");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-GRID-GEOMETRY"));
});

test("static lane fails when a frame is not placed on its declared grid cell", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    frames: [
      { id: "idle0", index: 0, x: 0, y: 0, width: 64, height: 64, state: "idle", anchor: { x: 0.5, y: 0.9 } },
      { id: "idle1", index: 1, x: 0, y: 64, width: 64, height: 64, state: "idle", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk0", index: 2, x: 128, y: 0, width: 64, height: 64, state: "walk", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk1", index: 3, x: 192, y: 0, width: 64, height: 64, state: "walk", anchor: { x: 0.5, y: 0.9 } },
    ],
    qualityPolicy: { mode: "OFF" },
  }));

  assert.equal(report.static, "FAIL");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-FRAME-CELL-MISMATCH"));
});

test("static lane fails when the measured cell size contradicts the declared cell or logical frame", () => {
  const cellMismatch = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: { mode: "OFF" },
    metrics: metrics({ measuredCellPx: { width: 32, height: 64 } }),
  }));
  assert.equal(cellMismatch.static, "FAIL");
  assert.ok(cellMismatch.issues.some((issue) => issue.code === "SPRITE-CELL-SIZE-MISMATCH"));

  const logicalMismatch = normalizeSpriteSheetReview(baseManifest({
    target: {
      engine: "pixijs",
      renderer: "WebGL2",
      platform: "web",
      logicalFramePx: { width: 96, height: 96 },
      runtimeFramePx: { width: 96, height: 96 },
    },
    qualityPolicy: { mode: "OFF" },
    metrics: metrics({ measuredCellPx: { width: 64, height: 64 } }),
  }));
  assert.equal(logicalMismatch.static, "FAIL");
  assert.ok(logicalMismatch.issues.some((issue) => issue.code === "SPRITE-LOGICAL-SIZE-MISMATCH"));
});

// ---------------------------------------------------------------------------
// Repair 2 — declared animations are actually evaluated.
// ---------------------------------------------------------------------------

test("animation playback is NOT_EVALUATED when no frame was observed", () => {
  const withoutMetrics = manifestWithoutMetrics();
  const report = normalizeSpriteSheetReview({ ...withoutMetrics, qualityPolicy: { mode: "OFF" } });

  assert.deepEqual([...report.framesObserved], []);
  assert.equal(report.animationPlayback, "NOT_EVALUATED");
  assert.notEqual(report.readiness, "ready");
});

test("animation playback fails when a required state has no declared animation", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    animations: [
      { id: "idle", state: "idle", fps: 8, loop: true, frameIds: ["idle0", "idle1"], required: true },
    ],
    qualityPolicy: { mode: "BLOCKING", requiredStates: ["idle", "walk"], requireRuntimeCapture: false, requireHumanReview: false },
  }));

  assert.equal(report.animationPlayback, "FAIL");
  assert.equal(report.readiness, "blocked");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-REQUIRED-ANIMATION-MISSING"));
});

test("animation playback fails when a clip plays a frame measured as empty", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: { mode: "OFF" },
    metrics: metrics({ emptyFrameIds: ["walk1"] }),
  }));

  assert.equal(report.animationPlayback, "FAIL");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-ANIMATION-EMPTY-FRAME"));
});

test("animation playback fails on an unplayable frame rate and observes only measured frames", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    animations: [
      { id: "idle", state: "idle", fps: 900, loop: true, frameIds: ["idle0", "idle1"], required: true },
      { id: "walk", state: "walk", fps: 10, loop: true, frameIds: ["walk0", "walk1"], required: true },
    ],
    qualityPolicy: { mode: "OFF" },
  }));

  assert.equal(report.animationPlayback, "FAIL");
  assert.deepEqual([...report.framesObserved].sort(), ["idle0", "idle1", "walk0", "walk1"]);
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-ANIMATION-FPS-RANGE"));
});

test("a single-frame looping clip is an advisory observation, not a silent pass", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    animations: [
      { id: "idle", state: "idle", fps: 8, loop: true, frameIds: ["idle0"], required: true },
      { id: "walk", state: "walk", fps: 10, loop: true, frameIds: ["walk0", "walk1"], required: true },
    ],
    qualityPolicy: { mode: "OFF" },
  }));

  assert.equal(report.animationPlayback, "PASS");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-ANIMATION-STATIC-LOOP"));
});

// ---------------------------------------------------------------------------
// Repair 4 — calibrated threshold floors cannot be declared away.
// ---------------------------------------------------------------------------

test("declared thresholds below the calibrated floor are raised, not honoured", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: {
      mode: "BLOCKING",
      minMeanFrameDelta: 0.005,
      minSilhouetteCoverage: 0.002,
      requireRuntimeCapture: false,
      requireHumanReview: false,
    },
    metrics: metrics({
      meanFrameDelta: 0.01,
      silhouetteCoverages: [0.03, 0.04, 0.05, 0.06],
    }),
  }));

  assert.equal(report.quality, "BLOCKED");
  assert.equal(report.effectiveThresholds.minMeanFrameDelta, 0.03);
  assert.equal(report.effectiveThresholds.minSilhouetteCoverage, 0.08);
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-THRESHOLD-BELOW-CALIBRATION"));
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-LOW-MEAN-FRAME-DELTA"));
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-SILHOUETTE-COVERAGE"));
});

// ---------------------------------------------------------------------------
// Repair 5 — pixel-art discipline indicators.
// ---------------------------------------------------------------------------

test("pixel-art indicators are recorded without gating until the profile opts in", () => {
  const observed = metrics({
    hardAlphaRatio: 0.42,
    uniqueColorCount: 60000,
    dominantRunLength: 1,
    offGridPixelRatio: 0.6,
  });
  const recorded = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: { mode: "BLOCKING", requireRuntimeCapture: false, requireHumanReview: false },
    metrics: observed,
  }));

  assert.equal(recorded.metrics?.hardAlphaRatio, 0.42);
  assert.equal(recorded.metrics?.uniqueColorCount, 60000);
  assert.equal(recorded.metrics?.dominantRunLength, 1);
  assert.equal(recorded.metrics?.offGridPixelRatio, 0.6);
  assert.ok(!recorded.issues.some((issue) => issue.code.startsWith("SPRITE-PIXEL-")));

  const gated = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: {
      mode: "BLOCKING",
      strictChecks: ["pixel-discipline"],
      minAlphaCoverage: 0.5,
      requireRuntimeCapture: false,
      requireHumanReview: false,
    },
    metrics: observed,
  }));

  assert.equal(gated.quality, "BLOCKED");
  for (const code of [
    "SPRITE-PIXEL-HARD-ALPHA",
    "SPRITE-PIXEL-COLOR-COUNT",
    "SPRITE-PIXEL-OFF-GRID",
    "SPRITE-ALPHA-COVERAGE",
  ]) assert.ok(gated.issues.some((issue) => issue.code === code), code);
});

test("an opted-in pixel-discipline gate is UNAVAILABLE when the indicators were never measured", () => {
  const report = normalizeSpriteSheetReview(baseManifest({
    qualityPolicy: {
      mode: "BLOCKING",
      strictChecks: ["pixel-discipline"],
      requireRuntimeCapture: false,
      requireHumanReview: false,
    },
  }));

  assert.equal(report.quality, "UNAVAILABLE");
  assert.ok(report.issues.some((issue) => issue.code === "SPRITE-PIXEL-DISCIPLINE-METRICS-UNAVAILABLE"));
});

test("the sprite review report carries an explicit rule-set version", () => {
  const report = normalizeSpriteSheetReview(baseManifest());
  assert.equal(report.ruleSetId, SPRITE_SHEET_REVIEW_RULESET_ID);
  assert.equal(report.ruleSetVersion, SPRITE_SHEET_REVIEW_RULESET_VERSION);
  assert.equal(report.ruleSetVersion, "2.0.0");
});
