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
  assert.match(catalog, /formatPrice\(listing\.priceCents, listing\.currency\)/u);
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

  assert.match(page, /PAYMENT_PROVIDER_NOT_CONFIGURED|결제 미설정/u);
  assert.match(page, /MarketplaceListingDetail/u);
  assert.match(catalog, /function MarketplaceListingDetail/u);
  assert.match(catalog, /listing\.priceCents.*\/ 100|priceCents, listing\.currency/u);
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
  assert.match(delivery, /ENTITLEMENT_REQUIRED/u);
});
