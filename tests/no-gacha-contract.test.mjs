import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/**
 * 가챠는 화면 어디에도 없다.
 *
 * 2026-09-02 부터 이틀 동안 첫 화면은 캡슐 자판기였다. 레버를 당기면 유리 돔 안의 캡슐이
 * 튀어 오르고, 무작위로 하나가 배출구에 떨어지고, 등급 색 링이 감긴 알을 눌러 열면 안에서
 * 상품이 나왔다. 국내 결제대행(페이에이드) 심사는 그 화면을 사행성으로 보고 서비스 이용을
 * 거절했고, 사업주의 지시는 한 줄이었다 — "애초에 저거 가챠 머신 없애야할듯 저거 때문에
 * 사행성처럼 보인다고 들었음".
 *
 * 그래서 tests/gacha-contract.test.mjs (29건, 기계가 어떻게 굴러가야 하는지를 못박던 계약)은
 * 지워진 것이 아니라 뒤집혔다. 요구가 사라진 자리를 비워 두면 다음 사람이 같은 것을 다시
 * 세운다. 여기서 못박는 것은 그 반대다: **뽑는 화면도, 뽑는 도구도, 뽑는 말도 없다.**
 *
 * 남긴 것 하나 — 등급(S/A/B/C)이다. 등급은 확률이 아니라 크기와 동작을 보고 매기는 분류라
 * 판매·당첨과 무관하고, 마켓 카드가 그대로 쓴다(app/components/catalog-facts.ts,
 * tests/catalog-facts-contract.test.mjs). 무엇을 받을 수 있는지는 등급이 아니라 접근권
 * (무료 등급 / 구독)이 정한다.
 */

/** 기계가 살던 자리. 하나도 돌아오면 안 된다. */
const REMOVED_PATHS = [
  "app/components/gacha",
  "app/components/gacha/GachaMachine3D.tsx",
  "app/components/gacha/CapsuleMachine.tsx",
  "app/components/gacha/PrizeCard.tsx",
  "app/components/gacha/GachaPoster.tsx",
  "app/components/gacha/gacha-catalog.ts",
  "app/components/gacha/gacha-scene.ts",
  "app/components/gacha/gacha-sound.ts",
  "app/components/gacha/gacha.css",
  "app/components/gacha/useGachaWebMcp.ts",
  "app/gacha-theme.css",
  "public/gacha",
  "tests/gacha-contract.test.mjs",
];

/**
 * 화면에 적히는 말만 남긴다: 블록 주석과 줄 주석을 걷어낸다(URL 의 `//` 는 건드리지 않는다).
 * 왜 없앴는지 적어 둔 주석까지 막으면 다음 사람이 까닭을 모른 채 되살린다 —
 * tests/legal-and-signout-contract.test.mjs 의 용어집 핀과 같은 방식이다.
 */
function screenText(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gu, "$1");
}

async function exists(path) {
  try {
    await stat(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

/** app/ 아래 모든 소스 파일. node_modules 와 빌드 산출물은 보지 않는다. */
async function walk(dir, out = []) {
  for (const entry of await readdir(new URL(`${dir}/`, root), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path, out);
    else if (/\.(?:tsx?|mjs|css)$/u.test(entry.name)) out.push(path);
  }
  return out;
}

test("캡슐 자판기의 파일은 하나도 남아 있지 않다", async () => {
  for (const path of REMOVED_PATHS) {
    assert.equal(await exists(path), false, `${path} 이(가) 되살아났습니다 — 캡슐 자판기는 심사에서 사행성으로 거절된 화면입니다`);
  }
});

test("첫 화면은 뽑는 기계가 아니라 마켓 카탈로그다", async () => {
  const page = await source("app/page.tsx");
  // 기계를 불러오던 두 줄. 둘 다 없어야 한다.
  assert.doesNotMatch(page, /GachaMachine3D|CapsuleMachine|gacha\.css/u, "app/page.tsx: 캡슐 자판기가 첫 화면으로 돌아왔습니다");
  // 그 자리에 서 있어야 하는 것 — 지어낸 목록이 아니라 살아 있는 카탈로그다.
  assert.match(page, /LandingMarketShowcase/u, "app/page.tsx: 첫 화면에 마켓 카탈로그가 없습니다");
  const showcase = await source("app/components/LandingMarketShowcase.tsx");
  assert.match(showcase, /fetch\("\/api\/marketplace"/u, "app/components/LandingMarketShowcase.tsx: 카탈로그를 실제로 읽지 않습니다");
  assert.match(showcase, /marketplace\/\$\{encodeURIComponent\(listing\.slug\)\}/u, "app/components/LandingMarketShowcase.tsx: 카드가 자기 상품 화면으로 가지 않습니다");
});

test("어느 화면도 뽑기·캡슐·확률의 말을 쓰지 않는다", async () => {
  const files = await walk("app");
  const banned = [
    [/가챠|뽑기|뽑으세요|뽑아 ?보|자판기|캡슐/u, "뽑기의 말"],
    [/당첨|꽝|희귀도|레어도/u, "당첨의 말"],
    [/확률\s*[\d.]+\s*%|[\d.]+\s*% *확률/u, "확률 표기"],
  ];
  for (const file of files) {
    const text = screenText(await source(file));
    for (const [pattern, what] of banned) {
      const hit = text.match(pattern);
      assert.equal(hit, null, `${file} 에 ${what}이(가) 남아 있습니다: ${hit?.[0]}`);
    }
  }
});

test("어느 화면도 무엇을 보여 줄지 무작위로 고르지 않는다", async () => {
  // 기계는 crypto.getRandomValues 로 자루에서 하나를 골랐다(옛 gacha-catalog.randomIndex).
  // 상점은 고르지 않는다 — 사람이 고른다. 첫 화면과 카탈로그에는 난수 자체가 없어야 하고,
  // 어느 화면에서도 난수가 목록을 고르거나 섞는 자리에 들어가면 안 된다.
  //
  // 난수 자체를 전부 막지는 않는다. 체크아웃 멱등키·타자 연출·OAuth 논스는 무엇을
  // 보여 줄지 정하지 않으므로 이 계약의 대상이 아니다.
  for (const file of ["app/page.tsx", "app/components/LandingMarketShowcase.tsx"]) {
    const text = screenText(await source(file));
    assert.doesNotMatch(text, /getRandomValues|Math\.random/u, `${file} 에서 첫 화면이 스스로 무작위로 고르고 있습니다`);
  }
  for (const file of await walk("app")) {
    const text = screenText(await source(file));
    assert.doesNotMatch(
      text,
      /(?:Math\.random\(\)|getRandomValues\([^)]*\)).{0,60}(?:\.length|listings|pool|bag|catalog)/u,
      `${file} 에서 난수가 목록에서 하나를 고르고 있습니다`,
    );
    assert.doesNotMatch(
      text,
      /\.sort\([^)]{0,60}(?:Math\.random|getRandomValues)/u,
      `${file} 에서 목록을 무작위로 섞고 있습니다`,
    );
  }
});

test("등급은 남되, 캡슐로도 확률로도 그려지지 않는다", async () => {
  // 등급은 크기와 동작을 보고 매기는 분류이므로 남는다.
  const facts = await source("app/components/catalog-facts.ts");
  assert.match(facts, /export function gradeOf/u, "app/components/catalog-facts.ts: 등급 규칙이 사라졌습니다");
  assert.doesNotMatch(facts, /randomIndex|drawFrom|gradeOddsOf|domeCapsules|formatOdds/u, "app/components/catalog-facts.ts: 뽑기 계산이 함께 옮겨 왔습니다");
  // 등급 배지는 위·아래 반구와 이음선을 가진 알이 아니라 납작한 칩이다.
  const css = await source("app/marketplace/marketplace.module.css");
  const badge = css.slice(css.indexOf(".gradeBadge {"), css.indexOf('.gradeBadge[data-grade="S"]'));
  assert.doesNotMatch(badge, /border-radius:\s*50%/u, "app/marketplace/marketplace.module.css: 등급 배지가 다시 알 모양입니다");
  assert.doesNotMatch(badge, /47%|48%|53%|54%/u, "app/marketplace/marketplace.module.css: 등급 배지에 캡슐 이음선이 돌아왔습니다");
  assert.doesNotMatch(css, /data-grade="C"/u, "app/marketplace/marketplace.module.css: 없앤 C 등급 칠이 남아 있습니다");
});
