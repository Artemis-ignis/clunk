import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlayerFacingQualityEvidence,
  normalizePlayerFacingQualityEvidence,
} from "../packages/core/src/player-facing-quality";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

const file = (path: string, sha256: string) => ({ path, bytes: 128, sha256, verified: true as const });

const checks = {
  silhouette: { status: "PASS" as const, observation: "The three-quarter silhouette remains readable." },
  proportions: { status: "PASS" as const, observation: "Length, height, and depth match the contract." },
  materials: { status: "PASS" as const, observation: "Material response is visible at the target distance." },
  lighting: { status: "PASS" as const, observation: "Key and fill preserve the authored value hierarchy." },
  scale: { status: "PASS" as const, observation: "World scale is stable in the shipped scene." },
  readability: { status: "PASS" as const, observation: "The asset is not lost against the game background." },
  composition: { status: "PASS" as const, observation: "The focal composition leaves gameplay space clear." },
};

const capture = {
  screenshot: file("evidence/hero.png", HASH_C),
  renderer: "webgl2",
  viewport: { width: 1920, height: 1080 },
  imageSize: { width: 1920, height: 1080 },
  originalSize: true,
  fixedFps: { targetHz: 60, sampleIntervalMs: 16.667, sampledFrameCount: 120 },
  cameraPoseHash: "d".repeat(64),
  sourceTreeHash: "e".repeat(64),
  shippedPath: true as const,
  console: { errors: 0, warnings: 0 },
};

test("contract fixtures cannot become a visual PASS", () => {
  const fixture = createPlayerFacingQualityEvidence({
    evidenceKind: "CONTRACT_FIXTURE",
    runId: "quality-fixture-01",
    assetId: "hero_ship_01",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    reference: file("reference/hero.png", HASH_A),
    runtime: file("runtime/hero.glb", HASH_B),
    checks,
  });
  assert.equal(fixture.status, "NOT_EVALUATED");
  assert.equal(fixture.productionReady, false);
  assert.throws(
    () => normalizePlayerFacingQualityEvidence({ ...fixture, humanDecision: "PASS", status: "PASS" }),
    /CONTRACT_FIXTURE cannot carry a human approval decision/,
  );
});

test("a real capture lane requires fixed-FPS original-size evidence before PASS", () => {
  const evidence = createPlayerFacingQualityEvidence({
    evidenceKind: "PLAYER_FACING_CAPTURE",
    runId: "quality-capture-01",
    assetId: "hero_ship_01",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    reference: file("reference/hero.png", HASH_A),
    runtime: file("runtime/hero.glb", HASH_B),
    captures: [capture],
    checks,
    measurements: { silhouetteIoU: 0.91, aspectRatioDelta: 0.03 },
    humanDecision: "PASS",
    reviewer: "human-review-required",
  });
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.captures[0]?.fixedFps.sampledFrameCount, 120);
  assert.equal(evidence.productionReady, false);

  assert.throws(
    () => normalizePlayerFacingQualityEvidence({
      ...evidence,
      captures: [{ ...capture, originalSize: false }],
    }),
    /original-size, fixed-FPS/,
  );
});
