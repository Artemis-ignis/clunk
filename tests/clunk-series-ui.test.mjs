import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");


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

test("Clunk Series has a truthful public catalog surface", async () => {
  const page = await source("app/series/page.tsx");
  const catalog = await source("app/components/ClunkSeriesCatalog.tsx");
  const seriesCatalog = await source("packages/clunk-series/src/catalog.ts");

  for (const name of [
    "Clunk Asset Forge",
    "Clunk Sprite Lab",
    "Clunk Material Lab",
    "Clunk Motion Lab",
    "Clunk Game Ready",
    "Clunk Market",
  ]) {
    assert.match(page + catalog + seriesCatalog, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /getClunkSeriesCatalog/);
  assert.match(page, /Clunk 내부 시리즈/);
  assert.match(catalog, /sourceRecordIds/);
  assert.match(catalog, /license/);
  assert.match(catalog, /NativeLink/);
  assert.match(catalog, new RegExp("/studio"));
  assert.match(catalog, new RegExp("/app"));
  assert.match(catalog, new RegExp("/marketplace"));
  assert.doesNotMatch(page + catalog, /fal\.ai|api\.fal\.ai|replicate\.com|external provider/i);
});

test("Studio authoring uses the native Clunk Series execution rail", async () => {
  const client = await source("app/studio/StudioClient.tsx");
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  const model = await source("app/studio/studio-model.ts");
  const studio = client + model;

  assert.match(studio, /seriesId/);
  assert.match(studio, /Clunk Series/);
  assert.match(studio, /Asset Forge/);
  assert.match(studio, /Sprite Lab/);
  assert.match(studio, /Material Lab/);
  assert.match(studio, /Motion Lab/);
  assert.match(client, /AssetCreationWorkbench[\s\S]*seriesId/);
  assert.match(workbench, /\/api\/series/);
  // 2026-09-01: the workbench used to print the rule-set id in a label on
  // screen. Users never needed to read it; the rail identity is contracted
  // where it is actually declared and served.
  const seriesRoute = await source("app/api/series/route.ts");
  assert.match(seriesRoute, /clunk-series-native-v1/);
  assert.doesNotMatch(workbench, /fal\.ai|api\.fal\.ai|replicate\.com/i);
});

test("Docs explain the native Clunk Series execution boundary", async () => {
  const docs = await docsSurface();

  assert.match(docs, /Clunk Series/);
  assert.match(docs, /clunk-series-native-v1/);
  assert.match(docs, /series:mesh/);
  assert.match(docs, /Game Ready/);
  assert.match(docs, /productionReady/);
  assert.match(docs, /\/series/);
});
