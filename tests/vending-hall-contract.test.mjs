import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MACHINE_THEMES,
  buildMachines,
  formatWon,
  machineCountLabel,
  machineIdOf,
  polygonsOf,
  previewUrlOf,
  priceTagOf,
  sellableListings,
  slotFactOf,
  slotForKeypad,
  specOf,
} from "../app/components/vending/vending-catalog.ts";

/**
 * 자판기 홀의 계약.
 *
 * 화면 없이 확인할 수 있는 것만 여기서 확인한다: 어떤 상품이 어느 자판기에 들어가는지,
 * 슬롯에 적히는 폴리곤 수와 가격이 어디서 나오는지, 그리고 소스가 지키기로 한 몇 가지
 * (로그아웃이면 뽑지 않는다 / 소리는 합성이다 / 글자는 0.72rem 밑으로 내려가지 않는다).
 *
 * 아래 설명 문장은 2026-09-02 에 https://clunk.games/api/marketplace 가 실제로 준 값을
 * 그대로 옮긴 것이다 — 여기에 없는 문장에서 숫자를 읽어 내는 일이 없도록.
 */

/** 운영 API 응답에서 그대로 가져온 표본. 값을 손으로 고치지 말 것. */
const LIVE_SAMPLE = [
  {
    id: "listing-tractor", slug: "cozy-tractor", title: "코지 트랙터",
    description: "농장 배경에 세우는 가벼운 3D 트랙터입니다. 파일을 열어 잰 값으로 폴리곤 1,060개, 그리기 18회, 재질 5개이고 실제 크기는 2.29x2.03x2.98 m입니다.",
    priceCents: 190000, currency: "KRW", status: "PUBLISHED", assetId: "asset-tractor",
    entryFileName: "tractor.glb", previewFileName: "preview-cozy-tractor.webp", variantOf: null,
  },
  {
    id: "listing-stall", slug: "cozy-market-stall", title: "코지 마켓 스톨",
    description: "가벼운 3D 시장 좌판입니다. 파일을 열어 잰 값으로 폴리곤 2,456개, 그리기 31회, 재질 11개입니다.",
    priceCents: 690000, currency: "KRW", status: "PUBLISHED", assetId: "asset-stall",
    entryFileName: "market-stall.glb", previewFileName: "preview-cozy-market-stall.webp", variantOf: null,
  },
  {
    id: "listing-farmset", slug: "cozy-farm-set-vol1", title: "코지 팜 세트 Vol.1 (3종 묶음)",
    description: "시장 좌판·창고 헛간·울타리 문 세 가지를 한 번에 받는 묶음입니다. 셋을 합쳐 폴리곤 4,596개, 그리기 68회, 재질 26개입니다.",
    priceCents: 190000, currency: "KRW", status: "PUBLISHED", assetId: "asset-farmset",
    entryFileName: "cozy-farm-set-vol1.glb", previewFileName: "preview-cozy-fence-gate.webp", variantOf: null,
  },
  {
    id: "listing-grove", slug: "grove-tree-pack-vol1", title: "그로브 트리 팩 Vol.1 (6 템플릿)",
    description: "잎 넓은 나무 4종과 침엽수 2종, 모두 여섯 그루의 가벼운 3D 나무 묶음입니다. 한 그루에 폴리곤 860~2,136개이며, 그루마다 재질 2개·그리기 2회·텍스처 0장으로 통일돼 있습니다.",
    priceCents: 290000, currency: "KRW", status: "PUBLISHED", assetId: "asset-grove",
    entryFileName: "grove-tree-pack-vol1.glb", previewFileName: "preview-grove-broadleaf-column-flame.webp", variantOf: null,
  },
  {
    id: "listing-soil", slug: "tex-soil-tilled-v2", title: "경작지 흙 · 이어붙는 텍스처",
    description: "1024x1024 크기의 이음매 없는 타일 한 장입니다. 이어 붙여도 경계가 안 보이는지 잰 결과는 이음매 없음(가로 1.19 / 세로 1.5, 1에 가까울수록 좋음)입니다.",
    priceCents: 190000, currency: "KRW", status: "PUBLISHED", assetId: "asset-soil",
    entryFileName: "soil-tilled.png", previewFileName: "preview-tex-soil-tilled-v2.webp", variantOf: null,
  },
  {
    id: "listing-texbundle", slug: "verified-seamless-textures-vol1", title: "이어붙는 텍스처 7종 묶음",
    description: "1024×1024 이음매 없는 텍스처 7종을 한 번에 받는 묶음입니다. 이어 붙였을 때 경계가 안 보이는 것이 5종, 경계가 약하게 보이는 것이 2종입니다.",
    priceCents: 190000, currency: "KRW", status: "PUBLISHED", assetId: "asset-texbundle",
    entryFileName: "verified-seamless-textures-vol1.zip", previewFileName: "preview-tex-dirt-path-v1.webp", variantOf: null,
  },
  {
    id: "listing-farmhand", slug: "farmhand-walk-sprites", title: "팜핸드 (밀짚모자 농부) — 걷기 애니메이션 (64×64, 8방향 × 8프레임)",
    description: "64×64 PNG 64컷으로, 8방향 각각에 8프레임짜리 걷기 동작이 들어 있습니다. Clunk가 코드로 만든 폴리곤 480개짜리 3D 모델을 렌더한 것이라, 모든 방향·모든 프레임이 같은 모델에서 나옵니다.",
    priceCents: 90000, currency: "KRW", status: "PUBLISHED", assetId: "asset-farmhand",
    entryFileName: "farmhand-walk.sheet.png", previewFileName: "threejs-factory-v1.sheet.card.png", variantOf: null,
  },
  {
    id: "listing-crate-sheet", slug: "cozy-crate-closed-sprites", title: "나무 궤짝 (닫힘) — 스프라이트 시트 (64×64, 8방향)",
    description: "64×64 PNG 8컷입니다.",
    priceCents: 90000, currency: "KRW", status: "PUBLISHED", assetId: "asset-crate-sheet",
    entryFileName: "crate-closed.sheet.png", previewFileName: "crate-closed.sheet.card.png", variantOf: "cozy-crate-closed",
  },
  {
    id: "listing-draft", slug: "cozy-greenhouse", title: "코지 온실",
    description: "온실 구조물입니다. 파일을 열어 잰 값으로 폴리곤 5,756개, 그리기 2회, 재질 1개입니다.",
    priceCents: 690000, currency: "KRW", status: "DRAFT", assetId: "asset-greenhouse",
    entryFileName: "greenhouse.glb", previewFileName: "preview-cozy-greenhouse.webp", variantOf: null,
  },
];

test("슬러그만 보고 자판기를 정한다", () => {
  assert.equal(machineIdOf({ slug: "cozy-market-stall" }), "structure");
  assert.equal(machineIdOf({ slug: "cozy-storage-shed" }), "structure");
  assert.equal(machineIdOf({ slug: "cozy-greenhouse" }), "structure");
  assert.equal(machineIdOf({ slug: "cozy-fence-gate" }), "structure");
  assert.equal(machineIdOf({ slug: "cozy-farm-set-vol1" }), "structure");
  assert.equal(machineIdOf({ slug: "grove-tree-pack-vol1" }), "tree");
  assert.equal(machineIdOf({ slug: "cozy-crate-produce" }), "prop");
  assert.equal(machineIdOf({ slug: "cozy-haystack-full" }), "prop");
  assert.equal(machineIdOf({ slug: "cozy-tractor" }), "prop");
  // 3D 모델이 없는 2D 캐릭터라 소품 자판기에 들어간다.
  assert.equal(machineIdOf({ slug: "farmhand-walk-sprites" }), "prop");
  assert.equal(machineIdOf({ slug: "tex-soil-tilled-v2" }), "texture");
  assert.equal(machineIdOf({ slug: "verified-seamless-textures-vol1" }), "texture");
});

test("폴리곤 수는 설명에 적힌 '잰 값' 문장에서만 읽는다", () => {
  assert.equal(polygonsOf({ description: LIVE_SAMPLE[0].description }), "폴리곤 1,060개");
  assert.equal(polygonsOf({ description: LIVE_SAMPLE[2].description }), "모두 합쳐 폴리곤 4,596개");
  assert.equal(polygonsOf({ description: LIVE_SAMPLE[3].description }), "한 그루에 폴리곤 860~2,136개");
  // 텍스처에는 폴리곤이 없다 — 없으면 없다고 한다.
  assert.equal(polygonsOf({ description: LIVE_SAMPLE[4].description }), null);
  // 팜핸드 설명에도 '폴리곤 480개'가 있지만 그것은 시트를 구운 원본 모델의 값이라
  // 잰 값 문장이 아니다. 상품의 값처럼 보여 주지 않는다.
  assert.equal(polygonsOf({ description: LIVE_SAMPLE[6].description }), null);
  assert.equal(polygonsOf({ description: "아무 숫자도 없는 설명입니다." }), null);
});

test("폴리곤이 없는 상품은 설명에 적힌 규격 한 줄을 대신 내놓는다", () => {
  assert.equal(specOf({ description: LIVE_SAMPLE[4].description }), "1024×1024 이음매 없는 타일 1장");
  assert.equal(specOf({ description: LIVE_SAMPLE[5].description }), "1024×1024 이음매 없는 타일 7장");
  assert.equal(specOf({ description: LIVE_SAMPLE[6].description }), "스프라이트 시트 64×64 · 64컷");
  assert.equal(specOf({ description: "설명이 아무 규격도 적지 않았습니다." }), null);
});

test("슬롯 두 번째 줄은 폴리곤 → 규격 → 확장자 순으로 정직하게 내려간다", () => {
  assert.equal(slotFactOf(LIVE_SAMPLE[0]), "폴리곤 1,060개");
  assert.equal(slotFactOf(LIVE_SAMPLE[4]), "1024×1024 이음매 없는 타일 1장");
  assert.equal(
    slotFactOf({ description: "아무 수치도 없습니다.", entryFileName: "thing.glb" }),
    "GLB 파일",
  );
});

test("무료 베타면 값을 지우지 않고 그어 둔다", () => {
  assert.deepEqual(priceTagOf({ priceCents: 190000 }, true), { struck: "1,900원", label: "베타 무료" });
  assert.deepEqual(priceTagOf({ priceCents: 190000 }, false), { struck: null, label: "1,900원" });
  assert.deepEqual(priceTagOf({ priceCents: 0 }, true), { struck: null, label: "무료" });
  assert.equal(formatWon(690000), "6,900원");
});

test("자판기에는 공개된 상품만, 구운 스프라이트 시트는 빼고 넣는다", () => {
  const sellable = sellableListings(LIVE_SAMPLE);
  const slugs = sellable.map((row) => row.slug);
  assert.ok(!slugs.includes("cozy-crate-closed-sprites"), "모델에서 구운 시트는 따로 팔지 않는다");
  assert.ok(!slugs.includes("cozy-greenhouse"), "공개되지 않은 상품은 자판기에 들어가지 않는다");
  assert.ok(slugs.includes("farmhand-walk-sprites"), "3D 모델이 없는 시트는 그 자체가 상품이다");
  assert.equal(sellable.length, 7);
});

test("자판기와 슬롯 코드는 카탈로그가 준 것만으로 만들어진다", () => {
  const machines = buildMachines(LIVE_SAMPLE, true);
  const byId = Object.fromEntries(machines.map((machine) => [machine.theme.id, machine]));
  assert.deepEqual(machines.map((machine) => machine.theme.id), ["structure", "prop", "tree", "texture"]);

  assert.deepEqual(byId.structure.slots.map((slot) => slot.code), ["A1", "A2"]);
  assert.deepEqual(byId.prop.slots.map((slot) => slot.code), ["B1", "B2"]);
  assert.deepEqual(byId.tree.slots.map((slot) => slot.code), ["C1"]);
  assert.deepEqual(byId.texture.slots.map((slot) => slot.code), ["D1", "D2"]);

  // 간판에 적히는 수는 그 자판기에 실제로 들어간 슬롯 수와 같아야 한다.
  for (const machine of machines) {
    assert.equal(machineCountLabel(machine), `${machine.slots.length}개`);
  }

  const tractor = byId.prop.slots.find((slot) => slot.listing.slug === "cozy-tractor");
  assert.equal(tractor.fact, "폴리곤 1,060개");
  assert.deepEqual(tractor.price, { struck: "1,900원", label: "베타 무료" });
  assert.equal(
    tractor.preview,
    "/api/marketplace/assets/asset-tractor?file=preview-cozy-tractor.webp&preview=1",
  );
});

test("상품이 하나도 없는 테마는 빈 자판기를 세우지 않는다", () => {
  const machines = buildMachines([LIVE_SAMPLE[4]], true);
  assert.equal(machines.length, 1);
  assert.equal(machines[0].theme.id, "texture");
  assert.equal(buildMachines([], true).length, 0);
});

test("키패드 숫자는 그 자판기의 슬롯으로만 이어진다", () => {
  const [structure] = buildMachines(LIVE_SAMPLE, true);
  assert.equal(slotForKeypad(structure, "1").code, "A1");
  assert.equal(slotForKeypad(structure, "2").code, "A2");
  assert.equal(slotForKeypad(structure, "9"), null);
  assert.equal(slotForKeypad(structure, ""), null);
  assert.equal(slotForKeypad(structure, "abc"), null);
});

test("미리보기 주소는 마켓이 이미 쓰는 형식과 같다", () => {
  assert.equal(previewUrlOf({ assetId: "a b", previewFileName: "p q.webp" }), "/api/marketplace/assets/a%20b?file=p%20q.webp&preview=1");
  assert.equal(previewUrlOf({ assetId: "a", previewFileName: null }), null);
});

test("자판기 넉 대는 서로 다른 코드와 색을 가진다", () => {
  assert.equal(new Set(MACHINE_THEMES.map((theme) => theme.code)).size, MACHINE_THEMES.length);
  assert.equal(new Set(MACHINE_THEMES.map((theme) => theme.accent)).size, MACHINE_THEMES.length);
  for (const theme of MACHINE_THEMES) {
    assert.match(theme.accent, /^#[0-9a-f]{6}$/iu);
    assert.match(theme.code, /^[A-Z]$/u);
  }
});

test("로그아웃 상태에서는 뽑지 않고 로그인으로 안내한다", async () => {
  const source = await readFile(new URL("../app/components/vending/VendingHall.tsx", import.meta.url), "utf8");
  // 뽑기는 상점이 이미 쓰는 흐름을 그대로 부른다.
  assert.match(source, /"\/api\/marketplace\/checkout"/u);
  assert.match(source, /paymentMethod: "beta"/u);
  assert.match(source, /BETA_GRANTED/u);
  // 로그인하지 않았으면 서버에 묻기도 전에 돌려보낸다 — 가짜로 떨어뜨리지 않는다.
  assert.match(source, /if \(!authenticated\)[\s\S]{0,200}loginHref: LOGIN_HREF/u);
  assert.match(source, /const LOGIN_HREF = "\/login\?return_to=%2F"/u);
  // 잔액은 API 응답에서만 온다.
  assert.match(source, /"\/api\/credits"/u);
  assert.doesNotMatch(source, /Math\.random\(\)\s*\*\s*\d/u);
});

test("자판기 화면은 키보드와 보조기기로도 쓸 수 있다", async () => {
  const source = await readFile(new URL("../app/components/vending/VendingMachine.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-pressed=\{selectedCode === slot\.code\}/u);
  assert.match(source, /role="status"\s+aria-live="polite"/u);
  assert.match(source, /ArrowRight/u);
  assert.match(source, /reducedMotion/u);
});

test("Clunk 소리는 외부 파일 없이 그 자리에서 합성한다", async () => {
  const source = await readFile(new URL("../app/components/vending/clunk-sound.ts", import.meta.url), "utf8");
  assert.match(source, /createOscillator/u);
  assert.match(source, /createBuffer\(/u);
  // 음원 파일을 받아오는 자리가 없어야 한다.
  assert.doesNotMatch(source, /fetch\(|\.mp3|\.wav|\.ogg/u);
});

test("자판기 글자는 0.72rem 밑으로 내려가지 않는다", async () => {
  const css = await readFile(new URL("../app/components/vending/vending.css", import.meta.url), "utf8");
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)rem/gu)].map((match) => Number(match[1]));
  assert.ok(sizes.length > 10, "검사할 font-size 선언이 있어야 한다");
  for (const size of sizes) assert.ok(size >= 0.72, `font-size ${size}rem 은 0.72rem 보다 작다`);
  // 가로 넘침을 막는 두 장치가 남아 있어야 한다.
  assert.match(css, /min-width: 0/u);
  assert.match(css, /overflow-wrap: anywhere/u);
});

test("랜딩은 자판기 홀을 렌더하고 마켓 문구를 유지한다", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<VendingHall \/>/u);
  assert.match(source, /크레딧을 넣고/u);
  assert.match(source, /에셋을 뽑으세요/u);
  assert.match(source, /마켓에 올라와 있는 에셋/u);
  // 손으로 적은 카탈로그 복사본이 다시 생기지 않았는지.
  assert.doesNotMatch(source, /LandingMarketShowcase/u);
  assert.doesNotMatch(source, /const SHOWCASE =/u);
});
