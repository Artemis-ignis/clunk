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

test("unparseable input scores zero and reports the real reason", async () => {
  const cases: Array<{ name: string; bytes: Uint8Array; expect: RegExp }> = [
    { name: "empty.glb", bytes: new Uint8Array(0), expect: /shorter than its header/i },
    {
      name: "text.glb",
      bytes: new TextEncoder().encode("this is definitely not a glb file at all"),
      expect: /invalid glb magic/i,
    },
    {
      name: "broken.gltf",
      bytes: new TextEncoder().encode("{ not json at all"),
      expect: /json/i,
    },
  ];

  for (const testCase of cases) {
    const report = inspectAsset(createAssetBundle(testCase.name, testCase.bytes));

    // A file we could not read has no measurable qualities. Scoring it on a per-category
    // average used to return 92/100 for a renamed text file, which made the headline number
    // meaningless. Every category must be zero.
    assert.equal(report.score.score, 0, `${testCase.name} must score 0`);
    assert.equal(report.score.ready, false);
    assert.ok(report.score.hardBlockerCount > 0);
    for (const [category, value] of Object.entries(report.score.breakdown)) {
      assert.equal(value, 0, `${testCase.name} breakdown.${category} must be 0`);
    }

    // The byte length must be the real one: hard-coding 0 made the storage API reject the
    // run with a byte-length error, so the actual diagnostic never reached the user.
    assert.equal(report.byteLength, testCase.bytes.byteLength);

    const parseFinding = report.findings.find((finding) => finding.ruleId === "FORMAT-PARSE");
    assert.ok(parseFinding, `${testCase.name} must report FORMAT-PARSE`);
    assert.equal(parseFinding.severity, "CRITICAL");
    assert.match(parseFinding.message, testCase.expect);
  }
});

test("a node graph that revisits paths cannot stall the inspection", () => {
  // Each node lists the same child twice. Depth is still linear, but a walk that carries a
  // per-path visited set explores 2^n paths — 40 such nodes in a 900-byte file used to freeze
  // the browser tab with no way to cancel. Receiving an asset from a collaborator is the
  // product's main use, so this was a hand-written file away from being a denial of service.
  const nodeCount = 2000;
  const nodes: Array<{ children?: number[] }> = [];
  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push(index < nodeCount - 1 ? { children: [index + 1, index + 1] } : {});
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify({ asset: { version: "2.0" }, scenes: [{ nodes: [0] }], scene: 0, nodes }),
  );

  const started = Date.now();
  const report = inspectAsset(createAssetBundle("revisit.gltf", bytes));
  const elapsed = Date.now() - started;

  assert.equal(report.metrics.maxDepth, nodeCount);
  assert.ok(elapsed < 2000, `inspection took ${elapsed}ms; the walk is not linear`);
});

test("an embedded resource that cannot be decoded is reported, not ignored", () => {
  // A data URI with characters outside the base64 alphabet decodes to nothing. Before, embedded
  // resources were assumed resolved, so a broken payload disappeared and the asset looked clean.
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8, uri: "data:application/octet-stream;base64,!!!!not-base64!!!!" }],
      scenes: [{ nodes: [] }],
      scene: 0,
    }),
  );

  const report = inspectAsset(createAssetBundle("broken-embed.gltf", bytes));
  assert.ok(
    report.metrics.unresolvedResourceCount > 0,
    "an undecodable embedded resource must be counted as unresolved",
  );
});

test("a large embedded resource decodes in linear time", () => {
  // 3 MB of valid base64. The old decoder accumulated a JS number per byte and looked each
  // character up with indexOf, so this scaled quadratically in both time and memory.
  const payload = "QUJDRA==".repeat(512 * 1024 / 8);
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8, uri: "data:application/octet-stream;base64," + payload }],
      scenes: [{ nodes: [] }],
      scene: 0,
    }),
  );

  const started = Date.now();
  inspectAsset(createAssetBundle("big-embed.gltf", bytes));
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 3000, `decoding took ${elapsed}ms; it is not linear`);
});
