import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  const url = new URL(relativePath, root);
  await access(url, constants.F_OK);
  return readFile(url, "utf8");
}

test("frame manifest CLI exposes deterministic validate and merge commands", async () => {
  const script = await source("scripts/frame-manifest-cli.ts");
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(script, /normalizeFrameManifest/);
  assert.match(script, /mergeFrameManifestEvidence/);
  assert.match(script, /evidenceMode/);
  assert.match(script, /process\.exitCode = 2/);
  assert.equal(packageJson.scripts["collaboration:frame-manifest"], "tsx scripts/frame-manifest-cli.ts");
});

test("HF M99 acceptance fixture keeps static and visual verdicts separate", async () => {
  const manifest = JSON.parse(await source("examples/frame-manifest/harvest-frontier-m99-packaged-webgpu.json"));
  const noHud = manifest.frames.find((frame) => frame.id === "hf-m99-webgpu-nohud");
  const glbInspections = manifest.assetInspections.filter((item) => item.origin === "file" && item.assetKind === "3d-model");
  const proceduralInspections = manifest.assetInspections.filter((item) => item.origin === "procedural");

  assert.equal(manifest.schema, "clunk.frame-manifest.v1");
  assert.equal(manifest.sourceCommit, "781a551c5c6eb577f2326ecb84deb22af93eaa3d");
  assert.equal(manifest.reviewStatus, "NOT_EVALUATED");
  assert.equal(manifest.visualRuntime, "GAP");
  assert.equal(manifest.playerFacing, "NOT_EVALUATED");
  assert.equal(noHud.shippedPath, true);
  assert.equal(glbInspections.length, 8);
  assert.equal(proceduralInspections.length, 6);
  assert.equal(manifest.frames.length, 3);
  assert.equal(manifest.prescriptions.length, 6);
  assert.ok(manifest.prescriptions.every((item) => item.status === "NON_BLOCKING"));
});
