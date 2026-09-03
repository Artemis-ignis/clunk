import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GACHA_THEMES,
  GRADE_COLORS,
  GRADE_RULE,
  boundsOf,
  capsuleColorOf,
  categoryOf,
  domeCapsules,
  drawCallsOf,
  drawFrom,
  drawableListings,
  formatBytes,
  formatOdds,
  gradeOddsOf,
  formatWon,
  gradeBasisOf,
  gradeOf,
  hasMotionOf,
  inspectionScoreOf,
  isModelBundleOf,
  licenseLabelOf,
  listingsForTheme,
  materialsOf,
  modelUrlOf,
  polygonCountOf,
  polygonsOf,
  previewUrlOf,
  remainingInRound,
  remainingPool,
  priceTagOf,
  randomIndex,
  seamVerdictOf,
  sheetSpecOf,
  statRowsOf,
  themeCounts,
  variantNoteOf,
} from "../app/components/gacha/gacha-catalog.ts";

/**
 * 캡슐 머신의 계약.
 *
 * 화면 없이 확인할 수 있는 것만 여기서 확인한다: 설명 문장에서 무엇을 읽어 내는지,
 * 못 읽은 항목이 정말로 빠지는지, 등급 규칙이 무엇인지, 한 바퀴 도는 동안 중복 없이
 * 뽑는지, 베타 가격을 어떻게 적는지, 그리고 소스가 지키기로 한 몇 가지
 * (로그아웃이어도 뽑기는 된다 / 소리는 합성이다 / 글자는 0.72rem 밑으로 안 간다).
 *
 * 아래 설명 문장은 2026-09-02 에 https://clunk.games/api/marketplace 가 실제로 준 값을
 * 그대로 옮긴 것이다 — 여기에 없는 문장에서 숫자를 읽어 내는 일이 없도록.
 */

/** 운영 API 응답에서 그대로 가져온 표본. 값을 손으로 고치지 말 것. */
const TRACTOR = {
  id: "listing-w1-cozy-tractor", slug: "cozy-tractor", title: "코지 트랙터",
  description: "농장 배경에 세우는 가벼운 3D 트랙터입니다. 파일을 열어 잰 값으로 폴리곤 1,060개, 그리기 18회, 재질 5개이고 실제 크기는 2.29x2.03x2.98 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-w1-cozy-tractor", entryFileName: "tractor.glb", byteLength: 74764,
  previewFileName: "preview-cozy-tractor.webp", variantOf: null, variants: [], palette: null,
};

const STALL = {
  id: "listing-stall", slug: "cozy-market-stall", title: "시장 노점",
  description: "가벼운 3D 시장 좌판입니다. 파일을 열어 잰 값으로 폴리곤 2,456개, 그리기 31회, 재질 11개이고 실제 크기는 2.44x2.39x1.35 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 690000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-stall", entryFileName: "market-stall.m1.clunk-optimized.glb", byteLength: 214584,
  previewFileName: "preview-cozy-market-stall.webp", variantOf: null,
  variants: [{ slug: "cozy-market-stall-sprites", title: "시장 노점 · 스프라이트 시트" }],
  palette: [{ hex: "#a8794b", share: 0.3586 }, { hex: "#6b4630", share: 0.2865 }],
};

const FARM_SET = {
  id: "listing-farmset", slug: "cozy-farm-set-vol1", title: "코지 팜 세트 Vol.1 (3종 묶음)",
  description: "시장 좌판·창고 헛간·울타리 문 세 가지를 한 번에 받는 묶음입니다. 셋을 합쳐 폴리곤 4,596개, 그리기 68회, 재질 26개입니다. 세 가지 모두 웹·모바일 게임 기준 100점, 막히는 문제 0건입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-farmset", entryFileName: "market-stall.m1.clunk-optimized.glb", byteLength: 214584,
  previewFileName: "preview-cozy-fence-gate.webp", variantOf: null,
  variants: [{ slug: "cozy-farm-set-vol1-sprites", title: "코지 팜 세트 Vol.1 (3종) — 스프라이트 시트 (64×64, 8방향)" }],
  palette: [{ hex: "#a8794b", share: 1 }],
};

const GROVE = {
  id: "listing-grove", slug: "grove-tree-pack-vol1", title: "나무 6종 팩",
  description: "잎 넓은 나무 4종과 침엽수 2종, 모두 여섯 그루의 가벼운 3D 나무 묶음입니다. 한 그루에 폴리곤 860~2,136개이며, 그루마다 재질 2개·그리기 2회·텍스처 0장으로 통일돼 있습니다. 여섯 그루 모두 웹·모바일 게임 기준 100점, 막히는 문제 0건이고 색이 모델에 들어 있어 텍스처 파일이 없습니다.",
  priceCents: 290000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-grove", entryFileName: "broadleaf-round-full.glb", byteLength: 189820,
  previewFileName: "preview-grove-broadleaf-column-flame.webp", variantOf: null,
  variants: [{ slug: "grove-tree-pack-vol1-sprites", title: "나무 6종 팩 · 스프라이트 시트" }],
  palette: [{ hex: "#6d8b4a", share: 0.6 }],
};

/** 여닫기 동작 시트가 딸린 모델. 실제 운영 응답에서 그대로 옮긴 제목이다. */
const GATE = {
  id: "listing-gate", slug: "cozy-fence-gate", title: "울타리 문",
  description: "가벼운 3D 울타리 문입니다. 파일을 열어 잰 값으로 폴리곤 520개, 그리기 13회, 재질 6개이고 실제 크기는 2.67x1.75x0.52 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
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
  priceCents: 490000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-greenhouse", entryFileName: "greenhouse.m1.clunk-optimized.glb", byteLength: 120000,
  previewFileName: "preview-cozy-greenhouse.webp", variantOf: null,
  variants: [{ slug: "cozy-greenhouse-sprites", title: "코지 온실 — 스프라이트 시트 (64×64, 8방향)" }],
  palette: [{ hex: "#d3e3d7", share: 0.53 }],
};

const MEADOW = {
  id: "listing-meadow", slug: "tex-grass-meadow-v1", title: "초원 풀 텍스처",
  description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 경계 약함(가로 1.62 / 세로 1.77, 1에 가까울수록 좋음)입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-meadow", entryFileName: "tex-grass-meadow-v1.png", byteLength: 2732086,
  previewFileName: "preview-tex-grass-meadow-v1.webp", variantOf: null, variants: [],
  palette: [{ hex: "#4d6b34", share: 0.5 }],
};

const SOIL = {
  id: "listing-soil", slug: "tex-soil-tilled-v2", title: "경작지 흙 텍스처",
  description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 이음매 없음(가로 1.19 / 세로 1.5, 1에 가까울수록 좋음)입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-soil", entryFileName: "tex-soil-tilled-v2.png", byteLength: 2591910,
  previewFileName: "preview-tex-soil-tilled-v2.webp", variantOf: null, variants: [],
  palette: [{ hex: "#6b4a2f", share: 0.4 }],
};

const FARMHAND = {
  id: "listing-farmhand", slug: "farmhand-walk-sprites", title: "팜핸드 (밀짚모자 농부) — 걷기 애니메이션 (64×64, 8방향 × 8프레임)",
  description: "64×64 PNG 64컷으로, 8방향 각각에 8프레임짜리 걷기 동작이 들어 있습니다. Clunk가 코드로 만든 폴리곤 480개짜리 3D 모델을 렌더한 것이라, 모든 방향·모든 프레임이 같은 모델에서 나옵니다.",
  priceCents: 90000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-farmhand", entryFileName: "threejs-factory-v1.sheet.png", byteLength: 13952,
  previewFileName: "threejs-factory-v1.sheet.card.png", variantOf: null, variants: [],
  palette: [{ hex: "#c9a227", share: 0.3 }],
};

const CRATE_SHEET = {
  id: "listing-crate-sheet", slug: "cozy-crate-closed-sprites", title: "나무 궤짝 (닫힘) — 스프라이트 시트",
  description: "64×64 PNG 8컷입니다.",
  priceCents: 90000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
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
});

test("머신에는 공개된 상품만, 구운 스프라이트 시트는 빼고 넣는다", () => {
  const slugs = drawableListings(SAMPLE).map((row) => row.slug);
  assert.ok(!slugs.includes("cozy-crate-closed-sprites"), "모델에서 구운 시트는 따로 뽑히지 않는다");
  assert.ok(!slugs.includes("cozy-storage-shed"), "공개되지 않은 상품은 머신에 들어가지 않는다");
  assert.ok(slugs.includes("farmhand-walk-sprites"), "3D 모델이 없는 시트는 그 자체가 상품이다");
  assert.equal(slugs.length, 9);
});

test("다이얼 옆의 수는 그 테마에 실제로 있는 상품 수다", () => {
  const counts = themeCounts(SAMPLE);
  assert.equal(counts.all, drawableListings(SAMPLE).length);
  assert.equal(counts.structure, 4);
  assert.equal(counts.prop, 2);
  assert.equal(counts.tree, 1);
  assert.equal(counts.texture, 2);
  assert.equal(counts.structure + counts.prop + counts.tree + counts.texture, counts.all);
  for (const theme of GACHA_THEMES) {
    assert.equal(listingsForTheme(SAMPLE, theme.id).length, counts[theme.id], theme.id);
  }
});

test("잰 값은 설명에 적힌 문장에서만 읽는다", () => {
  assert.equal(polygonsOf(TRACTOR), "1,060개");
  assert.equal(drawCallsOf(TRACTOR), "18회");
  assert.equal(materialsOf(TRACTOR), "5개");
  assert.equal(boundsOf(TRACTOR), "2.29 × 2.03 × 2.98 m");

  assert.equal(polygonsOf(FARM_SET), "모두 합쳐 4,596개");
  assert.equal(drawCallsOf(FARM_SET), "모두 합쳐 68회");
  assert.equal(materialsOf(FARM_SET), "모두 합쳐 26개");
  assert.equal(boundsOf(FARM_SET), null, "묶음에는 하나의 실제 크기가 없다");

  assert.equal(polygonsOf(GROVE), "한 그루에 860~2,136개");
  assert.equal(drawCallsOf(GROVE), "한 그루에 2회");
  assert.equal(materialsOf(GROVE), "한 그루에 2개");

  // 텍스처에는 폴리곤이 없다 — 없으면 없다고 한다.
  assert.equal(polygonsOf(MEADOW), null);
  assert.equal(drawCallsOf(MEADOW), null);
  // 팜핸드 설명에도 '폴리곤 480개'가 있지만 그것은 시트를 구운 원본 모델의 값이라
  // 잰 값 문장이 아니다. 상품의 값처럼 보여 주지 않는다.
  assert.equal(polygonsOf(FARMHAND), null);
  assert.equal(polygonsOf({ description: "아무 숫자도 없는 설명입니다." }), null);
});

test("규격 한 줄도 설명에 적힌 문장에서만 읽는다", () => {
  assert.equal(sheetSpecOf(MEADOW), "1024×1024 · 1장");
  assert.equal(sheetSpecOf({ description: "1024×1024 이음매 없는 텍스처 7종을 한 번에 받는 묶음입니다." }), "1024×1024 · 7장");
  assert.equal(sheetSpecOf(FARMHAND), "64×64 · 64컷");
  assert.equal(sheetSpecOf({ description: "설명이 아무 규격도 적지 않았습니다." }), null);
});

test("등급은 눈에 보이는 품질로 가르고, 규칙을 그대로 적는다", () => {
  // 2026-09-02: 검사 점수는 팔리는 것 거의 전부가 100점이라 등급을 가르지 못했다.
  // 이제 등급은 "움직이는 동작이 있는가" 와 "얼마나 복잡한가" 두 가지로만 갈린다.

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

  // C — 그 외. 단순한 소품과 텍스처 낱장이 여기 온다.
  assert.deepEqual(
    gradeOf({ ...TRACTOR, description: "잰 값으로 폴리곤 552개, 그리기 3회, 재질 1개입니다." }),
    { letter: "C", basis: "polygons" },
  );
  assert.deepEqual(gradeOf(MEADOW), { letter: "C", basis: "plain" });
  assert.equal(gradeBasisOf(MEADOW), null, "텍스처 한 장에는 내세울 근거가 없다");

  // 텍스처 일곱 장 묶음은 모델 묶음이 아니다 — 낱장 일곱 장이라 C 에 남는다.
  const texturePack = {
    ...MEADOW,
    slug: "verified-seamless-textures-vol1", title: "텍스처 7종 묶음",
    description: "1024×1024 이음매 없는 텍스처 7종을 한 번에 받는 묶음입니다.",
  };
  assert.equal(isModelBundleOf(texturePack), false);
  assert.equal(gradeOf(texturePack).letter, "C");

  // 화면에 적히는 규칙과 코드가 매기는 규칙은 같은 문장이어야 한다.
  assert.equal(
    GRADE_RULE,
    "등급 기준: S 움직이는 동작 포함(폴리곤 1,500개 이상) 또는 폴리곤 4,000개 이상 · A 움직이는 동작 포함 또는 1,500개 이상 또는 묶음 · B 700개 이상 · C 그 외",
  );
  // 검사 점수와 이음매 판정은 여전히 읽지만 등급을 정하지는 않는다.
  assert.equal(inspectionScoreOf(TRACTOR), 100);
  assert.equal(seamVerdictOf(SOIL), "이음매 없음");
  assert.equal(gradeOf(SOIL).letter, "C", "이음매가 없어도 텍스처 한 장은 단순한 물건이다");

  // 등급 색은 한 벌뿐이다 — 캡슐 이음 링, 카드 배지, 빛줄기가 이것을 같이 쓴다.
  assert.deepEqual(Object.keys(GRADE_COLORS).sort(), ["A", "B", "C", "S"]);
  for (const letter of ["S", "A", "B", "C"]) {
    assert.match(GRADE_COLORS[letter], /^#[0-9a-f]{6}$/u, letter);
  }
  assert.notEqual(GRADE_COLORS.S, GRADE_COLORS.C);
});

test("카드는 읽지 못한 항목을 빈칸으로 채우지 않고 줄째로 뺀다", () => {
  const tractor = statRowsOf(TRACTOR);
  assert.deepEqual(tractor, [
    { label: "테마", value: "농장 소품" },
    { label: "폴리곤", value: "1,060개" },
    { label: "재질", value: "5개" },
    { label: "실제 크기", value: "2.29 × 2.03 × 2.98 m" },
    { label: "파일 크기", value: "74.8 KB" },
    { label: "라이선스", value: "상업적 이용 가능" },
  ]);

  const meadow = statRowsOf(MEADOW).map((row) => row.label);
  assert.deepEqual(meadow, ["테마", "규격", "파일 크기", "라이선스"]);
  for (const row of [...statRowsOf(TRACTOR), ...statRowsOf(MEADOW), ...statRowsOf(GROVE)]) {
    assert.notEqual(row.value.trim(), "");
    assert.notEqual(row.value.trim(), "—");
  }

  // 파일 크기를 모르면 그 줄이 없다.
  const noBytes = statRowsOf({ ...MEADOW, byteLength: null }).map((row) => row.label);
  assert.ok(!noBytes.includes("파일 크기"));
});

test("결제가 없으면 값을 지우지 않고 그어 둔다", () => {
  assert.deepEqual(priceTagOf({ priceCents: 190000 }, true), { struck: "1,900원", label: "무료" });
  assert.deepEqual(priceTagOf({ priceCents: 190000 }, false), { struck: null, label: "1,900원" });
  assert.deepEqual(priceTagOf({ priceCents: 0 }, true), { struck: null, label: "무료" });
  assert.equal(formatWon(690000), "6,900원");
  assert.equal(formatBytes(74764), "74.8 KB");
  assert.equal(formatBytes(2732086), "2.7 MB");
  assert.equal(formatBytes(820), "820 B");
  assert.equal(licenseLabelOf("cleared"), "상업적 이용 가능");
  assert.equal(licenseLabelOf(null), null);
});

test("캡슐 색은 그 상품에서 잰 색이고, 못 잰 것만 테마색으로 떨어진다", () => {
  assert.equal(capsuleColorOf(STALL), "#a8794b");
  // 트랙터는 팔레트를 재지 못한 상품이라 그 갈래(농장 소품)의 색으로 간다.
  const propAccent = GACHA_THEMES.find((theme) => theme.id === "prop").accent;
  assert.equal(capsuleColorOf(TRACTOR), propAccent);
  assert.equal(capsuleColorOf({ slug: "tex-x", palette: [{ hex: "not-a-colour", share: 1 }] }),
    GACHA_THEMES.find((theme) => theme.id === "texture").accent);

  // 돔은 자리 수만큼 채우되 색은 지금 통에 든 상품에서만 돌려 쓴다.
  const pool = listingsForTheme(SAMPLE, "texture");
  const capsules = domeCapsules(pool, 26);
  assert.equal(capsules.length, 26);
  assert.deepEqual([...new Set(capsules.map((capsule) => capsule.slug))].sort(), pool.map((row) => row.slug).sort());
  assert.equal(domeCapsules([], 26).length, 0);

  // 이음 링은 그 상품의 등급 색이다 — 돔 안에서 무엇이 들었는지 미리 읽힌다.
  const domeOfAll = domeCapsules(drawableListings(SAMPLE), 30);
  for (const capsule of domeOfAll) {
    const listing = drawableListings(SAMPLE).find((row) => row.slug === capsule.slug);
    assert.equal(capsule.letter, gradeOf(listing).letter, capsule.slug);
    assert.equal(capsule.ring, GRADE_COLORS[capsule.letter], capsule.slug);
  }
  assert.ok(
    new Set(domeOfAll.map((capsule) => capsule.ring)).size > 1,
    "한 통에 등급이 섞여 있으면 링 색도 섞여 보여야 한다",
  );
});

test("한 바퀴 도는 동안 같은 것이 두 번 나오지 않는다", () => {
  const pool = drawableListings(SAMPLE);
  let drawn = [];
  const seen = [];
  for (let round = 0; round < pool.length; round += 1) {
    const result = drawFrom(pool, drawn);
    assert.ok(result, "통이 비어 있지 않으면 언제나 하나 나온다");
    assert.ok(!seen.includes(result.listing.id), `${result.listing.slug} 가 한 바퀴 안에 두 번 나왔다`);
    seen.push(result.listing.id);
    drawn = result.drawn;
  }
  assert.equal(seen.length, pool.length, "한 바퀴면 전부 한 번씩 나온다");

  // 다 나오면 그 자리에서 통을 새로 채우고 기록도 새로 쌓는다.
  const next = drawFrom(pool, drawn);
  assert.equal(next.drawn.length, 1);
  assert.equal(next.drawn[0], next.listing.id);

  // 통이 비면 아무것도 나오지 않는다 — 없는 상품을 지어내지 않는다.
  assert.equal(drawFrom([], []), null);

  // "이번 바퀴 남은 개수" 는 아직 안 나온 것의 실제 수다. 한 바퀴가 끝나면 통을 새로 채운다.
  assert.equal(remainingInRound(pool, []), pool.length);
  assert.equal(remainingInRound(pool, [pool[0].id]), pool.length - 1);
  assert.equal(remainingInRound(pool, pool.map((row) => row.id)), pool.length);
  assert.equal(remainingInRound([], []), 0);

  // 뽑기는 crypto.getRandomValues 로만 고른다.
  const counts = new Map();
  for (let index = 0; index < 4000; index += 1) {
    const value = randomIndex(5);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 5);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  assert.equal(counts.size, 5, "다섯 자리가 모두 나와야 균등하다");
  assert.equal(randomIndex(1), 0);
});

test("미리보기와 3D 파일은 상점이 이미 공개해 둔 경로 그대로다", () => {
  // 2026-09-03: 미리보기는 저장소가 내주는 API 주소다 — 워커에 번들된 정적 사본은 옛 파일이 남는다.
  assert.equal(previewUrlOf(STALL), "/api/marketplace/assets/asset-stall?file=preview-cozy-market-stall.webp&preview=1");
  assert.equal(previewUrlOf({ assetId: "a", previewFileName: null }), null);
  assert.equal(modelUrlOf(STALL), "/market/cozy-market-stall/market-stall.m1.clunk-optimized.glb");
  // 텍스처를 3D 뷰어에 넣지 않는다.
  assert.equal(modelUrlOf(MEADOW), null);
  assert.equal(variantNoteOf(STALL), "스프라이트 시트 1종 포함");
  assert.equal(variantNoteOf(FARMHAND), null);
});

test("로그아웃이어도 뽑기와 연출은 되고, 받기만 로그인을 요구한다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  // 받기는 상점이 이미 쓰는 흐름을 그대로 부른다.
  assert.match(machine, /"\/api\/marketplace\/checkout"/u);
  assert.match(machine, /paymentMethod: "beta"/u);
  assert.match(machine, /BETA_GRANTED/u);
  // 받은 파일은 같은 출처의 downloadUrl 을 링크로 눌러 곧장 내려받는다.
  assert.match(machine, /anchor\.download = prize\.entryFileName/u);
  assert.match(machine, /const LOGIN_HREF = "\/signup\?return_to=%2F%3Fintent%3Dmarket"/u);
  // 2026-09-03(운영자): "로그인하고 받기"가 빈손으로 돌아왔다. 뽑은 것이 있으면 문은 그
  // 물건의 상품 페이지로 돌아온다 — 거기 받기 단추가 이미 있다. 아무것도 안 뽑았을 때만
  // 위의 첫 화면 주소를 쓴다.
  assert.match(machine, /function loginHrefFor\(listing: GachaListing \| null\): string/u);
  assert.match(
    machine,
    /return `\/signup\?return_to=\$\{encodeURIComponent\(`\/marketplace\/\$\{slug\}\?intent=market`\)\}`/u,
  );
  assert.match(machine, /loginHref: loginHrefFor\(prize\)/u);
  assert.match(machine, /loginHref=\{loginHrefFor\(prize\)\}/u);
  // 돌아온 사람에게 돌려줄 마지막 뽑기는 이 세션에만, 30분만 남는다.
  assert.match(machine, /const LAST_PRIZE_KEY = "clunk\.gacha\.last-prize"/u);
  assert.match(machine, /const LAST_PRIZE_TTL_MS = 30 \* 60 \* 1000/u);
  assert.match(machine, /if \(Date\.now\(\) - record\.at > LAST_PRIZE_TTL_MS\) return null/u);
  assert.match(machine, /intent=market/u);
  assert.match(machine, /setStage\("result"\)/u);
  // 잔액은 이 화면이 들지 않는다 — 지갑이 내비로 올라갔고(CoinHud), 거기서 /api/credits 를
  // 한 번만 부른다. 이 화면은 "받기" 단추 때문에 로그인 여부만 묻는다.
  assert.doesNotMatch(machine, /"\/api\/credits"/u);
  assert.match(machine, /void fetch\("\/api\/session", \{ cache: "no-store" \}\)/u);
  assert.doesNotMatch(machine, /Math\.random\(\)\s*\*\s*\d/u);
  // 뽑기 자체에는 로그인 검사가 없다 — 로그아웃이어도 연출과 카드까지 간다.
  assert.doesNotMatch(machine, /if \(!authenticated\)[\s\S]{0,120}setStage/u);
  // 중복 없는 뽑기 기록은 세션에만 남는다.
  assert.match(machine, /sessionStorage/u);

  const card = await readFile(new URL("../app/components/gacha/PrizeCard.tsx", import.meta.url), "utf8");
  assert.match(card, /로그인하고 받기/u);
  assert.match(card, /다시 뽑기/u);
  assert.match(card, /\/marketplace\/\$\{listing\.slug\}/u);
  assert.match(card, /role="dialog"/u);
  assert.match(card, /aria-live="polite"/u);
  assert.match(card, /GRADE_RULE/u);
  // 카드에는 이번 바퀴 남은 개수가 실제 값으로 적힌다.
  assert.match(card, /이번 바퀴 남은 개수/u);
});

test("연출은 레버 당김 → 흔들림 → Clunk → 캡슐 → 흔들흔들 → 빛 → 카드 순서다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  for (const stage of ["idle", "pull", "shake", "impact", "capsule", "wobble", "burst", "result"]) {
    assert.match(machine, new RegExp(`"${stage}"`, "u"), `${stage} 단계가 없다`);
  }
  // 크랭크(돌리기)는 남아 있지 않다 — 운영자가 당기는 레버를 요구했다.
  assert.doesNotMatch(machine, /setStage\("crank"\)|CRANK_TRIGGER_DEGREES/u);
  // 시간표는 코드에 그대로 적혀 있다: 흔들림 0.75초부터, 떨어지는 것이 1.95초, Clunk 이 2.73초.
  assert.match(machine, /shake: 750/u);
  assert.match(machine, /impact: 1950/u);
  assert.match(machine, /clunk: 2730/u);
  assert.match(machine, /capsule: 3200/u);
  // 움직임을 줄여 달라는 설정에서는 짧은 시간표를 쓴다.
  assert.match(machine, /reducedMotion \? TIMING\.reduced : TIMING\.full/u);
  // 레버는 끝까지 내려가는 거리(96px)의 40% 인 40px 을 넘겨 끌면 발동하고, 키보드로도
  // 눌린다(button + onClick). 2026-09-03: 60px 은 손잡이 지름(88px)만큼 긴 거리였다.
  assert.match(machine, /const LEVER_TRIGGER_PIXELS = 40/u);
  assert.match(machine, /const LEVER_TRAVEL_PIXELS = 96/u);
  assert.match(machine, /pulled >= LEVER_TRIGGER_PIXELS/u);
  const trigger = Number(/const LEVER_TRIGGER_PIXELS = (\d+)/u.exec(machine)?.[1]);
  const travel = Number(/const LEVER_TRAVEL_PIXELS = (\d+)/u.exec(machine)?.[1]);
  assert.ok(trigger / travel >= 0.4, `발동 거리 ${trigger}px 은 전체 ${travel}px 의 40% 에 못 미친다`);
  // 짧게 끌고 놓으면 아무것도 뽑히지 않는다 — 뒤따라오는 클릭을 삼킨다.
  assert.match(machine, /const LEVER_DRAG_SLOP = 6/u);
  assert.match(machine, /if \(wasDragging && drag\.moved > LEVER_DRAG_SLOP\) swallowLeverClick\.current = true/u);
  assert.match(machine, /if \(swallowLeverClick\.current\) \{ swallowLeverClick\.current = false; return; \}/u);
  // 끌기는 단추가 아니라 창이 듣는다 — 포인터 잡기가 풀려도 끝까지 따라간다.
  assert.match(machine, /window\.addEventListener\("pointermove", onMove\)/u);
  assert.match(machine, /window\.addEventListener\("pointerup", onUp\)/u);
  assert.match(machine, /window\.addEventListener\("pointercancel", onUp\)/u);
  assert.match(machine, /setPointerCapture\(event\.pointerId\)/u);
  // 엄지로 한 번에 잡을 크기 — 손잡이 단추는 64px 밑으로 내려가지 않는다.
  assert.match(machine, /const LEVER_HIT_PIXELS = 64/u);
  assert.match(machine, /put\(leverRef\.current, points\.lever, LEVER_HIT_PIXELS\)/u);
  assert.match(machine, /aria-label="레버를 당겨 에셋 뽑기"/u);
  // 화면 없이 단계를 세우고 프레임을 돌리는 두 손잡이.
  assert.match(machine, /__gachaStep/u);
  assert.match(machine, /__gachaFrame/u);
  // 화면 밖이거나 탭이 숨으면 렌더 루프를 멈춘다.
  assert.match(machine, /IntersectionObserver/u);
  assert.match(machine, /document\.visibilityState === "hidden"/u);
  // WebGL 이 없으면 SVG 머신으로 되돌아간다.
  assert.match(machine, /if \(!webgl\) return <CapsuleMachine \/>;/u);
});

test("첫 페인트에 기계가 있고, 카탈로그는 나중에 쏟아져 들어온다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");

  // 2026-09-02: 운영자가 처음 본 것은 "머신에 캡슐을 채우는 중입니다…" 글자만 있는 빈
  // 화면이었다. 그 자리를 대신하는 것은 아직 비어 있는 진짜 기계다.
  assert.doesNotMatch(machine, /머신에 캡슐을 채우는 중/u, "기다리는 동안 글자만 띄우지 않는다");
  // 장면은 카탈로그가 아니라 WebGL 만 보고 선다.
  assert.match(machine, /if \(!webgl\) return;\s*const host = hostRef\.current;/u);
  assert.doesNotMatch(machine, /if \(!webgl \|\| load !== "ready"\) return;/u);
  // 카탈로그가 실패하거나 비어 있어도 기계는 남고 안내 한 줄만 붙는다.
  assert.match(machine, /const notice = load === "failed"/u);
  assert.match(machine, /className="gc3-notice"/u);
  // 캡슐이 처음 들어오는 그 한 번만 쏟아 붓는다.
  assert.match(machine, /scene\.setCapsules\(capsuleSpecs, \{ pour \}\)/u);
  assert.match(machine, /const pour = capsuleSpecs\.length > 0 && !poured\.current/u);
});

test("등장 연출은 세션당 한 번, 2.4초 안에 끝나고, 누르면 건너뛴다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  const scene = await readFile(new URL("../app/components/gacha/gacha-scene.ts", import.meta.url), "utf8");

  // 리액트가 소리를 얹는 시간표와 장면이 그림을 움직이는 시간표는 같은 값이어야 한다.
  assert.match(
    machine,
    /const INTRO_MS = \{ spotlight: 180, land: 860, neon: 1020, pour: 1280, total: 2400 \}/u,
  );
  assert.match(scene, /spotlight: 0\.18/u);
  assert.match(scene, /land: 0\.86/u);
  assert.match(scene, /neon: 1\.02/u);
  assert.match(scene, /pour: 1\.28/u);
  assert.match(scene, /total: 2\.4/u);

  // 네 가지 소리가 그 자리에 얹힌다.
  for (const call of ["playLeverClick()", "playClunk()", "playNeonBuzz()", "playRumble(0.9)"]) {
    assert.ok(machine.includes(call), `${call} 이 등장 연출에 없다`);
  }
  // 세션당 한 번, 그리고 누르거나 키를 치면 건너뛴다.
  assert.match(machine, /const INTRO_KEY = "clunk\.gacha\.intro"/u);
  assert.match(machine, /if \(reducedMotion \|\| introAlreadySeen\(\) \|\| posterShownMs\.current > 700\)/u);
  assert.match(machine, /scene\.skipIntro\(\)/u);
  assert.match(machine, /window\.addEventListener\("pointerdown", skip, true\)/u);
  // 연출 표시는 리액트 상태가 아니라 뿌리 요소의 속성이다 — 서버가 그린 첫 화면과
  // 어긋나지 않고, 효과 안에서 렌더를 한 번 더 돌리지도 않는다.
  assert.match(machine, /node\.dataset\.intro = "1"/u);
  assert.match(machine, /window\.addEventListener\("keydown", skip, true\)/u);
  // 움직임을 줄여 달라는 설정이면 장면도 그 자리에서 완성 상태가 된다.
  assert.match(scene, /startIntro\(\) \{\s*if \(reduced\) \{ finishIntro\(\); return; \}/u);
});

test("3D 장면은 외부 모델 파일 없이 코드로만 짓는다", async () => {
  const scene = await readFile(new URL("../app/components/gacha/gacha-scene.ts", import.meta.url), "utf8");
  // 기계는 three.js 기본 도형으로만 만든다 — 머신 모델을 어디서도 받아 오지 않는다.
  for (const piece of ["SphereGeometry", "CylinderGeometry", "TorusGeometry", "RoundedBoxGeometry"]) {
    assert.match(scene, new RegExp(piece, "u"), `${piece} 가 없다`);
  }
  // 파일을 받아 오는 자리는 상품 GLB 하나뿐이다(loadModel).
  const fetches = [...scene.matchAll(/fetch\(/gu)];
  assert.equal(fetches.length, 1, "장면이 받아 오는 파일은 상품 GLB 하나뿐이어야 한다");
  assert.doesNotMatch(scene, /\.glb"|\.gltf"|\.hdr|\.exr/u);

  // 데스크톱과 모바일 두 벌의 씀씀이.
  assert.match(scene, /DESKTOP_QUALITY: Quality = \{ capsules: 40, dpr: 2, shadowMap: 1024/u);
  assert.match(scene, /MOBILE_QUALITY: Quality = \{ capsules: 24, dpr: 1\.5, shadowMap: 512/u);
  // 그림자 설정은 상품 뷰어와 같은 규칙(bias 0 + normalBias).
  assert.match(scene, /shadow\.bias = 0/u);
  assert.match(scene, /shadow\.normalBias/u);
  // 움직임을 줄여 달라는 설정에서는 대기 애니메이션과 파티클을 만들지 않는다.
  assert.match(scene, /if \(!reduced\) stepCapsules/u);
  assert.match(scene, /sparkMaterial\.opacity = reduced \? 0/u);
  // 캡슐은 두 색 반구 + 이음 링 세 조각이다.
  assert.match(scene, /capsuleGeometryTop/u);
  assert.match(scene, /capsuleGeometryBottom/u);
  assert.match(scene, /capsuleGeometryRing/u);
  // 캔버스에 실제로 그려졌는지 셀 수 있어야 한다.
  assert.match(scene, /countDrawnPixels/u);
});

test("레버는 돌리는 것이 아니라 당기는 것이고, 통은 비어 있는 채로 선다", async () => {
  const scene = await readFile(new URL("../app/components/gacha/gacha-scene.ts", import.meta.url), "utf8");

  // 세로 레버 세 조각 — 받침, 축, 둥근 손잡이.
  for (const piece of ["leverMount", "leverArm", "leverKnob"]) {
    assert.match(scene, new RegExp(piece, "u"), `${piece} 가 없다`);
  }
  // 당긴 만큼 축이 앞으로 넘어간다(회전축은 x). 돌리던 크랭크는 남아 있지 않다.
  assert.match(scene, /lever\.rotation\.x = leverValue \* 1\.26/u);
  assert.doesNotMatch(scene, /crank\.rotation\.z|setCrankAngle/u);
  // 끝까지 내려갔다 스프링처럼 튕겨 올라온다.
  assert.match(scene, /Math\.cos\(spring \* 7\.4\) \* \(1 - spring\)/u);

  // 첫 프레임에 통은 비어 있다 — 캡슐은 카탈로그가 올 때 투입구로 들어온다.
  assert.match(scene, /ensureCapsules\(0\)/u);
  assert.match(scene, /function stackAboveHatch/u);
  assert.match(scene, /if \(options\?\.pour && !reduced && count > 0\)/u);
  // 돔 꼭대기에 실제로 구멍이 뚫려 있고 깔때기가 얹혀 있다.
  assert.match(scene, /HATCH_PHI, Math\.PI \* 0\.76 - HATCH_PHI/u);
  assert.match(scene, /const funnel =/u);
});

test("공개 화면은 기계가 통째로 숨어도 남는다", async () => {
  const scene = await readFile(new URL("../app/components/gacha/gacha-scene.ts", import.meta.url), "utf8");

  // 2026-09-02: 기계를 통째로 숨기기 시작한 뒤로 공개 화면이 까맣게 나왔다 —
  // 상품과 빛 터짐이 기계의 자식이라 같이 사라졌다. 이제 따로 산다.
  assert.match(scene, /const reveal = new THREE\.Group\(\);\s*scene\.add\(reveal\);/u);
  for (const line of ["reveal.add(prize.group)", "reveal.add(burstGroup)", "reveal.add(prizeArt)"]) {
    assert.ok(scene.includes(line), `${line} 이 없다`);
  }
  assert.ok(!scene.includes("machine.add(prizeArt)"), "상품은 기계의 자식이 아니다");
  assert.ok(!scene.includes("machine.add(prize.group)"));
  // 가려 놓는 막(z 2.6)은 상품(z 4.5)보다 뒤, 기계 앞면(z 0.71)보다 앞에 서 있어야 한다.
  assert.match(scene, /backdrop\.position\.set\(0, 1\.9, 2\.6\)/u);
  assert.match(scene, /STAGE_FRONT = new THREE\.Vector3\(0, 2\.1, 4\.5\)/u);
  // 카메라가 한 걸음 물러나 받침이 바닥에 닿는 곳까지 담는다 — 잘린 기계는 떠 보인다.
  // 2026-09-02 밤: 무대가 화면 전체가 되면서 6.4 로 한 걸음 다가왔다. 세로 화면은 프레임에서 물러선다.
  assert.match(scene, /const CAMERA_DISTANCE = 6\.4/u);
  assert.match(scene, /const portrait = Math\.max\(1, 0\.62 \/ Math\.max\(0\.3, camera\.aspect\)\)/u);
  assert.match(scene, /const CAMERA_TARGET = 1\.6/u);

  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  // 그래픽 문맥이 날아가면 흰 상자 대신 SVG 머신을 보여 준다.
  assert.match(machine, /"webglcontextlost"/u);
});

test("가게 한 칸 — 바닥·뒷벽·전구·빛기둥·먼지가 있고 먼지는 60개를 넘지 않는다", async () => {
  const scene = await readFile(new URL("../app/components/gacha/gacha-scene.ts", import.meta.url), "utf8");
  for (const piece of ["const floor =", "const wall =", "const wallGlow =", "bulbGeometry", "const cone =", "dustGeometry"]) {
    assert.ok(scene.includes(piece), `${piece} 가 없다`);
  }
  // 대기 중 파티클 예산: 떠다니는 먼지(데스크톱 34) + 착지 먼지(24) = 58개.
  const desktopDust = Number(/DESKTOP_QUALITY[^;]*dust: (\d+)/u.exec(scene)?.[1]);
  const mobileDust = Number(/MOBILE_QUALITY[^;]*dust: (\d+)/u.exec(scene)?.[1]);
  const puff = Number(/const PUFF_COUNT = (\d+)/u.exec(scene)?.[1]);
  assert.ok(Number.isInteger(desktopDust) && Number.isInteger(mobileDust) && Number.isInteger(puff));
  assert.ok(desktopDust + puff <= 60, `파티클 ${desktopDust + puff}개는 예산(60)을 넘는다`);
  assert.ok(mobileDust <= desktopDust);
  // 등장 연출을 다시 돌리면 통을 비웠다가 투입구에서 다시 붓는다.
  assert.match(scene, /pile\.visible = !machineHidden && !pileHeld/u);
  // 상품이 뜨는 동안에는 가게도 같이 물러난다.
  assert.match(scene, /shop\.visible = !machineHidden/u);
});

test("소리는 외부 파일 없이 그 자리에서 합성한다", async () => {
  const source = await readFile(new URL("../app/components/gacha/gacha-sound.ts", import.meta.url), "utf8");
  assert.match(source, /createOscillator/u);
  assert.match(source, /createBuffer\(/u);
  // 일곱 가지가 모두 합성 함수로 있다.
  for (const name of [
    "playLeverClick",
    "playCrankRatchet",
    "playRumble",
    "playClunk",
    "playBounce",
    "playCapsuleTap",
    "playOpenSparkle",
    "playNeonBuzz",
  ]) {
    assert.match(source, new RegExp(`export function ${name}`, "u"), `${name} 이 없다`);
  }
  // 음원 파일을 받아오는 자리가 없어야 한다.
  assert.doesNotMatch(source, /fetch\(|\.mp3|\.wav|\.ogg/u);
});

test("머신 글자는 0.72rem 밑으로 내려가지 않는다", async () => {
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)rem/gu)].map((match) => Number(match[1]));
  assert.ok(sizes.length > 10, "검사할 font-size 선언이 있어야 한다");
  for (const size of sizes) assert.ok(size >= 0.72, `font-size ${size}rem 은 0.72rem 보다 작다`);
  // 가로 넘침을 막는 두 장치가 남아 있어야 한다.
  assert.match(css, /min-width: 0/u);
  assert.match(css, /overflow-wrap: anywhere/u);
  // 첫 화면은 머신이 다 차지한다.
  assert.match(css, /\.gc-hero \{[^}]*min-height: 100svh/u);
  // 엄지로 당길 크기 — SVG 폴백의 레버와 3D 머신의 손잡이 둘 다.
  assert.match(css, /\.gc-lever-grip \{[\s\S]*?min-height: 48px/u);
  assert.match(css, /\.gc3-lever \{[\s\S]*?min-height: 56px/u);
  assert.match(css, /\.gc3-capsule \{[\s\S]*?min-height: 48px/u);
  // 움직임을 줄여 달라는 설정에서는 흔들림과 파티클을 아예 만들지 않는다.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("무대는 내비 밑에서 시작하고, 제목은 기계를 덮지 않는다", async () => {
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  const site = await readFile(new URL("../app/site-v5.css", import.meta.url), "utf8");

  // 2026-09-03(운영자): 기계 꼭대기가 내비 띠 안으로 올라와 메뉴를 가렸다. 캔버스와
  // 포스터가 내비 높이만큼 내려서 시작한다 — 장면 파일은 건드리지 않는다.
  assert.match(css, /html:has\(\.gc-film\) \{ --gc-nav-h: 84px; \}/u);
  // 내비가 앉는 띠는 꺼 두지 않는다 — 카메라가 기계 안으로 들어가는 근접 장면에서도
  // 메뉴는 이 띠 위에서 읽힌다.
  assert.match(css, /html:has\(\.gc-film\) \.sitenav-dock::before \{\s*opacity: 1 !important;\s*top: 0;\s*height: var\(--gc-nav-h, 84px\);/u);
  assert.doesNotMatch(css, /\.sitenav-dock::before \{ opacity: 0 !important; \}/u);
  assert.match(
    css,
    /\.gc-film \.gc3-canvas,\s*\.gc-film \.gc3-poster \{[\s\S]{0,400}?top: var\(--gc-head-h\);/u,
  );
  // 내비는 무대의 어떤 층보다도 위에 선다.
  assert.match(site, /\.cv5 \.sitenav-dock \{ position: fixed; inset: 0 0 auto 0; z-index: 80; \}/u);

  // 넓은 화면: 제목은 왼쪽 칸, 기계는 그만큼 오른쪽으로 물러난다.
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.gc-film \{\s*--gc-stage-left: clamp\(292px, 25vw, 470px\);/u);
  // 캔버스가 비켜난 자리는 검은 상자가 아니라 같은 가게다 — 배경이 화면 전체에 남는다.
  assert.match(css, /\.gc-film\.gc3\[data-live\] \.gc3-stage::before,\s*\.gc-film\.gc3\[data-live\] \.gc3-stage::after \{ opacity: 1; \}/u);
  // 2026-09-03(2차): 모서리 페이드는 제목 글줄과 같은 ramp 로만 산다. 첫 샷 밖에서 남으면
  // 기계 한가운데를 세로로 가르는 어두운 띠가 된다(레버 근접샷에서 CLUNK 사인이 잘렸다).
  assert.match(css, /--gc-fade-left: calc\(var\(--gc-left-ramp, 1\) \* 240px\)/u);
  assert.match(css, /--gc-fade-top: calc\(14px \+ var\(--gc-left-ramp, 1\) \* 30px\)/u);
  assert.doesNotMatch(css, /--gc-fade-left: 120px/u);
  assert.match(machine, /const headBeat = ramp\(p, -1, 0, 0\.06, 0\.16\);/u);
  assert.match(machine, /setProperty\("--gc-left-ramp", headBeat\.toFixed\(3\)\)/u);
  // 마스크가 사라진 뒤의 층계는 기계를 덮어서가 아니라 옆 칸을 밝혀서 낮춘다 —
  // 그 빛은 캔버스 밑에 깔리고, 모서리 너머까지 늘어져 새 경계선을 만들지 않는다.
  assert.match(css, /\.gc-film-sticky::after \{[\s\S]*?width: calc\(var\(--gc-stage-left\) \+ 240px\);/u);
  // 장면에 카메라 훅이 붙으면 바로 쓰도록 호출을 미리 걸어 둔다(없으면 아무 일도 없다).
  assert.match(machine, /scene\.setTopInset\?\.\(inset\)/u);
  // 위를 비운 만큼 거리를 늘려야 기계 밑동이 남는다 — 둘은 항상 같이 불린다.
  assert.match(machine, /scene\.setFrameFill\?\.\(Math\.min\(1\.2, Math\.max\(1, \(h \/ Math\.max\(1, h - inset\)\) \* 1\.04 \* portrait\)\)\)/u);
  assert.match(machine, /applyCameraFraming\(scene as SceneWithCameraHooks, host\)/u);
  assert.match(css, /\.gc-beat-head \{\s*left: max\(28px, 4\.4vw\);/u);
  // 좁은 화면: 제목은 내비 아래 띠에 눕고 h1 은 2rem 을 넘지 않는다.
  assert.match(css, /@media \(max-width: 767px\) \{\s*html:has\(\.gc-film\) \{ --gc-nav-h: 76px; \}\s*\.gc-film \{ --gc-head-h: 196px; \}/u);
  assert.match(css, /\.gc-beat-head h1 \{ font-size: clamp\(1\.6rem, 6\.6vw, 2rem\); \}/u);

  // 자리잡기는 CSS 가, 떠오르는 거리만 스크롤이 넣는다 — 글줄의 스크롤 연출은 그대로다.
  assert.match(css, /transform: translate\(var\(--gc-beat-x\), var\(--gc-beat-rise, 0px\)\)/u);
  assert.match(machine, /node\.style\.setProperty\("--gc-beat-rise"/u);
  // 캔버스가 비켜난 만큼 단추 자리도 함께 옮긴다.
  assert.match(machine, /const dx = host\.offsetLeft;\s*const dy = host\.offsetTop;/u);
  // 움직임을 줄여 달라는 설정의 규칙은 그대로 남아 있다.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.gc-film-track \{ height: 100svh; \}/u);
});

test("랜딩은 캡슐 머신 한 대를 렌더한다", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<GachaMachine3D \/>/u);
  // 2026-09-02 밤: 첫 화면은 스크롤이 카메라를 움직이는 한 편의 영상이다. 헤드라인과 부제는
  // 무대 위 글줄(gc-beat-head)로 들어가 진행도가 띄우고 거둔다 — 페이지가 아니라 부품이 갖는다.
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  assert.match(machine, /className="gc-film-track"/u);
  assert.match(machine, /className="gc-film-sticky"/u);
  // 2026-09-03(운영자 목업): 제목은 두 줄로 서고 "뽑기" 가 강조색을 갖는다.
  assert.match(machine, /<h1 id="home-heading">게임 에셋<br \/><em>뽑기<\/em><\/h1>/u);
  assert.match(machine, /레버를 당기면 마켓의 에셋이 캡슐로 떨어집니다/u);
  // 스크롤이 레버를 당긴다 — 0.5 에서 0.6 사이.
  // 2026-09-04 운영자 지적으로 스크롤과 레버를 갈랐다: 스크롤은 카메라만 옮기고,
  // 뽑는 것은 손으로 레버를 당기거나 누를 때뿐이다. 스크롤이 다시 뽑게 만들지 않는다.
  assert.doesNotMatch(machine, /SCROLL_PULL|SCROLL_OPEN_AT|SCROLL_REARM_BELOW|scrollFired/u);
  assert.match(machine, /스크롤은 카메라만 옮긴다/u);
  // 손을 대지 않아도 캡슐은 잠깐 뒤 열린다 — 막다른 길을 남기지 않는다.
  assert.match(machine, /openLiveRef\.current\(\)/u);
  const scroll = await readFile(new URL("../app/components/gacha/gacha-scroll.ts", import.meta.url), "utf8");
  assert.match(scroll, /from: 0\.5, to: 0\.6/u);
  // 무대의 "베타 무료" 칩은 없다 — 값은 뽑은 뒤 카드에서만 말한다.
  assert.doesNotMatch(machine, /gc3-beta|베타 무료<\/span>/u);
  assert.doesNotMatch(source, /손잡이를 돌리면/u);
  // 자판기 넉 대 짜리 홀은 더 이상 없다.
  assert.doesNotMatch(source, /VendingHall|VendingMachine/u);
  // 손으로 적은 카탈로그 복사본이 다시 생기지 않았는지.
  assert.doesNotMatch(source, /LandingMarketShowcase/u);
  assert.doesNotMatch(source, /const SHOWCASE =/u);
});


/**
 * 크레딧 지갑 — 내비 안의 동전 알약 (2026-09-03, 운영자 2차 지시)
 *
 * 처음에는 첫 화면 무대 오른쪽 위에 떠 있었다. 지갑은 첫 화면만의 물건이 아니므로 내비로
 * 올라왔고, 그래서 규칙도 첫 화면만 읽는 gacha.css 가 아니라 모든 화면이 읽는 site-v5.css 에
 * 산다. 여기서 지키는 것은 다섯이다 — 내비가 걸고, 숫자는 서버에서 오고, 모르는 동안 대시를
 * 적지 않고, 충전은 약속하지 않고, 움직임을 줄여 달라면 멈춘다.
 */
test("크레딧 지갑은 내비 안의 알약이고 숫자는 전부 서버가 준 값이다", async () => {
  const hud = await readFile(new URL("../app/components/gacha/CoinHud.tsx", import.meta.url), "utf8");
  const nav = await readFile(new URL("../app/components/SiteNav.tsx", import.meta.url), "utf8");
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  const site = await readFile(new URL("../app/site-v5.css", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");

  // 지갑은 내비가 건다 — 어느 화면에서나 같은 자리다. 무대는 더 이상 들지 않는다.
  assert.match(nav, /import \{ CoinHud \} from "\.\/gacha\/CoinHud";/u);
  assert.match(nav, /<CoinHud authenticated=\{authenticated\} joinHref=\{signupHref\} \/>/u);
  assert.doesNotMatch(machine, /<CoinHud/u);
  assert.doesNotMatch(machine, /from "\.\/CoinHud"/u);
  assert.doesNotMatch(machine, /gc-coin-hud/u);
  assert.match(hud, /className="gc-coin-pill"/u);
  // 모든 화면이 읽는 파일에 규칙이 있어야 마켓·요금·작업공간에서도 같은 알약이 선다.
  assert.match(site, /\.gc-coin-pill \{/u);
  assert.doesNotMatch(css, /\.gc-coin-pill \{/u);

  // 숫자는 전부 서버에서 온다 — 이 파일에는 크레딧 숫자가 하나도 적혀 있지 않다.
  assert.doesNotMatch(hud, /\d+\s*크레딧|크레딧\s*\d+/u);
  assert.match(hud, /로그인하면 \{signupGrant\}크레딧/u);
  assert.match(hud, /const payload = await response\.json\(\) as CreditsPayload;/u);
  // 가입 지급분은 서버의 SIGNUP_GRANT_CREDITS 를 그대로 싣는 공개 접근 계약에서 읽는다.
  assert.match(hud, /fetch\("\/api\/credits\/packs"\)/u);
  assert.match(hud, /payload\.access\?\.a_signed_in_workspace_adds\?\.credits_on_signup/u);
  const access = await readFile(new URL("../app/api/_lib/access.ts", import.meta.url), "utf8");
  assert.match(access, /credits_on_signup: SIGNUP_GRANT_CREDITS,/u);
  const packs = await readFile(new URL("../app/api/credits/packs/route.ts", import.meta.url), "utf8");
  assert.match(packs, /access: accessFor\(\{ authenticated: false \}\)/u);
  // 로그아웃일 때 /api/credits 를 부르지 않는다 — 401 을 콘솔에 남기지 않는다.
  assert.match(hud, /if \(!authenticated\) return;\s*let alive = true;\s*void fetch\("\/api\/credits"/u);

  // 자릿수가 흔들리지 않게 tabular-nums 로 서고, 화면 낭독기에게도 같은 값을 준다.
  assert.match(site, /\.gc-coin-count \{[^}]*font-variant-numeric: tabular-nums;/u);
  assert.match(hud, /aria-live="polite"/u);
  assert.match(hud, /aria-label=\{known \? `보유 크레딧 \$\{credits\}` : "보유 크레딧 확인 중"\}/u);

  // 잔액을 모르는 동안 대시를 적지 않는다 — 자리표시가 들어간다(운영자 2026-09-03).
  assert.doesNotMatch(hud, /"—"/u);
  assert.match(hud, /<span className="gc-coin-wait" aria-hidden="true" \/>/u);
  assert.match(site, /\.gc-coin-wait \{/u);

  // "+" 는 충전 단추가 아니다. 결제가 없으므로 요금 화면으로만 데려간다.
  assert.match(hud, /className="gc-coin-plus"[\s\S]{0,120}href="\/pricing"/u);
  assert.doesNotMatch(hud, /충전하기|결제하기/u);

  // 실시간으로 돌고 반짝인다.
  assert.match(site, /animation: gc-coin-breathe 3\.4s ease-in-out infinite;/u);
  assert.match(site, /animation: gc-coin-sparkle 4s ease-in-out infinite;/u);
  // 레버가 내려가는 동안 동전이 한 바퀴 넘어간다. 숫자는 그대로다(뽑기는 무료).
  assert.match(css, /@keyframes gc-coin-insert/u);
  assert.match(css, /html:has\(\.gc3\[data-stage="pull"\]\) \.gc-coin-spin/u);

  // 움직임을 줄여 달라면 동전은 멈춰 선다.
  assert.match(
    site,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.gc-coin-spin,\s*\.gc-coin-shine,\s*\.gc-coin-sparkle \{ animation: none !important; \}/u,
  );

  // 좁은 화면에서도 알약은 남고, 내비의 다른 것을 밀어내지 않는다.
  assert.match(site, /@media \(max-width: 900px\) \{\s*\.gc-coin-pill \{ height: 32px;/u);
  assert.match(site, /@media \(max-width: 1199px\) \{\s*\.cv5 \.sitenav-utility \{ display: none; \}\s*\}/u);
  assert.match(site, /@media \(max-width: 1499px\) \{\s*\.cv5 \.sitenav-utility-link \{ padding: 0 7px; \}\s*\}/u);

  // 아래 판의 잔액 글줄은 걷어냈다 — 같은 값을 두 번 말하지 않는다.
  assert.doesNotMatch(machine, /gc3-coin-line/u);
});


/**
 * 가챠 라인업 판 — 계산된 확률만 (2026-09-03, 운영자 결정)
 *
 * "모든 에셋이 똑같이 나온다. 등급은 분류일 뿐이다." 그래서 판의 모든 수는 지금 자루를
 * 세어 나눈 값이고, 손으로 적은 확률은 한 개도 없다. 이 검사가 지키는 것은 셋이다 —
 * 자루가 뽑기와 같고, 몫이 개수와 맞고, 화면에 숫자가 적혀 있지 않다.
 */
test("라인업 판의 확률은 지금 자루를 세어 나눈 값이다", () => {
  const pool = drawableListings(SAMPLE);
  // 자루는 drawFrom 이 실제로 고르는 그 자루다.
  assert.deepEqual(remainingPool(pool, []).map((row) => row.id), pool.map((row) => row.id));
  assert.equal(remainingPool(pool, []).length, remainingInRound(pool, []));
  const one = pool[0];
  assert.equal(remainingPool(pool, [one.id]).length, pool.length - 1);
  // 한 바퀴가 끝나면 통을 새로 채운다 — 개수와 확률이 함께 되돌아온다.
  assert.equal(remainingPool(pool, pool.map((row) => row.id)).length, pool.length);

  const rows = gradeOddsOf(pool, []);
  assert.ok(rows.length > 0);
  const total = rows[0].total;
  assert.equal(total, pool.length);
  // 등급별 개수의 합은 자루 전체이고, 몫의 합은 정확히 1 이다.
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), total);
  // 몫의 합은 1 이다(부동소수 오차만 허용).
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-12);
  for (const row of rows) {
    assert.equal(row.share, row.count / total);
    assert.equal(row.color, GRADE_COLORS[row.letter]);
    // 판에 거는 그림은 그 등급에 실제로 있는 상품의 것이고, 주소는 상점이 쓰는 그대로다.
    assert.ok(row.samples.length <= 2);
    for (const sample of row.samples) {
      assert.equal(gradeOf(sample).letter, row.letter);
      assert.ok(previewUrlOf(sample));
      assert.match(previewUrlOf(sample), /^\/api\/marketplace\/assets\//u);
    }
  }
  // 등급은 언제나 S·A·B·C 차례로 선다.
  assert.deepEqual(
    rows.map((row) => row.letter),
    ["S", "A", "B", "C"].filter((letter) => rows.some((row) => row.letter === letter)),
  );

  // 한 번 뽑으면 자루가 하나 줄고 그 등급의 몫이 내려간다.
  const drawnRow = pool.find((row) => gradeOf(row).letter === "C");
  const after = gradeOddsOf(pool, [drawnRow.id]);
  assert.equal(after[0].total, total - 1);
  const beforeC = rows.find((row) => row.letter === "C");
  const afterC = after.find((row) => row.letter === "C");
  assert.equal(afterC.count, beforeC.count - 1);
  assert.ok(afterC.share < beforeC.share);
  assert.ok(Math.abs(after.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-12);

  // 소수점은 필요할 때만 한 자리 — 25% 를 25.0% 로 적지 않는다.
  assert.equal(formatOdds(0.25), "25%");
  assert.equal(formatOdds(1 / 24), "4.2%");
  assert.equal(formatOdds(1 / 3), "33.3%");
  assert.equal(formatOdds(1), "100%");
});

test("라인업 판은 확률을 화면에 적어 두지 않는다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../app/components/gacha/gacha-catalog.ts", import.meta.url), "utf8");

  // 판이 읽는 줄은 전부 gradeOddsOf 가 준다. 화면 파일에 확률 문자열이 없다.
  assert.match(machine, /const odds = useMemo\(\(\) => gradeOddsOf\(pool, drawn\), \[pool, drawn\]\);/u);
  assert.match(machine, /<b>\{formatOdds\(row\.share\)\}<\/b>/u);
  assert.match(machine, /하나가 나올 확률 <b>\{formatOdds\(1 \/ total\)\}<\/b>/u);
  assert.match(machine, /<small>\{row\.count\}개<\/small>/u);
  // 판 안에 손으로 적은 확률이 없다 — 퍼센트 글자를 만드는 곳은 formatOdds 한 군데뿐이다.
  const panel = machine.slice(machine.indexOf("function OddsPanel("), machine.indexOf("function createIdempotencyKey("));
  assert.doesNotMatch(panel, /["'>]\s*\d+(?:\.\d+)?\s*%/u);
  assert.match(catalog, /return `\$\{Number\.isInteger\(rounded\) \? rounded\.toFixed\(0\) : rounded\.toFixed\(1\)\}%`;/u);
  // 가중치가 없다는 것이 곧 계약이다 — 등급은 분류일 뿐이다.
  assert.match(catalog, /이 함수는 가중치를 하나도 갖지 않는다/u);
  assert.match(catalog, /share: members\.length \/ total,/u);
  assert.match(catalog, /한 개가 나올 확률은 1\/total, 한 등급이 나올 확률은 count\/total 이다\./u);

  // 판이 다시 계산되는 두 손잡이(뽑기·다이얼)를 그대로 본다.
  assert.match(machine, /const pool = useMemo\(\(\) => listingsForTheme\(listings, theme\), \[listings, theme\]\);/u);
  assert.match(machine, /setDrawn\(result\.drawn\);/u);

  // 정직한 한 줄. "확률은 변경될 수 있습니다" 같은 빠져나갈 문장은 쓰지 않는다.
  assert.match(machine, /같은 바퀴에서는 같은 에셋이 다시 나오지 않습니다\. 남은 것 중 고르게 뽑습니다\./u);
  assert.doesNotMatch(machine, /확률은 변경될 수 있습니다/u);

  // 아래 판이 이미 말하던 것(등급 점·남은 개수)은 걷어냈다 — 같은 값을 두 번 말하지 않는다.
  assert.doesNotMatch(machine, /className="gc3-legend"/u);
  assert.doesNotMatch(machine, /gc3-remaining/u);
  assert.match(machine, /<p className="gc3-rule">\{GRADE_RULE\}<\/p>/u);
});


/**
 * 세 칸 구성 — 왼쪽 제목 · 가운데 기계 · 오른쪽 라인업 (2026-09-03, 운영자 목업)
 */
test("무대는 세 칸이고, 기계는 두 칸 사이에 선다", async () => {
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");

  // 왼쪽과 오른쪽을 함께 비워야 기계가 가운데 칸에 선다.
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.gc-film \{\s*--gc-stage-left: clamp\(292px, 25vw, 470px\);\s*--gc-stage-right: clamp\(276px, 22vw, 366px\);/u);
  assert.match(css, /left: calc\(var\(--gc-stage-left\) \* var\(--gc-left-ramp, 1\)\);\s*right: calc\(var\(--gc-stage-right\) \* var\(--gc-left-ramp, 1\)\);/u);
  // 오른쪽 모서리 페이드도 제목 글줄과 같은 ramp 로 산다.
  assert.match(css, /--gc-fade-right: calc\(var\(--gc-left-ramp, 1\) \* 200px\)/u);
  // 라인업 판은 제목과 같은 ramp 로 뜨고 진다 — 근접샷에서 기계를 덮지 않는다.
  assert.match(css, /\.gc3\[data-stage="result"\] \.gc-beat-odds \{ opacity: 0; visibility: hidden; \}/u);
  assert.doesNotMatch(machine, /show\(beatOddsRef\.current/u);
  assert.match(css, /@media \(max-width: 1023px\) \{ \.gc-beat-odds \{ display: none; \} \}/u);
  assert.match(css, /@media \(min-width: 1024px\) \{ \.gc3-odds-below \{ display: none; \} \}/u);

  // 제목은 이 화면의 주인공이다 — 두 줄로 서고 1440·1920 이 둘 다 의도한 크기가 된다.
  assert.match(machine, /<h1 id="home-heading">게임 에셋<br \/><em>뽑기<\/em><\/h1>/u);
  assert.match(css, /\.gc-beat-head h1 \{ font-size: clamp\(4\.1rem, 7vw, 7rem\); line-height: 0\.98; \}/u);

  // "내려서 시작" 은 화면 구석의 각주가 아니라 소개 글 바로 밑에 선다.
  assert.match(machine, /<p>레버를 당기면 마켓의 에셋이 캡슐로 떨어집니다<\/p>[\s\S]{0,320}?<p className="gc-beat-scroll" ref=\{beatScrollRef\}/u);
  assert.match(css, /\.gc-beat-scroll \{\s*position: static;/u);

  // 레버 화살표 — 손잡이 바로 위에 서고, 레버 구간에 대기 중일 때만 뜨고, 포인터를 가로채지 않는다.
  assert.match(machine, /const leverBeat = idle \? ramp\(p, 0\.43, 0\.5, 0\.6, 0\.66\) : 0;/u);
  assert.match(machine, /show\(beatLeverRef\.current, leverBeat\);\s*show\(leverCueRef\.current, leverBeat, 10\);/u);
  assert.match(machine, /<b>당겨서 뽑기<\/b>/u);
  assert.match(machine, /leverCueRef\.current\.style\.left = `\$\{dx \+ points\.lever\.x\}px`;/u);
  assert.match(css, /\.gc3-lever-cue \{[\s\S]*?pointer-events: none;/u);
});


/**
 * 좁은 화면 — 글줄은 기계 위에 얹히지 않는다 (2026-09-03, 운영자 실기기)
 * "24개 / 마켓에 올라온 에셋이 …" 세 줄이 유리 돔 위에 겹쳐 셋째 줄이 읽히지 않았다.
 */
test("좁은 화면에서는 글줄이 내비 밑 한 띠에서만 살고, 캔버스는 그 밑을 쓴다", async () => {
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");

  // 글줄 셋이 같은 띠에 선다.
  assert.match(
    css,
    /@media \(max-width: 1023px\) \{[\s\S]*?\.gc-beat-head,\s*\.gc-beat-inside,\s*\.gc-beat-lever \{\s*top: calc\(var\(--gc-nav-h\) \+ 6px\);/u,
  );
  // 띠 높이는 그 안에 실제로 서는 것의 높이다.
  assert.match(css, /@media \(max-width: 1023px\) \{[\s\S]*?--gc-head-h: 214px;/u);
  assert.match(css, /@media \(max-width: 767px\) \{[\s\S]*?--gc-head-h: 196px;/u);
  // 한 띠를 돌려 쓰므로 두 글줄의 구간이 겹치면 안 된다 — "이 안에 든 것" 이 먼저 물러난다.
  assert.match(machine, /show\(beatInsideRef\.current, ramp\(p, 0\.17, 0\.25, 0\.38, 0\.43\)\);/u);
  // 캔버스가 내비 띠 밑에서 시작하는 화면에서는 카메라를 더 들어 올리지 않는다.
  assert.match(machine, /const inset = Math\.max\(0, Math\.round\(navH - \(box\?\.top \?\? 0\)\)\);/u);
  // 세로 화면에서는 한 걸음 더 물러서야 돔 꼭대기부터 받침까지 들어온다.
  assert.match(machine, /const portrait = w \/ h < 0\.75 \? 1\.14 : 1;/u);
  // 라인업 판은 무대 아래로 내려가 접히는 칸이 된다 — 기계 위에 얹지 않는다.
  assert.match(machine, /<OddsPanel rows=\{odds\} collapsible \/>/u);
  assert.match(machine, /<details className="gc-odds gc-odds-fold" open>/u);
});


/**
 * 유령 기계 (2026-09-03, 운영자: "로고를 눌러 돌아오면 오른쪽에 기계가 하나 더")
 * 포스터와 캔버스가 같은 상자 안에서 기계를 다른 자리에 세우고, 모서리 페이드 아래로
 * 포스터가 비쳐 두 대가 함께 보였다.
 */
test("첫 프레임이 그려지면 포스터는 그 자리에서 사라진다", async () => {
  const css = await readFile(new URL("../app/components/gacha/gacha.css", import.meta.url), "utf8");
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");

  assert.match(css, /\.gc3\[data-live\] \.gc3-poster,\s*\.gc3\[data-warm\] \.gc3-poster \{ display: none !important; \}/u);
  // 이 세션에 이미 3D 를 본 브라우저는 포스터를 아예 띄우지 않는다(화면을 칠하기 전에 표시한다).
  assert.match(machine, /const SCENE_LIVE_KEY = "clunk\.gacha\.live";/u);
  assert.match(machine, /useLayoutEffect\(\(\) => \{[\s\S]{0,400}?if \(webgl\) rootRef\.current\?\.setAttribute\("data-warm", "1"\);/u);
  assert.match(machine, /markSceneLive\(\);/u);
  // 3D 가 오지 않으면 포스터가 도로 선다 — 빈 무대를 남기지 않는다.
  assert.match(machine, /if \(!liveRef\.current\) rootRef\.current\?\.removeAttribute\("data-warm"\);/u);
  // 포스터는 상자를 바꾸지 않는다 — 커졌다 작아지면 캔버스와 같은 사각형이 아니게 된다.
  assert.match(css, /@keyframes gc3-poster-breathe \{ 0%, 100% \{ filter: brightness\(1\); \} 50% \{ filter: brightness\(1\.07\); \} \}/u);
  assert.doesNotMatch(css, /@keyframes gc3-poster-breathe \{[^}]*transform: scale/u);
});
