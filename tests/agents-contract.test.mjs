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
  // 2026-09-05: 이 핀은 이미 어느 파일에도 없는 문장을 찾고 있었다("Clunk가 직접 운영하는
  // HTTP MCP"). 지켜야 할 것은 그 글자가 아니라 "이 연결을 남에게 맡기지 않고 Clunk가
  // 직접 운영한다"는 사실이므로, 화면이 지금 그것을 말하는 두 자리로 옮긴다.
  assert.match(html, /Clunk가 직접 운영하는 연결 서버/);
  assert.match(clientSource, /Clunk가 운영하는 연결/);
  // 2026-09-05: 한 화면이 같은 두 가지를 두 벌의 말로 부르고 있어서 화면의 말로 통일했다
  // ("웹으로 바로 쓰는 도구" / "내 컴퓨터에서 쓰는 도구"). 기술 용어는 괄호로 한 번만 남는다.
  assert.match(html, /웹으로 바로 쓰는 도구 <!-- -->\d+<!-- -->개/);
  assert.match(html, /로컬 stdio/);
  assert.match(clientSource, /Clunk 연결 키 만들기/);
  assert.match(clientSource, /const \[endpoint, setEndpoint\] = useState\("\/api\/mcp"\)/);
  assert.match(clientSource, /fetch\(endpoint, \{[\s\S]*method: "POST"/);
  // 2026-09-05: AgentsClient 의 이 한 줄이 "키 발급 후 바로 연결" → "키를 만들면 바로
  // 연결됩니다" 로 다듬어졌다. 지켜야 할 것은 "키가 있어야 연결이 산다"를 이 카드가
  // 말한다는 것이므로 문구만 따라 옮긴다.
  assert.match(clientSource, /키를 만들면 바로 연결됩니다/);
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

/**
 * 발급된 평문 키가 화면에 그대로 서 있으면 안 된다.
 *
 * 2026-09-05 점검에서 발급 직후의 키가 마스킹 없이 `<code>` 에, 그리고
 * `claude mcp add … --header "Authorization: Bearer clunk_live_…"` 스니펫 안에 통째로
 * 렌더되고 있었다. 화면 공유·녹화·스크린샷에 그대로 남는 자리다. 복사 버튼은 실제 키를
 * 복사하고, 화면은 가린 판을 그린다 — 그 갈라짐이 유지되는지 본다.
 */
test("발급된 연결 키는 화면에서 가려지고, 복사만 실제 값을 쓴다", async () => {
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  const guideSource = await readFile(new URL("../app/components/agent-guides.ts", import.meta.url), "utf8");

  assert.match(clientSource, /function maskApiKey\(/u, "가리는 함수가 없다");
  assert.match(
    clientSource,
    /keyRevealed \? issuedSecret : maskApiKey\(issuedSecret\)/u,
    "발급 패널이 기본으로 평문 키를 그리고 있다",
  );
  assert.doesNotMatch(
    clientSource,
    /<code>\{issuedSecret\}<\/code>/u,
    "발급된 키가 아직 마스킹 없이 렌더된다",
  );
  assert.match(clientSource, /<CopyCodeButton value=\{issuedSecret\}/u, "복사 버튼은 실제 키를 써야 한다");
  assert.match(clientSource, /selected\.displayCode/u, "스니펫이 화면용 판을 쓰지 않는다");
  assert.match(guideSource, /maskedApiKey/u, "가이드가 가린 키를 받지 않는다");
  assert.match(guideSource, /displayCode/u, "가이드가 화면용 판을 내놓지 않는다");
});

/** 다운로드 폴더는 백업·동기화가 지나가는 자리다. 평문 키를 떨구지 않는다. */
test("설정 다운로드에는 평문 키가 들어가지 않는다", async () => {
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  const download = clientSource.slice(
    clientSource.indexOf("function downloadSelectedGuide"),
    clientSource.indexOf("async function revokeKey"),
  );
  assert.ok(download.length > 100, "다운로드 함수를 못 찾았다");
  assert.doesNotMatch(download, /selected\.code/u, "다운로드가 실제 키가 든 판을 쓴다");
  assert.match(download, /CLUNK_API_KEY/u, "다운로드 파일이 환경변수 자리를 남기지 않는다");
});

/** 훔쳐간 키가 쓰이고 있는지 사람이 알아볼 수 있는 유일한 자리. */
test("발급된 키 목록은 마지막 사용 시각을 보여 준다", async () => {
  const clientSource = await readFile(new URL("../app/agents/AgentsClient.tsx", import.meta.url), "utf8");
  assert.match(clientSource, /key\.lastUsedAt/u, "목록이 lastUsedAt 을 받아 놓고 버리고 있다");
});
