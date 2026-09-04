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
  // 2026-08-24(441a6f5) 정정: 이 계약은 텍스처 두 예산이 0 이던 시절을 얼려 두고 있었다.
  // resolvePolicy 는 이 값을 `?? base` 로 읽기 때문에 0 은 "미설정"이 아니라 "예산 0" 이고,
  // 그래서 텍스처가 든 GLB 는 전부 자동 BLOCK 됐다 — 하필 텍스처를 검사하라고 만든 게임
  // 이름의 프로필에서(packages/core/src/assetops-profiles.ts:50-54 주석이 그 사고를 기록).
  // 제품은 바로 위 texturePolicy 가 이미 선언한 4096 / 128MB 를 그대로 쓰도록 고쳤다.
  // 아래 두 줄은 그 숫자를 texturePolicy 와 맞물려 못 박아, 누가 다시 0 을 넣으면 깨진다.
  assert.deepEqual(profile.inspectionPolicy, {
    maxTriangles: 40000,
    maxMaterials: 64,
    maxTextureMemoryBytes: 128 * 1024 * 1024,
    maxTextureDimension: 4096,
  });
  assert.equal(profile.inspectionPolicy?.maxTextureDimension, profile.texturePolicy.maxDimension);
  assert.equal(profile.inspectionPolicy?.maxTextureMemoryBytes, profile.texturePolicy.memoryBudgetBytes);
});

test("Yeongheoge Pixi profile scopes 2D authoring and keeps runtime approval separate", () => {
  const profile = getBuiltInTargetProfiles().find((item) => item.id === "yeongheo-pixi-2d");
  assert.ok(profile);
  assert.equal(profile.engine, "pixi-js");
  assert.equal(profile.renderer, "WebGL2");
  assert.deepEqual(profile.assetKinds, ["2d-image", "sprite-atlas", "spine-project"]);
  assert.deepEqual(profile.semanticRules, ["pixi-sprite-atlas-v1"]);
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
