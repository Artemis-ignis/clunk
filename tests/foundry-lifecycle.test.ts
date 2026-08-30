import assert from "node:assert/strict";
import test from "node:test";
import {
  createFoundryRequestHash,
  createKitManifest,
  createRemixRequest,
  type FoundryArtifactRef,
} from "../packages/core/src/foundry-contract";

const artifacts: FoundryArtifactRef[] = [
  { fileName: "hero.png", role: "page", contentType: "image/png", byteLength: 20, sha256: "b".repeat(64) },
  { fileName: "hero.clunk.json", role: "manifest", contentType: "application/json", byteLength: 10, sha256: "a".repeat(64) },
];

test("foundry request hashes are stable and remixes require a source", () => {
  const first = createFoundryRequestHash({ b: 2, a: 1 });
  const second = createFoundryRequestHash({ a: 1, b: 2 });
  assert.equal(first, second);
  assert.throws(() => createRemixRequest({ prompt: "new color" }), /sourceAssetId/i);
  const remix = createRemixRequest({
    sourceAssetId: "asset-source",
    sourceHash: "c".repeat(64),
    prompt: "new color",
    targetProfileId: "web-three-mobile",
  });
  assert.match(remix.requestHash, /^[a-f0-9]{64}$/);
  assert.equal(remix.sourceAssetId, "asset-source");
  assert.equal(remix.sourceHash, "c".repeat(64));
});

test("kit manifests are deterministic, ordered, and contain no bytes", () => {
  const input = {
    kitId: "kit-one",
    title: "Forge starter kit",
    description: "A small native kit",
    members: [
      { assetId: "asset-b", role: "secondary", sourceHash: "d".repeat(64), artifacts },
      { assetId: "asset-a", role: "entry", sourceHash: "e".repeat(64), artifacts: artifacts.slice().reverse() },
    ],
  } as const;
  const manifest = createKitManifest(input);
  assert.equal(manifest.schema, "clunk.asset-kit.v1");
  assert.deepEqual(manifest.members.map((member) => member.assetId), ["asset-a", "asset-b"]);
  assert.deepEqual(manifest.members[0].artifacts.map((artifact) => artifact.fileName), ["hero.clunk.json", "hero.png"]);
  assert.equal("bytes" in manifest.members[0].artifacts[0], false);
  assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/);
});
