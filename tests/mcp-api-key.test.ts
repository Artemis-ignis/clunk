import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_API_KEY_PREFIX,
  createMcpApiKeyMaterial,
  hashMcpApiKey,
  isMcpApiKey,
} from "../app/api/_lib/mcp-api-key";

test("issued Clunk API keys are one-time secrets with verifiable hashes", () => {
  const material = createMcpApiKeyMaterial();
  assert.ok(material.secret.startsWith(MCP_API_KEY_PREFIX));
  assert.ok(isMcpApiKey(material.secret));
  assert.equal(material.hash, hashMcpApiKey(material.secret));
  assert.equal(material.prefix, material.secret.slice(0, 20));
  assert.notEqual(material.secret, createMcpApiKeyMaterial().secret);
});

test("API key validation does not accept arbitrary bearer values", () => {
  assert.equal(isMcpApiKey("clunk_live_short"), false);
  assert.equal(isMcpApiKey("Bearer clunk_live_short"), false);
  assert.equal(isMcpApiKey(null), false);
});
