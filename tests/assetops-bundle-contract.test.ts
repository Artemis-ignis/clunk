import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_ASSET_BUNDLE_BYTES,
  parseAssetInspectionRequest,
} from "../app/api/assetops/inspect/bundle-contract";
import { inspectAssetForTarget } from "../packages/core/src/assetops-pipeline";

const image = new Uint8Array(await readFile("public/og.png"));
const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function atlasText(): Uint8Array {
  return encoder.encode(`body.png
size: 1672,941
format: RGBA8888
filter: Linear,Linear
repeat: none
body
  rotate: false
  xy: 0, 0
  size: 64, 64
  orig: 64, 64
  offset: 0, 0
  index: -1
`);
}

function spineJson(): Uint8Array {
  return encoder.encode(JSON.stringify({
    skeleton: { spine: "4.1" },
    bones: [{ name: "root" }],
    slots: [{ name: "body-slot", bone: "root", attachment: "body" }],
    skins: [{
      name: "default",
      attachments: { "body-slot": { body: { type: "region", path: "body" } } },
    }],
    animations: { idle: { slots: { "body-slot": { attachment: [{ time: 0, name: "body" }] } } } },
  }));
}

function validBundlePayload() {
  return {
    schema: "clunk.asset-inspection-request.v2",
    entryFileName: "spine/character.json",
    files: [
      { fileName: "spine/character.json", role: "entry", bytesBase64: base64(spineJson()) },
      { fileName: "spine/character.atlas", role: "atlas", relatesTo: ["spine/character.json"], bytesBase64: base64(atlasText()) },
      { fileName: "spine/body.png", role: "page", relatesTo: ["spine/character.atlas"], bytesBase64: base64(image) },
    ],
    targetProfileId: "harvest-frontier-web-three",
    assetKind: "spine-project",
    runId: "bundle-contract-test",
  };
}

test("parses a multi-file Spine bundle and preserves per-file hashes", () => {
  const parsed = parseAssetInspectionRequest(validBundlePayload());

  assert.equal(parsed.schema, "clunk.asset-inspection-request.v2");
  assert.equal(parsed.entryFileName, "spine/character.json");
  assert.equal(parsed.bundleFiles.size, 3);
  assert.equal(parsed.fileSummaries.length, 3);
  assert.equal(parsed.fileSummaries.find((file) => file.fileName === "spine/body.png")?.bytes, image.byteLength);
  assert.equal(parsed.fileSummaries.find((file) => file.fileName === "spine/character.atlas")?.role, "atlas");
  assert.deepEqual(parsed.fileSummaries.find((file) => file.fileName === "spine/body.png")?.relatesTo, ["spine/character.atlas"]);
  assert.match(parsed.fileSummaries[0]?.sha256 ?? "", /^[a-f0-9]{64}$/);

  const evidence = inspectAssetForTarget({
    runId: parsed.runId,
    sourcePath: `upload:${parsed.entryFileName}`,
    fileName: parsed.entryFileName,
    bytes: parsed.entryBytes,
    targetProfileId: parsed.targetProfileId,
    assetKind: parsed.assetKind,
    bundleFiles: parsed.bundleFiles,
  });
  assert.equal(evidence.stages.structure.status, "pass");
  assert.equal(evidence.stages.runtime.status, "environmentUnavailable");
});

test("keeps legacy single-file requests compatible", () => {
  const parsed = parseAssetInspectionRequest({
    schema: "clunk.asset-inspection-request.v1",
    fileName: "body.png",
    bytesBase64: base64(image),
    targetProfileId: "harvest-frontier-web-three",
  });

  assert.equal(parsed.schema, "clunk.asset-inspection-request.v1");
  assert.equal(parsed.entryFileName, "body.png");
  assert.equal(parsed.bundleFiles.size, 1);
  assert.equal(parsed.bundleFiles.get("body.png")?.byteLength, image.byteLength);
});

test("rejects unsafe, duplicate, missing-entry, and malformed bundle members", () => {
  const valid = validBundlePayload();
  const cases: Array<[string, unknown, RegExp]> = [
    ["unsafe path", { ...valid, files: [{ fileName: "../body.png", bytesBase64: base64(image) }], entryFileName: "../body.png" }, /single relative file name|path traversal|unsafe/i],
    ["duplicate path", { ...valid, files: [...valid.files, valid.files[0]] }, /duplicate/i],
    ["missing entry", { ...valid, entryFileName: "spine/missing.json" }, /entryFileName|entry.*bundle|missing/i],
    ["malformed member", { ...valid, files: valid.files.map((file, index) => index === 1 ? { ...file, bytesBase64: "not-base64!" } : file) }, /base64/i],
  ];

  for (const [label, payload, expected] of cases) {
    assert.throws(() => parseAssetInspectionRequest(payload), expected, label);
  }
});

test("rejects a bundle relation that does not name another submitted file", () => {
  const valid = validBundlePayload();
  assert.throws(() => parseAssetInspectionRequest({
    ...valid,
    files: valid.files.map((file, index) => index === 1 ? { ...file, relatesTo: ["spine/missing.json"] } : file),
  }), /relatesTo|submitted file|bundle/i);
});

test("rejects an aggregate bundle above the upload limit", () => {
  const oversized = new Uint8Array(MAX_ASSET_BUNDLE_BYTES + 1);
  assert.throws(() => parseAssetInspectionRequest({
    schema: "clunk.asset-inspection-request.v2",
    entryFileName: "oversized.bin",
    files: [{ fileName: "oversized.bin", bytesBase64: base64(oversized) }],
    targetProfileId: "harvest-frontier-web-three",
  }), /upload limit|exceed/i);
});
