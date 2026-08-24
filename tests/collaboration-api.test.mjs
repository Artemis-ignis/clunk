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
  assert.match(collection, /evidence_json/);
  assert.match(collection, /parseStoredEvidence/);
  assert.match(item, /evidence_json/);
  assert.match(item, /evidenceJson/);
  assert.match(messages, /evidence_json/);
  assert.match(messages, /parseStoredEvidence/);
});

test("collaboration D1 schema stores append-only messages and status snapshots", async () => {
  const schema = await source("drizzle/0002_lovely_thunderbolt_ross.sql");
  assert.match(schema, /clunk_collaboration_threads/);
  assert.match(schema, /clunk_collaboration_messages/);
  assert.match(schema, /status_json/);
  assert.match(schema, /input_hash/);
  assert.match(schema, /workspace_id/);
});

test("frame manifest evidence has a versioned migration and API envelope", async () => {
  const migration = await source("drizzle/0004_motionless_captain_midlands.sql");
  const contract = await source("packages/core/src/collaboration-contract.ts");
  const docs = await source("public/llms.txt");
  assert.match(migration, /ADD `evidence_json` text/);
  assert.match(contract, /clunk\.frame-manifest\.v1/);
  assert.match(contract, /reviewStatus/);
  assert.match(docs, /clunk\.frame-manifest\.v1/);
  assert.match(docs, /sceneGaps/);
  assert.match(docs, /NOT_EVALUATED/);
});
