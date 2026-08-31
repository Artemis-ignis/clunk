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

test("world-space bounds apply node transforms while local bounds stay untouched", async () => {
  // farm-windmill is a scene graph: the base plinth's geometry is locally centred
  // (y in [-0.25, 0.25]) but its node lifts it by +0.25 so the true floor sits at world y=0,
  // and the blades are pivoted 3.35 up, reaching ~4.975. The accessor-space merge cannot see
  // any of this, so metrics.bounds under-reports the model. metrics.worldBounds must not.
  const bytes = new Uint8Array(await readFile("examples/generated/farm-windmill.m1.glb"));
  const bundle = createAssetBundle("farm-windmill.m1.glb", bytes);
  const report = inspectAsset(bundle);

  const near = (actual: number, expected: number, tol = 1e-3) =>
    Math.abs(actual - expected) <= tol;

  // Local (accessor-space) bounds are preserved exactly as before: the tower mesh dominates
  // the naive merge, so min Y is its local -1.45, nowhere near the real floor.
  const local = report.metrics.bounds;
  assert.ok(local.min && local.max && local.dimensions, "local bounds present");
  assert.ok(near(local.min[1], -1.45), `local min Y expected ~-1.45, got ${local.min[1]}`);

  // World-space bounds apply the scene-graph node transforms to the accessor AABB corners.
  const world = report.metrics.worldBounds;
  assert.ok(world && world.min && world.max && world.dimensions, "worldBounds present");
  // The fix: the windmill's true floor is world y=0, not the local -1.45.
  assert.ok(Math.abs(world.min[1]) < 1e-6, `world floor expected ~0, got ${world.min[1]}`);
  assert.ok(near(world.max[1], 4.975), `world top expected ~4.975, got ${world.max[1]}`);
  assert.ok(near(world.min[0], -1.625), `world min X expected ~-1.625, got ${world.min[0]}`);
  assert.ok(near(world.max[0], 1.625), `world max X expected ~1.625, got ${world.max[0]}`);
  assert.ok(near(world.dimensions[1], 4.975), `world height expected ~4.975, got ${world.dimensions[1]}`);
  assert.ok(near(world.dimensions[0], 3.25), `world width expected ~3.25, got ${world.dimensions[0]}`);

  // The bug this fixes: the naive local merge understates the real footprint and height.
  assert.ok(world.dimensions[1] > local.dimensions[1], "world height exceeds local merge");
  assert.ok(world.min[1] > local.min[1], "world floor sits above the local merge floor");

  // World bounds are deterministic, and adding them left the digest untouched (they are
  // excluded from the canonical digest input on purpose).
  const again = inspectAsset(bundle);
  assert.deepEqual(again.metrics.worldBounds, report.metrics.worldBounds);
  assert.equal(again.resultDigest, report.resultDigest);
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
  const malformedBytes = new Uint8Array([1, 2, 3, 4]);
  const malformed = inspectAsset(createAssetBundle("broken.glb", malformedBytes));
  assert.equal(malformed.byteLength, malformedBytes.byteLength);
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
