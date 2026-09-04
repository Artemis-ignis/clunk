import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  cardSpec,
  factRows,
  hasMotion,
  kitLine,
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
  UNKNOWN_FORMAT_LABEL,
  buildFacts,
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
  assert.equal(formatLabelOf("no-extension", null), UNKNOWN_FORMAT_LABEL);
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

// --- a rebake must not blank what only the previous index knows -----------------------------

// 2026-09-03: re-running `npm run asset:facts` silently emptied clunk-heli-h145. The
// helicopter's numbers were measured outside the wave1 manifest and written straight into the
// index, so every rebake minted a fresh all-null record for it out of the /api/marketplace
// snapshot, and the carry-forward then skipped the slug because this run had "built" something
// for it. A listing the snapshot names but the manifest does not must keep its measurement.
// The published PNGs under public/market are not in the repository, so these tests read their
// sheet manifests from the baker's own output tree, which is. The shape is the same file.
const MARKET_ROOT = fileURLToPath(new URL("tmp/anim-sheets", root));

const h145Listing = {
  slug: "clunk-heli-h145",
  title: "구조용 헬리콥터",
  entryFileName: "h145.glb",
  format: "model/gltf-binary",
  byteLength: 3_303_252,
};

const h145Measured = emptyFacts({
  triangles: 85_150,
  materials: 9,
  boundsMetres: [10.605, 3.95, 13.64],
  byteLength: 3_303_252,
  animatedParts: ["main_rotor_hub", "fenestron_rotor", "door_left_slide"],
  animations: [{ name: "rotor_spin", seconds: 1 }, { name: "doors_open", seconds: 2.4 }],
  viewYawDegrees: 40.3,
});

test("a listing the snapshot names but the manifest does not keeps its measured numbers", () => {
  const built = buildFacts({ products: [] }, [h145Listing], [], MARKET_ROOT, {
    "clunk-heli-h145": h145Measured,
  });
  const h145 = built.facts["clunk-heli-h145"];
  assert.ok(h145, "the helicopter is still in the index");
  assert.equal(h145.triangles, 85_150);
  assert.equal(h145.materials, 9);
  assert.deepEqual(h145.boundsMetres, [10.605, 3.95, 13.64]);
  assert.deepEqual(h145.animatedParts, ["main_rotor_hub", "fenestron_rotor", "door_left_slide"]);
  assert.deepEqual(h145.animations, [{ name: "rotor_spin", seconds: 1 }, { name: "doors_open", seconds: 2.4 }]);
  assert.equal(h145.viewYawDegrees, 40.3);
});

test("the snapshot still wins where it actually speaks — the file's size and format", () => {
  const resized = { ...h145Listing, byteLength: 3_400_000, entryFileName: "h145.m1.glb" };
  const built = buildFacts({ products: [] }, [resized], [], MARKET_ROOT, {
    "clunk-heli-h145": emptyFacts({ ...h145Measured, byteLength: 3_303_252, format: "PNG" }),
  });
  assert.equal(built.facts["clunk-heli-h145"].byteLength, 3_400_000, "the row the shop serves states the size");
  assert.equal(built.facts["clunk-heli-h145"].format, "GLB");
});

// The same failure mode as the helicopter's, one field over: a snapshot row is allowed to omit
// its size and its file name, and the minted record then carries a 0 and a "파일" that would
// paper over a real measurement.
test("a snapshot row that omits its size and file name keeps the previous size and format", () => {
  const silent = { slug: "clunk-heli-h145", title: "구조용 헬리콥터", entryFileName: "" };
  const built = buildFacts({ products: [] }, [silent], [], MARKET_ROOT, {
    "clunk-heli-h145": h145Measured,
  });
  assert.equal(built.facts["clunk-heli-h145"].byteLength, 3_303_252, "0 bytes is a silence, not a file");
  assert.equal(built.facts["clunk-heli-h145"].format, "GLB", UNKNOWN_FORMAT_LABEL + " is a shrug, not a format");
});

test("a D1 listing the previous index never saw still gets its size, format and grid", () => {
  const built = buildFacts(
    { products: [] },
    [{ slug: "cozy-fence-gate-swing", title: "울타리 문", entryFileName: "gate.sheet.png", format: "image/png", byteLength: 15_441 }],
    [],
    MARKET_ROOT,
    {},
  );
  const sheet = built.facts["cozy-fence-gate-swing"];
  assert.equal(sheet.byteLength, 15_441);
  assert.equal(sheet.format, "PNG");
  assert.deepEqual(sheet.sheet, { cell: 64, directions: 8, frames: 8, cuts: 64 });
  assert.equal(sheet.triangles, null, "a sheet has no geometry to claim");
});

test("the manifest's record is whole — a model that lost its clips does not get them back", () => {
  const manifest = {
    products: [{
      slug: "a-gate", kind: "3d-model", title: "문",
      files: [{ path: "assets/a-gate/gate.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 47_960 }],
      measured: { triangleCount: 520, materialCount: 6 },
    }],
  };
  const built = buildFacts(manifest, [{ slug: "a-gate", title: "문", entryFileName: "gate.glb", byteLength: 47_960 }], [], MARKET_ROOT, {
    "a-gate": emptyFacts({ animations: [{ name: "swing", seconds: 2 }], animatedParts: ["gate_pivot"], triangles: 99_999 }),
  });
  assert.deepEqual(built.facts["a-gate"].animations, [], "the pipeline re-measured it as still");
  assert.deepEqual(built.facts["a-gate"].animatedParts, []);
  assert.equal(built.facts["a-gate"].triangles, 520, "the manifest's own count, not the stale one");
});

// main's half of this defect, kept: 4d4810e ("keep H145's numbers") guarded the case where the
// manifest names a file the pipeline could not read. That entry is all-null too, and a 3D
// product always has triangles, so it is a failed read rather than a measurement of nothing.
test("a manifest record that measured nothing at all does not overwrite the real numbers", () => {
  const unreadable = {
    products: [{
      slug: "a-gate", kind: "3d-model", title: "문",
      files: [{ path: "assets/a-gate/gate.glb", role: "entry", contentType: "model/gltf-binary", byteLength: 47_960 }],
      measured: {},
    }],
  };
  const built = buildFacts(unreadable, [], [], MARKET_ROOT, {
    "a-gate": emptyFacts({ triangles: 520, materials: 6, boundsMetres: [1.2, 2.4, 0.3], animatedParts: ["gate_pivot"] }),
  });
  const gate = built.facts["a-gate"];
  assert.equal(gate.triangles, 520, "a read that failed is not a model without geometry");
  assert.equal(gate.materials, 6);
  assert.deepEqual(gate.boundsMetres, [1.2, 2.4, 0.3]);
  assert.deepEqual(gate.animatedParts, ["gate_pivot"]);
  assert.equal(gate.byteLength, 47_960, "the size the manifest did state still wins");
});

test("a slug neither source mentions is still carried forward whole", () => {
  const built = buildFacts({ products: [] }, [], [], MARKET_ROOT, { "gone-from-both": h145Measured });
  assert.deepEqual(built.facts["gone-from-both"], h145Measured);
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
  assert.equal(rigged.tail, "걷기, 괭이질 — 파일 안 애니메이션이 그대로 재생됩니다");

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
  assert.equal(kitLine(emptyFacts({ kit: "cozy-farm-set", kitSize: 3 })), "코지 팜 세트의 일부 · 같은 팔레트·같은 축척의 부품 3개");
  assert.equal(kitLine(emptyFacts({ kit: "harvest-frontier", kitSize: 9 })), "하베스트 프론티어 세트의 일부 · 같은 팔레트·같은 축척의 부품 9개");
  assert.equal(kitLine(emptyFacts()), null);
});

test("the browser's own reading is reported as agreeing or as differing, never silently", () => {
  const facts = emptyFacts({ triangles: 520, materials: 6, byteLength: 47_960 });
  assert.equal(reconcileMeasured(facts, { triangles: 520, materials: 6, bytes: 47_960 }), "이 브라우저에서 다시 잰 값도 같습니다.");
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
