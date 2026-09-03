import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("credit packs ship DRAFT with no invented price and a public honest catalogue", async () => {
  const lib = await source("app/api/_lib/clunk.ts");
  assert.match(lib, /clunk_credit_packs/);
  assert.match(lib, /clunk_credit_orders/);
  assert.match(lib, /'pack-starter', 'Starter', 500, 0, 'KRW', 'DRAFT'/);
  assert.match(lib, /'pack-studio', 'Studio', 2000, 0, 'KRW', 'DRAFT'/);
  assert.match(lib, /'pack-foundry', 'Foundry', 6000, 0, 'KRW', 'DRAFT'/);

  await access(path.join(root, "app", "api", "credits", "packs", "route.ts"));
  const packs = await source("app/api/credits/packs/route.ts");
  // 2026-09-01: the pre-launch sales lock gates purchasability too. Three
  // "(QA 임시가)" packs had reached the public pricing page with real prices and
  // working buy buttons while the mail-order filing was still pending.
  assert.match(packs, /purchasable: salesOpen && pack\.status === "ACTIVE" && Number\(pack\.priceCents\) > 0/);
  assert.match(packs, /areSalesOpen/);
});

test("credit checkout mirrors the marketplace order state machine", async () => {
  await access(path.join(root, "app", "api", "credits", "checkout", "route.ts"));
  const checkout = await source("app/api/credits/checkout/route.ts");
  assert.match(checkout, /assertSameOrigin/);
  assert.match(checkout, /requireClunkContext/);
  assert.match(checkout, /readIdempotencyKey/);
  assert.match(checkout, /PACK_NOT_PURCHASABLE/);
  assert.match(checkout, /status !== "ACTIVE" \|\| Number\(pack\.priceCents\) <= 0/);
  assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(checkout, /scopedStorageId\("credit-order"/);
  assert.match(checkout, /INSERT OR IGNORE INTO clunk_credit_orders/);
  assert.match(checkout, /'CREATING'/);
  assert.match(checkout, /credit-pack:\$\{pack\.id\}/);
  assert.doesNotMatch(checkout, /fake|pretend/i);
});

test("the provider webhook grants pack credits idempotently and never claws back silently", async () => {
  const webhook = await source("app/api/marketplace/webhook/route.ts");
  assert.match(webhook, /readCreditOrder/);
  assert.match(webhook, /validateEventAgainstCreditOrder/);
  assert.match(webhook, /applyCreditOperation/);
  assert.match(webhook, /key: `credit-order:\$\{order\.id\}`/);
  assert.match(webhook, /kind: "pack-purchase"/);
  assert.match(webhook, /status = 'applied'/);
  assert.match(webhook, /CREDIT_CLAWBACK_MANUAL_REVIEW/);
});

test("the demo self-grant is gated off outside explicit local smoke runs", async () => {
  const credits = await source("app/api/credits/route.ts");
  assert.match(credits, /CLUNK_ENABLE_DEV_CREDIT_GRANT/);
  assert.match(credits, /410/);
  const files = await import("node:fs/promises").then(({ readdir }) => readdir(path.join(root, "app", "components")));
  assert.equal(files.includes("DemoUpgradeButton.tsx"), false, "the dead demo upgrade component must stay deleted");
});

test("the pricing surface renders pack state from the API and never invents a price", async () => {
  const panel = await source("app/components/CreditPacksPanel.tsx");
  assert.match(panel, /\/api\/credits\/packs/);
  assert.match(panel, /가격 확정 전/);
  assert.match(panel, /withdrawalConsent: consent/);
  assert.doesNotMatch(panel, /₩\s?\d|\d+,\d+원/);
  // 2026-09-02, free beta: the page no longer renders the pack panel — three cards with no
  // price and no button read as a shop that had crashed. It states the PLANNED prices
  // instead, labelled as such, and every grant figure is imported from the module that
  // enforces it rather than typed on the page.
  const pricing = await source("app/pricing/page.tsx");
  assert.doesNotMatch(pricing, /CreditPacksPanel/, "요금 페이지는 팩 패널을 그리지 않는다");
  assert.match(pricing, /SIGNUP_GRANT_CREDITS/);
  assert.match(pricing, /BETA_MONTHLY_GRANT_CREDITS/);
  assert.match(pricing, /WORKSPACE_IMAGES_PER_DAY/);
  assert.doesNotMatch(pricing, /충전하기|구매하기/, "결제가 없는 동안 살 수 있는 것처럼 보이는 버튼이 없어야 한다");
  // 2026-09-03(마스터 결정): 결제 자체가 없으므로 "베타"라는 말을 이 화면에서 쓰지 않는다.
  assert.doesNotMatch(pricing, /베타/u, "요금 화면에 베타 표현이 남아 있으면 안 된다");
  assert.doesNotMatch(pricing, /예정가|DEMO/u, "옛 예정가·DEMO 잔재가 남아 있으면 안 된다");
  // 용어집: 화면에는 "면"과 "그리기 횟수"로 적는다.
  assert.doesNotMatch(pricing, /삼각형|드로우콜/, "내부 용어가 요금 화면에 남아 있으면 안 된다");
  // 2026-09-02: the gloss after the number was removed at the operator's request.
  assert.match(pricing, /폴리곤 수, 재질 수/);

  // 구독 카드의 값은 계획 문서가 기록한 숫자 그대로이고, 페이지의 PLANS 한 곳에서만 나온다.
  const plan = await source("docs/free-beta-plan.ko.md");
  for (const figure of ["₩9,900/월", "₩29,000/월"]) {
    assert.ok(plan.includes(figure), `계획 문서에 ${figure} 이 없다`);
  }
  assert.match(pricing, /priceKrw: 9_900,\s*annualKrw: 99_000/);
  assert.match(pricing, /priceKrw: 29_000,\s*annualKrw: 290_000/);

  // 크레딧 팩 3종은 D1 정의(clunk_credit_packs)와 같은 id·크레딧 수를 쓰고, price_cents 가
  // 0(=미정)이므로 화면에는 값을 지어내지 않고 "가격 미정" + 비활성 버튼으로 둔다.
  for (const [id, credits] of [["pack-starter", "500"], ["pack-studio", "2_000"], ["pack-foundry", "6_000"]]) {
    assert.ok(
      pricing.includes(`id: "${id}", name:`) && pricing.includes(`credits: ${credits}, priceKrw: null`),
      `페이지의 팩 ${id} 가 D1 정의와 다르다`,
    );
  }
  assert.match(pricing, /가격 미정/);
  assert.match(pricing, /결제 준비 중/);
});
