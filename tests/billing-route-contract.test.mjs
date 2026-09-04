import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("checkout route creates only configured provider sessions from a published listing", async () => {
  await access(new URL("app/api/marketplace/billing.ts", root));
  await access(new URL("app/api/marketplace/webhook/route.ts", root));
  const checkout = await source("app/api/marketplace/checkout/route.ts");
  const webhook = await source("app/api/marketplace/webhook/route.ts");
  assert.match(checkout, /requireClunkContext/);
  assert.match(checkout, /PUBLISHED/);
  assert.match(checkout, /price_cents|amountCents/);
  assert.match(checkout, /seller|owner_user_id|buyer/i);
  assert.match(checkout, /idempot|pending/i);
  assert.match(checkout, /createCheckout/);
  assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(checkout, /INSERT OR IGNORE/);
  assert.doesNotMatch(checkout, /INSERT OR REPLACE INTO clunk_marketplace_orders/);
  assert.match(webhook, /verifyWebhook/);
  assert.match(webhook, /clunk_marketplace_orders/);
  assert.match(webhook, /clunk_marketplace_entitlements/);
  assert.match(webhook, /PAID|REFUNDED|CANCELED/);
  assert.match(webhook, /amount|currency/);
});

test("generation stores artifacts in R2 before D1 confirmation and never trusts request metadata", async () => {
  const generation = await source("app/api/generation/route.ts");
  const storageProof = generation.indexOf("storageStatus = await verifyStorageEvidence");
  const confirmation = generation.indexOf("const confirmation = await confirmCreditOperation");
  assert.ok(storageProof >= 0, "generation must use storage evidence");
  assert.ok(confirmation > storageProof, "credit confirmation must follow storage evidence");
  assert.match(generation, /getRuntimeAssets/);
  assert.match(generation, /bucket\.put/);
  assert.match(generation, /Promise\.allSettled/);
  assert.match(generation, /storageStatus = await verifyStorageEvidence/);
  assert.match(generation, /persistenceStatements/);
  assert.match(generation, /STORED/);
  assert.match(generation, /INSERT OR IGNORE INTO clunk_assets/);
  assert.match(generation, /INSERT OR IGNORE INTO clunk_asset_artifacts/);
  assert.match(generation, /INSERT OR IGNORE INTO clunk_generation_jobs/);
  assert.match(generation, /WHERE EXISTS \([\s\S]*clunk_credit_operations[\s\S]*status = 'applied'/);
  assert.doesNotMatch(generation, /storageAvailable/);
  assert.doesNotMatch(generation, /payload\.(artifactStored|storageAvailable)/);
  assert.match(generation, /refundCreditOperation/);
  assert.match(generation, /clunk_credit_operations[\s\S]*status = 'applied'/);
});

test("credits route exposes only the explicit demo grant and cannot debit arbitrary requests", async () => {
  const credits = await source("app/api/credits/route.ts");
  assert.match(credits, /applyCreditOperation/);
  assert.match(credits, /simulate-upgrade/);
  assert.match(credits, /CLUNK_ENABLE_DEV_CREDIT_GRANT/);
  assert.match(credits, /410/);
  assert.match(credits, /\/api\/credits\/checkout/);
  assert.match(credits, /amount:\s*100/);
  assert.doesNotMatch(credits, /amount:\s*-/);
});

test("paid artifact delivery requires active entitlement while free listing delivery remains possible", async () => {
  const route = await source("app/api/marketplace/assets/[assetId]/route.ts");
  assert.match(route, /getCurrentUser|requireUser/);
  // 2026-09-04: 낱개 가격이 사라졌으므로 문지기는 값이 아니라 등급을 본다.
  assert.match(route, /isFreeGrade\(gradeOf\(/, "문지기가 등급 규칙을 불러야 한다");
  assert.doesNotMatch(route, /price_cents|access_tier/, "아무도 청구하지 않는 값이나 어긋날 수 있는 컬럼으로 가르면 안 된다");
  assert.match(route, /clunk_marketplace_entitlements/);
  assert.match(route, /ACTIVE/);
  assert.match(route, /401|403|PAYMENT/);
  assert.match(route, /preview/);
  assert.match(route, /getRuntimeAssets\(\)\.get/);
  assert.doesNotMatch(route, /artifactStored|storageAvailable/);
  assert.match(route, /private, no-store/);
});
