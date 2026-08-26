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
  const docs = await source("app/docs/page.tsx");
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
