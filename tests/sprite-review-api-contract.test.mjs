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

test("sprite and scene review APIs are explicit, stateless, and preserve review boundaries", async () => {
  const spriteRoute = await source("app/api/sprite-review/route.ts");
  const sceneRoute = await source("app/api/scene-review/route.ts");
  const localMcp = await source("integrations/mcp/server.ts");
  const remoteMcp = await source("app/mcp/route.ts");

  assert.match(spriteRoute, /normalizeSpriteSheetReview/);
  assert.match(spriteRoute, /DECLARED_METADATA_ONLY/);
  assert.match(spriteRoute, /visualRuntime/);
  assert.match(spriteRoute, /humanDecision/);
  assert.match(sceneRoute, /normalizeFrameManifest/);
  assert.match(sceneRoute, /evaluatePlayerFacingSceneReview/);
  assert.match(sceneRoute, /visualRuntime/);
  assert.match(localMcp, /clunk_scene_review/);
  assert.match(localMcp, /clunk_sprite_sheet_review/);
  assert.match(remoteMcp, /clunk_scene_review/);
  assert.match(remoteMcp, /clunk_sprite_sheet_review/);
});

test("sprite review docs name the local image contract and its exit semantics", async () => {
  const docs = await docsSurface();
  const llms = await source("public/llms.txt");
  const facts = await source("app/components/product-facts.ts");

  for (const text of [docs, llms, facts]) {
    assert.match(text, /clunk\.sprite-sheet-review\.v1/);
    assert.match(text, /CONTRACT_FIXTURE/);
    assert.match(text, /PLAYER_FACING_CAPTURE/);
    assert.match(text, /exit 4|exit code 4/);
    assert.match(text, /Pixi/i);
  }
});
