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

test("Asset Studio exposes the complete 2D/3D authoring-to-runtime boundary", async () => {
  const page = await source("app/studio/page.tsx");
  const model = await source("app/studio/studio-model.ts");
  const client = await source("app/studio/StudioClient.tsx");
  const shell = await source("app/components/WorkspaceShell.tsx");
  const facts = await source("app/components/product-facts.ts");
  const mcp = await source("integrations/mcp/server.ts");
  const packageJson = await source("package.json");
  const docs = await docsSurface();
  const llms = await source("public/llms.txt");

  assert.match(page, /requireChatGPTUser/);
  assert.match(model, /sprite-atlas/);
  assert.match(model, /spine-project/);
  assert.match(model, /animation-clip/);
  assert.match(model, /ENVIRONMENT_UNAVAILABLE/);
  assert.match(client, /Asset Studio/);
  assert.match(model, /2D Sprite/);
  assert.match(model, /Spine Rig/);
  assert.match(model, /3D Model/);
  assert.match(client, /검사기로 보내기/);
  assert.match(client, /실제 별도 output/);
  assert.match(client, /\/api\/sprite-review/);
  assert.match(client, /크레딧/);
  assert.match(client, /내 Workspace|자신의 프로젝트|Workspace에 저장/);
  assert.doesNotMatch(client, /판매 Draft 저장|마켓 상품 초안 만들기/);
  assert.doesNotMatch(client, /CONTRACT FIXTURE|clunk-sprite-sample|tractor-hero/);
  for (const marker of ["PIXEL CONTRACT", "RUNTIME", "HUMAN REVIEW", "READINESS", "DECLARED_METADATA_ONLY"]) assert.match(client, new RegExp(marker));
  assert.match(shell, /\/studio/);
  assert.match(docs, /Asset Studio/);
  assert.match(llms, /\/studio/);
  assert.match(llms, /2D.*Spine.*3D/);
  assert.match(llms, /7 tools/);
  assert.match(llms, /clunk_asset_author/);
  assert.match(facts, /clunk_asset_author/);
  assert.match(mcp, /clunk_asset_author/);
  assert.match(packageJson, /"asset:author"/);
});
