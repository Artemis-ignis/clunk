import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  const guideSource = await readFile(new URL("../app/components/agent-guides.ts", import.meta.url), "utf8");
  assert.match(html, /Claude Code/);
  assert.match(html, /Claude Desktop/);
  assert.match(html, /VS Code/);
  assert.match(html, /GitHub Copilot/);
  assert.match(html, /clunk_asset_inspect/); // the HTTP tool the page lists; clunk_inspect is the local stdio tool (2026-09-02)
  assert.match(html, /Clunk가 직접 운영하는 HTTP MCP/);
  assert.match(html, /HTTP 원격 도구\s*<!-- -->\d+<!-- -->개/);
  assert.match(html, /로컬 stdio 도구/);
  assert.match(clientSource, /Clunk 연결 키 만들기/);
  assert.match(clientSource, /const \[endpoint, setEndpoint\] = useState\("\/api\/mcp"\)/);
  assert.match(clientSource, /fetch\(endpoint, \{[\s\S]*method: "POST"/);
  assert.match(clientSource, /키 발급 후 바로 연결/);
  assert.match(guideSource, /Authorization: Bearer/);
  assert.match(guideSource, /로컬 stdio/);
  assert.doesNotMatch(html, /Polyfork/);
});

test("server-renders an actionable setup journey instead of a text wall", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /agent-journey/);
  // 2026-09-03: 번호는 왼쪽 칸(01~04)만 붙입니다. 제목에도 "1." 이 있어 "01 1. 키 발급"으로
  // 읽히던 것을 걷어냈습니다. 네 단계가 순서대로 다 있는지는 그대로 확인합니다.
  assert.match(html, /<span>01<\/span><strong>키 발급<\/strong>/);
  assert.match(html, /<span>02<\/span><strong>클라이언트 선택<\/strong>/);
  assert.match(html, /<span>03<\/span><strong>설정 복사<\/strong>/);
  assert.match(html, /<span>04<\/span><strong>연결 확인<\/strong>/);
  assert.match(html, /agent-tab-purpose/);
  assert.match(html, /선택한 클라이언트/);
  assert.match(html, /로그인 후 키 발급/);
});

test("setup links preserve a real login return path", async () => {
  const pageSource = await readFile(new URL("../app/agents/page.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  const guideSource = await readFile(new URL("../app/components/agent-guides.ts", import.meta.url), "utf8");
  assert.match(pageSource, /href="#connect"/);
  assert.match(clientSource, /\/signup\?return_to=%2Fagents%3Fintent%3Dagents%23connect/);
  assert.match(clientSource, /connectionState !== "ready"/);
  assert.match(guideSource, /codex mcp add clunk --url/);
  assert.match(guideSource, /--bearer-token-env-var CLUNK_API_KEY/);
  assert.match(guideSource, /copilot mcp add --transport http/);
});

test("the connection surface exposes live endpoint status and a real MCP handshake", async () => {
  const pageSource = await readFile(new URL("../app/agents/page.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  const statusSource = await readFile(new URL("../app/components/McpEndpointStatus.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /McpEndpointStatus/);
  assert.match(clientSource, /initialize/);
  assert.match(clientSource, /tools\/list/);
  assert.match(clientSource, /agent-handshake-card/);
  assert.match(statusSource, /fetch\("\/api\/mcp"/);
  assert.match(statusSource, /LIVE MCP STATUS/);
});
