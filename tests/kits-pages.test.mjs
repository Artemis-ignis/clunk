import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

/**
 * 공개 키트 화면의 계약.
 *
 * 키트는 같은 팔레트, 같은 축척으로 만든 부품 묶음이고(docs/kits.md), 2026-09-05 부터
 * 자기 주소를 갖습니다 — 목록은 /kits, 한 벌은 /kit/<id>. 그 전까지 /kits 는 로그인한
 * 사용자의 "묶음" 작업 화면이었고, 그 기능은 /bundles 로 옮겨졌습니다.
 *
 * 여기서 못 박는 것은 화면의 생김새가 아니라 두 가지입니다: 방문자가 키트에 닿는 길이
 * 실제로 있는가, 그리고 그 화면이 없는 키트에 200 을 돌려주지 않는가.
 */

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("주 메뉴에 키트 문이 있다", async () => {
  const nav = await source("app/components/SiteNav.tsx");
  assert.match(nav, /label:\s*"키트",\s*href:\s*"\/kits",\s*section:\s*"kits"/);
  // 드로어는 NAV_LINKS 를 그대로 훑으므로 좁은 화면에서도 같은 다섯 문이 선다.
  assert.match(nav, /NAV_LINKS\.map/);
  assert.match(nav, /ShellSection = [^;]*"kits"/);
  // 에셋 마켓 바로 뒤 자리. 낱개와 한 벌은 나란히 있어야 고르는 사람이 둘을 비교한다.
  const marketAt = nav.indexOf('href: "/marketplace"');
  const kitsAt = nav.indexOf('href: "/kits"');
  const inspectAt = nav.indexOf('href: "/app"');
  assert.ok(marketAt > 0 && kitsAt > marketAt && inspectAt > kitsAt);
});

test("/kits 는 공개 화면이고 작업 화면 껍데기를 쓰지 않는다", async () => {
  const page = await source("app/kits/page.tsx");
  assert.match(page, /SiteShell/);
  // 2026-09-05: 여기 있던 /ForceDarkTheme/ 못을 뺐다. 그 컴포넌트는 화면마다
  // data-theme 을 dark 로 박아 두는 것이었고, 테마가 세 벌(기본·화이트·블랙)이
  // 된 지금은 사람이 고른 값을 덮어써 버린다. 16개 화면에서 함께 지웠고,
  // 그 자리의 계약은 tests/theme-contract.test.mjs 가 본다.
  assert.doesNotMatch(page, /ForceDarkTheme/);
  assert.match(page, /KitsIndex/);
  assert.match(page, /areSalesOpen/);
  assert.match(page, /한 벌로 꾸미는/);
  assert.doesNotMatch(page, /WorkspaceShell/);
  assert.doesNotMatch(page, /KitsClient/);
  // 옛 주소로 오는 링크는 끊기지 않고 작업 화면으로 넘어간다.
  assert.match(page, /params\.view === "workspace"/);
  assert.match(page, /redirect\(`\/bundles\?view=workspace/);
});

test("묶음 작업 화면은 /bundles 로 옮겨졌고 들어오는 링크가 그쪽을 가리킨다", async () => {
  const page = await source("app/bundles/page.tsx");
  assert.match(page, /WorkspaceShell/);
  assert.match(page, /KitsClient/);
  assert.match(page, /requireChatGPTUser\("\/bundles\?view=workspace"\)/);
  assert.match(page, /if \(!user\) redirect\("\/marketplace"\)/);
  assert.match(page, /href="\/bundles\?view=workspace"/);
  assert.match(page, /path: "\/bundles"/);

  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  const assetDetail = await source("app/components/WorkspaceAssetDetail.tsx");
  assert.match(workbench, /href="\/bundles"/);
  assert.match(assetDetail, /href="\/bundles"/);
  assert.match(assetDetail, /\/bundles\?kit=/);
  assert.doesNotMatch(workbench, /href="\/kits"/);
  assert.doesNotMatch(assetDetail, /href="\/kits"/);
});

test("/kit/<id> 는 없는 키트에 404 를 돌려준다", async () => {
  await access(new URL("app/kit/[slug]/page.tsx", root));
  const page = await source("app/kit/[slug]/page.tsx");
  assert.match(page, /notFound/);
  assert.match(page, /if \(kits && !kits\.some\(\(kit\) => kit\.id === slug\)\) notFound\(\);/);
  // 키트 이름을 이 파일에 적어 두지 않는다. 서는 키트는 목록 계산이 정한다.
  assert.match(page, /kitsFrom/);
  assert.doesNotMatch(page, /"kit-village-square"|"kit-fishing-dock"|"kit-mine-entrance"/);
  assert.match(page, /KitDetail/);
  assert.match(page, /areSalesOpen/);
});

test("키트 화면은 전체 장면과 부품 격자를 같은 사실에서 그린다", async () => {
  const detail = await source("app/components/KitDetail.tsx");
  // 합본이 있는 키트는 그 파일을 그대로 돌려 보여 준다 — 상품 상세와 같은 주소 꼴.
  assert.match(detail, /EmbeddedGlbViewer/);
  assert.match(detail, /`\/market\/\$\{product\.slug\}\/\$\{product\.entryFileName\}`/);
  assert.match(detail, /키트 전체 장면 · 드래그 회전 · 휠 줌/);
  // 합본이 없는 키트는 없는 파일을 지어내지 않고 대표 그림과 한 줄을 세운다.
  assert.match(detail, /부품을 하나씩 따로 받습니다/);
  assert.match(detail, /들어 있는 것/);
  assert.match(detail, /kit\.parts\.length/);
  // 화면에 적히는 수는 전부 응답의 값이다. 손으로 적은 숫자가 있으면 안 된다.
  assert.match(detail, /part\.facts\?\.triangles/);
  assert.match(detail, /mergedPalette/);

  const index = await source("app/components/KitsIndex.tsx");
  assert.match(index, /kitsFrom/);
  assert.match(index, new RegExp("/api/marketplace"));
  assert.match(index, /state === "loading"/);
  assert.match(index, /state === "error"/);
  assert.match(index, /!kits\.length/);
  assert.match(index, /`\/kit\/\$\{encodeURIComponent\(kit\.id\)\}`/);
});

test("키트 계산은 한 벌 화면을 가리킨다", async () => {
  const facts = await source("app/components/catalog-facts.ts");
  assert.match(facts, /href: `\/kit\/\$\{encodeURIComponent\(id\)\}`/);
  assert.doesNotMatch(facts, /href: group\.product/);
});

test("사이트맵이 키트 목록과 각 키트를 싣는다", async () => {
  const sitemap = await source("app/sitemap.xml/route.ts");
  assert.match(sitemap, /\{ path: "\/kits", priority: "0\.8"/);
  assert.match(sitemap, new RegExp("/kit/\\$\\{encodeURIComponent\\(kitId\\)\\}"));
  // 키트 이름을 적어 두지 않고 등록부에서 읽는다.
  assert.match(sitemap, /kitIdsFromFacts/);
  assert.doesNotMatch(sitemap, /"kit-village-square"|"harvest-frontier"/);
});

test("새 화면의 문구가 용어집을 지킨다", async () => {
  // docs/copy-glossary.ko.md — "재다" 계열은 "측정" 으로, 그리고 방문자 화면은 개발
  // 이야기를 하지 않는다(날짜, 고쳤다, 이전에는, 버그).
  const forbidden = [/재다/u, /재서/u, /잰/u, /재어/u, /재고/u, /수정했/u, /고쳤/u, /이전에는/u, /버그/u];
  for (const path of [
    "app/kits/page.tsx",
    "app/kit/[slug]/page.tsx",
    "app/components/KitsIndex.tsx",
    "app/components/KitDetail.tsx",
    "app/components/KitPages.module.css",
  ]) {
    const text = await source(path);
    for (const pattern of forbidden) {
      assert.doesNotMatch(text, pattern, `${path} 에 금지된 낱말이 있습니다: ${pattern}`);
    }
    // 같은 물건은 같은 이름으로 부른다 — 이 화면들에서는 "키트" 와 "부품".
    assert.doesNotMatch(text, /번들/u);
  }
});

test("키트 계약 문서가 두 주소를 적어 둔다", async () => {
  const doc = await source("docs/kits.md");
  assert.match(doc, new RegExp("/kits"));
  assert.match(doc, new RegExp("/kit/<"));
  assert.match(doc, new RegExp("/bundles"));
});
