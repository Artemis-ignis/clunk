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
 * The manual moved to a real GitBook site on 2026-09-01 and /docs now redirects
 * there, so the docs surface is docs/gitbook/*.md — the Git Sync source kept
 * byte-identical to the published pages. This assertion freezes that the DOCS
 * SURFACE publishes a fact, not which file holds it, so read them all.
 */
async function docsSurface() {
  // 2026-09-01: the docs surface moved to GitBook and /docs redirects there.
  // The published pages are mirrored in docs/gitbook/*.md (kept byte-identical
  // to the live site), so the contract still reads the docs surface itself.
  const { readdir, readFile: read } = await import("node:fs/promises");
  const dir = new URL("../docs/gitbook/", import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  const parts = await Promise.all(
    names.map((name) => read(new URL(name, dir), "utf8")),
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
