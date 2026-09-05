import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  cardSpec,
  factRows,
  hasMotion,
  kitLine,
  memberCount,
  motionNote,
  movingRow,
  reconcileMeasured,
} from "../app/components/listing-facts-rows.ts";
import {
  GLTF_CLIP_LABELS,
  clipLabels,
  describeAnimations,
  gltfClipLabel,
} from "../app/components/review/gltf-clip-labels.ts";
import {
  factsFromManifest,
  formatLabelOf,
  sheetManifestsFor,
  sheetSpecFromManifests,
} from "../scripts/listing-facts-cli.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/** A listing fact with everything switched off, so each test states only what it is about. */
const emptyFacts = (overrides = {}) => ({
  triangles: null,
  materials: null,
  boundsMetres: null,
  byteLength: 0,
  format: "GLB",
  animatedParts: [],
  animations: [],
  kit: null,
  kitSize: 0,
  members: null,
  sheet: null,
  texture: null,
  inspection: null,
  ...overrides,
});

// --- the clip name table ------------------------------------------------------------------

test("the clip table names the motions Harvest Frontier ships and leaves the rest alone", () => {
  assert.equal(gltfClipLabel("idle"), "대기");
  assert.equal(gltfClipLabel("walk"), "걷기");
  assert.equal(gltfClipLabel("inspect"), "살펴보기");
  assert.equal(gltfClipLabel("water"), "물주기");
  assert.equal(gltfClipLabel("hoe"), "괭이질");
  assert.equal(gltfClipLabel("harvest"), "수확");
  assert.equal(gltfClipLabel("blades-spin"), "날개 회전");
  // Every key in the table is reachable through the public function.
  for (const [name, label] of Object.entries(GLTF_CLIP_LABELS)) assert.equal(gltfClipLabel(name), label);
});

test("a clip name we do not know keeps its own name rather than being invented", () => {
  assert.equal(gltfClipLabel("mystery_track"), "mystery_track");
  assert.equal(gltfClipLabel("Anim_07"), "Anim_07");
});

test("case and separators do not change which motion a clip is", () => {
  assert.equal(gltfClipLabel("Blades_Spin"), "날개 회전");
  assert.equal(gltfClipLabel("  WALK "), "걷기");
});

test("the animation summary serialises what the file carries and nothing else", () => {
  const farmhand = [
    { name: "idle", seconds: 8.976 },
    { name: "walk", seconds: 0.827 },
    { name: "inspect", seconds: 0.78 },
    { name: "water", seconds: 1.24 },
    { name: "hoe", seconds: 1.02 },
    { name: "harvest", seconds: 1.12 },
  ];
  assert.equal(describeAnimations(farmhand), "동작 6개 · 대기 9.0초 · 걷기 0.8초 · 살펴보기 0.8초 · 외 3개");
  assert.equal(describeAnimations([{ name: "blades-spin", seconds: 8 }]), "동작 1개 · 날개 회전 8.0초");
  assert.equal(describeAnimations([]), null, "a file with no clips gets no line at all");
  assert.deepEqual(clipLabels(farmhand), ["대기", "걷기", "살펴보기", "물주기", "괭이질", "수확"]);
});

// --- the facts index ----------------------------------------------------------------------

test("a sheet's grid comes from the baker's manifest, never from the product name", () => {
  assert.deepEqual(
    sheetSpecFromManifests([{ grid: { frameWidth: 64 }, generation: { views: 8, clip: { frames: 8 } } }]),
    { cell: 64, directions: 8, frames: 8, cuts: 64 },
  );
  assert.deepEqual(
    sheetSpecFromManifests([{ grid: { frameWidth: 64 }, generation: { views: 8, clip: null } }]),
    { cell: 64, directions: 8, frames: null, cuts: null },
  );
  assert.equal(sheetSpecFromManifests([]), null, "a product with no sheet manifest states no grid");
});

// The titles are plain nouns since 2026-09-03 ("울타리 문 · 여닫기 애니메이션 시트"), so a grid
// parsed out of a name would now be null on every sheet. These are the published files.
test("every published sheet still has a manifest that states its grid", () => {
  const marketRoot = fileURLToPath(new URL("public/market", root));
  // Re-baked 2026-09-03: 64 px cells broke the gate's rails into dotted fragments and left
  // the tree as an 18 px smudge, so the cells are 128 px (256 px for the trees) now.
  assert.deepEqual(
    sheetSpecFromManifests(sheetManifestsFor("cozy-fence-gate-swing-sprites", marketRoot)),
    { cell: 128, directions: 8, frames: 8, cuts: 64 },
  );
  assert.deepEqual(
    sheetSpecFromManifests(sheetManifestsFor("grove-tree-pack-vol1-sprites", marketRoot)),
    { cell: 256, directions: 8, frames: null, cuts: null },
  );
  assert.equal(sheetSpecFromManifests(sheetManifestsFor("hf-barn", marketRoot)), null, "a 3D listing has no sheet");
});

test("the file format comes from the file name, never from a guess", () => {
  assert.equal(formatLabelOf("assets/hf-barn/barn.m1.glb", "model/gltf-binary"), "GLB");
  assert.equal(formatLabelOf("tex-soil-tilled-v2.png", "image/png"), "PNG");
  assert.equal(formatLabelOf("no-extension", "model/gltf-binary"), "GLB");
  assert.equal(formatLabelOf("no-extension", null), "파일");
});

test("facts are built from the pipeline's measurement, and a kit knows how big it is", () => {
  const manifest = {
    products: [
      {
        slug: "a-gate",
        kind: "3d-model",
        title: "문",
        configurationGroup: "cozy-farm-set",
        files: [{ path: "assets/a-gate/gate.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 47960 }],
        measured: {
          triangleCount: 520,
          materialCount: 6,
          boundsMetres: [2.4, 1.71, 0.52],
          animatedParts: ["gate_pivot"],
          animations: [],
          gameReadyScore: { web: { score: 100, hardBlockerCount: 0 }, mobile: { score: 100 } },
        },
      },
      {
        slug: "a-shed",
        kind: "3d-model",
        title: "헛간",
        configurationGroup: "cozy-farm-set",
        files: [{ path: "assets/a-shed/shed.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 100 }],
        measured: { triangleCount: 1620, materialCount: 9 },
      },
      {
        slug: "a-bundle",
        kind: "bundle",
        title: "묶음",
        configurationGroup: "cozy-farm-set",
        bundleOf: ["a-gate", "a-shed"],
        files: [{ path: "assets/a-gate/gate.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 47960 }],
        measured: { perItem: { "a-gate": { triangleCount: 520 }, "a-shed": { triangleCount: 1620 } } },
      },
    ],
  };
  const facts = factsFromManifest(manifest);
  assert.equal(facts["a-gate"].triangles, 520);
  assert.equal(facts["a-gate"].format, "GLB");
  assert.deepEqual(facts["a-gate"].animatedParts, ["gate_pivot"]);
  assert.equal(facts["a-gate"].kit, "cozy-farm-set");
  assert.equal(facts["a-gate"].kitSize, 2, "the bundle is not one of its own members");
  assert.equal(facts["a-bundle"].kit, null, "a bundle is the set, not a part of one");
  assert.equal(facts["a-bundle"].members, 2);
  assert.equal(facts["a-bundle"].triangles, 2140, "a bundle with only a per-item table still totals up");
});

test("the material-budget caveat is stated only when the inspection actually raised it", () => {
  const overBudgetWithFinding = factsFromManifest({
    products: [{
      slug: "x", kind: "3d-model", title: "x",
      files: [{ path: "x.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 1 }],
      measured: { materialCount: 40, gameReadyScore: { web: { score: 96, hardBlockerCount: 1 }, mobile: { score: 96 } } },
    }],
  });
  assert.match(overBudgetWithFinding.x.inspection.note, /재질이 일반 웹 기준 상한/u);

  const overBudgetWithoutFinding = factsFromManifest({
    products: [{
      slug: "y", kind: "3d-model", title: "y",
      files: [{ path: "y.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 1 }],
      measured: { materialCount: 40, gameReadyScore: { web: { score: 100, hardBlockerCount: 0 }, mobile: { score: 100 } } },
    }],
  });
  assert.equal(overBudgetWithoutFinding.y.inspection.note, null);
});

// --- the rows the shop renders --------------------------------------------------------------

test("the specification list is the polyfork five, in order, and states no draw calls", () => {
  const rows = factRows(emptyFacts({
    triangles: 572,
    materials: 1,
    boundsMetres: [1.25, 3, 0.75],
    byteLength: 64_000,
    format: "GLB",
    animatedParts: ["sash", "door-l", "door-r"],
  }));
  assert.deepEqual(rows.map((row) => row.id), ["geometry", "size", "file", "moving", "license"]);
  assert.equal(rows[0].head, "폴리곤 572개 · 재질 1개");
  assert.equal(rows[1].head, "1.25 × 3.00 × 0.75 m");
  assert.equal(rows[1].tail, "실제 크기");
  assert.equal(rows[2].head, "GLB (64.0 KB)");
  assert.equal(rows[2].tail, "바로 넣는 3D 파일");
  assert.match(rows[3].tail, /sash, door-l, door-r/u);
  assert.match(rows[4].tail, /원본 재판매와 에셋 생성기 학습만 금지/u);
  for (const row of rows) {
    assert.doesNotMatch(`${row.head} ${row.tail ?? ""}`, /그리기|드로우콜/u);
  }
});

test("a row whose fact is missing is left off rather than filled in", () => {
  const rows = factRows(emptyFacts({ byteLength: 15_441, format: "PNG", sheet: { cell: 64, directions: 8, frames: 8, cuts: 64 } }));
  assert.deepEqual(rows.map((row) => row.id), ["file", "license"]);
  assert.equal(rows[0].tail, "64×64 · 8방향 × 8프레임");
});

test("a texture states its tile, a bundle states how many files it hands over", () => {
  const texture = factRows(emptyFacts({ byteLength: 2_600_000, format: "PNG", texture: { resolution: "1024×1024", seamless: true } }));
  assert.equal(texture[0].head, "PNG (2.6 MB)");
  assert.equal(texture[0].tail, "1024×1024 · 이어붙는 타일");

  const bundle = factRows(emptyFacts({ triangles: 4596, materials: 26, byteLength: 214_584, members: 3 }));
  assert.equal(bundle[1].tail, "바로 넣는 3D 파일 · 묶음 3종");
});

test("a file with clips leads with its motions; a file with hinges leads with its parts", () => {
  const rigged = movingRow(emptyFacts({
    animations: [{ name: "walk", seconds: 0.827 }, { name: "hoe", seconds: 1.02 }],
    animatedParts: ["pelvis", "spine"],
  }));
  assert.equal(rigged.head, "동작 2개");
  assert.equal(rigged.tail, "걷기, 괭이질 — 받은 파일에서 그대로 재생됩니다");

  const hinged = movingRow(emptyFacts({ animatedParts: ["gate_pivot", "gate_hinge_straps"] }));
  assert.equal(hinged.head, "움직이는 부품 2개");
  assert.match(hinged.tail, /경첩·축 기준으로 돌아갑니다$/u);

  const long = movingRow(emptyFacts({ animatedParts: ["a", "b", "c", "d", "e", "f"] }));
  assert.match(long.tail, /a, b, c, d 외 2개/u);

  assert.equal(movingRow(emptyFacts()), null, "a still model claims no motion");
});

test("the card shows one measured line and a motion mark only when the file moves", () => {
  assert.equal(cardSpec(emptyFacts({ triangles: 2456, materials: 11 })), "폴리곤 2,456개 · 재질 11개");
  assert.equal(cardSpec(emptyFacts({ sheet: { cell: 64, directions: 8, frames: 8, cuts: 64 } })), "64×64 · 64컷");
  assert.equal(cardSpec(emptyFacts({ sheet: { cell: 64, directions: 8, frames: null, cuts: null } })), "64×64 · 8방향");
  assert.equal(cardSpec(emptyFacts({ texture: { resolution: "1024×1024", seamless: true } })), "1024×1024 · 이어붙는 타일");
  assert.equal(cardSpec(null), null, "a listing with no facts gets no line rather than a guess");

  assert.equal(hasMotion(emptyFacts({ animations: [{ name: "walk", seconds: 1 }] })), true);
  assert.equal(hasMotion(emptyFacts({ animatedParts: ["gate_pivot"] })), true);
  assert.equal(hasMotion(emptyFacts({ triangles: 500 })), false);
  assert.equal(hasMotion(null), false);
});

test("the kit line names the set and counts its real members", () => {
  assert.equal(
    kitLine(emptyFacts({ kit: "cozy-farm-set", kitSize: 3 })),
    "코지 팜 세트의 부품입니다. 같은 팔레트, 같은 축척으로 만든 부품 3개 가운데 하나입니다.",
  );
  assert.equal(
    kitLine(emptyFacts({ kit: "harvest-frontier", kitSize: 9 })),
    "하베스트 프론티어 세트의 부품입니다. 같은 팔레트, 같은 축척으로 만든 부품 9개 가운데 하나입니다.",
  );
  assert.equal(kitLine(emptyFacts()), null);

  // 목록에서 실제로 찾아낸 수가 있으면 그것이 먼저다. facts 의 kitSize 는 빌드
  // 매니페스트가 센 값이라, 부품 하나를 공개에서 내리면 아홉이라 적고 여덟을 보여 준다
  // (docs/kits.md 3절).
  assert.match(
    kitLine(emptyFacts({ kit: "harvest-frontier", kitSize: 9 }), { name: "하베스트 프론티어 세트", count: 8 }),
    /부품 8개 가운데 하나/u,
  );
  // 이름을 모르는 키트는 슬러그를 보여 주지 않는다 — 슬러그는 사람에게 이름이 아니다.
  const unnamed = kitLine(emptyFacts({ kit: "kit-village-square", kitSize: 6 }));
  assert.doesNotMatch(unnamed, /kit-village-square/u);
  assert.match(unnamed, /부품 6개 가운데 하나/u);
  // 이름을 알아냈으면 그 이름으로 적는다.
  assert.match(
    kitLine(emptyFacts({ kit: "kit-village-square", kitSize: 6 }), { name: "마을 광장 키트", count: 6 }),
    /^마을 광장 키트의 부품입니다\./u,
  );
});

test("a kit states its parts as slugs; an old bundle only knows how many files it hands over", () => {
  // 계약이 바뀌는 중이라 한 자리에 두 모양이 있다(docs/kits.md 3절).
  assert.equal(memberCount(["village-well", "village-lamp"]), 2);
  assert.equal(memberCount(3), 3);
  assert.equal(memberCount(null), null);
  assert.equal(memberCount(0), null);

  const kitFile = factRows(emptyFacts({
    triangles: 9420, materials: 12, byteLength: 208_114,
    members: ["village-well", "village-notice-board", "village-lamp"],
  }));
  assert.equal(kitFile[1].tail, "바로 넣는 3D 파일 · 묶음 3종", "부품 슬러그를 적어도 개수는 그대로 읽힌다");
});

test("the card states the file size, because the grid offers to sort by it", () => {
  // 목록에 "파일 작은순" 정렬이 있는데 카드가 용량을 한 번도 적지 않았다 — 정렬을 걸어도
  // 무엇이 왜 앞에 왔는지 카드에서 확인할 수 없었다.
  assert.equal(
    cardSpec(emptyFacts({ triangles: 2456, materials: 11, byteLength: 214_584 })),
    "폴리곤 2,456개 · 재질 11개 · 214.6 KB",
  );
  assert.equal(
    cardSpec(emptyFacts({ byteLength: 2_600_000, texture: { resolution: "1024×1024", seamless: true } })),
    "1024×1024 · 이어붙는 타일 · 2.6 MB",
  );
  // 단위는 상세 화면과 같은 함수 하나에서 나온다. 두 화면이 같은 파일을 다른 단위로
  // 적으면 어느 쪽이 맞는지 사는 사람이 알 수 없다.
  const rows = factRows(emptyFacts({ triangles: 2456, byteLength: 214_584 }));
  assert.ok(cardSpec(emptyFacts({ triangles: 2456, byteLength: 214_584 })).endsWith("214.6 KB"));
  assert.ok(rows.find((row) => row.id === "file").head.includes("214.6 KB"));
});

test("the browser's own reading is reported as agreeing or as differing, never silently", () => {
  const facts = emptyFacts({ triangles: 520, materials: 6, byteLength: 47_960 });
  assert.equal(reconcileMeasured(facts, { triangles: 520, materials: 6, bytes: 47_960 }), "이 브라우저에서 다시 측정한 값도 같습니다.");
  assert.match(reconcileMeasured(facts, { triangles: 999, materials: 6, bytes: 47_960 }), /다릅니다 — 폴리곤 999개/u);
  assert.equal(reconcileMeasured(facts, null), null);
});

// --- source contracts -----------------------------------------------------------------------

test("the shop reads its numbers from facts, not from the description it is printing", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /from "\.\/listing-facts-rows"/u);
  assert.match(catalog, /cardSpec\(listing\.facts\)/u);
  assert.match(catalog, /factRows\(listing\.facts\)/u);
  // The regular expressions that used to mine the Korean description for figures.
  assert.doesNotMatch(catalog, /잰 값으로 폴리곤/u);
  assert.doesNotMatch(catalog, /합쳐 폴리곤/u);
  assert.doesNotMatch(catalog, /한 그루에 폴리곤/u);
  assert.doesNotMatch(catalog, /경계가 안 보이는 것이/u);
});

test("no buyer-facing surface says 그리기 횟수", async () => {
  for (const path of [
    "app/components/MarketplaceCatalog.tsx",
    "app/components/listing-facts-rows.ts",
    "app/marketplace/page.tsx",
    "app/pricing/page.tsx",
    "app/series/page.tsx",
  ]) {
    const text = await source(path);
    // The one permitted mention is the comment recording that it was removed.
    const offending = text.split("\n").filter((line) => /그리기 횟수|드로우콜/u.test(line) && !/is gone/u.test(line));
    assert.deepEqual(offending, [], `${path} still shows 그리기 횟수 to a buyer`);
  }
});

test("the catalogue API serves the facts index the way it serves the palette index", async () => {
  const route = await source("app/api/marketplace/route.ts");
  assert.match(route, /from "\.\.\/_lib\/listing-facts"/u);
  assert.match(route, /facts: factsFor\(String\(listing\.slug\)\)/u);
  assert.match(route, /facts: factsFor\(String\(row\.slug\)\)/u);
});

test("the built facts index carries the listings the pipeline measured", async () => {
  const index = JSON.parse(await source("app/data/listing-facts.json"));
  assert.equal(index.schema, "clunk.listing-facts.v1");
  const farmhand = index.facts["hf-player-farmhand"];
  assert.ok(farmhand, "the rigged character is in the index");
  assert.equal(farmhand.animations.length, 6, "six clips, as the file carries");
  assert.deepEqual(farmhand.animations.map((clip) => clip.name), ["idle", "walk", "inspect", "water", "hoe", "harvest"]);
  assert.equal(farmhand.kit, "harvest-frontier");
  // The inspector reports a meshopt file's quantised accessor grid as its bounds; the shop
  // must publish the renderer's real-world measurement instead.
  for (const [slug, fact] of Object.entries(index.facts)) {
    if (!fact.boundsMetres) continue;
    for (const value of fact.boundsMetres) {
      assert.ok(value > 0 && value < 1000, `${slug} publishes a quantised bound: ${value}`);
    }
  }
});

test("the card counts what moves instead of stamping a badge on it", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /motionNote\(listing\.facts\)/u);
  // The generative-AI disclosure is a legal statement, not a feature chip: one sentence on
  // the product page, never a badge repeated on every card in the grid.
  assert.doesNotMatch(catalog, /aiChipMini/u);
  assert.match(catalog, /생성형 AI로 만들었습니다/u);
});

test("the moving-parts note counts clips first, then named parts, and never guesses", () => {
  assert.equal(motionNote(emptyFacts({ animations: [{ name: "walk", seconds: 1 }, { name: "idle", seconds: 2 }] })), "동작 2개");
  assert.equal(motionNote(emptyFacts({ animatedParts: ["a", "b", "c"] })), "움직이는 부품 3개");
  assert.equal(motionNote(emptyFacts({ triangles: 100 })), null);
  assert.equal(motionNote(null), null);
});

test("every workbench tool is wired to something that changes the scene", async () => {
  const viewer = await source("app/components/review/EmbeddedGlbViewer.tsx");
  // Each rail button must reach a handle that touches the renderer, the model or a material.
  // A button with no handle behind it is a fake button, which this catalogue does not ship.
  for (const [tool, effect] of [
    ["setWireframe", /material\.wireframe = on/u],
    ["setMirror", /model\.scale\.x = on \? -1 : 1/u],
    ["setDimensions", /measureHelper\.visible = on/u],
    ["setFlatShading", /material\.flatShading/u],
    ["setBackground", /renderer\.setClearColor\(BACKGROUND_COLOURS\[value\], 1\)/u],
    ["setLighting", /sun\.intensity =/u],
    ["setGrid", /gridHelper\.visible = on/u],
    ["setShadows", /renderer\.shadowMap\.enabled = on/u],
    ["setAutoRotate", /controls\.autoRotate = on/u],
    ["resetCamera", /frame\(referenceGroup\.visible\)/u],
    ["setMaterialColour", /item\.material\.color\.set\(hex\)/u],
    ["resetMaterials", /color\.set\(item\.entry\.original\)/u],
    ["capture", /toBlob\(onBlob, "image\/png"\)/u],
  ]) {
    assert.match(viewer, new RegExp(`${tool}\\(`, "u"), `${tool} is not a handle`);
    assert.match(viewer, effect, `${tool} does not change anything`);
  }
  // Korean accessible names, so the tooltip and the screen reader say the same sentence.
  for (const label of ["색 바꾸기", "와이어프레임 보기", "좌우 반전", "치수 상자 보기", "카메라 초기화", "격자 바닥 보기", "그림자 켜기", "자동 회전", "전체 화면", "지금 화면 PNG로 저장"]) {
    assert.ok(viewer.includes(`label="${label}"`), `no rail button labelled ${label}`);
  }
});

test("pivot tests drive the file's own named nodes, several at once", async () => {
  const viewer = await source("app/components/review/EmbeddedGlbViewer.tsx");
  // A Map rather than one slot: a tractor is not convincing one wheel at a time.
  assert.match(viewer, /const pivotRuns = new Map/u);
  assert.match(viewer, /testPivot\(pivot\.name, pivotAxis, !on\)/u);
  // Wheels turn, hinges swing — decided by the part's own name.
  assert.match(viewer, /const SPIN_NAME = /u);
  assert.match(viewer, /mode === "spin"/u);
  // A part the file does not carry gets a disabled button, never a mimed motion.
  assert.match(viewer, /disabled=\{!pivot\.present\}/u);
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /pivots=\{listing\.facts\?\.animatedParts \?\? null\}/u);
});

test("the reveal prop clips the model bottom-up and lets go at the end", async () => {
  const viewer = await source("app/components/review/EmbeddedGlbViewer.tsx");
  assert.match(viewer, /revealProgress\?: number;/u);
  assert.match(viewer, /onModelReady\?: \(\) => void;/u);
  // Read from a ref, never a dependency: re-running the whole scene per frame is a slideshow.
  assert.match(viewer, /revealRef\.current = revealProgress/u);
  assert.doesNotMatch(viewer, /\[src, clipsKey, pivotsKey, yawDegrees, workbench, revealProgress\]/u);
  // At 1 the plane comes out, so nothing shimmers afterwards.
  assert.match(viewer, /renderer\.clippingPlanes = \[\];/u);
  assert.match(viewer, /readyRef\.current\?\.\(\)/u);
});

test("the 2D benches only offer playback when the image really is the grid", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /function TileBench/u);
  assert.match(catalog, /function SheetBench/u);
  assert.match(catalog, /natural\.height === sheet\.directions \* sheet\.cell/u);
  assert.match(catalog, /disabled=\{!playable\}/u);
  // The operator is taking the watermark off the images, so no screen may assume one.
  assert.doesNotMatch(catalog, /워터마크/u);
});

test("the viewer plays a file's own animations beside the baked pivot clips", async () => {
  const viewer = await source("app/components/review/EmbeddedGlbViewer.tsx");
  assert.match(viewer, /AnimationMixer/u);
  assert.match(viewer, /gltfClipLabel/u);
  assert.match(viewer, /kind: "gltf"/u);
  assert.match(viewer, /kind: "sheet"/u);
  // Stop and speed have to reach the mixer, or the bar lies about the file's own clips.
  assert.match(viewer, /mixerAction\.paused = !next/u);
  assert.match(viewer, /mixerAction\.timeScale = next/u);
  // Every motion button is a real button with a pressed state, so it is reachable by keyboard.
  assert.match(viewer, /aria-pressed=\{active === index\}/u);
});
