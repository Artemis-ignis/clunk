import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("pricing explains real Clunk credit usage without invented price cards", async () => {
  const page = await source("app/pricing/page.tsx");

  assert.match(page, /getBillingStatus/);
  assert.match(page, /성공한 실행/);
  assert.match(page, /data-snap-section/);
  assert.match(page, new RegExp("/marketplace"));
  assert.match(page, new RegExp("/signup"));
  assert.doesNotMatch(page, /MONTHLY_PLANS|CREDIT_PACKS/);
  assert.doesNotMatch(page, /49,000|190,000|15,000|65,000|220,000|예정가/);
  assert.doesNotMatch(page, /실제 에셋 만들기|상품 만들기/);
});

test("login and signup render the real host OAuth journey and explain failures", async () => {
  for (const pathname of ["app/login/page.tsx", "app/signup/page.tsx"]) {
    const page = await source(pathname);
    assert.match(page, /getChatGPTUser/);
    assert.match(page, /chatGPTSignInPath/);
    assert.match(page, /getOAuthProviderStatuses/);
    assert.match(page, /auth_error/);
    assert.match(page, /safeOAuthReturnPath/);
    assert.match(page, /provider_denied|provider_exchange_failed|invalid_oauth_state/);
    assert.doesNotMatch(page, /AuthEntryCard/);
    assert.doesNotMatch(page, /DEMO MODE|비공개 파일럿/);
  }
});

test("missing public routes have public product guidance and a private workspace handoff", async () => {
  const kits = await source("app/kits/page.tsx");
  assert.match(kits, /SiteShell/);
  assert.match(kits, /KitsClient/);
  assert.match(kits, /view=workspace|workspace/);
  assert.match(kits, /hash-only|manifest/);
  assert.match(kits, /data-snap-section/);

  const series = await source("app/series/page.tsx");
  assert.match(series, /getClunkSeriesCatalog/);
  assert.match(series, /getClunkSourceManifest/);
  assert.match(series, /data-snap-section/);
  assert.match(series, /\/series/);

  const mcp = await source("app/mcp/page.tsx");
  assert.match(mcp, /path: "\/mcp"/);
  assert.match(mcp, /data-snap-section/);
  assert.match(mcp, /McpEndpointStatus/);

  const notFound = await source("app/not-found.tsx");
  for (const href of ["/marketplace", "/series", "/kits", "/mcp"]) {
    assert.match(notFound, new RegExp(href.replaceAll("/", "\\/")));
  }
  assert.match(notFound, /data-snap-section/);
});

test("all requested public route files remain present", async () => {
  for (const pathname of [
    "app/pricing/page.tsx",
    "app/login/page.tsx",
    "app/signup/page.tsx",
    "app/not-found.tsx",
    "app/kits/page.tsx",
    "app/series/page.tsx",
    "app/mcp/page.tsx",
  ]) {
    await access(new URL(pathname, root));
  }
});
