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
  // 2026-08-26(54762bd) 정정: 원격 HTTP MCP 라우트가 /mcp 에서 /api/mcp 로 옮겨졌고
  // 이 계약만 옛 경로를 읽다가 ENOENT 로 죽고 있었다. 지금 app/mcp 에는 설명 페이지
  // (page.tsx)만 남아 있고, 라우트는 app/api/mcp/route.ts(핸들러 재수출) 하나다.
  // 도구 이름을 실제로 들고 있는 쪽은 handler.ts 이므로 둘을 나눠서 읽는다.
  const remoteMcpRoute = await source("app/api/mcp/route.ts");
  const remoteMcp = await source("app/api/mcp/handler.ts");
  // 옛 경로가 되살아나면 같은 MCP 엔드포인트가 두 곳이 된다 — 공개 링크가 어느 쪽을
  // 가리키는지 아무도 모르게 되므로, 사라진 사실 자체를 계약으로 잠근다.
  await assert.rejects(access(new URL("app/mcp/route.ts", root)), /ENOENT/);
  assert.match(remoteMcpRoute, /export \{[^}]*POST[^}]*\} from "\.\/handler"/);

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
