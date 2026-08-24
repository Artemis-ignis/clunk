import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectAssetForTarget,
  type AssetOpsGateOverrides,
} from "../packages/core/src/assetops-pipeline";

const image = new Uint8Array(await readFile("public/og.png"));
const encoder = new TextEncoder();

function harvestSemanticGltf(includeSemanticNodes: boolean): {
  bytes: Uint8Array;
  bundleFiles: Map<string, Uint8Array>;
} {
  const nodes = includeSemanticNodes
    ? [
      { name: "tractorRoot", mesh: 0 },
      { name: "pivot.hitchTopLink" },
      { name: "socket.attach.implement" },
      { name: "collider.body" },
    ]
    : [{ name: "tractorRoot", mesh: 0 }];
  const binary = new Uint8Array(44);
  const binaryView = new DataView(binary.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => binaryView.setFloat32(index * 4, value, true));
  [0, 1, 2].forEach((value, index) => binaryView.setUint16(36 + index * 2, value, true));
  const bytes = encoder.encode(JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: "HF semantic fixture", pbrMetallicRoughness: { baseColorFactor: [0.2, 0.5, 0.2, 1] } }],
    buffers: [{ uri: "model.bin", byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    extensionsUsed: includeSemanticNodes ? ["EXT_meshopt_compression"] : [],
  }));
  return { bytes, bundleFiles: new Map([["model.gltf", bytes], ["model.bin", binary]]) };
}

test("unified pipeline dispatches a real image and keeps missing engine gates unavailable", async () => {
  const evidence = inspectAssetForTarget({
    runId: "pipeline-image-r01",
    sourcePath: "public/og.png",
    fileName: "og.png",
    bytes: image,
    targetProfileId: "harvest-frontier-web-three",
  });

  assert.equal(evidence.assetKind, "2d-image");
  assert.equal(evidence.source.bytes, image.byteLength);
  assert.match(evidence.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.stages.structure.status, "pass");
  assert.equal(evidence.stages.policy.status, "pass");
  assert.equal(evidence.stages.import.status, "environmentUnavailable");
  assert.equal(evidence.stages.runtime.status, "environmentUnavailable");
  assert.equal(evidence.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(evidence.productionReady, false);
});

test("unified pipeline accepts explicit runner evidence without inventing it", async () => {
  const pass = (message: string): AssetOpsGateOverrides["import"] => ({
    status: "pass",
    message,
    evidence: [{ key: "runner", value: "test-attested" }],
    durationMs: 1,
    environmentId: "test-runner/1.0",
  });
  const evidence = inspectAssetForTarget({
    runId: "pipeline-image-attested-r01",
    fileName: "og.png",
    bytes: image,
    targetProfileId: "harvest-frontier-web-three",
    stageOverrides: {
      import: pass("Three texture import completed."),
      runtime: pass("Three texture runtime smoke completed."),
    },
  });
  assert.equal(evidence.stages.import.status, "pass");
  assert.equal(evidence.stages.runtime.status, "pass");
  assert.equal(evidence.status, "READY");
  assert.equal(evidence.productionReady, true);
});

test("unified pipeline reports unsupported target asset kinds honestly", () => {
  const evidence = inspectAssetForTarget({
    runId: "pipeline-spine-target-r01",
    fileName: "character.fbx",
    bytes: new TextEncoder().encode("Kaydara FBX Binary  "),
    targetProfileId: "harvest-frontier-web-three",
    assetKind: "spine-project",
  });
  assert.equal(evidence.assetKind, "spine-project");
  assert.notEqual(evidence.status, "READY");
  assert.ok(evidence.findings.some((finding) => finding.id === "TARGET-FORMAT"));
});

test("Harvest Frontier semantic rules are enforced inside the unified 3D pipeline", () => {
  const fixture = harvestSemanticGltf(false);
  const evidence = inspectAssetForTarget({
    runId: "pipeline-hf-semantic-fail-r01",
    fileName: "tractor.gltf",
    bytes: fixture.bytes,
    targetProfileId: "harvest-frontier-web-three",
    bundleFiles: fixture.bundleFiles,
  });

  assert.equal(evidence.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(evidence.stages.structure.status, "fail");
  assert.equal(evidence.stages.policy.status, "fail");
  assert.equal(evidence.status, "BLOCKED");
  assert.equal(evidence.productionReady, false);
  assert.ok(evidence.findings.some((finding) => finding.id === "HF-ATTACHMENT-SOCKET"));
  assert.ok(evidence.findings.some((finding) => finding.id === "HF-COLLIDER"));
  assert.equal(evidence.stages.import.status, "environmentUnavailable");
  assert.equal(evidence.stages.runtime.status, "environmentUnavailable");
});

test("Harvest Frontier semantic PASS remains structural-only when runtime evidence is absent", () => {
  const fixture = harvestSemanticGltf(true);
  const evidence = inspectAssetForTarget({
    runId: "pipeline-hf-semantic-pass-r01",
    fileName: "tractor.gltf",
    bytes: fixture.bytes,
    targetProfileId: "harvest-frontier-web-three",
    bundleFiles: fixture.bundleFiles,
  });

  assert.equal(evidence.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(evidence.stages.structure.status, "pass");
  assert.equal(evidence.stages.policy.status, "pass");
  assert.equal(evidence.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.stages.import.status, "environmentUnavailable");
  assert.equal(evidence.stages.runtime.status, "environmentUnavailable");
  assert.ok(!evidence.findings.some((finding) => finding.id.startsWith("HF-")));
});
