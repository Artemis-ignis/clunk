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
  // 카드는 지금 되는 일을 말해야 한다. 판매가 닫혀 있는 동안에는 유료 등급도 로그인만
  // 하면 받으므로 "구독자 전용" 이라고만 적으면 눌러 보는 순간 라벨이 거짓이 된다
  // (2026-09-04 마스터가 그 모순을 짚었다).
  assert.match(catalog, /cardFree \? "무료" : salesOpen \? "구독자 전용" : "지금은 무료"/u, "app/components/MarketplaceCatalog.tsx: 카드 배지가 지금 되는 일을 말하지 않는다");
  assert.doesNotMatch(catalog, /formatPrice/u, "app/components/MarketplaceCatalog.tsx: 아무도 청구하지 않는 값을 카드에 되살리지 않는다");
  assert.match(catalog, /listing\.format|formatLabel\(listing\)/u);
  assert.match(catalog, /listing\.licenseStatus/u);
});

test("marketplace page describes the master-curated buyer model and exposes snap sections", async () => {
  const page = await source("app/marketplace/page.tsx");

  // 누가 만든 물건인지는 그대로 말한다. 그 말이 서 있던 히어로 판은 격자를 첫 화면 밖으로
  // 밀어내고 있어 사라졌고, 같은 사실은 이 화면의 소개 문장이 그대로 갖고 있다.
  assert.match(page, /Clunk가 직접 만든/u, "app/marketplace/page.tsx: 누가 만든 물건인지 말하지 않는다");
  // 둘러보는 화면의 머리글은 세 줄이다 — 어디인지, 무엇을 하는 곳인지, 무엇을 보고 고르는지.
  assert.match(page, /<span className="cv5-eyebrow">에셋 마켓<\/span>/u);
  assert.match(page, /<h1>에셋 둘러보기<\/h1>/u);
  assert.match(page, /폴리곤 수와 용량은 파일에서 측정한 값입니다/u);
  // 키트는 이 목록의 탭이 아니라 자기 화면을 갖는다. 그 길이 화면에 있어야 한다.
  assert.match(page, /href="\/kits"/u, "app/marketplace/page.tsx: 키트로 가는 길이 없다");
  assert.doesNotMatch(page, /“키트” 탭|"키트" 탭/u, "없어진 탭을 가리키는 문장이 남아 있으면 안 된다");
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
  assert.match(catalog, /freeTier \? "무료" : beta \? "지금은 무료" : "구독자 전용"/u, "app/components/MarketplaceCatalog.tsx: 상세가 지금 되는 일을 말하지 않는다");
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
  // 2026-09-04: 낱개 가격을 없앴다. 이 검사는 예전에 가격 컬럼이 실려 오기를 요구했는데,
  // 지금 지켜야 하는 것은 그 반대다 — 아무도 청구하지 않는 값이 응답에 실리면 화면이
  // 다시 값을 말하기 시작한다.
  assert.doesNotMatch(route, /price_cents AS priceCents/u, "낱개 가격 컬럼이 카탈로그 응답에 돌아왔습니다");
  assert.match(route, /license_status AS licenseStatus/u);
  assert.match(route, /previewFileName/u);
  assert.match(route, /status: 404/u);
  assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/u);
  assert.match(checkout, /clunk_marketplace_entitlements/u);
  // 2026-09-04: 유료 에셋의 문은 "이 에셋을 샀는가"가 아니라 "지금 구독 중인가"로
  // 열린다(da174bd). 거절 코드도 그 사실을 말하도록 바뀌었으므로 새 코드로 고정하고,
  // 낱개 구매를 전제하던 옛 코드가 되살아나지 않는지 함께 본다.
  // 2026-09-05: 이 판정이 라우트에서 app/api/_lib/market-gate.ts 로 옮겨갔다. 같은 바이트가
  // 놓인 정적 경로(/market/<slug>/<file>)에도 문을 세우면서, 문이 둘로 갈라져 한쪽만
  // 고쳐지는 일을 막으려고 판정을 한 함수에 모았다. 그래서 문지기 파일을 본다.
  const gateFile = "app/api/_lib/market-gate.ts";
  const gate = await source(gateFile);
  assert.match(gate, /SUBSCRIPTION_REQUIRED/u, `${gateFile}: 거절 코드가 구독을 말하지 않는다`);
  assert.doesNotMatch(gate, /ENTITLEMENT_REQUIRED/u, `${gateFile}: 낱개 구매를 전제한 옛 코드가 되살아나면 안 된다`);
  assert.match(gate, /getCatalogAccessForUser/u, `${gateFile}: 문을 여는 판정이 구독이 아니다`);
  const deliveryFile = "app/api/marketplace/assets/[assetId]/route.ts";
  assert.match(delivery, /authorizeMarketDownload\(/u, `${deliveryFile}: 내려받기 라우트가 그 문지기를 부르지 않는다`);
});

/* ---------------------------------------------------------------------------
   키트 — 계약은 docs/kits.md, 계산의 계약은 tests/catalog-facts-contract.test.mjs.
   여기서는 화면이 그 계산을 실제로 쓰고 있는지만 본다.
   ------------------------------------------------------------------------- */

test("the shop sells kits as a unit: a theme, a chip on the part, and a way back from a part", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  // 2026-09-05: 키트는 목록의 탭이 아니라 자기 화면(/kits, /kit/<id>)을 갖는다. 목록에
  // 남은 것은 둘이다 — 테마로 좁혀 보는 자리, 그리고 부품 카드에서 그 한 벌로 가는 길.
  assert.doesNotMatch(catalog, /\{ id: "kit", label: "키트" \}/u, "없어진 키트 탭이 목록에 되살아났다");
  assert.match(catalog, /title="테마"/u, "목록을 테마로 좁혀 볼 자리가 없다");
  assert.match(catalog, /className=\{styles\.cardKitChip\}/u, "부품 카드에 그 한 벌로 가는 길이 없다");
  assert.match(catalog, /legacyKitTarget/u, "옛 키트 주소를 새 화면으로 보내지 않는다");

  // 부품에서 키트로 돌아가는 길. 부품 한 장을 보고 "나머지는 어디 있나"를 묻게 두면 안 된다.
  assert.match(catalog, /이 키트의 일부/u, "부품 상세가 어느 키트의 것인지 말하지 않는다");
  assert.match(catalog, /키트로 돌아가기/u, "부품 상세에서 키트로 돌아가는 길이 없다");
  assert.match(catalog, /function KitParts/u, "키트 상세에 부품 격자가 없다");
  assert.match(catalog, /이 키트에 들어 있는 부품/u);
  assert.match(catalog, /같은 키트의 다른 부품/u);
});

test("kit membership is read from the listing's own facts, never from a slug prefix", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  const facts = await source("app/components/catalog-facts.ts");

  assert.match(catalog, /kitsFrom|kitOfPart|kitOfProduct/u, "화면이 키트 계산을 쓰지 않는다");
  // 접두사로 묶으면 상품 이름을 바꾸는 순간 키트가 흩어진다. 근거는 facts 뿐이다.
  for (const prefix of ["village-", "dock-", "mine-", "kit-village", "kit-fishing", "kit-mine"]) {
    assert.doesNotMatch(catalog, new RegExp(prefix, "u"), `화면이 ${prefix} 접두사로 키트를 알아보려 한다`);
    assert.doesNotMatch(facts, new RegExp(prefix, "u"), `계산이 ${prefix} 접두사로 키트를 알아보려 한다`);
  }
  // 부품 수는 늘 목록에서 찾아낸 공개 부품의 수다. facts 의 kitSize 는 빌드 매니페스트가
  // 센 값이라 공개를 내린 부품까지 세고 있다(docs/kits.md 3절).
  assert.match(catalog, /count: partKit\.parts\.length/u, "부품 수를 목록에서 다시 세지 않는다");
});

test("an empty result tells the visitor what to do next instead of describing our API", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  assert.match(catalog, /조건 지우고 전체 보기/u, "찾은 것이 없을 때 누를 것이 없다");
  assert.doesNotMatch(catalog, /API가 반환한 listing만 표시됩니다/u, "우리 사정을 방문자에게 설명하지 않는다");
  assert.match(catalog, /지금 받을 수 있는 에셋이 없습니다/u);
  // 낱개로 사고파는 말은 이 화면에서 사라졌다(4c8bb6b).
  assert.doesNotMatch(catalog, /구매 가능한 공개 에셋/u);
});

test("the kit contract is written down where the kit agents can read it", async () => {
  const doc = await source("docs/kits.md");

  for (const slug of ["kit-village-square", "kit-fishing-dock", "kit-mine-entrance"]) {
    assert.match(doc, new RegExp(slug, "u"), `계약 문서에 ${slug} 가 없다`);
  }
  assert.match(doc, /public\/market\/<slug>\/<file>\.glb/u, "파일 자리 규칙이 없다");
  assert.match(doc, /hero-<slug>\.png/u);
  assert.match(doc, /preview-<slug>\.webp/u);
  assert.match(doc, /가장 높은 부품 등급/u, "키트 등급 규칙이 없다");
  assert.match(doc, /kitSize/u, "kitSize 가 무엇을 세는 값인지 적혀 있지 않다");
});
