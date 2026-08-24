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

test("authenticated asset inspection API exposes the canonical byte-upload contract", async () => {
  const route = await source("app/api/assetops/inspect/route.ts");
  assert.match(route, /requireClunkContext/);
  assert.match(route, /assertSameOrigin/);
  assert.match(route, /bytesBase64/);
  assert.match(route, /inspectAssetForTarget/);
  assert.match(route, /raw bytes are not persisted/i);
  assert.match(route, /privateJson/);
});
