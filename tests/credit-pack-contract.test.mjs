import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const gone = async (relativePath) => {
  try {
    await access(path.join(root, relativePath));
    return false;
  } catch {
    return true;
  }
};

/**
 * 크레딧을 파는 길이 없다.
 *
 * 2026-09-04 마스터 지시: "크레딧이랑 이전 사행성 느낌나는거 한개당 얼마에 파는거 이런건
 * 확실하게 빼두고 무료/유료 이 두개로만 놔둬라". 결제대행 심사가 크레딧을 환금성으로 보고
 * 반려한 것도 같은 이유다.
 *
 * 화면에서 단추를 지우는 것으로는 부족하다. /api/credits/packs 는 아무 화면도 부르지
 * 않는데 라이브에서 200 을 돌려주며 크레딧 팩 세 개와 "1개 100원"을 공표하고 있었다.
 * 심사하는 사람은 화면이 아니라 주소를 연다.
 */
test("크레딧을 파는 경로가 없다", async () => {
  assert.ok(await gone("app/api/credits/packs/route.ts"), "크레딧 팩 목록이 되살아났습니다");
  assert.ok(await gone("app/api/credits/checkout/route.ts"), "크레딧 결제가 되살아났습니다");

  const index = await source("app/api/route.ts");
  assert.doesNotMatch(index, /credits\/packs/, "API 안내가 아직 크레딧 팩을 가리킵니다");
  const unmatched = await source("app/api/[...unmatched]/route.ts");
  assert.doesNotMatch(unmatched, /credits\/packs/, "없는 주소 안내가 아직 크레딧 팩을 가리킵니다");
});

/**
 * 크레딧에 값이 붙어 나가지 않는다.
 *
 * 값을 한 번 적어 두면 그 숫자가 곧 가격이 되고, 우리가 파는 것은 기간제 구독 하나뿐이다.
 * 남은 실행 횟수는 몇 번 쓸 수 있는지일 뿐 얼마어치가 아니다.
 */
test("공개 응답이 크레딧 값을 말하지 않는다", async () => {
  const accessBlock = await source("app/api/_lib/access.ts");
  assert.doesNotMatch(accessBlock, /credit_price_krw/, "크레딧 단가가 공개 응답에 남아 있습니다");
  assert.doesNotMatch(accessBlock, /CREDIT_KRW/, "크레딧 단가 상수가 남아 있습니다");
  assert.match(accessBlock, /runs_remaining/, "남은 실행 횟수를 말하지 않습니다");
});

/**
 * 에셋에 낱개 값이 붙어 나가지 않는다.
 *
 * 무료/유료 두 갈래이고 유료는 구독으로 열린다. 목록 응답이 priceCents 를 실어 보내면
 * 그 값이 아무도 청구하지 않는 가격으로 화면과 검색엔진에 흘러간다 — 2026-09-04 라이브
 * 목록이 ₩12,900 을 그렇게 내보내고 있었다.
 */
test("마켓 응답이 낱개 가격을 싣지 않는다", async () => {
  const route = await source("app/api/marketplace/route.ts");
  assert.doesNotMatch(route, /price_cents AS priceCents/, "목록 SQL 이 아직 낱개 가격을 꺼냅니다");
  assert.doesNotMatch(route, /priceCents: row\.priceCents/, "목록 응답이 아직 낱개 가격을 싣습니다");
  assert.doesNotMatch(route, /payload\.priceCents/, "상품을 만드는 입구가 아직 값을 받습니다");

  for (const file of ["app/components/MarketplaceCatalog.tsx", "app/components/LandingMarketShowcase.tsx"]) {
    const text = await source(file);
    assert.doesNotMatch(text, /priceCents/, `${file} 에 낱개 가격이 남아 있습니다`);
  }
  const webmcp = await source("app/webmcp/useProductWebMcp.ts");
  assert.doesNotMatch(webmcp, /priceWon/, "에이전트에게 낱개 가격을 넘기고 있습니다");
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
  const files = await readdir(path.join(root, "app", "components"));
  assert.equal(files.includes("DemoUpgradeButton.tsx"), false, "the dead demo upgrade component must stay deleted");
});
