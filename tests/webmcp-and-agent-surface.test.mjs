import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("registers the public WebMCP contract without upgrading visual evidence", async () => {
  const bridge = await source("app/components/WebMcpBridge.tsx");
  const layout = await source("app/layout.tsx");

  await access(new URL("../app/components/WebMcpBridge.tsx", import.meta.url));
  assert.match(layout, /WebMcpBridge/);
  assert.match(bridge, /document[\s\S]*modelContext/);
  assert.match(bridge, /navigator\.modelContext|navigator[\s\S]*modelContext/);
  assert.match(bridge, /registerTool/);
  assert.match(bridge, /clunk_connection_check/);
  assert.match(bridge, /clunk_product_capabilities/);
  assert.match(bridge, /visualRuntime.*GAP|GAP.*visualRuntime/);
  assert.match(bridge, /playerFacing.*NOT_EVALUATED|NOT_EVALUATED.*playerFacing/);
  assert.doesNotMatch(bridge, /clunk_optimize/);
});

test("landing MCP setup is an actual accessible client switcher", async () => {
  const component = await source("app/components/LandingMcpDemo.tsx");
  const page = await source("app/page.tsx");
  const guideSource = await source("app/components/agent-guides.ts");

  await access(new URL("../app/components/LandingMcpDemo.tsx", import.meta.url));
  assert.match(page, /LandingMcpDemo/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tab"/);
  assert.match(component, /aria-selected/);
  assert.match(component, /navigator\.clipboard\.writeText/);
  assert.match(component, /복사됨/);
  assert.match(guideSource, /Claude Code/);
  assert.match(guideSource, /Codex/);
  assert.match(guideSource, /VS Code/);
  assert.match(component, /api.*mcp/);
});

test("the public MCP status card exposes a live WebMCP state", async () => {
  const sourceText = await source("app/components/McpEndpointStatus.tsx");
  assert.match(sourceText, /WEBMCP/);
  assert.match(sourceText, /data-webmcp-status/);
  assert.match(sourceText, /dataset\.webmcpStatus/);
  assert.match(sourceText, /syncTimer/);
  // 2026-09-02: the card used to print JSON-RPC method names (initialize, tools/list) to
  // visitors. It now says in Korean what the address can do; the method names belong
  // in the agent guide, not on a status card.
  assert.match(sourceText, /카탈로그를 읽고[\s\S]*검사/);
  assert.doesNotMatch(sourceText, /<code>[^<]*(initialize|tools\/list)[^<]*<\/code>/);
});
