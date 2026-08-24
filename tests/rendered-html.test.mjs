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
