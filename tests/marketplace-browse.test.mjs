import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * 에셋 마켓 = 둘러보는 화면 (2026-09-05).
 *
 * 이 화면은 한 가지 일을 한다: 지금 받을 수 있는 에셋을 훑고 좁히는 것. 그래서 여기서
 * 지키는 것도 그 일에 관한 것뿐이다 —
 *
 *   1. 머리글이 화면을 한 판 쓰지 않는다(격자가 첫 화면 안에 선다).
 *   2. 거르는 자리가 왼쪽에 있고, 그 자리에 적히는 수는 격자와 같은 계산에서 나온다.
 *   3. 키트는 목록의 탭이 아니라 자기 화면을 갖고, 옛 주소는 그리로 옮겨 간다.
 *   4. 값을 말하지 않는다(파는 것은 낱개가 아니라 접근권이다).
 *
 * 화면에 실제로 서 있는 수는 브라우저에서 확인한다. 여기서 고정하는 것은 그 수가 나오는
 * 자리다 — 자리가 사라지면 수는 조용히 틀린 값이 된다.
 */

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/** 화면 문구만 남긴다: 블록 주석과 줄 주석을 걷어낸다(URL 의 `//` 는 건드리지 않는다). */
function screenText(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gu, "$1");
}

test("둘러보는 화면의 머리글은 세 줄이고, 그 아래는 곧바로 목록이다", async () => {
  const page = await source("app/marketplace/page.tsx");

  assert.match(page, /<span className="cv5-eyebrow">에셋 마켓<\/span>/u);
  assert.match(page, /<h1>에셋 둘러보기<\/h1>/u);
  assert.match(page, /폴리곤 수와 용량은 파일을 열어 측정한 값입니다/u);

  // 진열장 그림 한 장과 원칙 네 줄이 격자를 화면 밖으로 밀어내고 있었다. 그 둘이 돌아오면
  // 같은 일이 다시 일어난다.
  assert.doesNotMatch(page, /시장 노점/u, "히어로 진열 판이 돌아왔다 — 격자가 첫 화면 밖으로 밀린다");
  assert.doesNotMatch(page, /cv5-flow/u, "머리글의 원칙 네 줄이 돌아왔다");
  assert.doesNotMatch(page, /heroPanel|heroGrid|heroLede/u, "히어로 판의 자리가 돌아왔다");

  // 목록은 머리글 바로 아래에 붙는다. 사이트 공통 띠(--v5-band)를 쓰면 둘 사이가 '다음
  // 섹션' 만큼 벌어져 머리글이 목록의 것이 아닌 것처럼 읽힌다.
  assert.match(page, /className=\{styles\.browseSection\}/u);
  assert.doesNotMatch(page, /styles\.browseSection\} data-band="section"/u);
});

test("한 벌로 파는 것은 목록의 탭이 아니라 자기 화면으로 보낸다", async () => {
  const page = await source("app/marketplace/page.tsx");
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  // 화면에 남은 것은 키트로 가는 길 하나다.
  assert.match(page, /href="\/kits"/u, "app/marketplace/page.tsx: 키트로 가는 길이 없다");
  assert.doesNotMatch(page, /“키트” 탭|"키트" 탭|키트 탭/u, "없어진 탭을 가리키는 문장이 남아 있다");

  // 탭 자체가 사라졌다.
  assert.doesNotMatch(catalog, /\{ id: "kit", label: "키트" \}/u, "목록에 키트 탭이 되살아났다");
  assert.doesNotMatch(catalog, /"all" \| "kit"/u, "거르는 값에 키트가 되살아났다");

  // 옛 주소는 새 화면으로 옮겨 간다. 링크를 받은 사람이 빈 목록을 보면 안 된다.
  assert.match(catalog, /function legacyKitTarget/u, "옛 키트 주소를 옮겨 주는 자리가 없다");
  assert.match(catalog, /params\.get\("cat"\) === "kit"\) return "\/kits"/u, "?cat=kit 가 /kits 로 가지 않는다");
  assert.match(catalog, /return `\/kit\/\$\{encodeURIComponent\(kit\)\}`/u, "?kit=<id> 가 /kit/<id> 로 가지 않는다");
  assert.match(catalog, /window\.location\.replace\(legacyTarget\)/u, "옮겨 가는 동작이 없다");
});

test("거르는 자리는 분류·테마·이용 조건 셋이고, 적힌 수는 격자와 같은 계산에서 나온다", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  assert.match(catalog, /title="분류"/u, "분류로 거르는 자리가 없다");
  assert.match(catalog, /title="테마"/u, "테마로 거르는 자리가 없다");
  assert.match(catalog, /title="이용 조건"/u, "이용 조건으로 거르는 자리가 없다");
  assert.match(catalog, /<aside className=\{styles\.side\}/u, "거르는 자리가 왼쪽에 서지 않는다");

  // 분류는 파일을 보고 가른다(listingFamily). 키트는 여기 없다.
  for (const label of ["전체", "3D 모델", "2D 스프라이트", "움직임 있음"]) {
    assert.ok(catalog.includes(`label: "${label}"`), `분류에 "${label}" 이 없다`);
  }

  // 테마는 목록에서 세운 키트에서 나온다. 이름을 표에 적어 두면 키트가 늘 때마다 화면을
  // 고쳐야 하고, 고치지 않으면 새 키트가 조용히 사라진다.
  assert.match(catalog, /kitsFrom\(listings\)/u, "테마를 목록에서 세우지 않는다");
  assert.doesNotMatch(catalog, /"마을 광장"|"부두·낚시터"|"광산 입구"/u, "키트 이름을 화면에 적어 두었다");

  // 세는 곳과 거르는 곳이 같은 함수를 쓴다. 다른 규칙을 쓰면 사이드바는 언젠가 틀린 수를
  // 적고, 그 수는 아무도 눌러 보기 전까지 틀린 채로 있는다.
  assert.match(catalog, /const matchesFacets/u, "조건을 판단하는 자리가 하나가 아니다");
  assert.match(catalog, /listings\.filter\(\(listing\) => matchesFacets\(listing, facets\)\)/u, "격자가 그 판단을 쓰지 않는다");
  assert.match(catalog, /matchesFacets\(listing, \{ \.\.\.facets, \.\.\.patch \}\)/u, "사이드바의 수가 그 판단을 쓰지 않는다");

  // 판매가 닫혀 있는 동안에는 고를 것이 없다. 고를 수 없는 조건 대신 지금 되는 일을 적는다.
  assert.match(catalog, /지금은 로그인만 하면 전부 무료/u, "판매가 닫힌 동안 무엇이 되는지 말하지 않는다");
});

test("주소는 지금 보고 있는 화면을 그대로 담는다", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");

  for (const key of ["cat", "theme", "access", "sort", "q", "colour"]) {
    assert.ok(catalog.includes(`apply("${key}"`), `?${key}= 가 주소에 실리지 않는다`);
  }
  assert.match(catalog, /params\.delete\("kit"\)/u, "옛 키트 값이 주소에 남는다");
});

test("목록은 값이 아니라 무엇을 받을 수 있는지를 말한다", async () => {
  const page = screenText(await source("app/marketplace/page.tsx"));
  const catalog = screenText(await source("app/components/MarketplaceCatalog.tsx"));

  for (const [name, text] of [["app/marketplace/page.tsx", page], ["app/components/MarketplaceCatalog.tsx", catalog]]) {
    assert.doesNotMatch(text, /크레딧|원 \(VAT|₩/u, `${name}: 낱개로 값을 매기는 말이 돌아왔다`);
    // 측정한 값은 "측정" 으로 적는다(docs/copy-glossary.ko.md 3절).
    assert.doesNotMatch(text, /잰 값|재 보|재서|재면|잽니다/u, `${name}: "재다" 계열이 남아 있다`);
  }

  // 목록 머리글은 지금 무엇이 몇 개인지, 그리고 무엇을 받는지를 말한다.
  assert.match(catalog, /에셋 \{filteredListings\.length\}개 · GLB·PNG/u, "목록이 몇 개를 세우고 있는지 말하지 않는다");
  assert.match(catalog, /licenseLabel\(\[\.\.\.values\]\[0\]\)/u, "라이선스를 화면이 지어내고 있다");
});
