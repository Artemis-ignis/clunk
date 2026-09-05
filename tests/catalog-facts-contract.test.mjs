import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CATALOG_THEMES,
  GRADE_ACCESS,
  GRADE_ROWS,
  GRADE_RULE,
  boundsOf,
  categoryOf,
  drawableListings,
  gradeBasisOf,
  gradeOf,
  hasMotionOf,
  isFreeGrade,
  isModelBundleOf,
  licenseLabelOf,
  materialsOf,
  polygonCountOf,
  polygonsOf,
  previewImageUrlOf,
  themeById,
  isKitProduct,
  kitIdOfPart,
  kitMemberCount,
  kitMemberSlugs,
  kitOfPart,
  kitOfProduct,
  kitsFrom,
} from "../app/components/catalog-facts.ts";

/**
 * 마켓 카탈로그의 계산 계약.
 *
 * 화면 없이 확인할 수 있는 것만 여기서 확인한다: 설명 문장에서 무엇을 읽어 내는지,
 * 못 읽은 항목이 정말로 빠지는지, 등급 규칙이 무엇인지, 미리보기 주소가 상점이 이미
 * 공개해 둔 그 주소인지.
 *
 * 2026-09-04: 이 파일은 tests/gacha-contract.test.mjs 에서 나왔다. 캡슐 자판기는 결제대행
 * 심사에서 사행성으로 지목돼 통째로 사라졌고, 그 계약은 "화면 어디에도 없을 것"으로
 * 뒤집혀 tests/no-gacha-contract.test.mjs 가 되었다. 다만 등급과 잰 값을 읽는 계산은
 * 뽑기와 무관하게 마켓 카드가 그대로 쓰고 있으므로, 그 부분의 계약은 느슨해지지 않도록
 * 여기로 옮겨 그대로 남긴다. 뽑기에만 있던 것(무작위 뽑기, 확률판, 캡슐 색, 원화 표기)은
 * 함께 사라졌다.
 *
 * 아래 설명 문장은 2026-09-02 에 https://clunk.games/api/marketplace 가 실제로 준 값을
 * 그대로 옮긴 것이다 — 여기에 없는 문장에서 숫자를 읽어 내는 일이 없도록.
 */

/** 운영 API 응답에서 그대로 가져온 표본. 값을 손으로 고치지 말 것. */
const TRACTOR = {
  id: "listing-w1-cozy-tractor", slug: "cozy-tractor", title: "코지 트랙터",
  description: "농장 배경에 세우는 가벼운 3D 트랙터입니다. 파일을 열어 잰 값으로 폴리곤 1,060개, 그리기 18회, 재질 5개이고 실제 크기는 2.29x2.03x2.98 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-w1-cozy-tractor", entryFileName: "tractor.glb", byteLength: 74764,
  previewFileName: "preview-cozy-tractor.webp", variantOf: null, variants: [], palette: null,
};

const STALL = {
  id: "listing-stall", slug: "cozy-market-stall", title: "시장 노점",
  description: "가벼운 3D 시장 좌판입니다. 파일을 열어 잰 값으로 폴리곤 2,456개, 그리기 31회, 재질 11개이고 실제 크기는 2.44x2.39x1.35 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-stall", entryFileName: "market-stall.m1.clunk-optimized.glb", byteLength: 214584,
  previewFileName: "preview-cozy-market-stall.webp", variantOf: null,
  variants: [{ slug: "cozy-market-stall-sprites", title: "시장 노점 · 스프라이트 시트" }],
  palette: [{ hex: "#a8794b", share: 0.3586 }, { hex: "#6b4630", share: 0.2865 }],
};

const FARM_SET = {
  id: "listing-farmset", slug: "cozy-farm-set-vol1", title: "코지 팜 세트 Vol.1 (3종 묶음)",
  description: "시장 좌판·창고 헛간·울타리 문 세 가지를 한 번에 받는 묶음입니다. 셋을 합쳐 폴리곤 4,596개, 그리기 68회, 재질 26개입니다. 세 가지 모두 웹·모바일 게임 기준 100점, 막히는 문제 0건입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-farmset", entryFileName: "market-stall.m1.clunk-optimized.glb", byteLength: 214584,
  previewFileName: "preview-cozy-fence-gate.webp", variantOf: null,
  variants: [{ slug: "cozy-farm-set-vol1-sprites", title: "코지 팜 세트 Vol.1 (3종) — 스프라이트 시트 (64×64, 8방향)" }],
  palette: [{ hex: "#a8794b", share: 1 }],
};

const GROVE = {
  id: "listing-grove", slug: "grove-tree-pack-vol1", title: "나무 6종 팩",
  description: "잎 넓은 나무 4종과 침엽수 2종, 모두 여섯 그루의 가벼운 3D 나무 묶음입니다. 한 그루에 폴리곤 860~2,136개이며, 그루마다 재질 2개·그리기 2회·텍스처 0장으로 통일돼 있습니다. 여섯 그루 모두 웹·모바일 게임 기준 100점, 막히는 문제 0건이고 색이 모델에 들어 있어 텍스처 파일이 없습니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-grove", entryFileName: "broadleaf-round-full.glb", byteLength: 189820,
  previewFileName: "preview-grove-broadleaf-column-flame.webp", variantOf: null,
  variants: [{ slug: "grove-tree-pack-vol1-sprites", title: "나무 6종 팩 · 스프라이트 시트" }],
  palette: [{ hex: "#6d8b4a", share: 0.6 }],
};

/** 여닫기 동작 시트가 딸린 모델. 실제 운영 응답에서 그대로 옮긴 제목이다. */
const GATE = {
  id: "listing-gate", slug: "cozy-fence-gate", title: "울타리 문",
  description: "가벼운 3D 울타리 문입니다. 파일을 열어 잰 값으로 폴리곤 520개, 그리기 13회, 재질 6개이고 실제 크기는 2.67x1.75x0.52 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-gate", entryFileName: "fence-gate.m1.clunk-optimized.glb", byteLength: 30000,
  previewFileName: "preview-cozy-fence-gate.webp", variantOf: null,
  variants: [
    { slug: "cozy-fence-gate-sprites", title: "울타리 문 · 스프라이트 시트" },
    { slug: "cozy-fence-gate-swing-sprites", title: "울타리 문 · 여닫기 애니메이션 시트" },
  ],
  palette: [{ hex: "#6b4630", share: 0.32 }],
};

/** 폴리곤만으로 S 가 되는 모델. 동작은 없다. */
const GREENHOUSE = {
  id: "listing-greenhouse-published", slug: "cozy-greenhouse", title: "코지 온실",
  description: "온실 구조물입니다. 파일을 열어 잰 값으로 폴리곤 5,756개, 그리기 2회, 재질 1개이고 실제 크기는 8.42x4.24x6.51 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-greenhouse", entryFileName: "greenhouse.m1.clunk-optimized.glb", byteLength: 120000,
  previewFileName: "preview-cozy-greenhouse.webp", variantOf: null,
  variants: [{ slug: "cozy-greenhouse-sprites", title: "코지 온실 — 스프라이트 시트 (64×64, 8방향)" }],
  palette: [{ hex: "#d3e3d7", share: 0.53 }],
};

const MEADOW = {
  id: "listing-meadow", slug: "tex-grass-meadow-v1", title: "초원 풀 텍스처",
  description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 경계 약함(가로 1.62 / 세로 1.77, 1에 가까울수록 좋음)입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-meadow", entryFileName: "tex-grass-meadow-v1.png", byteLength: 2732086,
  previewFileName: "preview-tex-grass-meadow-v1.webp", variantOf: null, variants: [],
  palette: [{ hex: "#4d6b34", share: 0.5 }],
};

const SOIL = {
  id: "listing-soil", slug: "tex-soil-tilled-v2", title: "경작지 흙 텍스처",
  description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 이음매 없음(가로 1.19 / 세로 1.5, 1에 가까울수록 좋음)입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-soil", entryFileName: "tex-soil-tilled-v2.png", byteLength: 2591910,
  previewFileName: "preview-tex-soil-tilled-v2.webp", variantOf: null, variants: [],
  palette: [{ hex: "#6b4a2f", share: 0.4 }],
};

const FARMHAND = {
  id: "listing-farmhand", slug: "farmhand-walk-sprites", title: "팜핸드 (밀짚모자 농부) — 걷기 애니메이션 (64×64, 8방향 × 8프레임)",
  description: "64×64 PNG 64컷으로, 8방향 각각에 8프레임짜리 걷기 동작이 들어 있습니다. Clunk가 코드로 만든 폴리곤 480개짜리 3D 모델을 렌더한 것이라, 모든 방향·모든 프레임이 같은 모델에서 나옵니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-farmhand", entryFileName: "threejs-factory-v1.sheet.png", byteLength: 13952,
  previewFileName: "threejs-factory-v1.sheet.card.png", variantOf: null, variants: [],
  palette: [{ hex: "#c9a227", share: 0.3 }],
};

const CRATE_SHEET = {
  id: "listing-crate-sheet", slug: "cozy-crate-closed-sprites", title: "나무 궤짝 (닫힘) — 스프라이트 시트",
  description: "64×64 PNG 8컷입니다.",
  priceCents: 0, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-crate-sheet", entryFileName: "crate-closed.clunk-optimized.sheet.png", byteLength: 9000,
  previewFileName: "crate-closed.sheet.card.png", variantOf: "cozy-crate-closed", variants: [],
  palette: [{ hex: "#8a5a33", share: 0.5 }],
};

const DRAFT_SHED = {
  ...STALL,
  id: "listing-shed-draft", slug: "cozy-storage-shed", title: "코지 창고 헛간", status: "DRAFT",
};

const SAMPLE = [TRACTOR, STALL, GATE, GREENHOUSE, FARM_SET, GROVE, MEADOW, SOIL, FARMHAND, CRATE_SHEET, DRAFT_SHED];

test("슬러그만 보고 갈래를 정한다", () => {
  assert.equal(categoryOf({ slug: "cozy-market-stall" }), "structure");
  assert.equal(categoryOf({ slug: "cozy-storage-shed" }), "structure");
  assert.equal(categoryOf({ slug: "cozy-greenhouse" }), "structure");
  assert.equal(categoryOf({ slug: "cozy-fence-gate" }), "structure");
  assert.equal(categoryOf({ slug: "cozy-farm-set-vol1" }), "structure");
  assert.equal(categoryOf({ slug: "grove-tree-pack-vol1" }), "tree");
  assert.equal(categoryOf({ slug: "cozy-crate-produce" }), "prop");
  assert.equal(categoryOf({ slug: "cozy-tractor" }), "prop");
  // 3D 모델이 없는 2D 캐릭터라 소품으로 떨어진다.
  assert.equal(categoryOf({ slug: "farmhand-walk-sprites" }), "prop");
  assert.equal(categoryOf({ slug: "tex-soil-tilled-v2" }), "texture");
  assert.equal(categoryOf({ slug: "verified-seamless-textures-vol1" }), "texture");
  // 갈래마다 이름이 있고, 모르는 값은 "전체"로 떨어진다.
  assert.equal(themeById("texture").name, "텍스처");
  assert.equal(themeById("all").id, "all");
  assert.equal(CATALOG_THEMES.length, 5);
});

test("선반에는 공개된 상품만, 구운 스프라이트 시트는 빼고 올린다", () => {
  const slugs = drawableListings(SAMPLE).map((row) => row.slug);
  assert.ok(!slugs.includes("cozy-crate-closed-sprites"), "모델에서 구운 시트는 따로 서지 않는다");
  assert.ok(!slugs.includes("cozy-storage-shed"), "공개되지 않은 상품은 선반에 올라가지 않는다");
  assert.ok(slugs.includes("farmhand-walk-sprites"), "3D 모델이 없는 시트는 그 자체가 상품이다");
  assert.equal(slugs.length, 9);
});

test("잰 값은 설명에 적힌 문장에서만 읽는다", () => {
  assert.equal(polygonsOf(TRACTOR), "1,060개");
  assert.equal(materialsOf(TRACTOR), "5개");
  assert.equal(boundsOf(TRACTOR), "2.29 × 2.03 × 2.98 m");

  assert.equal(polygonsOf(FARM_SET), "모두 합쳐 4,596개");
  assert.equal(materialsOf(FARM_SET), "모두 합쳐 26개");
  assert.equal(boundsOf(FARM_SET), null, "묶음에는 하나의 실제 크기가 없다");

  assert.equal(polygonsOf(GROVE), "한 그루에 860~2,136개");
  assert.equal(materialsOf(GROVE), "한 그루에 2개");

  // 텍스처에는 폴리곤이 없다 — 없으면 없다고 한다.
  assert.equal(polygonsOf(MEADOW), null);
  // 팜핸드 설명에도 '폴리곤 480개'가 있지만 그것은 시트를 구운 원본 모델의 값이라
  // 잰 값 문장이 아니다. 상품의 값처럼 보여 주지 않는다.
  assert.equal(polygonsOf(FARMHAND), null);
  assert.equal(polygonsOf({ description: "아무 숫자도 없는 설명입니다." }), null);
});

test("등급은 눈에 보이는 품질로 가르고, 규칙을 그대로 적는다", () => {
  // 2026-09-02: 검사 점수는 팔리는 것 거의 전부가 100점이라 등급을 가르지 못했다.
  // 이제 등급은 "움직이는 동작이 있는가" 와 "얼마나 복잡한가" 두 가지로만 갈린다.
  //
  // 2026-09-04: 등급은 분류이지 값도, 받을 수 있는지의 판정도 아니다. 그 판정은
  // 접근권(무료 등급 / 구독)이 따로 한다.

  // A — 동작 시트가 딸렸지만 작은 모델. 동작은 한 단계 올려 줄 뿐, 520폴리곤 문을 S로 만들지 않는다.
  assert.equal(hasMotionOf(GATE), true, "여닫기 애니메이션 시트를 가진 모델은 움직이는 상품이다");
  assert.deepEqual(gradeOf(GATE), { letter: "A", basis: "motion" });
  assert.equal(gradeBasisOf(GATE), "움직이는 동작 포함");
  // 폴리곤은 520개뿐이라 동작이 없었다면 C 였을 것이다.
  assert.equal(polygonCountOf(GATE), 520);

  // A — 동작이 든 스프라이트 시트 그 자체. 폴리곤이 없는 시트는 동작만으로 S가 되지 않는다.
  assert.equal(hasMotionOf(FARMHAND), true);
  assert.deepEqual(gradeOf(FARMHAND), { letter: "A", basis: "motion" });

  // S — 폴리곤 4,000개 이상.
  assert.equal(polygonCountOf(GREENHOUSE), 5756);
  assert.deepEqual(gradeOf(GREENHOUSE), { letter: "S", basis: "polygons" });
  assert.equal(gradeBasisOf(GREENHOUSE), "폴리곤 5,756개");
  assert.equal(polygonCountOf(FARM_SET), 4596);
  assert.deepEqual(gradeOf(FARM_SET), { letter: "S", basis: "polygons" });

  // A — 1,500개 이상.
  assert.equal(polygonCountOf(STALL), 2456);
  assert.deepEqual(gradeOf(STALL), { letter: "A", basis: "polygons" });
  // 나무 팩은 범위로 적혀 있고, 가장 큰 한 그루를 기준으로 잡는다.
  assert.equal(polygonCountOf(GROVE), 2136);
  assert.deepEqual(gradeOf(GROVE), { letter: "A", basis: "polygons" });

  // A — 폴리곤을 못 읽어도 여러 모델 묶음이면.
  const modelPack = {
    ...FARM_SET,
    description: "세 가지를 한 번에 받는 묶음입니다. 잰 값은 각 파일에 들어 있습니다.",
  };
  assert.equal(polygonCountOf(modelPack), null);
  assert.equal(isModelBundleOf(modelPack), true);
  assert.deepEqual(gradeOf(modelPack), { letter: "A", basis: "bundle" });
  assert.equal(gradeBasisOf(modelPack), "여러 모델 묶음");

  // B — 700개 이상.
  assert.equal(polygonCountOf(TRACTOR), 1060);
  assert.deepEqual(gradeOf(TRACTOR), { letter: "B", basis: "polygons" });
  assert.equal(gradeBasisOf(TRACTOR), "폴리곤 1,060개");
  assert.deepEqual(
    gradeOf({ ...TRACTOR, description: "잰 값으로 폴리곤 700개, 그리기 3회, 재질 1개입니다." }),
    { letter: "B", basis: "polygons" },
  );

  // B — 그 외. 단순한 소품과 텍스처 낱장이 여기 온다. 2026-09-04: 등급이 접근권이 되면서
  // C 를 없앴다. 700개 미만이라는 경계는 무료와 유료를 가르지 않았으므로 아무것도 정하지
  // 않는 칸이었고, 남겨 두면 "가장 낮은 등급"이 무료 등급과 다른 뜻으로 읽힌다.
  assert.deepEqual(
    gradeOf({ ...TRACTOR, description: "잰 값으로 폴리곤 552개, 그리기 3회, 재질 1개입니다." }),
    { letter: "B", basis: "polygons" },
  );
  assert.deepEqual(gradeOf(MEADOW), { letter: "B", basis: "plain" });
  assert.equal(gradeBasisOf(MEADOW), null, "텍스처 한 장에는 내세울 근거가 없다");

  // 텍스처 일곱 장 묶음은 모델 묶음이 아니다 — 낱장 일곱 장이라 B 에 남는다.
  const texturePack = {
    ...MEADOW,
    slug: "verified-seamless-textures-vol1", title: "텍스처 7종 묶음",
    description: "1024×1024 이음매 없는 텍스처 7종을 한 번에 받는 묶음입니다.",
  };
  assert.equal(isModelBundleOf(texturePack), false);
  assert.equal(gradeOf(texturePack).letter, "B");
  assert.equal(gradeOf(SOIL).letter, "B", "이음매가 없어도 텍스처 한 장은 단순한 물건이다");

  // 등급이 곧 접근권이다. 이 두 줄이 무너지면 구독 전용 에셋이 무료로 나가거나
  // 무료 에셋이 잠긴다 — 화면의 칩과 다운로드 문지기가 같은 함수를 부르기 때문이다.
  assert.equal(isFreeGrade("B"), true, "B 는 로그인만 하면 받는 등급이다");
  assert.equal(isFreeGrade("A"), false, "A 는 구독자만 받는다");
  assert.equal(isFreeGrade("S"), false, "S 는 구독자만 받는다");

  // 화면에 적히는 규칙과 코드가 매기는 규칙은 같은 것이어야 한다.
  //
  // 2026-09-04: 예전에는 이 자리에서 문장 하나를 글자까지 맞춰 봤다. 그런데 그 문장은
  // 가운뎃점 다섯 개가 붙은 한 덩어리라 요금 화면에서 아무도 읽지 않았고, 마스터가 그걸
  // 짚었다. 지금은 등급마다 한 줄(GRADE_ROWS)로 두고 한 줄짜리가 필요한 자리에서만 이어
  // 붙인다. 그래서 글자가 아니라 규칙이 담고 있어야 하는 값을 못박는다 — 문장은 다시
  // 다듬을 수 있어야 하고, 규칙은 조용히 바뀌면 안 된다.
  assert.deepEqual(GRADE_ROWS.map((row) => row.letter), ["S", "A", "B"], "등급은 S·A·B 셋이다");
  const asOneLine = GRADE_ROWS.map((row) => row.when).join(" ");
  assert.match(asOneLine, /1,500개 이상/u, "A 와 S 를 가르는 1,500 이 규칙에서 사라졌다");
  assert.match(asOneLine, /4,000개 이상/u, "S 를 만드는 4,000 이 규칙에서 사라졌다");
  assert.match(asOneLine, /움직이는 동작/u, "움직임이 등급을 올린다는 것이 규칙에서 사라졌다");
  assert.match(asOneLine, /묶은 것|묶음/u, "묶음이 A 가 된다는 것이 규칙에서 사라졌다");
  // 등급과 접근권은 다른 이야기이고, 둘 다 적혀 있어야 한다.
  assert.match(GRADE_ACCESS, /B .*로그인/u, "B 가 로그인만으로 열린다는 말이 없다");
  assert.match(GRADE_ACCESS, /A와 S.*구독/u, "A·S 가 구독자용이라는 말이 없다");
  // 한 줄짜리는 그 셋을 그대로 담고 있어야 한다 — 화면과 에이전트가 같은 말을 하도록.
  for (const row of GRADE_ROWS) assert.ok(GRADE_RULE.includes(row.when), `한 줄 규칙에 ${row.letter} 조건이 빠졌다`);
  assert.ok(GRADE_RULE.includes(GRADE_ACCESS), "한 줄 규칙에 접근권 문장이 빠졌다");
  // 규칙이 말하지 않는 것은 규칙이 되지 못한다: 확률·값·희귀도는 여기 없다.
  assert.doesNotMatch(GRADE_RULE, /확률|%|원|희귀/u, "등급 규칙은 확률도 값도 말하지 않는다");
});

test("미리보기는 상점이 이미 공개해 둔 주소 그대로다", () => {
  // 2026-09-03: 미리보기는 저장소가 내주는 API 주소다 — 워커에 번들된 정적 사본은 옛 파일이 남는다.
  assert.equal(previewImageUrlOf(STALL), "/api/marketplace/assets/asset-stall?file=preview-cozy-market-stall.webp&preview=1");
  assert.equal(previewImageUrlOf({ assetId: "a", previewFileName: null }), null);
  // 미리보기 자리에 GLB 가 적힌 상품은 깨진 그림 대신 아무것도 걸지 않는다.
  assert.equal(previewImageUrlOf({ assetId: "a", previewFileName: "tractor.glb" }), null);
  assert.equal(licenseLabelOf("cleared"), "상업적 이용 가능");
  assert.equal(licenseLabelOf(null), null);
});


/* ---------------------------------------------------------------------------
   키트 (docs/kits.md)

   표본은 tests/fixtures/kits/contract-kits.json — 세 에이전트가 동시에 만들고 있는 그
   계약을 그대로 옮긴 것이다. 실제 상품이 아니라 화면 계산이 계약대로 도는지 확인하는
   자리이고, 진짜 키트가 들어오면 같은 계산이 그대로 돈다.
   ------------------------------------------------------------------------- */

const KIT_FIXTURE = JSON.parse(
  await readFile(new URL("./fixtures/kits/contract-kits.json", import.meta.url), "utf8"),
);
const KIT_ROWS = KIT_FIXTURE.listings;
const kitById = (id) => kitsFrom(KIT_ROWS).find((kit) => kit.id === id) ?? null;

test("키트는 상품이 스스로 적어 둔 사실로만 알아본다", () => {
  // 슬러그 접두사가 아니라 members / kit 필드가 근거다. 접두사로 묶으면 이름을 바꾸는
  // 순간 키트가 흩어진다.
  const product = KIT_ROWS.find((row) => row.slug === "kit-village-square");
  const part = KIT_ROWS.find((row) => row.slug === "village-well");
  assert.equal(isKitProduct(product), true);
  assert.equal(isKitProduct(part), false);
  assert.equal(kitIdOfPart(part), "kit-village-square", "부품의 kit 이 곧 키트 상품의 슬러그다");
  assert.equal(kitIdOfPart(product), null, "키트는 자기 자신의 부품이 아니다");

  assert.deepEqual(kitMemberSlugs(["a", "b"]), ["a", "b"]);
  assert.deepEqual(kitMemberSlugs(3), [], "개수만 적힌 옛 묶음은 부품을 말하지 못한다");
  assert.equal(kitMemberCount(["a", "b"]), 2);
  assert.equal(kitMemberCount(3), 3, "옛 묶음도 개수는 그대로 말할 수 있다");
  assert.equal(kitMemberCount(null), null);
});

test("키트의 부품 수는 지금 공개된 부품의 수다", () => {
  const kits = kitsFrom(KIT_ROWS);
  assert.deepEqual(
    kits.map((kit) => kit.id).sort(),
    ["kit-fishing-dock", "kit-mine-entrance", "kit-village-square"],
    "부품이 하나뿐인 키트와 키트에 속하지 않는 상품은 키트가 되지 않는다",
  );

  const mine = kitById("kit-mine-entrance");
  // 표본의 kit-mine-entrance 는 부품 넷을 적어 두었지만 mine-lantern 은 아직 DRAFT 다.
  assert.equal(mine.parts.length, 3, "공개되지 않은 부품은 세지 않는다");
  assert.equal(
    KIT_ROWS.find((row) => row.slug === "mine-cart").facts.kitSize,
    4,
    "facts 의 kitSize 는 빌드 매니페스트가 센 값이라 넷이라고 적혀 있다",
  );
  assert.ok(
    !mine.parts.some((part) => part.slug === "mine-lantern"),
    "화면이 세는 수와 화면이 거는 카드의 수가 어긋나면 안 된다",
  );
});

test("키트의 합계는 부품의 합이고, 등급은 가장 높은 부품의 등급이다", () => {
  const village = kitById("kit-village-square");
  assert.equal(village.name, "마을 광장 키트", "이름은 합쳐 파는 상품의 제목에서 온다");
  assert.equal(village.parts.length, 6);
  // 1840 + 620 + 480 + 720 + 1320 + 540
  assert.equal(village.triangles, 5520, "합계는 부품의 합 — 합친 파일의 값을 더하면 두 번 센다");
  assert.equal(village.byteLength, 129788);
  // 부품 중 village-well 만 1,500개를 넘는다.
  assert.equal(village.grade, "A");
  assert.equal(village.free, false, "A 등급 키트는 구독으로 열린다");
  assert.equal(village.product.slug, "kit-village-square");
  assert.equal(village.href, "/kit/kit-village-square", "키트는 자기 주소(/kit/<id>)로 간다 — 마켓 상품 페이지가 아니라");

  // 합친 파일 자신은 9,420개라 홀로 두면 S 가 되지만, 키트의 등급은 부품이 정한다.
  assert.equal(gradeOf(village.product).letter, "S");
  assert.notEqual(village.grade, gradeOf(village.product).letter);

  // 움직이는 부품이 든 키트는 S 로 올라간다.
  assert.equal(kitById("kit-fishing-dock").grade, "S");
});

/**
 * 2026-09-05: 키트 카드가 갈래를 적지 않고 있었다. Kit.themeName 이 대표 부품의 슬러그로
 * 고른 낱개 갈래여서 광산 키트에 "농장 소품"이라고 적혔고, 그래서 그 줄을 지웠던 것이다.
 * 지금 갈래는 키트가 스스로 등록부에 적어 둔다(facts.theme — 키트 조각에서
 * scripts/merge-kit-facts.mjs 가 넣는다). 슬러그 대응표는 두지 않는다: 적어 두지 않은 키트는
 * 예전처럼 낱개 갈래로 되돌아간다.
 */
test("키트의 갈래는 키트가 스스로 적어 둔 값이고, 없으면 낱개 갈래로 되돌아간다", () => {
  assert.equal(kitById("kit-village-square").themeName, "마을");
  assert.equal(kitById("kit-mine-entrance").themeName, "광산");
  // 표본의 kit-fishing-dock 은 갈래를 적어 두지 않았다 — 그때만 낱개 갈래가 쓰인다.
  const dock = kitById("kit-fishing-dock");
  assert.equal(dock.product.facts.theme, undefined, "표본이 갈래를 적어 두지 않았는지부터 확인한다");
  assert.equal(dock.themeName, themeById(categoryOf(dock.product)).name);
});

test("부품에서 키트로, 키트에서 부품으로 오갈 수 있다", () => {
  const kits = kitsFrom(KIT_ROWS);
  const part = KIT_ROWS.find((row) => row.slug === "dock-boat");
  const kit = kitOfPart(part, kits);
  assert.equal(kit.id, "kit-fishing-dock");
  assert.ok(kit.parts.some((row) => row.slug === "dock-crane"), "같은 키트의 다른 부품으로 갈 수 있다");
  assert.equal(kitOfProduct(kit.product, kits).id, "kit-fishing-dock");
  assert.equal(kitOfPart(kit.product, kits), null, "키트 상품은 자기 자신의 부품이 아니다");
  assert.equal(
    kitOfPart({ slug: "tex-sample-v1" }, kits),
    null,
    "키트에 속하지 않는 상품은 키트 줄을 얻지 않는다",
  );
});

test("합쳐 파는 상품이 없는 키트는 목록을 그 키트로 좁혀 보여 준다", () => {
  // 하베스트 프론티어처럼 부품만 파는 키트. 없는 상품 페이지를 지어내지 않는다.
  const rows = [
    { ...MEADOW, id: "l-a", slug: "hf-barn", title: "헛간", entryFileName: "barn.glb", facts: { triangles: 15080, byteLength: 100, kit: "harvest-frontier", kitSize: 9, members: null } },
    { ...MEADOW, id: "l-b", slug: "hf-windmill", title: "풍차", entryFileName: "windmill.glb", facts: { triangles: 1656, byteLength: 100, kit: "harvest-frontier", kitSize: 9, members: null } },
  ];
  const [kit] = kitsFrom(rows);
  assert.equal(kit.id, "harvest-frontier");
  assert.equal(kit.name, "하베스트 프론티어 세트", "상품이 없으면 이름표에서 이름을 가져온다");
  assert.equal(kit.product, null);
  assert.equal(kit.href, "/kit/harvest-frontier", "합본이 없는 키트도 자기 주소가 있다");
  assert.equal(kit.parts.length, 2);

  // 그룹 이름으로만 묶여 있던 옛 키트는 대응표를 거쳐 합본 상품에 닿는다.
  const legacy = kitsFrom([
    ...rows.map((row, index) => ({ ...row, id: `c-${index}`, slug: index ? "cozy-market-stall" : "cozy-fence-gate", facts: { ...row.facts, kit: "cozy-farm-set", kitSize: 3 } })),
    { ...FARM_SET, facts: { triangles: 4596, byteLength: 214584, kit: null, kitSize: 0, members: 3 } },
  ]);
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].id, "cozy-farm-set");
  assert.equal(legacy[0].product.slug, "cozy-farm-set-vol1");
  assert.equal(legacy[0].href, "/kit/cozy-farm-set");
  assert.ok(
    !legacy[0].parts.some((part) => part.slug === "cozy-farm-set-vol1"),
    "합본 상품이 자기 부품 목록에 들어가면 안 된다",
  );
});
