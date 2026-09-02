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
  id: "listing-stall", slug: "cozy-market-stall", title: "코지 마켓 스톨",
  description: "가벼운 3D 시장 좌판입니다. 파일을 열어 잰 값으로 폴리곤 2,456개, 그리기 31회, 재질 11개이고 실제 크기는 2.44x2.39x1.35 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 690000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-stall", entryFileName: "market-stall.m1.clunk-optimized.glb", byteLength: 214584,
  previewFileName: "preview-cozy-market-stall.webp", variantOf: null,
  variants: [{ slug: "cozy-market-stall-sprites", title: "코지 마켓 스톨 — 스프라이트 시트 (64×64, 8방향)" }],
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
  id: "listing-grove", slug: "grove-tree-pack-vol1", title: "그로브 트리 팩 Vol.1 (6 템플릿)",
  description: "잎 넓은 나무 4종과 침엽수 2종, 모두 여섯 그루의 가벼운 3D 나무 묶음입니다. 한 그루에 폴리곤 860~2,136개이며, 그루마다 재질 2개·그리기 2회·텍스처 0장으로 통일돼 있습니다. 여섯 그루 모두 웹·모바일 게임 기준 100점, 막히는 문제 0건이고 색이 모델에 들어 있어 텍스처 파일이 없습니다.",
  priceCents: 290000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-grove", entryFileName: "broadleaf-round-full.glb", byteLength: 189820,
  previewFileName: "preview-grove-broadleaf-column-flame.webp", variantOf: null,
  variants: [{ slug: "grove-tree-pack-vol1-sprites", title: "그로브 트리 팩 Vol.1 (6종) — 스프라이트 시트 (64×64, 8방향)" }],
  palette: [{ hex: "#6d8b4a", share: 0.6 }],
};

/** 여닫기 동작 시트가 딸린 모델. 실제 운영 응답에서 그대로 옮긴 제목이다. */
const GATE = {
  id: "listing-gate", slug: "cozy-fence-gate", title: "코지 울타리 문",
  description: "가벼운 3D 울타리 문입니다. 파일을 열어 잰 값으로 폴리곤 520개, 그리기 13회, 재질 6개이고 실제 크기는 2.67x1.75x0.52 m입니다. 웹·모바일 게임 기준 모두 100점, 막히는 문제 0건입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-gate", entryFileName: "fence-gate.m1.clunk-optimized.glb", byteLength: 30000,
  previewFileName: "preview-cozy-fence-gate.webp", variantOf: null,
  variants: [
    { slug: "cozy-fence-gate-sprites", title: "코지 울타리 문 — 스프라이트 시트 (64×64, 8방향)" },
    { slug: "cozy-fence-gate-swing-sprites", title: "코지 울타리 문 — 여닫기 애니메이션 (64×64, 8방향 × 8프레임)" },
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
  id: "listing-meadow", slug: "tex-grass-meadow-v1", title: "초원 풀 · 이어붙는 텍스처",
  description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 경계 약함(가로 1.62 / 세로 1.77, 1에 가까울수록 좋음)입니다.",
  priceCents: 190000, currency: "KRW", licenseStatus: "cleared", status: "PUBLISHED",
  assetId: "asset-meadow", entryFileName: "tex-grass-meadow-v1.png", byteLength: 2732086,
  previewFileName: "preview-tex-grass-meadow-v1.webp", variantOf: null, variants: [],
  palette: [{ hex: "#4d6b34", share: 0.5 }],
};

const SOIL = {
  id: "listing-soil", slug: "tex-soil-tilled-v2", title: "경작지 흙 · 이어붙는 텍스처",
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

  // S — 동작 시트가 딸린 모델.
  assert.equal(hasMotionOf(GATE), true, "여닫기 애니메이션 시트를 가진 모델은 움직이는 상품이다");
  assert.deepEqual(gradeOf(GATE), { letter: "S", basis: "motion" });
  assert.equal(gradeBasisOf(GATE), "움직이는 동작 포함");
  // 폴리곤은 520개뿐이라 동작이 없었다면 C 였을 것이다.
  assert.equal(polygonCountOf(GATE), 520);

  // S — 동작이 든 스프라이트 시트 그 자체.
  assert.equal(hasMotionOf(FARMHAND), true);
  assert.deepEqual(gradeOf(FARMHAND), { letter: "S", basis: "motion" });

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
    slug: "verified-seamless-textures-vol1", title: "이어붙는 텍스처 7종 묶음",
    description: "1024×1024 이음매 없는 텍스처 7종을 한 번에 받는 묶음입니다.",
  };
  assert.equal(isModelBundleOf(texturePack), false);
  assert.equal(gradeOf(texturePack).letter, "C");

  // 화면에 적히는 규칙과 코드가 매기는 규칙은 같은 문장이어야 한다.
  assert.equal(
    GRADE_RULE,
    "등급 기준: S 움직이는 동작 포함 또는 폴리곤 4,000개 이상 · A 1,500개 이상 또는 묶음 · B 700개 이상 · C 그 외",
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

test("무료 베타면 값을 지우지 않고 그어 둔다", () => {
  assert.deepEqual(priceTagOf({ priceCents: 190000 }, true), { struck: "1,900원", label: "베타 무료" });
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
  assert.equal(previewUrlOf(STALL), "/market/cozy-market-stall/preview-cozy-market-stall.webp");
  assert.equal(previewUrlOf({ slug: "a", previewFileName: null }), null);
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
  assert.match(machine, /const LOGIN_HREF = "\/login\?return_to=%2F"/u);
  // 잔액은 API 응답에서만 온다.
  assert.match(machine, /"\/api\/credits"/u);
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

test("연출은 크랭크 → 흔들림 → Clunk → 캡슐 → 흔들흔들 → 빛 → 카드 순서다", async () => {
  const machine = await readFile(new URL("../app/components/gacha/GachaMachine3D.tsx", import.meta.url), "utf8");
  for (const stage of ["idle", "crank", "shake", "impact", "capsule", "wobble", "burst", "result"]) {
    assert.match(machine, new RegExp(`"${stage}"`, "u"), `${stage} 단계가 없다`);
  }
  // 시간표는 코드에 그대로 적혀 있다: 흔들림 0.75초부터, 떨어지는 것이 1.95초, Clunk 이 2.73초.
  assert.match(machine, /shake: 750/u);
  assert.match(machine, /impact: 1950/u);
  assert.match(machine, /clunk: 2730/u);
  assert.match(machine, /capsule: 3200/u);
  // 움직임을 줄여 달라는 설정에서는 짧은 시간표를 쓴다.
  assert.match(machine, /reducedMotion \? TIMING\.reduced : TIMING\.full/u);
  // 손잡이는 270° 이상 돌리면 발동하고, 키보드로도 눌린다(button + onClick).
  assert.match(machine, /const CRANK_TRIGGER_DEGREES = 270/u);
  assert.match(machine, /Math\.abs\(drag\.total\) >= CRANK_TRIGGER_DEGREES/u);
  assert.match(machine, /aria-label="손잡이를 돌려 에셋 뽑기"/u);
  // 화면 없이 단계를 세우고 프레임을 돌리는 두 손잡이.
  assert.match(machine, /__gachaStep/u);
  assert.match(machine, /__gachaFrame/u);
  // 화면 밖이거나 탭이 숨으면 렌더 루프를 멈춘다.
  assert.match(machine, /IntersectionObserver/u);
  assert.match(machine, /document\.visibilityState === "hidden"/u);
  // WebGL 이 없으면 SVG 머신으로 되돌아간다.
  assert.match(machine, /if \(!webgl\) return <CapsuleMachine \/>;/u);
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
  assert.match(scene, /DESKTOP_QUALITY: Quality = \{ capsules: 30, dpr: 2, shadowMap: 1024/u);
  assert.match(scene, /MOBILE_QUALITY: Quality = \{ capsules: 18, dpr: 1\.5, shadowMap: 512/u);
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
  assert.match(css, /\.gc3-crank \{[\s\S]*?min-height: 56px/u);
  assert.match(css, /\.gc3-capsule \{[\s\S]*?min-height: 48px/u);
  // 움직임을 줄여 달라는 설정에서는 흔들림과 파티클을 아예 만들지 않는다.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("랜딩은 캡슐 머신 한 대를 렌더한다", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<GachaMachine3D \/>/u);
  assert.match(source, /게임 에셋을 <em>뽑으세요<\/em>/u);
  // 자판기 넉 대 짜리 홀은 더 이상 없다.
  assert.doesNotMatch(source, /VendingHall|VendingMachine/u);
  // 손으로 적은 카탈로그 복사본이 다시 생기지 않았는지.
  assert.doesNotMatch(source, /LandingMarketShowcase/u);
  assert.doesNotMatch(source, /const SHOWCASE =/u);
});
