import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
} from "../packages/core/src/collaboration-contract";

test("M104 acceptance fixture links procedural crop, GLB, and comparison evidence without visual auto-pass", async () => {
  const raw = JSON.parse(await readFile("examples/frame-manifest/harvest-frontier-m104-comparison-closeout.example.json", "utf8")) as unknown;
  const manifest = normalizeFrameManifest(raw);
  const review = evaluatePlayerFacingSceneReview(manifest);

  assert.equal(manifest.schema, "clunk.frame-manifest.v1");
  assert.equal(manifest.comparison?.schema, "clunk.frame-comparison.v1");
  assert.equal(manifest.comparison?.pairs[0]?.beforeFrameId, "hf-m104-before-nohud");
  assert.equal(manifest.comparison?.pairs[0]?.afterFrameId, "hf-m104-after-nohud");
  assert.equal(manifest.sceneGaps.length, 4);
  assert.ok(manifest.sceneGaps.every((gap) => gap.closeout?.status === "OPEN"));
  assert.equal(manifest.assetInspections?.find((asset) => asset.origin === "file")?.numericContract?.status, "PASS");
  assert.equal(manifest.assetInspections?.find((asset) => asset.origin === "procedural")?.playerFacing, "NOT_EVALUATED");
  assert.equal(review.readiness, "conditional");
  assert.equal(review.status, "UNAVAILABLE");
  assert.equal(review.humanReview, "PENDING");
  assert.equal(review.visualRuntime, "GAP");
  assert.equal(review.playerFacing, "NOT_EVALUATED");
  assert.match(review.issues?.join("\n") ?? "", /procedural.*NOT_EVALUATED/i);
});
