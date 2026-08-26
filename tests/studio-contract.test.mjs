import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Asset Studio exposes the complete 2D/3D authoring-to-runtime boundary", async () => {
  const page = await source("app/studio/page.tsx");
  const model = await source("app/studio/studio-model.ts");
  const client = await source("app/studio/StudioClient.tsx");
  const shell = await source("app/components/WorkspaceShell.tsx");
  const facts = await source("app/components/product-facts.ts");
  const mcp = await source("integrations/mcp/server.ts");
  const packageJson = await source("package.json");
  const docs = await source("app/docs/page.tsx");
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
