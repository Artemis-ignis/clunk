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

test("Harvest Frontier target profile exposes all declared 2D and 3D asset kinds", () => {
  const profile = getBuiltInTargetProfiles().find((item) => item.id === "harvest-frontier-web-three");
  assert.ok(profile);
  assert.deepEqual(profile.assetKinds, ["3d-model", "animation-clip", "2d-image", "sprite-atlas", "spine-project"]);
  assert.ok(profile.acceptedFormats.includes("json"));
  assert.ok(profile.acceptedFormats.includes("atlas"));
  assert.deepEqual(profile.inspectionPolicy, {
    maxTriangles: 40000,
    maxMaterials: 64,
    maxTextureMemoryBytes: 0,
    maxTextureDimension: 0,
  });
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

test("quality warnings are explicit non-blocking output separate from hard validation", () => {
  const target = getBuiltInTargetProfiles().find((profile) => profile.id === "godot-4");
  assert.ok(target);
  const evidence = createEvidenceEnvelope({
    runId: "run-quality-warning",
    source: { path: "grass.png", bytes: 8, sha256: "sha-input", format: "png" },
    target,
    stages: {
      bytes: gate("pass"),
      structure: gate("pass"),
      policy: gate("pass"),
      import: gate("pass"),
      runtime: gate("pass"),
    },
    findings: [],
    qualityWarnings: [{
      id: "grass-close-d-15m",
      domain: "texture",
      status: "NON_BLOCKING",
      message: "Grass close layer loses detail at 15m.",
    }],
  });
  assert.equal(evidence.status, "READY");
  assert.equal(evidence.qualityWarnings[0]?.domain, "texture");
  assert.equal(evidence.qualityWarnings[0]?.status, "NON_BLOCKING");
  assert.equal(evidence.productionReady, true);
});
