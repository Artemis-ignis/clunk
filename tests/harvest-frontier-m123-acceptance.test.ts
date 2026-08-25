import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
} from "../packages/core/src/collaboration-contract";

test("Harvest Frontier M123 fixture keeps structural evidence separate from scene review", async () => {
  const raw = JSON.parse(await readFile("examples/frame-manifest/harvest-frontier-m123-camera-review.example.json", "utf8")) as unknown;
  const manifest = normalizeFrameManifest(raw);
  const review = evaluatePlayerFacingSceneReview(manifest);

  assert.equal(manifest.schema, "clunk.frame-manifest.v1");
  assert.equal(manifest.frames.length, 2);
  assert.deepEqual(manifest.frames.map((frame) => frame.renderer), ["webgpu", "webgl2"]);
  assert.ok(manifest.frames.every((frame) => frame.shippedPath === false));
  assert.equal(manifest.assetInspections?.[0]?.numericContract?.status, "PASS");
  assert.equal(manifest.assetInspections?.[0]?.numericContract?.score, 100);
  assert.equal(manifest.assetInspections?.[0]?.playerFacing, "NOT_EVALUATED");
  assert.equal(review.status, "UNAVAILABLE");
  assert.equal(review.readiness, "conditional");
  assert.equal(review.reviewStatus, "NOT_EVALUATED");
  assert.equal(review.visualRuntime, "GAP");
  assert.equal(review.playerFacing, "NOT_EVALUATED");
  assert.equal(review.humanReview, "PENDING");
  assert.match(review.issues?.join("\n") ?? "", /no shippedPath frame/i);
});
