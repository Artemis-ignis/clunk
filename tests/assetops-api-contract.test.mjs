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


/**
 * /docs became a multi-page GitBook manual on 2026-08-31: the sections that used
 * to be anchors on app/docs/page.tsx are now app/docs/<topic>/page.tsx, and the
 * long listings live in app/docs/docs-content.ts. This assertion freezes that the
 * DOCS SURFACE publishes a fact, not which file holds it, so read them all.
 */
async function docsSurface() {
  const { readdir, readFile: read } = await import("node:fs/promises");
  const dir = new URL("../app/docs/", import.meta.url);
  const names = (await readdir(dir, { recursive: true })).filter((name) => /\.tsx?$/.test(name));
  const parts = await Promise.all(
    names.map((name) => read(new URL(name.replaceAll("\\", "/"), dir), "utf8")),
  );
  return parts.join("\n");
}

test("authenticated asset inspection API exposes the canonical byte-upload contract", async () => {
  const route = await source("app/api/assetops/inspect/route.ts");
  const bundleContract = await source("app/api/assetops/inspect/bundle-contract.ts");
  const llms = await source("public/llms.txt");
  const docs = await docsSurface();
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(route, /requireClunkContext/);
  assert.match(route, /assertSameOrigin/);
  assert.match(route, /parseAssetInspectionRequest/);
  assert.match(route, /clunk\.asset-inspection-response\.v2/);
  assert.match(route, /summarizeAssetBundle/);
  assert.match(route, /inspectAssetForTarget/);
  assert.match(route, /raw bytes are not persisted/i);
  assert.match(route, /privateJson/);
  assert.match(bundleContract, /clunk\.asset-inspection-request\.v2/);
  assert.match(bundleContract, /MAX_ASSET_BUNDLE_BYTES/);
  assert.match(bundleContract, /Duplicate bundle file/);
  assert.match(bundleContract, /path traversal/);
  assert.match(bundleContract, /AssetBundleFileRole/);
  assert.match(bundleContract, /relatesTo/);
  assert.match(llms, /clunk\.asset-inspection-request\.v2/);
  assert.match(llms, /Spine JSON \+ atlas \+ PNG/i);
  assert.match(llms, /role/);
  assert.match(llms, /relatesTo/);
  assert.match(docs, /entryFileName/);
  assert.match(docs, /fileCount/);
  assert.match(docs, /relatesTo/);
  assert.equal(packageJson.scripts["assetops:test"], "npm run assetops:2d:test && npm run assetops:pipeline:test && npm run assetops:bundle:test && npm run assetops:api:test && npm run assetops:texture:test");
});
