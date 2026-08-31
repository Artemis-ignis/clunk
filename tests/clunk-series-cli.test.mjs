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

test("Clunk Series CLI exposes a separate Game Ready mesh output", async () => {
  const script = await source("scripts/clunk-series-cli.ts");
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(script, /runClunkMeshLab/);
  assert.match(script, /flag.*out|--out/);
  assert.match(script, /flag.*target-profile|target-profile/);
  assert.match(script, /flag.*license|license/);
  assert.match(script, /wx/);
  assert.match(script, /sourceHash/);
  assert.match(script, /outputHash/);
  assert.equal(packageJson.scripts["series:mesh"], "tsx scripts/clunk-series-cli.ts");
});
