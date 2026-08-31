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

  assert.match(page, /마스터가 만든|구매/u);
  assert.match(page, /크레딧/u);
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
