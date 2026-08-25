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
  assert.match(html, /clunk_inspect/);
  assert.match(html, /Clunk가 직접 운영하는 HTTP MCP/);
  assert.match(html, /Clunk 연결 키 만들기/);
  assert.match(html, /Authorization: Bearer/);
  assert.match(html, /POST \/mcp/);
  assert.match(html, /로컬 stdio/);
  assert.match(html, /키 발급 후 바로 연결/);
  assert.doesNotMatch(html, /Polyfork/);
});
