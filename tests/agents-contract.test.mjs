import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/agents") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the client connection guide", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Claude Code/);
  assert.match(html, /Claude Desktop/);
  assert.match(html, /VS Code/);
  assert.match(html, /npm\.cmd run --silent mcp/);
  assert.match(html, /npm stdout/);
  assert.match(html, /\.cursor\/mcp\.json/);
  assert.match(html, /cursor-agent mcp list/);
  assert.match(html, /clunk_inspect/);
  assert.match(html, /공개 HTTP MCP는 아직 제공하지 않습니다/);
  assert.match(html, /복사/);
});
