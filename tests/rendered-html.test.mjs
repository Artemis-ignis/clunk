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
  assert.match(html, /<title>게임 에셋 파운드리 \| Clunk<\/title>/i);
  assert.match(html, /단 하나의 AI 슈퍼앱/);
  assert.match(html, /게임 제작의 모든 과정을/);
  assert.match(html, /마켓 둘러보기/);
  assert.match(html, /무료로 시작하기/);
  assert.match(html, /목업이 아니라, 실제 제품 파일입니다/);
  assert.doesNotMatch(html, /DEMO MODE|실제 제작부터|에셋 만들기|CONTRACT_FIXTURE|SAMPLE/);
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
  for (const pathname of ["/pricing", "/docs", "/series"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /Clunk/);
    assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/);
  }
});

test("server-renders the Clunk Series catalog with source transparency", async () => {
  const response = await render("/series");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const name of ["Clunk Asset Forge", "Clunk Sprite Lab", "Clunk Material Lab", "Clunk Motion Lab", "Clunk Game Ready", "Clunk Market"]) {
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(html, /CLUNK SERIES/);
  assert.match(html, /clunk-series-native-v1/);
  assert.match(html, /gltf-transform/);
  assert.match(html, /MIT/);
  assert.match(html, /RESEARCH ONLY/);
  assert.match(html, /사용 제외/);
  assert.match(html, /\/studio/);
});

test("landing language covers the full 2D and 3D asset path", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /실측한 수치 그대로/);
  assert.match(html, /GAME-READY SCORE/i);
  assert.match(html, /MAKE &amp; SELL|MAKE & SELL/);
  assert.match(html, /INSPECT &amp; REPAIR|INSPECT & REPAIR/);
  assert.match(html, /GAME AGENT/);
  assert.match(html, /Sprite.*Atlas|Atlas.*Sprite/);
  assert.match(html, /Spine/);
  assert.match(html, /크레딧/);
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
  assert.match(html, /브라우저 WebMCP/);
  assert.match(html, /document\.modelContext/);
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
    // signin-with-chatgpt is a pure server redirect since 2026-08-31 — no anchors to contract.
    "../app/not-found.tsx",
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']next\/link["']/u, file);
    assert.match(source, /NativeLink/u, file);
  }
});
