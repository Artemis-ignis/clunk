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
  // 2026-08-31 master directive ("깃북으로 해서 페이지별로 나눠서 만들지"): /docs
  // is no longer one long scroll. The contract it froze is unchanged in spirit —
  // a persistent table of contents, a search, and the one-file-three-states
  // evidence visual — but each section is now its own route, so the assertions
  // follow the sections to their pages. Class names moved from the legacy
  // .docs-* rules (light cards in globals.css) to the cv5-native dv5-* set.
  const response = await render("/docs");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /dv5-layout/);
  assert.match(html, /dv5-sidebar/);
  assert.match(html, /문서 목차/);
  assert.match(html, /문서 검색/);
  assert.match(html, /빠른 시작/);
  assert.match(html, /클라이언트별 설정/);
  assert.match(html, /계약과 상태/);
  assert.match(html, /브라우저 WebMCP/);
  assert.match(html, /dv5-evidence/);
  assert.match(html, /ONE FILE · THREE STATES/);
  // the light legacy docs card must never float on the cv5 shell again
  assert.doesNotMatch(html, /docs-page-redesign|docs-hero-v2|sample-workbench/);

  for (const [pathname, marker] of [
    ["/docs/quickstart", /mcpServers/],
    ["/docs/clients", /claude mcp add --transport http/],
    ["/docs/cli", /clunk -- inspect/],
    ["/docs/asset-studio", /clunk-series-native-v1/],
    ["/docs/contracts", /clunk\.asset-inspection-evidence\.v2/],
    ["/docs/harvest-frontier", /clunk\.frame-comparison\.v1/],
    ["/docs/webmcp", /document\.modelContext/],
    ["/docs/scope", /지원 surface/],
  ]) {
    const page = await render(pathname);
    assert.equal(page.status, 200, pathname);
    const pageHtml = await page.text();
    assert.match(pageHtml, marker, pathname);
    assert.match(pageHtml, /dv5-sidebar/, pathname);
    assert.match(pageHtml, /dv5-pager/, pathname);
    assert.doesNotMatch(pageHtml, /docs-page-redesign|docs-hero-v2/, pathname);
  }
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
    // the docs manual renders every breadcrumb/pager link through this frame
    "../app/docs/DocsPageFrame.tsx",
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

  // The docs manual is many routes now, so contract the whole directory instead
  // of listing pages one by one: no docs page may reach for next/link.
  const { readdir } = await import("node:fs/promises");
  const docsDir = new URL("../app/docs/", import.meta.url);
  const docsFiles = (await readdir(docsDir, { recursive: true })).filter((name) => /\.tsx?$/.test(name));
  assert.ok(docsFiles.length >= 9, "docs should be split into per-topic pages");
  for (const name of docsFiles) {
    const source = await readFile(new URL(name.replaceAll("\\", "/"), docsDir), "utf8");
    assert.doesNotMatch(source, /from ["']next\/link["']/u, name);
  }
});
