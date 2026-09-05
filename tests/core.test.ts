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
  // extras stay: see "the safe optimizer does not delete extras a runtime addresses" below.
  // The allowlist is asset.generator and asset.copyright, nothing more.
  assert.deepEqual(cleaned.extras, document.extras);
  assert.deepEqual(cleaned.nodes[0].extras, document.nodes[0].extras);
  assert.deepEqual(result.operations.map((operation) => operation.id), ["clean-metadata"]);
  assert.equal(result.operations[0].safety, "metadata-only");
  assert.equal(result.after.metrics.nodeCount, result.before.metrics.nodeCount);
});

/**
 * Bounds regression suite.
 *
 * The reported size of a model is a listing fact ("this gate is 2.4 m wide"), so it has to be the
 * size the engine draws, not the raw numbers sitting in a POSITION accessor. Two real failures
 * from the 2026-09-02 dogfood pass are pinned here:
 *   1. node transforms were ignored, so a part moved out to a pivot did not widen the box;
 *   2. quantized (normalized SHORT/USHORT) positions were read as-is, so meshopt/quantized files
 *      reported 65534 m instead of a few metres.
 */
function gltfBundleFromDocument(name: string, document: unknown) {
  return createAssetBundle(name, new TextEncoder().encode(JSON.stringify(document)));
}

/** One unit cube centred on the origin, expressed only through accessor min/max. */
function unitCubeDocument(nodes: unknown[], extra: Record<string, unknown> = {}) {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      {
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
    ],
    ...extra,
  };
}

test("bounds follow the node transform, not the raw accessor box", () => {
  const document = unitCubeDocument([
    { mesh: 0, translation: [10, 0, 0], scale: [2, 2, 2] },
  ]);
  const report = inspectAsset(gltfBundleFromDocument("transformed.gltf", document));
  assert.deepEqual(report.metrics.bounds.min, [9, -1, -1]);
  assert.deepEqual(report.metrics.bounds.max, [11, 1, 1]);
  assert.deepEqual(report.metrics.bounds.dimensions, [2, 2, 2]);
});

test("bounds accumulate through a parent chain and across siblings", () => {
  const document = unitCubeDocument([
    { children: [1], scale: [1, 1, 1], translation: [0, 0, 0] },
    { mesh: 0, translation: [0, 3, 0] },
    { mesh: 0, translation: [-4, 0, 0] },
  ]);
  // Scene roots are 0 and 2; node 1 is reached through node 0.
  document.scenes = [{ nodes: [0, 2] }];
  const report = inspectAsset(gltfBundleFromDocument("hierarchy.gltf", document));
  assert.deepEqual(report.metrics.bounds.min, [-4.5, -0.5, -0.5]);
  assert.deepEqual(report.metrics.bounds.max, [0.5, 3.5, 0.5]);
});

test("a rotated part widens the box the way an engine would draw it", () => {
  // 90 degrees about Z: a 4 x 0.2 x 0.2 bar becomes 0.2 x 4 x 0.2.
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      { componentType: 5126, count: 8, type: "VEC3", min: [-2, -0.1, -0.1], max: [2, 0.1, 0.1] },
    ],
  };
  const report = inspectAsset(gltfBundleFromDocument("rotated.gltf", document));
  const dimensions = report.metrics.bounds.dimensions!;
  assert.ok(Math.abs(dimensions[0] - 0.2) < 1e-6, `x was ${dimensions[0]}`);
  assert.ok(Math.abs(dimensions[1] - 4) < 1e-6, `y was ${dimensions[1]}`);
});

test("quantized positions are decoded instead of reported as 65534 metres", () => {
  // KHR_mesh_quantization style: normalized SHORT positions, dequantized by the node scale.
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, scale: [2, 2, 2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      {
        componentType: 5122,
        normalized: true,
        count: 8,
        type: "VEC3",
        min: [-32767, -32767, -32767],
        max: [32767, 32767, 32767],
      },
    ],
    extensionsUsed: ["KHR_mesh_quantization"],
    extensionsRequired: ["KHR_mesh_quantization"],
  };
  const report = inspectAsset(gltfBundleFromDocument("quantized.gltf", document));
  const dimensions = report.metrics.bounds.dimensions!;
  for (const value of dimensions) {
    assert.ok(value > 3.9 && value < 4.1, `expected about 4 m, got ${value}`);
  }
});

test("EXT_mesh_gpu_instancing instances widen the reported bounds", () => {
  const document = unitCubeDocument(
    [
      {
        mesh: 0,
        extensions: {
          EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 1 } },
        },
      },
    ],
    {
      extensionsUsed: ["EXT_mesh_gpu_instancing"],
    },
  );
  (document.accessors as unknown[]).push({
    componentType: 5126,
    count: 2,
    type: "VEC3",
    min: [0, 0, 0],
    max: [6, 0, 0],
  });
  const report = inspectAsset(gltfBundleFromDocument("instanced.gltf", document));
  assert.deepEqual(report.metrics.bounds.min, [-0.5, -0.5, -0.5]);
  assert.deepEqual(report.metrics.bounds.max, [6.5, 0.5, 0.5]);
});

test("shipped assets report the size a renderer decodes", async () => {
  // Ground truth from three.js GLTFLoader with the meshopt decoder enabled
  // (scripts/dogfood-bounds-truth.mjs), rounded to 1 cm.
  const cases: { path: string; dimensions: [number, number, number] }[] = [
    { path: "examples/generated/cozy-farm-set/fence-gate.m1.clunk-optimized.glb", dimensions: [2.4, 1.71, 0.52] },
    { path: "examples/generated/cozy-farm-set/storage-shed.m1.clunk-optimized.glb", dimensions: [2.6, 2.93, 2.23] },
    { path: "examples/harvest-frontier/runtime/cultivator.compact.m1.glb", dimensions: [1.54, 1.69, 3.35] },
    { path: "examples/harvest-frontier/runtime/seeder.compact.m1.glb", dimensions: [1.98, 2.23, 3.8] },
    { path: "examples/harvest-frontier/runtime/processing.line.m1.glb", dimensions: [7.38, 5.27, 4.28] },
  ];
  for (const testCase of cases) {
    const bytes = new Uint8Array(await readFile(testCase.path));
    const name = testCase.path.slice(testCase.path.lastIndexOf("/") + 1);
    const report = inspectAsset(createAssetBundle(name, bytes));
    const dimensions = report.metrics.bounds.dimensions;
    assert.ok(dimensions, `${name} produced no bounds`);
    for (let axis = 0; axis < 3; axis += 1) {
      const delta = Math.abs(dimensions[axis] - testCase.dimensions[axis]);
      assert.ok(
        delta <= 0.02,
        `${name} axis ${axis}: reported ${dimensions[axis].toFixed(3)} m, renderer decodes ${testCase.dimensions[axis]} m`,
      );
    }
  }
});

test("a GPU-instanced meshopt file is over-stated, never absurd and never under-stated", async () => {
  /*
   * tractor.compact.m1.glb draws its tread lugs through EXT_mesh_gpu_instancing, and the
   * per-instance transforms live inside an EXT_meshopt_compression stream that this package does
   * not decode. The mesh is therefore counted at its node's own transform. The renderer draws
   * 5.24 x 2.92 x 3.35 m; the reported box is the enclosing 5.36 x 2.92 x 3.76 m. That is a
   * declared over-approximation. What must never come back is the pre-fix 65534 m, and the box
   * must never be smaller than what is drawn.
   */
  const rendered: [number, number, number] = [5.24, 2.92, 3.35];
  const bytes = new Uint8Array(await readFile("examples/harvest-frontier/runtime/tractor.compact.m1.glb"));
  const report = inspectAsset(createAssetBundle("tractor.compact.m1.glb", bytes));
  const dimensions = report.metrics.bounds.dimensions!;
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(dimensions[axis] >= rendered[axis] - 0.02, `axis ${axis} under-states the drawn size`);
    assert.ok(dimensions[axis] <= rendered[axis] * 1.15, `axis ${axis} over-states by more than 15%`);
  }
});

test("a meshopt-compressed buffer view is never read as raw components", async () => {
  // Reading an encoded stream as plain floats yields numbers that look real. Refusing is the
  // only honest option until the package decodes meshopt.
  const bytes = new Uint8Array(await readFile("examples/harvest-frontier/runtime/tractor.compact.m1.glb"));
  const report = inspectAsset(createAssetBundle("tractor.compact.m1.glb", bytes));
  const dimensions = report.metrics.bounds.dimensions!;
  for (const value of dimensions) assert.ok(value < 100, `bounds leaked an undecoded value: ${value}`);
});

test("pruning empty nodes keeps animation and skin targets pointing at the same node", () => {
  /*
   * prune-empty-nodes renumbers the node array. Scene roots and children were renumbered with it,
   * but animation channel targets and skin joints were not, so an animated asset came out of the
   * "lossless" optimizer with its animation driving a different node. Node 0 here is a throwaway
   * empty node; removing it shifts every later index down by one.
   */
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "junk" },
      { name: "armSocket", translation: [0, 1, 0] },
      { name: "body", mesh: 0 },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      { componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] },
      { componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
      { componentType: 5126, count: 2, type: "VEC3" },
    ],
    animations: [
      {
        name: "wave",
        samplers: [{ input: 1, output: 2, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
    ],
  };
  const source = new TextEncoder().encode(JSON.stringify(document));
  const result = optimizeAsset(createAssetBundle("animated.gltf", source));
  const optimized = JSON.parse(new TextDecoder().decode(result.outputBytes)) as typeof document;

  assert.ok(
    result.operations.some((operation) => operation.id === "prune-empty-nodes"),
    "expected the empty node to be pruned",
  );
  const target = optimized.animations[0].channels[0].target.node;
  assert.equal(
    optimized.nodes[target].name,
    "armSocket",
    `animation now drives ${optimized.nodes[target].name} instead of armSocket`,
  );
});

test("pruning empty nodes keeps skin joints pointing at the same node", () => {
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "junk" },
      { name: "joint", translation: [0, 1, 0] },
      { name: "body", mesh: 0, skin: 0 },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] }],
    skins: [{ joints: [1], skeleton: 1 }],
  };
  const source = new TextEncoder().encode(JSON.stringify(document));
  const result = optimizeAsset(createAssetBundle("skinned.gltf", source));
  const optimized = JSON.parse(new TextDecoder().decode(result.outputBytes)) as typeof document;

  assert.ok(result.operations.some((operation) => operation.id === "prune-empty-nodes"));
  assert.equal(optimized.nodes[optimized.skins[0].joints[0]].name, "joint");
  assert.equal(optimized.nodes[optimized.skins[0].skeleton].name, "joint");
});

test("the safe optimizer does not delete extras a runtime addresses", () => {
  /*
   * `extras` is where engines keep the contract: Harvest Frontier's tractor stores
   * sculptRuntime.assetId, sockets and colliders there; an NPC stores npcId and its capsule
   * collider; the windmill stores its licence. clean-metadata used to delete all of it and call
   * the operation "metadata-only" — 289 KB of contract removed from one tractor without a word.
   * Rendering survives that; the game does not.
   */
  const document = {
    asset: { version: "2.0", generator: "fixture", copyright: "fixture copyright" },
    extras: { pipeline: "fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: "npc.root",
        mesh: 0,
        extras: { npcId: "npc.choi-minseo", collider: { type: "capsule", radius: 0.38 }, license: "Apache-2.0" },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] }],
  };
  const source = new TextEncoder().encode(JSON.stringify(document));
  const result = optimizeAsset(createAssetBundle("contract.gltf", source));
  const cleaned = JSON.parse(new TextDecoder().decode(result.outputBytes)) as typeof document;

  assert.equal(cleaned.asset.generator, undefined);
  assert.equal(cleaned.asset.copyright, undefined);
  assert.deepEqual(cleaned.nodes[0].extras, document.nodes[0].extras);
  assert.deepEqual(cleaned.extras, document.extras);
});

test("a Harvest Frontier runtime GLB keeps its semantic contract through optimize", async () => {
  const bytes = new Uint8Array(await readFile("examples/harvest-frontier/runtime/tractor.compact.m1.glb"));
  const result = optimizeAsset(createAssetBundle("tractor.compact.m1.glb", bytes));
  const output = result.outputBytes;
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const declared = view.getUint32(8, true);
  let offset = 12;
  let json: Record<string, unknown> | null = null;
  while (offset + 8 <= declared) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      const text = new TextDecoder().decode(output.subarray(offset + 8, offset + 8 + length)).replaceAll("\0", "").trim();
      json = JSON.parse(text) as Record<string, unknown>;
      break;
    }
    offset = offset + 8 + length;
  }
  assert.ok(json, "optimized GLB has no JSON chunk");
  const nodes = json!.nodes as Record<string, unknown>[];
  const root = nodes.find((node) => node.name === "tractorRoot");
  assert.ok(root, "tractorRoot node is missing from the optimized file");
  const extras = root!.extras as { sculptRuntime?: { assetId?: string; sockets?: string[] } } | undefined;
  assert.equal(extras?.sculptRuntime?.assetId, "tractor.compact.m1");
  assert.ok(extras?.sculptRuntime?.sockets?.includes("socket.attach.implement"));
  // The compressed geometry stream must come through untouched.
  assert.equal(result.after.metrics.triangleCount, result.before.metrics.triangleCount);
});
