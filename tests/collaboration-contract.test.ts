import assert from "node:assert/strict";
import test from "node:test";
import {
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
