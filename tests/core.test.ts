import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAssetBundle,
  inspectAsset,
  optimizeAsset,
  sha256Hex,
} from "../packages/core/src/index";

async function sample(name: string) {
  const bytes = new Uint8Array(await readFile(`public/samples/${name}`));
  return { bytes, bundle: createAssetBundle(name, bytes) };
}

test("real GLB inspection is deterministic across three runs", async () => {
  const { bytes, bundle } = await sample("clunk-messy-sample.glb");
  const reports = [inspectAsset(bundle), inspectAsset(bundle), inspectAsset(bundle)];
  assert.equal(reports[0].inputHash, sha256Hex(bytes));
  assert.equal(reports[0].resultDigest, reports[1].resultDigest);
  assert.equal(reports[1].resultDigest, reports[2].resultDigest);
  assert.equal(reports[0].metrics.triangleCount, 2);
  assert.ok(reports[0].findings.some((finding) => finding.id.startsWith("GEO-MISSING-NORMALS")));
  assert.equal(reports[0].score.ready, false);
});

test("safe optimization creates a new artifact and fresh reinspection", async () => {
  const { bytes, bundle } = await sample("clunk-messy-sample.glb");
  const sourceHash = sha256Hex(bytes);
  const result = optimizeAsset(bundle);
  assert.equal(result.inputHash, sourceHash);
  assert.notEqual(result.outputFileName, "clunk-messy-sample.glb");
  assert.notEqual(result.outputHash, result.inputHash);
  assert.equal(result.passport.sourceHash, result.inputHash);
  assert.equal(result.passport.outputHash, result.outputHash);
  assert.equal(sha256Hex(bytes), sourceHash);
  const downloaded = inspectAsset(createAssetBundle(result.outputFileName, result.outputBytes));
  assert.equal(downloaded.inputHash, result.outputHash);
  assert.equal(downloaded.resultDigest, result.after.resultDigest);
  assert.equal(downloaded.metrics.materialCount, 1);
  assert.equal(downloaded.metrics.emptyNodeCount, 0);
});

test("malformed and incomplete inputs are rejected with evidence", () => {
  const malformed = inspectAsset(createAssetBundle("broken.glb", new Uint8Array([1, 2, 3, 4])));
  assert.equal(malformed.score.ready, false);
  assert.ok(malformed.findings.some((finding) => finding.severity === "CRITICAL"));
  const missingResource = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "missing.bin", byteLength: 4 }] }));
  const report = inspectAsset(createAssetBundle("missing.gltf", missingResource));
  assert.ok(report.metrics.unresolvedResourceCount > 0);
  assert.equal(report.score.ready, false);
});

test("metadata cleanup is explicit, allowlisted, and render-safe", () => {
  const document = {
    asset: { version: "2.0", generator: "fixture", copyright: "fixture copyright" },
    extras: { source: "fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ extras: { editorOnly: true } }],
  };
  const source = new TextEncoder().encode(JSON.stringify(document));
  const result = optimizeAsset(createAssetBundle("metadata.gltf", source));
  const cleaned = JSON.parse(new TextDecoder().decode(result.outputBytes)) as typeof document;

  assert.equal(cleaned.asset.generator, undefined);
  assert.equal(cleaned.asset.copyright, undefined);
  assert.equal(cleaned.extras, undefined);
  assert.equal(cleaned.nodes[0].extras, undefined);
  assert.deepEqual(result.operations.map((operation) => operation.id), ["clean-metadata"]);
  assert.equal(result.operations[0].safety, "metadata-only");
  assert.equal(result.after.metrics.nodeCount, result.before.metrics.nodeCount);
});
