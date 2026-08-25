import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_HTTP_ENDPOINT_PATH,
  MCP_HTTP_PROTOCOL_VERSION,
  MCP_HTTP_TOOLS,
  createMcpInitializeResult,
  createMcpToolsListResult,
  parseBearerToken,
} from "../app/api/_lib/mcp-http";
import {
  buildAgentGuides,
  type AgentConnection,
} from "../app/components/agent-guides";

test("remote MCP contract accepts only an Authorization Bearer token", () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken("Basic abc"), null);
  assert.equal(parseBearerToken("Bearer "), null);
  assert.equal(parseBearerToken("Bearer clunk_test_key"), "clunk_test_key");
  assert.equal(parseBearerToken("bearer clunk_test_key"), "clunk_test_key");
});

test("HTTP MCP advertises a Clunk-owned endpoint and remote-safe tools", () => {
  assert.equal(MCP_HTTP_ENDPOINT_PATH, "/mcp");
  assert.equal(MCP_HTTP_PROTOCOL_VERSION, "2025-06-18");
  const names = MCP_HTTP_TOOLS.map((tool) => tool.name);
  assert.deepEqual(names, [
    "clunk_connection_check",
    "clunk_asset_inspect",
    "clunk_asset_validate",
    "clunk_asset_inspection_evidence",
    "clunk_collaboration_append",
  ]);
  assert.match(MCP_HTTP_TOOLS[1].description, /base64/i);
  assert.match(MCP_HTTP_TOOLS[1].description, /local path/i);
  assert.match(MCP_HTTP_TOOLS[3].description, /verified evidence/i);
  assert.match(MCP_HTTP_TOOLS[4].description, /workspace/i);
});

test("MCP initialize and tools/list responses are stable JSON-RPC results", () => {
  assert.deepEqual(createMcpInitializeResult(), {
    protocolVersion: MCP_HTTP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: "clunk", version: "0.1.0" },
  });
  const result = createMcpToolsListResult();
  assert.deepEqual(result.tools, MCP_HTTP_TOOLS);
});

test("each client guide is generated from one Clunk endpoint and one issued key", () => {
  const connection: AgentConnection = {
    endpoint: "https://clunk.honna1.chatgpt.site/mcp",
    apiKey: "clunk_live_test_key",
  };
  const guides = buildAgentGuides(connection);
  const byKey = new Map(guides.map((guide) => [guide.key, guide]));

  assert.match(byKey.get("claude-code")?.code ?? "", /https:\/\/clunk\.honna1\.chatgpt\.site\/mcp/);
  assert.match(byKey.get("claude-code")?.code ?? "", /clunk_live_test_key/);
  assert.match(byKey.get("codex")?.code ?? "", /Authorization/);
  assert.match(byKey.get("cursor")?.code ?? "", /type.*http/);
  assert.match(byKey.get("claude-desktop")?.code ?? "", /type.*http/);
  assert.match(byKey.get("vscode")?.code ?? "", /type.*http/);
  assert.match(byKey.get("stdio")?.code ?? "", /npm\.cmd/);
  assert.match(byKey.get("stdio")?.code ?? "", /"run"/);
  assert.ok(guides.filter((guide) => guide.key !== "stdio").every((guide) => !guide.code.includes("<CLUNK_ROOT>")));
});
