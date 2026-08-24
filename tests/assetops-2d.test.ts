import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  analyzeAnimation,
  analyzeImage,
  analyzeSpineProject,
  analyzeSpriteAtlas,
} from "../packages/core/src/analyzers/asset-analyzers";
import {
  createAssetBundle,
  getBuiltInTargetProfile,
  type TargetProfile,
} from "../packages/core/src/index";

const image = new Uint8Array(await readFile("public/og.png"));
const target = getBuiltInTargetProfile("godot-4") as TargetProfile;
const encoder = new TextEncoder();

function atlasText(region = "body") {
  return encoder.encode(`body.png
size: 1672,941
format: RGBA8888
filter: Linear,Linear
repeat: none
${region}
  rotate: false
  xy: 0, 0
  size: 64, 64
  orig: 64, 64
  offset: 0, 0
  index: -1
`);
}

function spineJson(attachmentPath = "body") {
  return encoder.encode(JSON.stringify({
    skeleton: { spine: "4.1" },
    bones: [{ name: "root" }],
    slots: [{ name: "body-slot", bone: "root", attachment: "body" }],
    skins: [{
      name: "default",
      attachments: { "body-slot": { body: { type: "region", path: attachmentPath } } },
    }],
    animations: { idle: { slots: { "body-slot": { attachment: [{ time: 0, name: "body" }] } } } },
  }));
}

test("image analyzer reads real PNG bytes and enforces target dimensions", async () => {
  const result = analyzeImage({ fileName: "og.png", bytes: image, target });
  assert.equal(result.gate.status, "pass");
  assert.ok(result.width > 0);
  assert.ok(result.height > 0);
  assert.match(result.inputHash, /^[a-f0-9]{64}$/);
  assert.ok(result.gpuBytesWithMips > image.byteLength);
});

test("image analyzer rejects malformed image bytes with a blocking gate", () => {
  const result = analyzeImage({ fileName: "broken.png", bytes: new Uint8Array([1, 2, 3]), target });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "IMAGE-PARSE"));
});

test("sprite atlas analyzer resolves a real page and region", () => {
  const files = new Map<string, Uint8Array>([
    ["body.atlas", atlasText()],
    ["body.png", image],
  ]);
  const result = analyzeSpriteAtlas({ entry: "body.atlas", files, target });
  assert.equal(result.gate.status, "pass");
  assert.equal(result.regionCount, 1);
  assert.equal(result.regions[0]?.name, "body");
});

test("sprite atlas analyzer blocks a missing page instead of treating it as a valid atlas", () => {
  const files = new Map<string, Uint8Array>([["body.atlas", atlasText()]]);
  const result = analyzeSpriteAtlas({ entry: "body.atlas", files, target });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "ATLAS-MISSING-PAGE"));
});

test("sprite atlas analyzer blocks a region outside the actual page bounds", () => {
  const outOfBounds = encoder.encode(`body.png
size: 1672,941
format: RGBA8888
body
  rotate: false
  xy: 10000, 0
  size: 64, 64
  orig: 64, 64
  offset: 0, 0
`);
  const result = analyzeSpriteAtlas({
    entry: "body.atlas",
    files: new Map([["body.atlas", outOfBounds], ["body.png", image]]),
    target,
  });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "ATLAS-REGION-BOUNDS"));
});

test("sprite atlas analyzer blocks duplicate region identifiers", () => {
  const duplicate = encoder.encode(`body.png
size: 1672,941
format: RGBA8888
body
  xy: 0, 0
  size: 64, 64
  orig: 64, 64
body
  xy: 64, 0
  size: 64, 64
  orig: 64, 64
`);
  const result = analyzeSpriteAtlas({
    entry: "body.atlas",
    files: new Map([["body.atlas", duplicate], ["body.png", image]]),
    target,
  });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "ATLAS-DUPLICATE-REGION"));
});

test("Spine analyzer checks skeleton, attachment, animation, and atlas references", () => {
  const files = new Map<string, Uint8Array>([
    ["character.json", spineJson()],
    ["character.atlas", atlasText()],
    ["body.png", image],
  ]);
  const result = analyzeSpineProject({ entry: "character.json", files, target });
  assert.equal(result.gate.status, "pass");
  assert.equal(result.boneCount, 1);
  assert.equal(result.slotCount, 1);
  assert.deepEqual(result.animationNames, ["idle"]);
});

test("Spine analyzer blocks slots and timelines that reference missing bones or slots", () => {
  const invalidProject = encoder.encode(JSON.stringify({
    skeleton: { spine: "4.1" },
    bones: [{ name: "root" }],
    slots: [{ name: "body-slot", bone: "missing-bone", attachment: "body" }],
    skins: [{ name: "default", attachments: { "body-slot": { body: { type: "region", path: "body" } } } }],
    animations: {
      idle: {
        bones: { "missing-bone": { rotate: [{ time: 0, angle: 0 }] } },
        slots: { "missing-slot": { attachment: [{ time: 0, name: "body" }] } },
      },
    },
  }));
  const result = analyzeSpineProject({
    entry: "character.json",
    files: new Map([
      ["character.json", invalidProject],
      ["character.atlas", atlasText()],
      ["body.png", image],
    ]),
    target,
  });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "SPINE-MISSING-BONE"));
  assert.ok(result.findings.some((finding) => finding.id === "SPINE-MISSING-ANIMATION-BONE"));
  assert.ok(result.findings.some((finding) => finding.id === "SPINE-MISSING-ANIMATION-SLOT"));
});

test("Spine analyzer reports missing attachment regions and binary skel support honestly", () => {
  const missing = analyzeSpineProject({
    entry: "character.json",
    files: new Map([
      ["character.json", spineJson("missing")],
      ["character.atlas", atlasText()],
      ["body.png", image],
    ]),
    target,
  });
  assert.equal(missing.gate.status, "fail");
  assert.ok(missing.findings.some((finding) => finding.id === "SPINE-MISSING-REGION"));

  const binary = analyzeSpineProject({
    entry: "character.skel",
    files: new Map([["character.skel", new Uint8Array([0x53, 0x4b, 0x45, 0x4c])]]),
    target,
  });
  assert.equal(binary.gate.status, "unsupported");
});

test("animation analyzer reports clip duration and required clip policy", () => {
  const gltf = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: "root" }],
    buffers: [{ byteLength: 8 }],
    accessors: [{ min: [0], max: [1] }],
    animations: [{
      name: "idle",
      samplers: [{ input: 0, output: 0 }],
      channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
    }],
  };
  const animationTarget = {
    ...target,
    animationPolicy: { requiredClips: ["idle"], rootMotion: "forbidden" as const },
  };
  const result = analyzeAnimation({
    bundle: createAssetBundle("character.gltf", encoder.encode(JSON.stringify(gltf))),
    target: animationTarget,
  });
  assert.equal(result.gate.status, "pass");
  assert.equal(result.clips[0]?.name, "idle");
  assert.equal(result.clips[0]?.durationSeconds, 1);
  assert.equal(result.clips[0]?.hasRootMotion, false);
});

test("animation analyzer blocks missing sampler, accessor, node, and target-path bindings", () => {
  const gltf = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: "root" }],
    buffers: [{ byteLength: 8 }],
    accessors: [{ min: [0], max: [1] }],
    animations: [{
      name: "broken",
      samplers: [{ input: 7, output: 8 }],
      channels: [{ sampler: 4, target: { node: 9, path: "morph" } }],
    }],
  };
  const result = analyzeAnimation({
    bundle: createAssetBundle("broken.gltf", encoder.encode(JSON.stringify(gltf))),
    target,
  });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "ANIM-SAMPLER-INDEX"));
  assert.ok(result.findings.some((finding) => finding.id === "ANIM-TARGET-NODE"));
  assert.ok(result.findings.some((finding) => finding.id === "ANIM-TARGET-PATH"));
});

test("animation analyzer keeps zero-duration clips visible as a non-blocking quality warning", () => {
  const gltf = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: "root" }],
    buffers: [{ byteLength: 8 }],
    accessors: [{ min: [0], max: [0] }],
    animations: [{
      name: "hold",
      samplers: [{ input: 0, output: 0 }],
      channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
    }],
  };
  const result = analyzeAnimation({
    bundle: createAssetBundle("hold.gltf", encoder.encode(JSON.stringify(gltf))),
    target,
  });
  assert.equal(result.gate.status, "pass");
  assert.ok(result.findings.some((finding) => finding.id === "ANIM-ZERO-DURATION" && finding.severity === "WARNING"));
});
