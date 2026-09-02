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
  // 2026-09-01: "파운드리" is our word for the pipeline, not one a buyer searches for,
  // and this title is what a shared link shows. The contract is that the landing titles
  // itself in Korean with the brand, not that it uses one particular phrase.
  assert.match(html, /<title>[^<]*게임 에셋[^<]*\| Clunk<\/title>/i);
  assert.doesNotMatch(html, /파운드리|Foundry/i);
  assert.match(html, /단 하나의 AI 슈퍼앱/);
  // 2026-09-02: the first viewport is one capsule machine — the operator's own picture
  // of the product ("들어가자마자 자판기가 나와서 레버 당기라고 되어 있고 … 게임 속
  // 캐릭터 뽑히면 나오는 가챠 연출처럼"). The headline says what to do, the line under it
  // says what happens, and the machine explains the brand's name where the capsule lands.
  // The old four-cabinet hall ("자판기 홀", "마켓에 올라와 있는 에셋") went with it.
  // 2026-09-02 (2): the headline reads like a game's own UI — short and big — and the
  // handle is one you pull, not one you turn.
  assert.match(html, /게임 에셋 <em>뽑기<\/em>/);
  assert.match(html, /레버를 당기면 마켓의 에셋이 캡슐로 떨어집니다/);
  // The machine is already standing in the server's first paint: the canvas host and the
  // lever's own line ship in the HTML, and nothing says the machine is still filling up.
  assert.match(html, /gc3-canvas/);
  assert.match(html, /레버를 당기세요/);
  assert.doesNotMatch(html, /머신에 캡슐을 채우는 중/);
  assert.doesNotMatch(html, /손잡이를 돌리/);
  assert.match(html, /게임 에셋 검사 및 수정/);
  assert.match(html, /게임 제작 에이전트/);
  assert.doesNotMatch(html, /자판기 홀|마켓에 올라와 있는 에셋</);
  assert.doesNotMatch(html, /DEMO MODE|실제 제작부터|에셋 만들기|CONTRACT_FIXTURE|SAMPLE/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("inspector explains that policy score is not player-facing approval", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(
    new URL("../app/components/ClunkInspector.tsx", import.meta.url),
    "utf8",
  ));
  // 2026-09-01: the inspector says this in Korean now instead of naming the
  // internal lanes. The boundary itself is unchanged.
  assert.match(source, /파일 규격 점수/);
  assert.match(source, /게임 화면/);
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
  // 2026-09-02: the page names what each series makes, not an internal brand.
  for (const name of ["3D 모델 만들기", "스프라이트 시트 만들기", "2D 이미지 만들기", "애니메이션 클립 만들기"]) {
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(html, /Clunk 내부 시리즈/);
  assert.match(html, /gltf-transform/);
  assert.match(html, /MIT/);
  assert.match(html, /사용 제외/);
  assert.match(html, /\/studio/);
});

test("landing language covers the full 2D and 3D asset path", async () => {
  const response = await render("/");
  const html = await response.text();
  // 2026-09-01: the landing stopped defending its own numbers and now tells the
  // reader what the number is for. The contract follows the fact, not the slogan.
  // 2026-09-02 (2): the long hero paragraph became a machine's own name plate. The
  // contract is still that the landing names all three kinds it actually sells.
  assert.match(html, /3D 모델 · 스프라이트 시트 · 이어붙는 텍스처/);
  assert.match(html, /게임 적합도/);
  // 2026-09-01: the three section labels are Korean now — the Korean reference
  // sites the master gave (meshy.ai/ko, aetherforgeai.com/ko) use no English
  // eyebrows at all.
  assert.match(html, /에셋 제작/);
  assert.match(html, /검사와 수정/);
  assert.match(html, /제작 에이전트/);
  assert.match(html, /스프라이트 시트[\s\S]*본 애니메이션/); // 2026-09-02: named in Korean
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
