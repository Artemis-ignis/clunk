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

test("collaboration thread routes require authentication and workspace scoping", async () => {
  const collection = await source("app/api/collaboration/threads/route.ts");
  const item = await source("app/api/collaboration/threads/[threadId]/route.ts");
  const messages = await source("app/api/collaboration/threads/[threadId]/messages/route.ts");

  for (const route of [collection, item, messages]) {
    assert.match(route, /requireClunkContext/);
    assert.match(route, /workspace_id/);
    assert.match(route, /privateJson/);
    assert.match(route, /jsonError/);
  }
  assert.match(collection, /assertSameOrigin/);
  assert.match(messages, /assertSameOrigin/);
});

test("collaboration D1 schema stores append-only messages and status snapshots", async () => {
  const schema = await source("drizzle/0002_lovely_thunderbolt_ross.sql");
  assert.match(schema, /clunk_collaboration_threads/);
  assert.match(schema, /clunk_collaboration_messages/);
  assert.match(schema, /status_json/);
  assert.match(schema, /input_hash/);
  assert.match(schema, /workspace_id/);
});
