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
