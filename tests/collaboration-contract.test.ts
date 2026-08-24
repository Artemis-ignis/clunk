import assert from "node:assert/strict";
import test from "node:test";
import {
  FRAME_MANIFEST_SCHEMA,
  normalizeFrameManifest,
  resolveCollaborationStatus,
  type CollaborationStatusInput,
} from "../packages/core/src/collaboration-contract";

function input(overrides: Partial<CollaborationStatusInput> = {}): CollaborationStatusInput {
  return {
    assetAudit: "PASS",
    visualRuntime: "NOT_RUN",
    profileId: "harvest-frontier-runtime-v1",
    baseProfileId: "pc",
    ruleSetId: "harvest-frontier-runtime-v1",
    inputHash: "a".repeat(64),
    ...overrides,
  };
}

test("asset PASS plus visual runtime gap resolves to SCENE_GAP", () => {
  const status = resolveCollaborationStatus(input({ visualRuntime: "GAP" }));
  assert.equal(status.readiness, "SCENE_GAP");
  assert.equal(status.assetAudit, "PASS");
  assert.equal(status.visualRuntime, "GAP");
  assert.equal(status.stale, false);
});

test("custom profile identity is separate from its base profile", () => {
  const status = resolveCollaborationStatus(input({
    profileId: "harvest-frontier-runtime-v1",
    baseProfileId: "pc",
  }));
  assert.equal(status.profileId, "harvest-frontier-runtime-v1");
  assert.equal(status.baseProfileId, "pc");
  assert.equal(status.ruleSetId, "harvest-frontier-runtime-v1");
});

test("a changed input hash marks the previous collaboration snapshot stale", () => {
  const status = resolveCollaborationStatus(input({
    previousInputHash: "b".repeat(64),
  }));
  assert.equal(status.stale, true);
  assert.equal(status.readiness, "ASSET_READY");
});

test("audit failure remains BLOCKED even when runtime was not run", () => {
  const status = resolveCollaborationStatus(input({
    assetAudit: "FAIL",
    visualRuntime: "NOT_RUN",
  }));
  assert.equal(status.readiness, "BLOCKED");
});

test("frame manifest v1 normalizes screenshot evidence without changing player-facing verdict", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M84-no-hud-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "486fe66",
    reviewStatus: "NOT_EVALUATED",
    frames: [{
      id: "m84-no-hud-world",
      path: ".logs/screenshots/M84/",
      frameSourceCommit: "d3d56464",
      bytes: 2821399,
      renderer: "webgpu",
      hud: "off",
      viewport: { width: 2560, height: 1440, dpr: 1 },
      scene: "farm",
      shippedPath: true,
      console: { errors: 0, warnings: 0 },
    }],
    sceneGaps: [{
      id: "terrain-seams",
      severity: "major",
      category: "environment",
      note: "Gray dome and terrain seams remain visible in the no-HUD frame.",
      frameIds: ["m84-no-hud-world"],
    }],
    prescriptions: [{
      id: "grass-close-detail",
      kind: "texture-detail",
      status: "NON_BLOCKING",
      priority: "P1",
      observation: "Close grass loses detail at the gameplay band.",
      action: "Evaluate a runtime material or second detail layer from shipped captures.",
      frameIds: ["m84-no-hud-world"],
    }],
  });

  assert.equal(manifest.schema, "clunk.frame-manifest.v1");
  assert.equal(manifest.reviewStatus, "NOT_EVALUATED");
  assert.equal(manifest.frames[0]?.viewport?.width, 2560);
  assert.equal(manifest.frames[0]?.shippedPath, true);
  assert.equal(manifest.frames[0]?.frameSourceCommit, "d3d56464");
  assert.equal(manifest.frames[0]?.bytes, 2821399);
  assert.deepEqual(manifest.frames[0]?.console, { errors: 0, warnings: 0 });
  assert.deepEqual(manifest.sceneGaps[0]?.frameIds, ["m84-no-hud-world"]);
  assert.equal(manifest.prescriptions?.[0]?.status, "NON_BLOCKING");
});

test("frame manifest v1 rejects a scene gap that references an unknown frame", () => {
  assert.throws(() => normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M84-no-hud-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "486fe66",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "known", path: ".logs/screenshots/M84/", hud: "off" }],
    sceneGaps: [{
      id: "missing-frame-reference",
      severity: "minor",
      category: "composition",
      note: "This note points at a frame that was not submitted.",
      frameIds: ["unknown"],
    }],
  }), /unknown frame/i);
});
