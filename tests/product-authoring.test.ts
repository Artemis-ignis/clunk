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

test("procedural 2d sprite silhouette is centered inside its frame, not clipped at the left edge", async () => {
  const result = createProceduralAuthoring({
    assetKind: "2d-image",
    label: "Center Probe",
    prompt: "A goblin archer with a longbow",
    targetProfileId: "yeongheo-pixi-2d",
    width: 128,
    height: 128,
  });
  const entry = result.artifacts.find((artifact) => artifact.role === "entry");
  assert.ok(entry);
  const sharpFactory = sharp as unknown as (input: Buffer) => {
    raw: () => { toBuffer: (options: { resolveWithObject: true }) => Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }> };
  };
  const { data, info } = await sharpFactory(Buffer.from(entry.bytes)).raw().toBuffer({ resolveWithObject: true });
  let weightedX = 0;
  let opaque = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 0) {
        weightedX += x;
        opaque += 1;
      }
    }
  }
  assert.ok(opaque > 0, "sprite must contain opaque pixels");
  const centerRatio = weightedX / opaque / info.width;
  assert.ok(centerRatio > 0.4 && centerRatio < 0.6, `silhouette center of mass must sit in the middle band, got ${centerRatio.toFixed(3)}`);
  const leftEdgeOpaque = Array.from({ length: info.height }, (_, y) => data[(y * info.width) * info.channels + 3]).filter((alpha) => alpha > 0).length;
  assert.equal(leftEdgeOpaque, 0, "column x=0 must not carry the silhouette body");
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
