import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256Hex } from "../packages/core/src/index";
import { runClunkMeshLab } from "../packages/clunk-series/src/mesh-lab";

const samplePath = new URL("../public/samples/clunk-messy-sample.glb", import.meta.url);

const hasGlbMagic = (bytes: Uint8Array): boolean => bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;

const input = new Uint8Array(await readFile(samplePath));

const result = await runClunkMeshLab({
  seriesId: "game-ready",
  assetKind: "3d-model",
  targetProfileId: "web-three-mobile",
  fileName: "clunk-messy-sample.glb",
  bytes: input,
  sourcePath: "public/samples/clunk-messy-sample.glb",
  runId: "series-mesh-lab-test",
});

assert.equal(result.inputHash, sha256Hex(input));
assert.equal(result.inputByteLength, input.byteLength);
assert.ok(result.outputByteLength > 0);
assert.ok(hasGlbMagic(result.outputBytes));
assert.notEqual(result.outputHash, result.inputHash);
assert.equal(result.evidence.stages.outputReopen?.status, "pass");
assert.equal(result.evidence.stages.structure?.status, "pass");
assert.equal(result.evidence.stages.policy?.status, "pass");
assert.equal(result.provenance.provider, "clunk-series-native-v1");
assert.ok(result.transforms.includes("gltf-transform:prune"));
assert.ok(result.transforms.includes("meshoptimizer:meshopt"));

const blockedResult = await runClunkMeshLab({
  seriesId: "game-ready",
  assetKind: "3d-model",
  targetProfileId: "yeongheo-pixi-2d",
  fileName: "clunk-messy-sample.glb",
  bytes: input,
  sourcePath: "public/samples/clunk-messy-sample.glb",
  runId: "series-mesh-lab-unsupported-target-test",
});

assert.equal(blockedResult.status, "BLOCKED");
assert.equal(blockedResult.evidence.status, "UNSUPPORTED");
assert.equal(blockedResult.provenance.productionReady, false);
