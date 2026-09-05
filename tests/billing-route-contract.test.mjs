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
  // 2026-09-04: 크레딧을 파는 길을 없앴으므로 충전 창구를 가리키지 않는다. 실행 횟수는
  // 가입과 구독으로만 열린다.
  assert.doesNotMatch(credits, /\/api\/credits\/checkout/, "없앤 충전 창구를 아직 가리킵니다");
  assert.match(credits, /amount:\s*100/);
  assert.doesNotMatch(credits, /amount:\s*-/);
});

test("paid artifact delivery requires active entitlement while free listing delivery remains possible", async () => {
  // 등급·로그인·구독·베타 기록 판정은 2026-09-05 부터 app/api/_lib/market-gate.ts 에 있다 —
  // 라우트와 정적 경로의 문지기가 같은 함수를 부른다. 핀은 두 파일을 합쳐 본다.
  const route = [
    await source("app/api/marketplace/assets/[assetId]/route.ts"),
    await source("app/api/_lib/market-gate.ts"),
  ].join("\n");
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

/**
 * 베타에서 받은 것이 영구 소유가 되면 안 된다.
 *
 * 2026-09-04: 무료 계정이 구독자 전용 헬리콥터를 받았다. 문지기에는 구멍이 없었다 —
 * 무료 베타에서 "받기"를 누르면 marketplace/checkout 이 그 에셋에 ACTIVE 기록을
 * 하나 남기는데(provider 'beta', 0원), 문지기가 그것을 "값을 치른 사람"으로 읽었다.
 * 그대로 두면 구독을 여는 날 베타에 눌러 본 사람 전원이 그 유료 에셋을 영구 무료로
 * 갖는다. 실제로 마스터 계정에 그날 13:30 헬리콥터 기록이 남아 있었다.
 */
test("베타에서 눌러 생긴 기록은 판매가 열린 뒤 유료 에셋을 열지 않는다", async () => {
  // 등급·로그인·구독·베타 기록 판정은 2026-09-05 부터 app/api/_lib/market-gate.ts 에 있다 —
  // 라우트와 정적 경로의 문지기가 같은 함수를 부른다. 핀은 두 파일을 합쳐 본다.
  const route = [
    await source("app/api/marketplace/assets/[assetId]/route.ts"),
    await source("app/api/_lib/market-gate.ts"),
  ].join("\n");
  assert.match(route, /areSalesOpen/, "문지기가 지금 판매 중인지 알아야 베타 기록을 가릴 수 있다");
  assert.match(
    route,
    /clunk_marketplace_orders/,
    "기록이 베타 것인지 값을 치른 것인지는 주문의 provider 에만 남아 있다",
  );
  assert.match(
    route,
    /payment_provider <> 'beta'/,
    "베타 provider 를 걸러내지 않으면 0원 기록이 유료 에셋의 문을 연다",
  );

  // 베타 기록을 만드는 쪽도 그대로여야 짝이 맞는다.
  const checkout = await source("app/api/marketplace/checkout/route.ts");
  assert.match(checkout, /'beta'/, "베타 지급은 자기 provider 로 남아야 나중에 가려낼 수 있다");
  assert.match(checkout, /amount_cents.*0|0, \?\)/u, "베타 지급은 0원으로 남아야 한다");
});
