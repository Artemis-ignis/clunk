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
  assert.match(html, /마켓에 올라와 있는 에셋/);
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
  for (const pathname of ["/pricing", "/series"]) {
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
  // 2026-09-01: the landing stopped defending its own numbers and now tells the
  // reader what the number is for. The contract follows the fact, not the slogan.
  assert.match(html, /농장·마을 배경에 바로 쓰는 저폴리 모델/);
  assert.match(html, /게임 적합도/);
  // 2026-09-01: the three section labels are Korean now — the Korean reference
  // sites the master gave (meshy.ai/ko, aetherforgeai.com/ko) use no English
  // eyebrows at all.
  assert.match(html, /에셋 제작/);
  assert.match(html, /검사와 수정/);
  assert.match(html, /제작 에이전트/);
  assert.match(html, /Sprite.*Atlas|Atlas.*Sprite/);
  assert.match(html, /Spine/);
  assert.match(html, /크레딧/);
});

test("public navigation uses browser-native anchors on the Sites runtime", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    "../app/page.tsx",
    "../app/components/SiteNav.tsx",
    "../app/components/AuthEntryCard.tsx",
    "../app/components/DashboardClient.tsx",
    "../app/components/WorkspaceShell.tsx",
    "../app/pricing/page.tsx",
    "../app/components/PassportClient.tsx",
    // SiteShell renders SiteNav + SiteFooter since 2026-09-01 and owns no anchors
    // of its own; the footer it delegates to is contracted here instead.
    "../app/components/SiteFooter.tsx",
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

test("the docs surface redirects to the published GitBook manual", async () => {
  // 2026-09-01 master directive ("① GitBook으로 리다이렉트"): the in-app manual
  // was replaced by a real GitBook site, so every former /docs route is now a
  // permanent cross-domain redirect. The pages themselves are contracted from
  // docs/gitbook/*.md, which mirrors the published site byte-for-byte.
  const base = "https://clunk.gitbook.io/docs";
  for (const [pathname, target] of [
    ["/docs", `${base}/`],
    ["/docs/quickstart", `${base}/quickstart`],
    ["/docs/clients", `${base}/clients`],
    ["/docs/cli", `${base}/cli-ci`],
    ["/docs/asset-studio", `${base}/asset-studio`],
    ["/docs/contracts", `${base}/contracts`],
    ["/docs/harvest-frontier", `${base}/harvest-frontier`],
    ["/docs/webmcp", `${base}/webmcp`],
    ["/docs/scope", `${base}/scope`],
    // anything else under the old manual lands on the GitBook home rather than a 404
    ["/docs/does-not-exist", `${base}/`],
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 308, pathname);
    assert.equal(response.headers.get("location"), target, pathname);
  }
});
