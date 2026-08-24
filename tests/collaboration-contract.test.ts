import assert from "node:assert/strict";
import test from "node:test";
import {
  FRAME_MANIFEST_SCHEMA,
  collaborationReadinessLevel,
  evaluatePlayerFacingSceneReview,
  mergeFrameManifestEvidence,
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
  assert.equal(status.readinessReason, "PLAYER_FACING_SCENE_GAP");
  assert.equal(status.assetAudit, "PASS");
  assert.equal(status.visualRuntime, "GAP");
  assert.equal(status.stale, false);
});

test("player-facing scene review keeps score 100 and runtime usage separate", () => {
  const framePath = "C:/hf/.logs/screenshots/M100/nohud.png";
  const frameHash = "a".repeat(64);
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M100-scene-review-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "3e5fffa",
    reviewStatus: "NOT_EVALUATED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    frames: [{
      id: "hf-m100-nohud",
      path: framePath,
      sha256: frameHash,
      bytes: 1024,
      viewport: { width: 1920, height: 1080 },
      renderer: "WebGPU",
      hud: "off",
      shippedPath: true,
      console: { errors: 0, warnings: 0 },
    }],
    sceneGaps: [{
      id: "distant-terrain-band",
      severity: "major",
      category: "terrain",
      note: "Repeated distant ridge remains visible.",
      ownership: "scene",
      affectedScene: "farm-long-shot",
      affectedAssetIds: ["tractor"],
      nextStep: "Recapture the same no-HUD camera after breaking the ridge silhouette.",
      evidence: { path: framePath, sha256: frameHash, bytes: 1024 },
      frameIds: ["hf-m100-nohud"],
    }],
    assetInspections: [{
      id: "tractor",
      sourcePath: "C:/hf/public/assets/tractor.glb",
      inputHash: "b".repeat(64),
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-runtime-v1",
      inspectionRunId: "HF-M100-asset-r01",
      evidenceStatus: "READY",
      productionReady: true,
      origin: "file",
      runtimeUsage: "UNKNOWN",
      numericContract: { status: "PASS", score: 100, hardBlockerCount: 0 },
    }],
  });

  const review = evaluatePlayerFacingSceneReview(manifest);
  assert.equal(review.status, "NO_GO");
  assert.equal(review.readinessReason, "PLAYER_FACING_SCENE_GAP");
  assert.equal(review.visualRuntime, "GAP");
  assert.equal(review.playerFacing, "NOT_EVALUATED");
  assert.equal(review.linkedAssets[0]?.numericContract?.score, 100);
  assert.equal(review.linkedAssets[0]?.runtimeUsage, "UNKNOWN");
});

test("player-facing scene review returns UNAVAILABLE for legacy or incomplete gap metadata", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M100-scene-review-incomplete",
    sourceProject: "Harvest Frontier",
    sourceCommit: "3e5fffa",
    reviewStatus: "NOT_EVALUATED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    frames: [{ id: "frame", path: "frame.png", hud: "off", shippedPath: true }],
    sceneGaps: [{ id: "gap", severity: "minor", category: "scene", note: "needs review" }],
  });
  const review = evaluatePlayerFacingSceneReview(manifest);
  assert.equal(review.status, "UNAVAILABLE");
  assert.equal(review.readinessReason, "PLAYER_FACING_REVIEW_INPUT_INCOMPLETE");
  assert.ok(review.issues?.length);
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
  assert.equal(status.readinessReason, "VISUAL_RUNTIME_NOT_EVALUATED");
});

test("conditional readiness exposes a machine-readable runtime-unavailable reason", () => {
  const status = resolveCollaborationStatus(input({ visualRuntime: "UNAVAILABLE" }));
  assert.equal(status.readiness, "ASSET_READY");
  assert.equal(status.readinessReason, "ENGINE_ENVIRONMENT_UNAVAILABLE");
  assert.equal(collaborationReadinessLevel(status), "conditional");
});

test("static audit failures expose the blocking reason instead of a generic conditional", () => {
  const status = resolveCollaborationStatus(input({ assetAudit: "FAIL" }));
  assert.equal(status.readiness, "BLOCKED");
  assert.equal(status.readinessReason, "STATIC_AUDIT_FAILED");
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
  assert.equal(manifest.visualRuntime, "GAP");
  assert.equal(manifest.playerFacing, "NOT_EVALUATED");
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

test("dialogue numeric runtime checks remain separate from human visual review", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "dialogue-camera-webgl2-r2",
    sourceProject: "Harvest Frontier",
    sourceCommit: "82459216c618a15f7588f57003e5f4f4ee99f40a",
    reviewStatus: "NOT_EVALUATED",
    frames: [{
      id: "dialogue-camera-webgl2-r2-A-opened",
      path: ".logs/screenshots/M98/dialogue-camera-webgl2-r2-A-opened.png",
      sha256: "b".repeat(64),
      bytes: 1242189,
      frameSourceCommit: "82459216c618a15f7588f57003e5f4f4ee99f40a",
      renderer: "WebGL2 fallback",
      hud: "on",
      shippedPath: false,
      viewport: { width: 1600, height: 900, dpr: 1 },
      console: { errors: 0, warnings: 0 },
    }],
    sceneGaps: [{ id: "dialogue-composition", severity: "major", category: "dialogue", note: "Human review remains open for final composition.", frameIds: ["dialogue-camera-webgl2-r2-A-opened"] }],
    runtimeChecks: [{
      id: "dialogue-camera-webgl2-r2",
      kind: "dialogue-camera",
      status: "PASS",
      renderer: "WebGL2 fallback",
      frameIds: ["dialogue-camera-webgl2-r2-A-opened"],
      checks: {
        poseAssist: true,
        poseFocusId: "npc.kang-taeho",
        poseFocusOnScreen: true,
        poseFocusCoverage: 0.01517,
        poseFocusLensInside: false,
      },
    }],
  });

  assert.equal(manifest.runtimeChecks?.[0]?.status, "PASS");
  assert.equal(manifest.runtimeChecks?.[0]?.checks.poseFocusOnScreen, true);
  assert.equal(manifest.runtimeChecks?.[0]?.checks.poseFocusCoverage, 0.01517);
  assert.equal(manifest.reviewStatus, "NOT_EVALUATED");
  assert.equal(manifest.frames[0]?.shippedPath, false);
});

test("frame manifest append preserves existing evidence and upserts stable ids", () => {
  const base = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M94-packaged-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "3e3e343",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "baseline", path: "baseline.png", hud: "off" }],
    sceneGaps: [
      { id: "gap-1", severity: "major", category: "terrain", note: "Old terrain note.", frameIds: ["baseline"] },
      { id: "gap-2", severity: "minor", category: "signage", note: "Old signage note.", frameIds: ["baseline"] },
    ],
    prescriptions: [
      { id: "prescription-1", kind: "texture", status: "NON_BLOCKING", priority: "P1", observation: "Old observation.", action: "Old action.", frameIds: ["baseline"] },
    ],
  });
  const incoming = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M94-packaged-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "3e3e343",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "follow-up", path: "follow-up.png", hud: "off" }],
    sceneGaps: [
      { id: "gap-1", severity: "minor", category: "terrain", note: "Updated terrain note.", frameIds: ["follow-up"] },
      { id: "gap-3", severity: "major", category: "dealer", note: "New dealer composition note.", frameIds: ["follow-up"] },
    ],
    prescriptions: [
      { id: "prescription-2", kind: "camera", status: "NON_BLOCKING", priority: "P2", observation: "New observation.", action: "New action.", frameIds: ["follow-up"] },
    ],
  });

  const appended = mergeFrameManifestEvidence(base, incoming, "append");
  assert.deepEqual(appended.frames.map((frame) => frame.id), ["baseline", "follow-up"]);
  assert.deepEqual(appended.sceneGaps.map((gap) => gap.id), ["gap-1", "gap-2", "gap-3"]);
  assert.equal(appended.sceneGaps[0]?.note, "Updated terrain note.");
  assert.deepEqual(appended.prescriptions?.map((item) => item.id), ["prescription-1", "prescription-2"]);

  const replaced = mergeFrameManifestEvidence(base, incoming, "replace");
  assert.deepEqual(replaced.frames.map((frame) => frame.id), ["follow-up"]);
  assert.deepEqual(replaced.sceneGaps.map((gap) => gap.id), ["gap-1", "gap-3"]);
});

test("frame manifest append rejects a different run identity", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "run-a",
    sourceProject: "Harvest Frontier",
    sourceCommit: "commit-a",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "frame-a", path: "a.png", hud: "off" }],
    sceneGaps: [],
  });
  const otherRun = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "run-b",
    sourceProject: "Harvest Frontier",
    sourceCommit: "commit-b",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "frame-b", path: "b.png", hud: "off" }],
    sceneGaps: [],
  });
  assert.throws(() => mergeFrameManifestEvidence(manifest, otherRun, "append"), /same runId and sourceProject/i);
});

test("frame manifest links shipped frames to source asset evidence without promoting player-facing status", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M96-packaged-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "8245921",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "nohud-r01", path: "shipped/nohud.png", hud: "off" }],
    sceneGaps: [{ id: "dealer-camera", severity: "major", category: "camera", note: "Dealer framing remains under review.", frameIds: ["nohud-r01"] }],
    assetInspections: [{
      id: "tractor-runtime-r01",
      sourcePath: "public/assets/runtime/tractor.compact.m1.glb",
      inputHash: "a".repeat(64),
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-web-three",
      inspectionRunId: "assetops-tractor-r01",
      evidenceStatus: "ENVIRONMENT_UNAVAILABLE",
      productionReady: false,
      frameIds: ["nohud-r01"],
      qualityWarningIds: ["grass-close-d-15m"],
      numericContract: {
        status: "PASS",
        valid: true,
        score: 100,
        threshold: 90,
        hardBlockerCount: 0,
        findingIds: ["GEO-MISSING-NORMALS"],
        observations: { drawCallCount: 88, missingUvPrimitiveCount: 88, bounds: "±32767" },
      },
    }],
  });
  assert.equal(manifest.assetInspections?.[0]?.inputHash, "a".repeat(64));
  assert.equal(manifest.assetInspections?.[0]?.evidenceStatus, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(manifest.reviewStatus, "NOT_EVALUATED");
  assert.equal(manifest.assetInspections?.[0]?.productionReady, false);
  assert.equal(manifest.assetInspections?.[0]?.numericContract?.status, "PASS");
  assert.equal(manifest.assetInspections?.[0]?.numericContract?.observations?.drawCallCount, 88);

  const appended = mergeFrameManifestEvidence(manifest, normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M96-packaged-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "8245921",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "nohud-r02", path: "shipped/nohud-r02.png", hud: "off" }],
    sceneGaps: [],
    assetInspections: [{
      id: "tractor-runtime-r01",
      sourcePath: "public/assets/runtime/tractor.compact.m1.glb",
      inputHash: "b".repeat(64),
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-web-three",
      inspectionRunId: "assetops-tractor-r02",
      evidenceStatus: "ENVIRONMENT_UNAVAILABLE",
      productionReady: false,
      frameIds: ["nohud-r02"],
    }],
  }), "append");
  assert.deepEqual(appended.assetInspections?.map((item) => item.id), ["tractor-runtime-r01"]);
  assert.equal(appended.assetInspections?.[0]?.inputHash, "b".repeat(64));
});

test("frame manifest keeps procedural and runtime-generated asset provenance explicit", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M98-crops-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "82459216c618a15f7588f57003e5f4f4ee99f40a",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "crop-distance-15m", path: "m98/crop-15m.png", hud: "off" }],
    sceneGaps: [],
    assetInspections: [{
      id: "crop-rice-procedural-r01",
      sourcePath: "src/game/render/crops.ts",
      inputHash: "c".repeat(64),
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-web-three",
      inspectionRunId: "assetops-crop-rice-r01",
      evidenceStatus: "ENVIRONMENT_UNAVAILABLE",
      productionReady: false,
      origin: "procedural",
      provenance: {
        sourceRef: "src/game/render/crops.ts#rice",
        sourceCommit: "82459216c618a15f7588f57003e5f4f4ee99f40a",
        generator: "harvest-frontier-crop-factory",
        recipeId: "crop-shape-v1",
      },
      frameIds: ["crop-distance-15m"],
    }],
  });

  const inspection = manifest.assetInspections?.[0];
  assert.equal(inspection?.origin, "procedural");
  assert.equal(inspection?.provenance?.sourceRef, "src/game/render/crops.ts#rice");
  assert.equal(inspection?.provenance?.generator, "harvest-frontier-crop-factory");
  assert.equal(manifest.reviewStatus, "NOT_EVALUATED");
});

test("procedural asset evidence requires a source reference", () => {
  assert.throws(() => normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M98-crops-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "82459216c618a15f7588f57003e5f4f4ee99f40a",
    reviewStatus: "NOT_EVALUATED",
    frames: [{ id: "crop", path: "crop.png", hud: "off" }],
    sceneGaps: [],
    assetInspections: [{
      id: "crop-rice-procedural-r01",
      sourcePath: "src/game/render/crops.ts",
      inputHash: "c".repeat(64),
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-web-three",
      inspectionRunId: "assetops-crop-rice-r01",
      evidenceStatus: "ENVIRONMENT_UNAVAILABLE",
      productionReady: false,
      origin: "runtime-generated",
      provenance: { generator: "runtime" },
    }],
}), /provenance\.sourceRef/i);
});

test("HF acceptance bundle links a GLB and procedural crop to a frame while staying conditional", () => {
  const manifest = normalizeFrameManifest({
    schema: FRAME_MANIFEST_SCHEMA,
    runId: "HF-M99-shipped-review-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "781a551",
    reviewStatus: "NOT_EVALUATED",
    frames: [{
      id: "hf-m99-nohud-gameplay-15m",
      path: ".logs/screenshots/M94/shipped-visual/HF-M94-packaged-r01-03-game-nohud.png",
      sha256: "5".repeat(64),
      bytes: 2821399,
      frameSourceCommit: "781a551",
      renderer: "WebGPU",
      hud: "off",
      shippedPath: true,
      viewport: { width: 1920, height: 1080, dpr: 1 },
      distanceBandId: "gameplay",
      distanceM: 15,
      console: { errors: 0, warnings: 0 },
    }],
    sceneGaps: [{ id: "terrain-repetition", severity: "major", category: "environment", note: "Distant terrain and vegetation still need human visual review.", frameIds: ["hf-m99-nohud-gameplay-15m"] }],
    prescriptions: [{ id: "grass-secondary-layer", kind: "texture-detail", status: "NON_BLOCKING", priority: "P1", observation: "Grass loses gameplay-band detail.", action: "Review a secondary structure layer from the same shipped frame.", frameIds: ["hf-m99-nohud-gameplay-15m"] }],
    assetInspections: [
      {
        id: "tractor-runtime-r01",
        sourcePath: "public/assets/runtime/tractor.compact.m1.glb",
        inputHash: "d".repeat(64),
        assetKind: "3d-model",
        targetProfileId: "harvest-frontier-web-three",
        inspectionRunId: "HF-M98-tractor-r01",
        evidenceStatus: "CONDITIONAL",
        productionReady: false,
        origin: "file",
        frameIds: ["hf-m99-nohud-gameplay-15m"],
        numericContract: { status: "PASS", valid: true, score: 100, threshold: 90, hardBlockerCount: 0, observations: { drawCallCount: 88, textureCount: 0 } },
      },
      {
        id: "tomato-procedural-r01",
        sourcePath: "src/game/world/crops.ts#tomato",
        inputHash: "e".repeat(64),
        assetKind: "3d-model",
        targetProfileId: "harvest-frontier-web-three",
        inspectionRunId: "HF-M99-tomato-r01",
        evidenceStatus: "ENVIRONMENT_UNAVAILABLE",
        productionReady: false,
        origin: "procedural",
        provenance: { sourceRef: "src/game/world/crops.ts#tomato", sourceCommit: "781a551", generator: "HarvestFrontierCropFactory", recipeId: "crop-tomato-v1" },
        frameIds: ["hf-m99-nohud-gameplay-15m"],
        numericContract: { status: "UNAVAILABLE", valid: false, hardBlockerCount: 0 },
      },
    ],
  });
  const status = resolveCollaborationStatus(input({ visualRuntime: "GAP", inputHash: "d".repeat(64) }));
  assert.equal(manifest.frames[0]?.distanceBandId, "gameplay");
  assert.equal(manifest.frames[0]?.distanceM, 15);
  assert.equal(manifest.assetInspections?.length, 2);
  assert.equal(manifest.assetInspections?.[1]?.provenance?.sourceCommit, "781a551");
  assert.equal(status.assetAudit, "PASS");
  assert.equal(status.visualRuntime, "GAP");
  assert.equal(status.readiness, "SCENE_GAP");
  assert.equal(collaborationReadinessLevel(status), "conditional");
});
