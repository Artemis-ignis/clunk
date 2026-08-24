import assert from "node:assert/strict";
import test from "node:test";
import {
  createEvidenceEnvelope,
  type GateResult,
} from "../packages/core/src/assetops-contract";
import { getBuiltInTargetProfiles } from "../packages/core/src/assetops-profiles";

function gate(status: GateResult["status"]): GateResult {
  return {
    status,
    message: status === "pass" ? "verified" : status,
    evidence: [],
    durationMs: 0,
  };
}

test("built-in target profiles declare engine and platform constraints", () => {
  const profiles = getBuiltInTargetProfiles();
  assert.ok(profiles.length >= 7);

  for (const profile of profiles) {
    assert.ok(profile.id.length > 0);
    assert.ok(profile.engine.length > 0);
    assert.ok(profile.engineVersion.length > 0);
    assert.ok(profile.platform.length > 0);
    assert.ok(profile.acceptedFormats.length > 0);
    assert.equal(profile.coordinateSystem.unitMeters > 0, true);
    assert.equal(profile.texturePolicy.maxDimension > 0, true);
    assert.ok(profile.texturePolicy.formats.length > 0);
  }
});

test("a skipped runtime gate cannot become READY", () => {
  const target = getBuiltInTargetProfiles().find((profile) => profile.id === "godot-4");
  assert.ok(target);

  const evidence = createEvidenceEnvelope({
    runId: "run-contract",
    source: { path: "fixture.glb", bytes: 12, sha256: "sha-input", format: "glb" },
    target,
    stages: {
      bytes: gate("pass"),
      structure: gate("pass"),
      policy: gate("pass"),
      import: gate("pass"),
      runtime: gate("notRun"),
    },
    findings: [],
  });

  assert.notEqual(evidence.status, "READY");
  assert.equal(evidence.productionReady, false);
});

test("environment-unavailable evidence remains visible and non-production", () => {
  const target = getBuiltInTargetProfiles().find((profile) => profile.id === "unreal");
  assert.ok(target);

  const evidence = createEvidenceEnvelope({
    runId: "run-unavailable",
    source: { path: "fixture.png", bytes: 8, sha256: "sha-input", format: "png" },
    target,
    stages: {
      bytes: gate("pass"),
      structure: gate("pass"),
      policy: gate("pass"),
      import: gate("environmentUnavailable"),
      runtime: gate("environmentUnavailable"),
    },
    findings: [],
  });

  assert.equal(evidence.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(evidence.productionReady, false);
});
