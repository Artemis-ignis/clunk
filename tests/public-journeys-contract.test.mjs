import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("pricing explains real Clunk credit usage without invented price cards", async () => {
  const page = await source("app/pricing/page.tsx");

  // 2026-09-03: the page reads the pre-launch sales lock (app/api/_lib/sales-lock.ts),
  // which is the gate that actually decides whether a purchase can complete on this
  // deployment. getBillingStatus is the provider-config probe the footer uses.
  assert.match(page, /areSalesOpen/);
  assert.match(page, /성공한 실행/);
  assert.match(page, /data-snap-section/);
  assert.match(page, new RegExp("/marketplace"));
  // 2026-09-03: the sign-up door is built by the validated helper (app/auth.ts signUpPath),
  // not typed as a literal, so the return path cannot drift off-site.
  assert.match(page, /signUpPath\("\/studio\?intent=create"\)/);
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

test("bundles sends signed-out visitors to the marketplace and signed-in visitors to their workspace", async () => {
  // 2026-09-05: /kits became the public kit index, so the workspace 묶음 feature moved to
  // /bundles. That route still has exactly two doors — the workspace list behind sign-in,
  // and a one-paragraph intro for signed-in visitors — and no public product page at all.
  // The public kit surfaces are pinned in tests/kits-pages.test.mjs.
  const kits = await source("app/bundles/page.tsx");
  assert.match(kits, /WorkspaceShell/);
  assert.match(kits, /KitsClient/);
  assert.match(kits, /params\.view === "workspace"/);
  assert.match(kits, /requireChatGPTUser\("\/bundles\?view=workspace"\)/);
  assert.match(kits, /if \(!user\) redirect\("\/marketplace"\)/);
  assert.match(kits, /href="\/bundles\?view=workspace"/);
  assert.match(kits, /href="\/dashboard"/);
  assert.doesNotMatch(kits, /SiteShell/);
  // The old marketing markup is only allowed to survive in the explanatory comment.
  assert.doesNotMatch(kits, />NO PUBLIC KIT LISTINGS<|data-snap-section|className="kits-contract/);

  const series = await source("app/series/page.tsx");
  assert.match(series, /getClunkSeriesCatalog/);
  assert.match(series, /getClunkSourceManifest/);
  assert.match(series, /data-snap-section/);
  assert.match(series, /\/series/);

  // 2026-09-02: /mcp duplicated /agents, so it is a bare redirect and the live
  // endpoint status is rendered in exactly one place — /agents.
  const mcp = await source("app/mcp/page.tsx");
  assert.match(mcp, /redirect\("\/agents"\)/);
  assert.doesNotMatch(mcp, /<McpEndpointStatus|data-snap-section/);
  const agents = await source("app/agents/page.tsx");
  assert.match(agents, /<McpEndpointStatus/);

  // The 404 page points at the surfaces that still exist as pages; /mcp is a
  // redirect now, so it must not be advertised there.
  const notFound = await source("app/not-found.tsx");
  for (const href of ["/", "/marketplace", "/app", "/review", "/agents", "/pricing"]) {
    assert.match(notFound, new RegExp(`href="${href.replaceAll("/", "\/")}"`));
  }
  assert.doesNotMatch(notFound, /href="\/mcp"/);
});

test("all requested public route files remain present", async () => {
  for (const pathname of [
    "app/pricing/page.tsx",
    "app/login/page.tsx",
    "app/signup/page.tsx",
    "app/not-found.tsx",
    "app/kits/page.tsx",
    "app/kit/[slug]/page.tsx",
    "app/bundles/page.tsx",
    "app/series/page.tsx",
    "app/mcp/page.tsx",
  ]) {
    await access(new URL(pathname, root));
  }
});
