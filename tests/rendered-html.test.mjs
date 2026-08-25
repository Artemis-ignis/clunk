import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Clunk landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>모든 에셋을 근거 있게 \| Clunk<\/title>/i);
  assert.match(html, /모든 에셋을/);
  assert.match(html, /검사기 열기/);
  // The agent integration section must render the real MCP tool names and the real rule set id
  // that packages/core declares, so the landing page cannot drift into invented marketing facts.
  assert.match(html, /clunk_inspect/);
  assert.match(html, /clunk_passport/);
  assert.match(html, /clunk-game-ready-v1/);
  assert.match(html, /llms\.txt/);
  assert.match(html, /STATIC POLICY SCORE/);
  assert.match(html, /2D + 3D 에셋 품질·근거 게이트/);
  assert.match(html, /visualRuntime.*NOT_EVALUATED|NOT_EVALUATED.*visualRuntime/i);
  assert.doesNotMatch(html, /GAME-READY SCORE/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("inspector explains that policy score is not player-facing approval", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(
    new URL("../app/components/ClunkInspector.tsx", import.meta.url),
    "utf8",
  ));
  assert.match(source, /정적 정책 점수/);
  assert.match(source, /player-facing/);
  assert.match(source, /NOT_EVALUATED/);
});

test("server-renders public product routes", async () => {
  for (const pathname of ["/pricing", "/docs"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /Clunk/);
    assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/);
  }
});

test("landing language covers the full 2D and 3D asset path", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /에이전트가 만든 에셋을/);
  assert.match(html, /게임에 넣기 전에 판정합니다/);
  assert.match(html, /파일 하나가 근거 있는/);
  assert.match(html, /결과가 되는 과정/);
  assert.match(html, /Sprite.*Atlas|Atlas.*Sprite/);
  assert.match(html, /Spine/);
});

test("docs expose a navigable GitBook-style information architecture", async () => {
  const response = await render("/docs");
  const html = await response.text();
  assert.match(html, /docs-layout/);
  assert.match(html, /docs-sidebar/);
  assert.match(html, /문서 목차/);
  assert.match(html, /빠른 시작/);
  assert.match(html, /클라이언트별 설정/);
  assert.match(html, /계약과 상태/);
  assert.match(html, /문서 검색/);
  assert.match(html, /docs-evidence-visual/);
  assert.match(html, /ONE FILE · THREE STATES/);
});

test("public navigation uses browser-native anchors on the Sites runtime", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    "../app/page.tsx",
    "../app/components/SiteNav.tsx",
    "../app/components/AuthEntryCard.tsx",
    "../app/components/DashboardClient.tsx",
    "../app/components/WorkspaceShell.tsx",
    "../app/docs/page.tsx",
    "../app/pricing/page.tsx",
    "../app/components/PassportClient.tsx",
    "../app/components/SiteShell.tsx",
    "../app/components/LandingHero.tsx",
    "../app/components/HeroAutopsy.tsx",
    "../app/settings/page.tsx",
    "../app/signin-with-chatgpt/page.tsx",
    "../app/not-found.tsx",
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']next\/link["']/u, file);
    assert.match(source, /NativeLink/u, file);
  }
});
