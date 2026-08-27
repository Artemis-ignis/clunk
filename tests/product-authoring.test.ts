import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createProceduralAuthoring } from "../packages/core/src/product-authoring";

test("procedural authoring emits a real RGBA sprite bundle with deterministic provenance", async () => {
  const first = createProceduralAuthoring({
    assetKind: "sprite-atlas",
    label: "Moon Ranger",
    prompt: "A readable pixel character for a Pixi game",
    targetProfileId: "yeongheo-pixi-2d",
    height: 96,
    frames: 4,
  });
  const second = createProceduralAuthoring({
    assetKind: "sprite-atlas",
    label: "Moon Ranger",
    prompt: "A readable pixel character for a Pixi game",
    targetProfileId: "yeongheo-pixi-2d",
    height: 96,
    frames: 4,
  });
  const page = first.artifacts.find((artifact) => artifact.role === "page");
  assert.ok(page);
  assert.deepEqual(Array.from(page.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(page.bytes.some((value, index) => index > 32 && value > 0));
  assert.equal(page.sha256, second.artifacts.find((artifact) => artifact.role === "page")?.sha256);
  assert.equal(first.provenance.productionReady, false);
  assert.equal(first.evidence.stages.outputReopen?.status, "pass");
  const sharpFactory = sharp as unknown as (input: Buffer) => { metadata: () => Promise<{ format?: string; width?: number; height?: number; channels?: number }> };
  const metadata = await sharpFactory(Buffer.from(page.bytes)).metadata();
  assert.deepEqual({ format: metadata.format, width: metadata.width, height: metadata.height, channels: metadata.channels }, { format: "png", width: 384, height: 96, channels: 4 });
});

test("procedural authoring emits a parseable GLB animation artifact", () => {
  const result = createProceduralAuthoring({
    assetKind: "animation-clip",
    label: "Signal Cube",
    prompt: "A small looping turntable animation",
    targetProfileId: "web-three-mobile",
  });
  const artifact = result.artifacts[0];
  assert.equal(artifact.fileName.endsWith(".glb"), true);
  assert.equal(new DataView(artifact.bytes.buffer, artifact.bytes.byteOffset).getUint32(0, true), 0x46546c67);
  assert.equal(result.evidence.assetKind, "animation-clip");
  assert.equal(result.evidence.stages.outputReopen?.status, "pass");
});
