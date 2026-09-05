import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_HTTP_ENDPOINT_PATH,
  MCP_HTTP_PROTOCOL_VERSION,
  MCP_HTTP_TARGET_PROFILE_IDS,
  MCP_HTTP_TOOLS,
  createMcpInitializeResult,
  createMcpToolsListResult,
  parseBearerToken,
} from "../app/api/_lib/mcp-http";
import { getBuiltInTargetProfiles } from "../packages/core/src/index";
import { factsOfListing } from "../app/api/mcp/catalog";
import {
  buildAgentGuides,
  type AgentConnection,
} from "../app/components/agent-guides";
import {
  MCP_HTTP_TOOL_COUNT,
  MCP_HTTP_TOOL_NAMES,
  MCP_TOOLS,
} from "../app/components/product-facts";

test("remote MCP contract accepts only an Authorization Bearer token", () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken("Basic abc"), null);
  assert.equal(parseBearerToken("Bearer "), null);
  assert.equal(parseBearerToken("Bearer clunk_test_key"), "clunk_test_key");
  assert.equal(parseBearerToken("bearer clunk_test_key"), "clunk_test_key");
});

/** 이름으로 찾는다. 도구를 하나 끼워 넣었다고 무관한 단언이 깨지면 안 된다. */
function tool(name: string) {
  const found = MCP_HTTP_TOOLS.find((item) => item.name === name);
  assert.ok(found, `${name} is not advertised by tools/list`);
  return found as (typeof MCP_HTTP_TOOLS)[number] & {
    inputSchema: { required?: readonly string[]; properties: Record<string, { description?: string; enum?: readonly string[] }> };
  };
}

test("HTTP MCP advertises a Clunk-owned endpoint and remote-safe tools", () => {
  assert.equal(MCP_HTTP_ENDPOINT_PATH, "/api/mcp");
  assert.equal(MCP_HTTP_PROTOCOL_VERSION, "2025-06-18");
  const names = MCP_HTTP_TOOLS.map((item) => item.name);
  assert.deepEqual(names, [
    "clunk_connection_check",
    "clunk_search_assets",
    "clunk_asset_facts",
    "clunk_asset_inspect",
    "clunk_asset_validate",
    "clunk_asset_inspection_evidence",
    "clunk_collaboration_append",
    "clunk_scene_review",
    "clunk_sprite_sheet_review",
  ]);
  assert.match(tool("clunk_asset_inspect").description, /base64/i);
  assert.match(tool("clunk_asset_inspect").description, /path on your machine/i);
  assert.match(tool("clunk_asset_inspect").inputSchema.properties.targetProfileId.description ?? "", /harvest-frontier-web-three/);
  assert.match(tool("clunk_asset_validate").inputSchema.properties.targetProfileId.description ?? "", /pc\/web\/mobile/i);
  assert.match(tool("clunk_asset_inspection_evidence").description, /verified evidence/i);
  assert.match(tool("clunk_collaboration_append").description, /workspace/i);
  assert.match(tool("clunk_scene_review").description, /scene review/i);
  assert.match(tool("clunk_sprite_sheet_review").description, /sprite sheet/i);
  assert.deepEqual(tool("clunk_scene_review").inputSchema.required, ["manifest"]);
  assert.deepEqual(tool("clunk_sprite_sheet_review").inputSchema.required, ["manifest"]);
});

/**
 * 2026-09-05 실측 회귀: 원격 tools/list에는 카탈로그 도구가 하나도 없어서, HTTP로 붙은
 * 에이전트는 "폴리곤 2,000개 이하 무료 소품을 찾아라"를 시작조차 할 수 없었습니다.
 * 브라우저 WebMCP에만 있던 그 능력이 원격에도 있어야 합니다.
 */
test("a remote agent can find an asset without opening a browser", () => {
  const search = tool("clunk_search_assets");
  for (const field of ["query", "theme", "grade", "maxPolygons", "minPolygons", "hasAnimation", "freeOnly", "limit"]) {
    assert.ok(search.inputSchema.properties[field], `clunk_search_assets is missing the ${field} filter`);
  }
  // 등급이 곧 접근권이라는 사실을 도구 설명이 말해야, 에이전트가 받을 수 없는 것을 권하지 않습니다.
  assert.match(search.description, /free/i);
  assert.match(search.description, /measured/i);
  assert.deepEqual(tool("clunk_asset_facts").inputSchema.required, ["slug"]);
});

/**
 * 스키마가 통과시킨 호출을 핸들러가 거절하면 안 됩니다. 예전 스키마는 required가
 * targetProfileId 하나뿐이라, 그것만 넣은 호출이 `Invalid fileName.`으로 끝났습니다.
 */
test("the upload schema says how to send bytes, not just which profile", () => {
  for (const name of ["clunk_asset_inspect", "clunk_asset_validate"]) {
    const schema = tool(name).inputSchema as unknown as {
      description: string;
      properties: Record<string, { description?: string; items?: { required?: readonly string[] } }>;
    };
    assert.match(schema.description, /fileName \+ bytesBase64/);
    assert.match(schema.description, /entryFileName \+ files/);
    assert.ok(schema.properties.bytesBase64.description, `${name}.bytesBase64 has no description`);
    assert.deepEqual(schema.properties.files.items?.required, ["fileName", "bytesBase64"]);
    // 실제로 받는 값만 enum에 있어야 합니다. 없는 이름을 권하면 에이전트는 반드시 실패합니다.
    assert.deepEqual(
      tool(name).inputSchema.properties.targetProfileId.enum,
      MCP_HTTP_TARGET_PROFILE_IDS,
    );
  }
});

/** 브라우저 번들 때문에 베껴 둔 목록이 진짜 등록부와 갈라지면 여기서 먼저 깨집니다. */
test("the advertised target profile ids are the ones core actually registers", () => {
  assert.deepEqual(
    [...MCP_HTTP_TARGET_PROFILE_IDS],
    getBuiltInTargetProfiles().map((profile) => profile.id),
  );
});

/**
 * 2026-09-05 실측: B등급 downloadUrl은 키도 세션도 없이 302 뒤 실제 바이트를 내주고,
 * A등급은 같은 조건에서 401입니다. 도구가 이 둘을 같은 말로 설명하면 에이전트는 받을 수
 * 있는 파일을 못 받고 사람에게 떠넘기거나, 못 받을 파일을 계속 두드립니다.
 */
test("catalogue results tell an agent which downloads it can fetch itself", () => {
  const base = {
    id: "listing-test",
    priceCents: 0,
    currency: "KRW",
    status: "PUBLISHED",
    assetId: "asset-test",
    entryFileName: "prop.glb",
    variantOf: null,
    licenseStatus: "cleared",
    byteLength: 1000,
    variants: [],
    clips: [],
  };
  const free = factsOfListing(
    { ...base, slug: "test-crate", title: "궤짝", description: "", facts: { triangles: 700 } },
    "https://clunk.games",
  );
  const paid = factsOfListing(
    { ...base, slug: "test-barn", title: "헛간", description: "", facts: { triangles: 5000 } },
    "https://clunk.games",
  );
  assert.equal(free.grade, "B");
  assert.equal(free.free, true);
  assert.match(free.access, /no sign-in|no key/i);
  assert.equal(paid.grade, "S");
  assert.equal(paid.free, false);
  assert.match(paid.access, /401|sign(ed)?-in/i);
  // 사람에게 넘길 주소와 파일 주소는 서로 다른 자리여야 합니다.
  assert.equal(free.downloadUrl, "https://clunk.games/api/marketplace/assets/asset-test?file=prop.glb");
  assert.equal(paid.productUrl, "https://clunk.games/marketplace/test-barn");
});

test("product capability facts keep HTTP and local stdio tool sets separate", () => {
  assert.deepEqual(MCP_HTTP_TOOL_NAMES, MCP_HTTP_TOOLS.map((item) => item.name));
  assert.equal(MCP_HTTP_TOOL_COUNT, MCP_HTTP_TOOLS.length);
  assert.equal(MCP_TOOLS.length, 7);
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
    endpoint: "https://clunk.games/api/mcp",
    apiKey: "clunk_live_test_key",
  };
  const guides = buildAgentGuides(connection);
  const byKey = new Map(guides.map((guide) => [guide.key, guide]));

  assert.match(byKey.get("claude-code")?.code ?? "", /https:\/\/clunk\.games\/api\/mcp/);
  assert.match(byKey.get("claude-code")?.code ?? "", /clunk_live_test_key/);
  assert.match(byKey.get("codex")?.code ?? "", /codex mcp add clunk --url/);
  assert.match(byKey.get("codex")?.code ?? "", /CLUNK_API_KEY/);
  assert.match(byKey.get("cursor")?.code ?? "", /type.*http/);
  assert.match(byKey.get("claude-desktop")?.code ?? "", /type.*http/);
  assert.match(byKey.get("vscode")?.code ?? "", /type.*http/);
  assert.match(byKey.get("github-copilot")?.code ?? "", /copilot mcp add --transport http/);
  assert.match(byKey.get("github-copilot")?.code ?? "", /Authorization/);
  assert.match(byKey.get("stdio")?.code ?? "", /npm\.cmd/);
  assert.match(byKey.get("stdio")?.code ?? "", /"run"/);
  // 도구를 늘렸을 때 이 숫자를 손으로 고치게 두면, 고치는 것을 잊은 만큼 안내가 틀립니다.
  assert.match(byKey.get("api")?.code ?? "", new RegExp(`${MCP_HTTP_TOOL_COUNT} remote-safe tools`));
  assert.ok(guides.filter((guide) => guide.key !== "stdio").every((guide) => !guide.code.includes("<CLUNK_ROOT>")));
});
