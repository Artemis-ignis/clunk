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

test("assetops CLI exposes canonical target inspection and honest exit mapping", async () => {
  const script = await source("scripts/assetops-inspect-cli.ts");
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(script, /inspectAssetForTarget/);
  assert.match(script, /target-profile/);
  assert.match(script, /ENVIRONMENT_UNAVAILABLE/);
  assert.match(script, /process\.exitCode = exitCodeFor/);
  assert.equal(packageJson.scripts["asset:inspect"], "tsx scripts/assetops-inspect-cli.ts");
});
