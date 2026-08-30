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
  assert.match(packs, /purchasable: pack\.status === "ACTIVE" && Number\(pack\.priceCents\) > 0/);
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
  const pricing = await source("app/pricing/page.tsx");
  assert.match(pricing, /CreditPacksPanel/);
  assert.match(pricing, /pricing-packs/);
});
