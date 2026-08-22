import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
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

test("responses carry the security headers the worker promises", async () => {
  const response = await render();
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  // The GLB preview instantiates the meshopt decoder as WebAssembly; without this the 3D
  // preview silently fails on any browser that enforces the policy.
  assert.match(csp, /script-src[^;]*'wasm-unsafe-eval'/);
  // 업로드한 GLB는 blob: URL로만 로더에 전달된다. connect-src에서 blob:을 빼면 텍스처가
  // 있는 에셋은 미리보기가 통째로 비고, 콘솔에만 조용히 찍힌다. 실제로 그렇게 됐었다.
  assert.match(csp, /connect-src[^;]*blob:/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=\d+/);
});

test("the page loads no subresource from another origin", async () => {
  // connect-src, font-src, img-src and script-src are all limited to 'self'. Anything pulled
  // from a third-party host would be blocked at runtime, so catch it here instead of in a
  // browser console after deploy. Absolute URLs in metadata (og:image, canonical) are fine —
  // they are not fetched as subresources.
  const html = await (await render()).text();
  const subresources = [
    ...html.matchAll(/<script[^>]+src="([^"]+)"/gi),
    ...html.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/gi),
    ...html.matchAll(/<img[^>]+src="([^"]+)"/gi),
  ]
    .map((match) => match[1])
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => !url.startsWith("http://localhost"));

  assert.deepEqual(
    subresources,
    [],
    `외부 오리진 서브리소스가 CSP에 막힙니다: ${subresources.join(", ")}`,
  );
});

test("protected surfaces stay closed to an unauthenticated request", async () => {
  // The auth entry point moved behind a provider abstraction. A regression here would not
  // throw or fail to build — it would quietly serve someone else's workspace, so the boundary
  // is asserted against the built worker rather than trusted.
  for (const pathname of ["/app", "/dashboard", "/settings", "/passport"]) {
    const response = await render(pathname);
    assert.equal(response.status, 307, `${pathname} must redirect a signed-out visitor`);
    assert.match(
      response.headers.get("location") ?? "",
      /\/signin-with-chatgpt\?return_to=/,
      `${pathname} must send the visitor to sign in`,
    );
  }
});

test("the worker strips identity headers from an untrusted host", async () => {
  // Authentication is derived from request headers alone, so any origin that reaches the
  // worker directly could otherwise hand-write a login for any account.
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-trust`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const forged = new Request("https://untrusted.example/app", {
    headers: {
      accept: "text/html",
      "oai-authenticated-user-id": "victim-user",
      "oai-authenticated-user-email": "victim@example.test",
    },
  });
  const response = await worker.fetch(forged, env, ctx);
  assert.equal(response.status, 307, "a forged identity header must not authenticate");
  assert.match(response.headers.get("location") ?? "", /\/signin-with-chatgpt/);
});

test("the worker survives a runtime with no bindings", async () => {
  // The plain Node production server calls the worker without any Cloudflare bindings, so
  // `env` arrives undefined. Reading a variable straight off it turned every single request
  // into a 500 — the site was completely down and nothing in the build said so.
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-noenv`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    undefined,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200, "a missing binding object must not break page rendering");
});

test("스타일시트가 존재하지 않는 토큰을 참조하지 않는다", async () => {
  // 정의되지 않은 커스텀 프로퍼티는 오류를 내지 않고 그냥 무시된다. --sp-10처럼 없는
  // 이름을 쓰면 간격이 조용히 0이 되고, 빌드도 린트도 통과한다. 실제로 --ls-tight와
  // --fs-0이 그렇게 살아 있었다.
  const css = await readFile("app/globals.css", "utf8");
  const defined = new Set([...css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]));
  // 폰트 로더와 인라인 style 속성이 런타임에 넣어 주는 값들.
  const injected = new Set([
    "--font-geist-sans",
    "--font-geist-mono",
    "--orbit-r",
    "--orbit-dur",
    "--orbit-delay",
  ]);
  const missing = [...new Set([...css.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((match) => match[1]))].filter(
    (name) => !defined.has(name) && !injected.has(name),
  );
  assert.deepEqual(missing, [], `정의되지 않은 CSS 토큰: ${missing.join(", ")}`);
});
