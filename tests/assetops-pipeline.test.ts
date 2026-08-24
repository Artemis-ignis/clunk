import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectAssetForTarget,
  type AssetOpsGateOverrides,
} from "../packages/core/src/assetops-pipeline";

const image = new Uint8Array(await readFile("public/og.png"));

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
