import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("marketplace catalog is API-only and gives buyers an honest empty state", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  assert.match(catalog, /fetch\("\/api\/marketplace"/u);
  assert.match(catalog, /Array\.isArray|listings\?\./u);
  assert.match(catalog, /PREVIEW NOT PROVIDED/u);
  assert.match(catalog, /PAYMENT_PROVIDER_NOT_CONFIGURED/u);
  assert.match(catalog, /href="\/app"/u);
  assert.doesNotMatch(catalog, /marketplace-sample-card|CONTRACT_FIXTURE|PROCEDURAL_AUTHORED/u);
  assert.doesNotMatch(catalog, /첫 상품 만들기|에셋 만들기|판매 등록|내 에셋도 만들기/u);
});

test("marketplace catalog defensively renders only published API rows with commerce fields", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  assert.match(catalog, /payload\.listings\.filter\(\(listing\) => listing\.status === ["']PUBLISHED["']\)/u);
  assert.match(catalog, /setListings\(publishedListings\)/u);
  // 2026-09-04: 카드가 파는 것이 낱개가 아니라 접근권이라 값을 찍던 자리가 사라졌다
  // (4c8bb6b). 다시 고정하는 것은 "카드가 상거래 사실을 말한다"는 요구 그대로이고,
  // 그 사실이 값에서 등급으로 바뀌었을 뿐이다 — 무료 등급인지 구독 전용인지.
  assert.match(catalog, /function isFreeTier/u, "app/components/MarketplaceCatalog.tsx: 등급으로 가르는 판정이 사라졌다");
  assert.match(catalog, /cardFree \? "무료" : "구독"/u, "app/components/MarketplaceCatalog.tsx: 카드 배지가 무료/구독을 말하지 않는다");
  assert.doesNotMatch(catalog, /formatPrice/u, "app/components/MarketplaceCatalog.tsx: 아무도 청구하지 않는 값을 카드에 되살리지 않는다");
  assert.match(catalog, /listing\.format|formatLabel\(listing\)/u);
  assert.match(catalog, /listing\.licenseStatus/u);
});

test("marketplace page describes the master-curated buyer model and exposes snap sections", async () => {
  const page = await source("app/marketplace/page.tsx");

  // 누가 만든 물건인지는 그대로 말한다. 다만 "구매"라는 말은 낱개로 파는 구조와 함께
  // 사라졌으므로(4c8bb6b), 이 자리는 지금 화면에 실제로 서 있는 문장으로 다시 고정한다.
  assert.match(page, /Clunk가 <b>직접 만든 에셋<\/b>/u);
  // 2026-09-04: 이 화면이 말하는 구매 모형이 바뀌었다. "크레딧으로 결제"가 아니라
  // "무료 등급은 로그인, 그 밖은 구독"이다. 낱개로 값을 매기는 말이 되살아나면 안 된다.
  assert.match(page, /무료 등급은 로그인만 하면 되고, 그 밖은 구독으로 열립니다/u);
  assert.doesNotMatch(page, /크레딧/u, "낱개로 파는 말이 마켓 화면에 남아 있으면 안 된다");
  assert.match(page, /data-snap-section="hero"/u);
  assert.match(page, /data-snap-section="catalog"/u);
  assert.match(page, /data-snap-section="use-clunk"/u);
  assert.doesNotMatch(page, /Create an asset|FOR CREATORS|판매 전 체크리스트|상품으로 닫는 순서|첫 상품/u);
});

test("listing detail keeps a user-facing recovery route for unknown slugs", async () => {
  const page = await source("app/marketplace/[slug]/page.tsx");

  assert.match(page, /MarketplaceListingDetail/u);
  assert.match(page, /data-snap-section="listing-detail"/u);
  assert.match(page, /존재하지|찾을 수 없|마켓으로 돌아가기|404/u);
});

test("listing detail names an unconfigured payment provider without seller CTAs", async () => {
  const page = await source("app/marketplace/[slug]/page.tsx");
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  // 2026-09-04: 결제 상태를 아는 것은 이 서버 화면이 아니라 /api/marketplace 를 읽는
  // 클라이언트다. 서버 페이지에서 상수가 사라진 것은 요구가 없어져서가 아니라 자리가
  // 옮겨진 것이므로, 옮겨 간 자리에 다시 못박는다.
  assert.match(catalog, /PAYMENT_PROVIDER_NOT_CONFIGURED/u, "app/components/MarketplaceCatalog.tsx: 결제 미설정 상태를 읽는 자리가 사라졌다");
  assert.match(page, /MarketplaceListingDetail/u);
  assert.match(catalog, /function MarketplaceListingDetail/u);
  // 상세도 값이 아니라 받을 수 있는지를 말한다.
  assert.match(catalog, /freeTier \? "무료" : "구독"/u, "app/components/MarketplaceCatalog.tsx: 상세가 값 대신 접근권을 말하지 않는다");
  assert.match(catalog, /구독하고 전체 받기/u, "app/components/MarketplaceCatalog.tsx: 구독으로 여는 버튼이 사라졌다");
  assert.match(catalog, /preview=1/u);
  assert.match(catalog, /listing\.status !== ["']PUBLISHED["']/u);
  assert.doesNotMatch(catalog, /에셋 만들기|판매 등록|내 에셋도 만들기/u);
  assert.match(page, /data-snap-section="detail-use"/u);
  assert.doesNotMatch(page, /에셋 만들기|판매 등록|내 에셋도 만들기/u);
});

test("public marketplace UI is aligned with the published listing and checkout contracts", async () => {
  const route = await source("app/api/marketplace/route.ts");
  const checkout = await source("app/api/marketplace/checkout/route.ts");
  const delivery = await source("app/api/marketplace/assets/[assetId]/route.ts");

  assert.match(route, /WHERE l\.status = 'PUBLISHED'/u);
  assert.match(route, /price_cents AS priceCents/u);
  assert.match(route, /license_status AS licenseStatus/u);
  assert.match(route, /previewFileName/u);
  assert.match(route, /status: 404/u);
  assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/u);
  assert.match(checkout, /clunk_marketplace_entitlements/u);
  // 2026-09-04: 유료 에셋의 문은 "이 에셋을 샀는가"가 아니라 "지금 구독 중인가"로
  // 열린다(da174bd). 거절 코드도 그 사실을 말하도록 바뀌었으므로 새 코드로 고정하고,
  // 낱개 구매를 전제하던 옛 코드가 되살아나지 않는지 함께 본다.
  const deliveryFile = "app/api/marketplace/assets/[assetId]/route.ts";
  assert.match(delivery, /SUBSCRIPTION_REQUIRED/u, `${deliveryFile}: 거절 코드가 구독을 말하지 않는다`);
  assert.doesNotMatch(delivery, /ENTITLEMENT_REQUIRED/u, `${deliveryFile}: 낱개 구매를 전제한 옛 코드가 되살아나면 안 된다`);
  assert.match(delivery, /getCatalogAccessForUser/u, `${deliveryFile}: 문을 여는 판정이 구독이 아니다`);
});
