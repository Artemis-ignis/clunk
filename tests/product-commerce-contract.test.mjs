import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("product contract keeps creation, evidence, license, and publication as separate gates", async () => {
  const contract = await import("../packages/core/src/product-contract.ts");
  assert.equal(contract.canPublishListing({
    artifactStored: true,
    provenanceComplete: true,
    licenseStatus: "cleared",
    staticStatus: "PASS",
    visualRuntime: "PASS",
    playerFacing: "PASS",
    humanDecision: "PASS",
  }), true);
  assert.equal(contract.canPublishListing({
    artifactStored: true,
    provenanceComplete: true,
    licenseStatus: "cleared",
    staticStatus: "PASS",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
  }), false);
  assert.equal(contract.readinessLabel({
    staticStatus: "PASS",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
  }), "EVIDENCE_INCOMPLETE");
});

test("creation and marketplace API surfaces exist and never imply a local path upload", async () => {
  await access(new URL("app/api/generation/route.ts", root));
  await access(new URL("app/api/reviews/route.ts", root));
  await access(new URL("app/api/marketplace/route.ts", root));
  await access(new URL("app/api/marketplace/checkout/route.ts", root));
  const generation = await source("app/api/generation/route.ts");
  const reviews = await source("app/api/reviews/route.ts");
  const marketplace = await source("app/api/marketplace/route.ts");
  const checkout = await source("app/api/marketplace/checkout/route.ts");
  const optimizations = await source("app/api/optimizations/route.ts");
  assert.match(generation, /clunk\.asset-generation-result\.v1/);
  assert.match(generation, /sha256/);
  assert.match(generation, /provenance/);
  assert.match(generation, /reserveCreditOperation/);
  assert.match(generation, /confirmCreditOperation/);
  assert.match(generation, /refundCreditOperation/);
  assert.match(generation, /idempotency-key|idempotencyKey/);
  assert.match(generation, /STORAGE_NOT_CONFIGURED/);
  assert.doesNotMatch(generation, /localPath|readFile|node:fs/);
  assert.match(reviews, /captureSha256/);
  assert.match(reviews, /humanDecision/);
  assert.doesNotMatch(reviews, /readFile|node:fs/);
  assert.match(marketplace, /PUBLISHED/);
  assert.match(marketplace, /license/);
  assert.match(marketplace, /artifact/);
  assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(checkout, /clunk_marketplace_orders/);
  assert.match(checkout, /idempot/);
  assert.match(checkout, /createCheckout/);
  assert.match(optimizations, /applyCreditOperation/);
  assert.match(optimizations, /key: `optimize:/);
  assert.match(optimizations, /amount: -1/);
});

test("the public product surfaces expose creation, library, review, and marketplace actions", async () => {
  const nav = await source("app/components/SiteNav.tsx");
  const studio = await source("app/studio/StudioClient.tsx");
  const landing = await source("app/page.tsx");
  const marketplace = await source("app/marketplace/page.tsx");
  const hosting = JSON.parse(await source(".openai/hosting.json"));
  await access(new URL("public/samples/product-sprite/clunk-sprite-sample.png", root));
  assert.equal(hosting.r2, "ASSETS");
  assert.match(nav, /marketplace/);
  // 2026-09-01: the studio page used to print its own API paths on screen.
  // Users never needed to read those, so the wiring is contracted where it
  // actually lives — in the component that calls them.
  const facts = await source("app/components/product-facts.ts");
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  assert.match(facts, new RegExp("api/generation"));
  assert.match(workbench, new RegExp("api/reviews"));
  // 2026-09-01: the surface says 만들기 now — the reference sites label the
  // action, not the pipeline stage. The contract follows the word the user reads.
  assert.match(studio, /만들기|생성|prompt/i);
  assert.match(landing, /실제 제작|마켓|판매/);
  // 2026-09-05: 마켓 첫 문장은 사용 조건(상업적으로 쓸 수 있고)과 받기를 말한다 — "라이선스" 라는 낱말은 더 이상 쓰지 않는다.
  assert.match(marketplace, /상업적으로 쓸 수 있고|받으세요|다운로드/);
});

test("paid marketplace artifacts never ship as public previews", async () => {
  // 2026-09-05: 이 판정이 라우트에서 app/api/_lib/market-gate.ts 로 옮겨갔다. 정적 경로
  // (/market/<slug>/<file>)에도 같은 문을 세우면서, 문이 둘로 갈라져 한쪽만 고쳐지는 일을
  // 막으려고 판정을 한 함수에 모았다. 라우트는 그 함수를 부르기만 한다.
  const gate = await source("app/api/_lib/market-gate.ts");
  assert.match(gate, /paid \? artifactRole === "preview" : true/);
  assert.doesNotMatch(gate, /artifactRole === "page" \|\| artifactRole === "texture"/);
  const route = await source("app/api/marketplace/assets/[assetId]/route.ts");
  assert.match(route, /authorizeMarketDownload\(/);
});

test("the billing boundary converts zero-decimal currencies exactly once", async () => {
  const billing = await source("app/api/marketplace/billing.ts");
  assert.match(billing, /ZERO_DECIMAL_CURRENCIES/);
  assert.match(billing, /toProviderAmount\(input\.amountCents, input\.currency\)/);
  assert.match(billing, /fromProviderAmount\(providerAmount, currency\)/);
  assert.doesNotMatch(billing, /unit_amount\]": String\(input\.amountCents\)/);
});

test("paid checkout requires an explicit withdrawal-waiver consent before any order exists", async () => {
  const marketplaceCheckout = await source("app/api/marketplace/checkout/route.ts");
  assert.match(marketplaceCheckout, /withdrawalConsent \!== true/);
  assert.match(marketplaceCheckout, /WITHDRAWAL_CONSENT_REQUIRED/);
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /withdrawalConsent/);
  assert.match(catalog, /청약철회가 제한/);
  // 2026-09-04: 낱개 구매 단추 둘이 사라져 문지기가 선 자리가 바뀌었다.
  //
  // 전에는 크레딧 결제 단추와 카드 결제 단추가 각각 disabled 식에 !withdrawalConsent 를
  // 달고 있었다. 낱개 판매를 없애면서 그 두 단추가 지워졌고, 구독 전용 상품에 남은 것은
  // 요금 화면으로 가는 링크뿐이다. 그러므로 동의 문지기는 이제 단추의 disabled 가 아니라
  // 요청을 보내는 자리(startCheckout)와 서버 라우트에 선다. 핀을 푸는 것이 아니라
  // 문지기가 실제로 서 있는 자리에 다시 박는다 — 낱개 구매 길이 되살아나는 것도 함께 막는다.
  assert.doesNotMatch(catalog, /creditPrice/u, "낱개 크레딧 가격이 되살아나 있으면 안 된다");
  assert.doesNotMatch(
    catalog,
    /disabled=\{buying \|\| !withdrawalConsent/u,
    "사라진 낱개 구매 단추가 되살아나 있으면 안 된다",
  );
  assert.match(
    catalog,
    /if \(paymentMethod !== "beta" && !freeTier && !withdrawalConsent\) \{\s*setMessage\("결제를 시작하려면 청약철회 제한 동의가 필요합니다\."\);\s*return;/u,
    "동의 없이 유료 결제를 보내지 않는 문지기가 없습니다",
  );
  // The server-side consent check runs before the credits branch can settle.
  const checkoutSource = await source("app/api/marketplace/checkout/route.ts");
  const consentIndex = checkoutSource.indexOf("WITHDRAWAL_CONSENT_REQUIRED");
  const creditsIndex = checkoutSource.indexOf('paymentMethod === "credits"');
  assert.ok(consentIndex > 0 && creditsIndex > consentIndex, "credits settlement must sit behind the consent gate");
});
