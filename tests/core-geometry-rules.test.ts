/*
 * 물리적 타당성 규칙.
 *
 * 마스터가 지난 며칠 손으로 잡아 온 결함들이 여기 걸린다. 값은 전부 실측이고, 픽스처는
 * tests/fixtures/geometry/build-geometry-fixtures.mjs 가 만든다 — 실제 마켓 파일은
 * 고쳐지면 조용해지므로, 규칙이 아직 도는지 보려면 결함이 영원히 남아 있는 파일이 있어야
 * 한다.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  CONTACT_TOLERANCE_MM,
  GROUND_TOLERANCE_MM,
  PHYSICAL_RULE_IDS,
  RULE_IDS,
  createAssetBundle,
  createCustomProfile,
  inspectAsset,
  validateAsset,
  type Finding,
} from "../packages/core/src/index";

const FIXTURES = "tests/fixtures/geometry";
const MARKET = "public/market";

async function fixture(name: string) {
  const bytes = new Uint8Array(await readFile(`${FIXTURES}/${name}`));
  return createAssetBundle(name, bytes);
}

async function market(slug: string, file: string) {
  const path = `${MARKET}/${slug}/${file}`;
  const bytes = new Uint8Array(await readFile(path));
  return createAssetBundle(file, bytes);
}

/** 저장소 어디에 있는 파일이든 그 자리에서 읽어 번들로 만든다(키트 재현 파일용). */
async function bundleAt(path: string) {
  const bytes = new Uint8Array(await readFile(path));
  return createAssetBundle(path.split("/").pop() ?? path, bytes);
}

function byRule(findings: readonly Finding[], ruleId: string): Finding[] {
  return findings.filter((finding) => finding.ruleId === ruleId);
}

function one(findings: readonly Finding[], ruleId: string): Finding {
  const matches = byRule(findings, ruleId);
  assert.equal(matches.length, 1, `${ruleId}: expected exactly one finding, got ${matches.length}`);
  return matches[0];
}

test("the physical rule registry is separate from the legacy structural registry", () => {
  // RULE_IDS 의 길이와 순서는 문서·마케팅 표면이 세고 있다. 새 규칙은 자기 등록부를 쓴다.
  assert.equal(RULE_IDS.length, 15);
  assert.deepEqual([...PHYSICAL_RULE_IDS], [
    "GEO-GROUND-CONTACT",
    "GEO-FLOATING-PART",
    "GEO-PART-INTERSECTION",
    "GEO-THIN-SHELL",
    "GEO-INVERTED-WINDING",
    "SCENE-ANIMATED-SCALE",
    "SCENE-UNNAMED-MESH",
    "SCENE-LAYOUT-FILE",
    "FORMAT-EXTENSION-REQUIRED",
    "GEO-ANALYSIS-LIMIT",
  ]);
  for (const id of PHYSICAL_RULE_IDS) assert.ok(!RULE_IDS.includes(id as never), `${id} leaked into RULE_IDS`);
});

test("a part that touches nothing is reported with the gap in millimetres", async () => {
  const report = inspectAsset(await fixture("floating-part.glb"));
  const finding = one(report.findings, "GEO-FLOATING-PART");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, "120 mm");
  assert.equal(finding.threshold, `≤ ${CONTACT_TOLERANCE_MM} mm`);
  assert.match(finding.message, /floatingCube/);
  assert.match(finding.message, /pedestal/);
  assert.equal(finding.path, "/nodes/1");
  // 부양은 hardBlocker 가 아니다.
  assert.equal(report.score.hardBlockerCount, 0);
});

test("the ground rule measures the scene's real lowest vertex, both above and below y=0", async () => {
  const lifted = inspectAsset(await fixture("ground-offset.glb"));
  const finding = one(lifted.findings, "GEO-GROUND-CONTACT");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, "40 mm");
  assert.equal(finding.threshold, `±${GROUND_TOLERANCE_MM} mm`);
  assert.match(finding.message, /\+40 mm/);
  assert.match(finding.message, /lowerBlock/);

  // 뿌리를 땅 밑으로 내린 나무 팩은 음수로 나오고, 그래도 결함 판정이 아니다.
  const trees = inspectAsset(await market("grove-tree-pack-vol1", "grove-tree-pack-vol1.glb"));
  const below = one(trees.findings, "GEO-GROUND-CONTACT");
  assert.equal(below.observed, "-439.6 mm");
  assert.equal(below.severity, "WARNING");
  assert.equal(trees.score.hardBlockerCount, 0);
});

test("a rod through a body is a real triangle intersection with a measured depth", async () => {
  const report = inspectAsset(await fixture("penetrating-rod.glb"));
  const finding = one(report.findings, "GEO-PART-INTERSECTION");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, "200 mm");
  assert.match(finding.message, /conveyorBelt/);
  assert.match(finding.message, /sealedTank/);
  assert.match(finding.message, /삼각형이 실제로 교차/);
  assert.equal(report.score.hardBlockerCount, 0);
});

/**
 * 이 세션에서 풍차 blades_tilt 의 -10도를 빼먹어 192 mm 짜리 가짜 관통이 나왔다.
 * 픽스처는 그 상황을 그대로 옮겨 둔 것이다: 부모 회전을 빼면 날개가 기둥을 지나는 것으로
 * 보이고, 실제 월드 변환으로 재면 633.7 mm 떨어져 있다.
 */
test("a rotated parent moves the part before anything is measured", async () => {
  const report = inspectAsset(await fixture("tilted-parent.glb"));
  assert.deepEqual(byRule(report.findings, "GEO-PART-INTERSECTION"), []);
  const gap = one(report.findings, "GEO-FLOATING-PART");
  assert.equal(gap.observed, "633.7 mm");
  assert.match(gap.message, /bladeArm/);
});

test("an intersection that only happens mid-animation names the clip and the phase", async () => {
  const report = inspectAsset(await fixture("animated-swing.glb"));
  const finding = one(report.findings, "GEO-PART-INTERSECTION");
  assert.equal(finding.observed, "200 mm");
  assert.match(finding.message, /swingArm/);
  assert.match(finding.message, /standingPost/);
  assert.match(finding.message, /정지 자세에서는 닿지 않고/);
  assert.match(finding.message, /spin 클립의 135° 위상/);
  assert.match(finding.message, /8위상 표본/);
});

test("a zero-thickness single-sided card is reported with its count and its node name", async () => {
  const report = inspectAsset(await fixture("thin-card.glb"));
  const finding = one(report.findings, "GEO-THIN-SHELL");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, 1);
  assert.match(finding.message, /strawCard/);
  assert.match(finding.message, /단면/);
});

/**
 * hf-player-farmhand 의 여섯 클립이 도구의 scale 을 몬다. 그건 결함이 아니라 손에 쥐었다
 * 놓는 연출이므로, 문장이 그렇게 말해야 한다.
 */
test("animation scale channels are reported as information, naming the clips and the nodes", async () => {
  const report = inspectAsset(await market("hf-player-farmhand", "player-farmhand.m1.glb"));
  const finding = one(report.findings, "SCENE-ANIMATED-SCALE");
  assert.equal(finding.severity, "INFO");
  assert.equal(finding.observed, "18 scale channels");
  for (const clip of ["harvest", "hoe", "idle", "inspect", "walk", "water"]) {
    assert.match(finding.message, new RegExp(clip));
  }
  assert.match(finding.message, /toolHarvestBasket/);
  assert.match(finding.message, /toolHoe/);
  assert.match(finding.message, /toolWateringCan/);
  assert.match(finding.message, /결함이 아닙니다/);
});

test("unnamed mesh nodes are counted as a share of the mesh nodes", async () => {
  const report = inspectAsset(await fixture("unnamed-meshes.glb"));
  const finding = one(report.findings, "SCENE-UNNAMED-MESH");
  assert.equal(finding.severity, "INFO");
  assert.equal(finding.observed, "2/3");
  assert.match(finding.message, /66\.7%/);
});

test("a declared required extension says which engine cannot open the file", async () => {
  const report = inspectAsset(await fixture("required-extension.glb"));
  const finding = one(report.findings, "FORMAT-EXTENSION-REQUIRED");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, "KHR_draco_mesh_compression");
  assert.match(finding.message, /DRACOLoader/);
  assert.equal(finding.category, "format");
});

/**
 * 무엇이 hard 인가. 어느 물리 규칙도 아니다.
 *
 * 같은 측정이 어떤 파일에서는 결함이고 다른 파일에서는 의도이기 때문이다 — 땅 밑으로
 * 내려간 나무 뿌리, 베어링을 지나는 축, 옷 안에 든 몸, 잎사귀 카드. 렌더를 보지 않은
 * 검사가 그 넷과 진짜 결함을 가를 수 없으므로 값과 이름을 대는 데까지만 한다.
 */
test("no physical rule ever becomes a hard blocker or flips validate to invalid", async () => {
  for (const name of [
    "floating-part.glb",
    "ground-offset.glb",
    "penetrating-rod.glb",
    "thin-card.glb",
    "tilted-parent.glb",
    "animated-swing.glb",
    "required-extension.glb",
  ]) {
    const bundle = await fixture(name);
    const { valid, report } = validateAsset(bundle);
    const physical = report.findings.filter((finding) =>
      (PHYSICAL_RULE_IDS as readonly string[]).includes(finding.ruleId),
    );
    assert.ok(physical.length > 0, `${name} produced no physical finding`);
    for (const finding of physical) {
      assert.ok(
        finding.severity === "WARNING" || finding.severity === "INFO",
        `${name}: ${finding.ruleId} is ${finding.severity}`,
      );
    }
    assert.equal(report.score.hardBlockerCount, 0, name);
    assert.equal(valid, true, name);
  }
});

test("a project profile can silence or raise a physical rule without touching the others", async () => {
  const bundle = await fixture("floating-part.glb");
  const base = inspectAsset(bundle);
  assert.equal(byRule(base.findings, "GEO-FLOATING-PART").length, 1);

  const quiet = createCustomProfile({
    id: "geometry-quiet-test",
    version: "1.0.0",
    rules: { "GEO-FLOATING-PART": { enabled: false } },
  });
  const silenced = inspectAsset(bundle, { customProfile: quiet });
  assert.deepEqual(byRule(silenced.findings, "GEO-FLOATING-PART"), []);

  const strict = createCustomProfile({
    id: "geometry-strict-test",
    version: "1.0.0",
    rules: { "GEO-FLOATING-PART": { severity: "ERROR" } },
  });
  const raised = inspectAsset(bundle, { customProfile: strict });
  assert.equal(one(raised.findings, "GEO-FLOATING-PART").severity, "ERROR");
  assert.equal(raised.score.hardBlockerCount, 1, "a project that declares it hard gets it hard");
});

/**
 * 부품이 하나뿐인 파일에는 견줄 상대가 없다. 그 선을 지키는 덕분에 public/samples 의
 * 두 파일에 대한 기존 digest 와 READY 판정이 그대로 남는다.
 */
test("a single-part file is not judged as an assembly", async () => {
  const bytes = new Uint8Array(await readFile("public/samples/clunk-ready-sample.glb"));
  const report = inspectAsset(createAssetBundle("clunk-ready-sample.glb", bytes));
  for (const id of PHYSICAL_RULE_IDS) assert.deepEqual(byRule(report.findings, id), [], id);
  assert.equal(report.score.ready, true);
});

test("shipped market models are measured in world space within the time budget", async () => {
  const cases: { slug: string; file: string; triangles: number }[] = [
    // 2026-09-05 수리(허브–차축 플랜지, 볼스터, 펜더 스테이)로 58,156 → 59,232.
    { slug: "hf-tractor-compact", file: "tractor.compact.m1.glb", triangles: 59_232 },
    { slug: "clunk-heli-h145", file: "h145.glb", triangles: 85_150 },
  ];
  for (const item of cases) {
    const bundle = await market(item.slug, item.file);
    const started = Date.now();
    const report = inspectAsset(bundle);
    const elapsed = Date.now() - started;
    assert.equal(report.metrics.triangleCount, item.triangles, item.slug);
    assert.ok(elapsed < 5_000, `${item.slug} took ${elapsed} ms, over the 5 s budget`);
  }
});

/**
 * 실제 파일에서 잡히는 것 두 가지. 둘 다 사람이 렌더로 확인한 것이다.
 *
 * hf-windmill 은 축 슬리브가 지붕을 271.6 mm 지나고(회전축을 제대로 쓴 값이다),
 * hf-barn 은 사일로 철물이 헛간 지붕을 1 m 넘게 지난다.
 */
test("real market models report the intersections a human found by eye", async () => {
  const windmill = inspectAsset(await market("hf-windmill", "farm-windmill.m1.glb"));
  const sleeve = byRule(windmill.findings, "GEO-PART-INTERSECTION")
    .find((finding) => finding.message.includes("windmillShaftSleeve"));
  // 2026-09-05 수리: 슬리브를 허브 뒷면 기준 55 mm 베어링 깊이로 잘랐다. 한때 271.6 mm 를
  // 지나던 그 관통이 다시 나타나면 수리가 풀린 것이다.
  assert.equal(sleeve, undefined, "the windmill shaft sleeve intersection came back");

  const barn = inspectAsset(await market("hf-barn", "barn.m1.glb"));
  const silo = byRule(barn.findings, "GEO-PART-INTERSECTION")
    .find((finding) => finding.message.includes("siloHardware") && finding.message.includes("barnRoof"));
  assert.ok(silo, "the silo-through-roof intersection is missing");
  assert.equal(silo.observed, "1094.5 mm");
});

/*
 * ------------------------------------------------------------------ 뒤집힌 감김
 *
 * 이 규칙이 없던 동안 무엇을 놓쳤나. 광산 키트 첫 빌드에서 레일 두 개의 면이 전부
 * 안쪽을 봤는데, 뒷면을 그리는 우리 히어로 렌더에서는 완전히 정상으로 보였고 세 검사
 * 경로가 모두 통과시켰다(tmp/kits/mine-entrance/product-gaps.md 1절). 그림으로 찾을 수
 * 없는 결함이므로 재는 수밖에 없다.
 */
test("a closed mesh whose faces point inward is reported with its signed volume", async () => {
  const report = inspectAsset(await fixture("inside-out-box.glb"));
  const finding = one(report.findings, "GEO-INVERTED-WINDING");
  // 뒷면 컬링을 켜면 사라지는 결함이므로 단면 재질에서는 WARNING 이 최소다.
  assert.equal(finding.severity, "WARNING");
  assert.match(finding.message, /insideOutCrate/);
  assert.match(finding.message, /-0\.008/);
  assert.equal(finding.observed, "1/2 메시");
  // 다른 물리 규칙과 같은 원칙 — hardBlocker 가 아니다.
  assert.equal(report.score.hardBlockerCount, 0);
  assert.equal(validateAsset(await fixture("inside-out-box.glb")).valid, true);
});

test("an inverted mesh whose material draws both sides is INFO, not a warning", async () => {
  const report = inspectAsset(await fixture("inside-out-double-sided.glb"));
  const finding = one(report.findings, "GEO-INVERTED-WINDING");
  assert.equal(finding.severity, "INFO");
  assert.match(finding.message, /doubleSided/);
});

/*
 * glTF 규격: 노드 전역 변환의 행렬식이 음수이면 감김을 뒤집어 그린다. 그래서 거울
 * 인스턴스는 월드 좌표에서 잰 부호가 음수여도 결함이 아니다. 월드 부호만 보고 판정하면
 * 여기서 가짜 지적이 난다.
 */
test("a mirrored instance is not reported: the spec already reverses its winding", async () => {
  const report = inspectAsset(await fixture("mirrored-instance.glb"));
  assert.equal(byRule(report.findings, "GEO-INVERTED-WINDING").length, 0);
});

test("open meshes are left alone: a signed volume means nothing on a card", async () => {
  // thin-card.glb 의 카드는 삼각형 두 개짜리 열린 면이다. 부호 있는 부피는 원점을
  // 어디 두느냐에 따라 부호가 바뀌므로 재지 않는다.
  const report = inspectAsset(await fixture("thin-card.glb"));
  assert.equal(byRule(report.findings, "GEO-INVERTED-WINDING").length, 0);
  assert.equal(byRule(report.findings, "GEO-THIN-SHELL").length, 1);
});

test("the repro file from the mine kit is caught and the shipped rail is clean", async () => {
  const broken = inspectAsset(await bundleAt("tests/fixtures/geometry/mine-inside-out-rail.glb") /* the mine kit build's repro, kept with the test: tmp/ is not in the repository */);
  const finding = one(broken.findings, "GEO-INVERTED-WINDING");
  assert.equal(finding.severity, "WARNING");
  assert.match(finding.message, /rails/);
  const shipped = inspectAsset(await market("mine-rail-straight", "mine-rail-straight.glb"));
  assert.equal(byRule(shipped.findings, "GEO-INVERTED-WINDING").length, 0);
});

/*
 * ------------------------------------------------------------------ 배치도(팩/키트)
 *
 * 한 파일에 독립 상품 여럿을 늘어놓은 파일에서는 "서로 안 닿는다"가 결함이 아니다.
 * 반대로 파일 전체 상자가 커서 상품 *안*의 관통이 4% 문턱에 걸려 통째로 묻혔다.
 */
test("a layout file judges floating inside one product, not between products", async () => {
  const report = inspectAsset(await fixture("layout-pack.glb"));
  const layout = one(report.findings, "SCENE-LAYOUT-FILE");
  assert.equal(layout.severity, "INFO");
  assert.equal(layout.observed, "4 units");
  const floating = byRule(report.findings, "GEO-FLOATING-PART");
  // 상품 넷 가운데 셋은 메시가 하나뿐이고 서로 2 m 떨어져 있다. 지적은 상품 A 안에서
  // 몸통 위 20 mm 에 떠 있는 뚜껑 하나뿐이어야 한다.
  assert.equal(floating.length, 1);
  assert.match(floating[0].message, /loose_cap/);
  assert.match(floating[0].message, /crate_a/);
  assert.equal(floating[0].observed, "20 mm");
});

test("the four real packs are recognised as layouts and assemblies are not", async () => {
  const packs = [
    { slug: "kit-mine-entrance", file: "kit-mine-entrance.glb", units: 16 },
    { slug: "kit-village-square", file: "kit-village-square.glb", units: 15 },
    { slug: "grove-tree-pack-vol1", file: "grove-tree-pack-vol1.glb", units: 6 },
    { slug: "cozy-farm-set-vol1", file: "cozy-farm-set-vol1.glb", units: 3 },
  ];
  for (const pack of packs) {
    const report = inspectAsset(await market(pack.slug, pack.file));
    const finding = one(report.findings, "SCENE-LAYOUT-FILE");
    assert.equal(finding.observed, `${pack.units} units`, pack.slug);
    // 배치도에서는 상품끼리 안 닿는 것이 정상이므로 부양 지적이 없어야 한다.
    assert.equal(byRule(report.findings, "GEO-FLOATING-PART").length, 0, pack.slug);
  }
  // 지붕·차양처럼 공중에 있는 부분이 있는 조립품은 배치도가 아니다.
  for (const item of [
    { slug: "cozy-storage-shed", file: "storage-shed.m1.clunk-optimized.glb" },
    { slug: "cozy-market-stall", file: "market-stall.m1.clunk-optimized.glb" },
  ]) {
    const report = inspectAsset(await market(item.slug, item.file));
    assert.equal(byRule(report.findings, "SCENE-LAYOUT-FILE").length, 0, item.slug);
  }
});

/*
 * 팩이 자기 부품의 결함을 삼키지 않는지. 2026-09-05 실측: 고치기 전에는
 * kit-mine-entrance 가 지적 0건·100점·ready true 였는데, 그 안에 든 mine-cart 를 따로
 * 검사하면 GEO-PART-INTERSECTION 이 2건 나왔다 — 파일 전체 부피로 "몸통"을 재는 바람에
 * 상품 하나하나가 4% 문턱에 못 미쳐 전부 걸러졌기 때문이다.
 */
test("a pack no longer swallows the defects of the products inside it", async () => {
  const kit = inspectAsset(await market("kit-mine-entrance", "kit-mine-entrance.glb"));
  const cart = inspectAsset(await market("mine-cart", "mine-cart.glb"));
  const cartHits = byRule(cart.findings, "GEO-PART-INTERSECTION");
  assert.ok(cartHits.length > 0, "mine-cart should still report its own intersections");
  const kitHits = byRule(kit.findings, "GEO-PART-INTERSECTION");
  assert.ok(
    kitHits.length >= cartHits.length,
    `the kit reported ${kitHits.length} intersections but the cart alone reports ${cartHits.length}`,
  );
});

/*
 * ------------------------------------------------------------------ 속 빈 것에 "묻혔다"고 말하지 않기
 *
 * 부두 키트 보고서 6절: 살 8개와 유리 8장으로 된 속 빈 등롱 안의 회전등이
 * "상자 안에 통째로 들어가 화면에서 아무것도 못 볼 수 있습니다"로 나왔다. 등은
 * 유리 너머로 잘 보인다 — 상자(AABB)만 보고 판정했기 때문이다.
 */
test("a hollow cage does not bury what stands inside it", async () => {
  const report = inspectAsset(await fixture("caged-lamp.glb"));
  const finding = one(report.findings, "GEO-PART-INTERSECTION");
  // 삼각형은 실제로 20 mm 겹치므로 지적 자체는 남는다. 다만 "묻혔다"가 아니다.
  assert.equal(finding.observed, "20 mm");
  assert.doesNotMatch(finding.message, /통째로 들어가 있고/);
  assert.match(finding.title, /뚫고 지나감/);
});

test("the buried verdict carries the measured fill of the enclosing part", async () => {
  // 우리는 자기 상자의 1.8%만 채운다. 꽉 찬 덩어리(sealedTank)는 100%다.
  const caged = inspectAsset(await fixture("caged-lamp.glb"));
  assert.equal(caged.findings.filter((item) => item.title.includes("묻혔음")).length, 0);
  const solid = inspectAsset(await fixture("penetrating-rod.glb"));
  assert.equal(one(solid.findings, "GEO-PART-INTERSECTION").observed, "200 mm");
});

/*
 * ------------------------------------------------------------------ 용접 성분(병합 메시)
 *
 * 2026-09-05 감사가 찾은 것. 파는 파일 넷(hf-processing-line·hf-seeder-compact·
 * hf-tractor-compact·hf-cultivator-compact)은 형상이 `body_metal`·`body_matte` 같은
 * 재질별 거대 메시로 합쳐져 있어 위의 규칙이 전부 0건을 냈다. 덩어리가 바닥에 닿는 데가
 * 한 군데라도 있으면 그 안에 용접된 채 떠 있는 부품이 전부 통과한다.
 *
 * 아래 두 픽스처는 그 상황을 가장 작게 옮긴 것이다 — 프리미티브 하나 안에 몸통 둘.
 * 이름을 `body_metal` 로 둔 것은 실제 파일이 그렇기 때문이고, 이 검사기가 "재질별
 * 묶음"으로 알아보는 것도 그 이름이다.
 */

/** 축 정렬 상자 하나. 면은 바깥을 보게 감는다(오른손 좌표계 반시계 = 앞면). */
function boxGeometry(center: readonly number[], half: readonly number[]) {
  const corners = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ].map(([sx, sy, sz]) => [center[0] + sx * half[0], center[1] + sy * half[1], center[2] + sz * half[2]]);
  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 5, 4], [0, 1, 5],
    [1, 6, 5], [1, 2, 6],
    [2, 7, 6], [2, 3, 7],
    [3, 4, 7], [3, 0, 4],
  ];
  return { positions: corners.flat(), indices: faces.flat() };
}

/**
 * 프리미티브 하나에 상자 여럿을 넣은 GLB. 상자끼리 꼭짓점을 나누지 않으므로 색인으로는
 * 갈라져 있고, 좌표로 용접해야만 몸통 여럿이 드러난다 — 실제 파일과 같은 모양이다.
 */
async function mergedBodiesBundle(
  name: string,
  merged: { center: number[]; half: number[] }[],
  companion: { name: string; center: number[]; half: number[] },
) {
  const document = new Document();
  const buffer = document.createBuffer();
  const material = document.createMaterial("metal");

  const build = (parts: { center: number[]; half: number[] }[]) => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const part of parts) {
      const box = boxGeometry(part.center, part.half);
      const base = positions.length / 3;
      positions.push(...box.positions);
      for (const index of box.indices) indices.push(index + base);
    }
    return document
      .createPrimitive()
      .setMaterial(material)
      .setAttribute(
        "POSITION",
        document.createAccessor().setType("VEC3").setArray(Float32Array.from(positions)).setBuffer(buffer),
      )
      .setIndices(
        document.createAccessor().setType("SCALAR").setArray(Uint32Array.from(indices)).setBuffer(buffer),
      );
  };

  const scene = document.createScene();
  scene.addChild(
    document.createNode("body_metal").setMesh(document.createMesh("body_metal").addPrimitive(build(merged))),
  );
  scene.addChild(
    document
      .createNode(companion.name)
      .setMesh(
        document.createMesh(companion.name).addPrimitive(build([{ center: companion.center, half: companion.half }])),
      ),
  );
  const bytes = await new NodeIO().writeBinary(document);
  return createAssetBundle(name, new Uint8Array(bytes));
}

test("one primitive holding two welded bodies is judged body by body, not as one mesh", async () => {
  /*
   * 받침(y 0~50 mm) 위에 선 몸통(y 50~350 mm)과, 그 위 300 mm 에 떠 있는 몸통
   * (y 650~850 mm)이 한 프리미티브에 들어 있다. 노드 단위로 보면 이 메시는 받침에
   * 닿아 있으므로 아무 말도 나오지 않는다.
   */
  const bundle = await mergedBodiesBundle(
    "welded-floating.glb",
    [
      { center: [0, 0.2, 0], half: [0.25, 0.15, 0.25] },
      { center: [0, 0.75, 0], half: [0.2, 0.1, 0.2] },
    ],
    { name: "pedestal", center: [0, 0.025, 0], half: [0.5, 0.025, 0.5] },
  );
  const finding = one(inspectAsset(bundle).findings, "GEO-FLOATING-PART");
  assert.equal(finding.severity, "WARNING");
  assert.equal(finding.observed, "300 mm");
  assert.equal(finding.threshold, `≤ ${CONTACT_TOLERANCE_MM} mm`);
  // 조각은 <노드 이름>#<번호> 로 불리고, 재질·크기·중심이 문장에 실린다.
  assert.match(finding.message, /body_metal#1/);
  assert.match(finding.message, /metal, 400×200×400 mm/);
  assert.match(finding.message, /밑면은 바닥에서 650 mm/);
  assert.equal(finding.path, "/nodes/0#1");
  assert.equal(inspectAsset(bundle).score.hardBlockerCount, 0);
});

test("two welded bodies that interpenetrate inside one primitive are measured against each other", async () => {
  /*
   * 1 m 상자를 120 × 180 mm 막대가 가로질러 뚫고 지나간다. 둘은 같은 프리미티브에
   * 들어 있어 노드 번호가 같다 — 같은 노드라고 조립 관계로 보면 이 관통은 영영 안 잡힌다.
   * 겹친 자리는 x 1000 · y 120 · z 180 mm 이고, 깊이는 그 가운데 가장 얕은 값이다.
   */
  const bundle = await mergedBodiesBundle(
    "welded-intersection.glb",
    [
      { center: [0, 0.5, 0], half: [0.5, 0.5, 0.5] },
      { center: [0, 0.55, 0.1], half: [1.0, 0.06, 0.09] },
    ],
    { name: "nameplate", center: [0.55, 0.25, -0.2], half: [0.05, 0.05, 0.05] },
  );
  const report = inspectAsset(bundle);
  const finding = one(report.findings, "GEO-PART-INTERSECTION");
  assert.equal(finding.observed, "120 mm");
  assert.match(finding.message, /body_metal#1/);
  assert.match(finding.message, /body_metal#0/);
  assert.match(finding.message, /삼각형이 실제로 교차/);
  assert.equal(report.score.hardBlockerCount, 0);
});

/**
 * 성분으로 쪼개는 것은 "이 검사기가 애초에 판정에서 빼던 재질별 묶음"에만 한다.
 * 부품 여럿이 든 멀쩡한 노드(cozy-fence-gate 의 `post_timbers` = 기둥 둘)를 쪼개면
 * 기둥 하나가 파일 부피의 17%에서 1.5%로 떨어져 "몸통"이 아니게 되고, 경첩 핀이 55 mm
 * 박힌 지적이 사라진다. 이 시험이 그 자리를 지킨다.
 */
test("splitting merged batches does not dissolve the joinery findings of small props", async () => {
  const gate = inspectAsset(await market("cozy-fence-gate", "fence-gate.m1.clunk-optimized.glb"));
  const pintles = one(gate.findings, "GEO-PART-INTERSECTION");
  assert.equal(pintles.observed, "55 mm");
  assert.match(pintles.message, /post_hinge_pintles/);
  assert.match(pintles.message, /post_timbers/);
  // 조각 번호가 붙지 않는다 — 이 노드들은 쪼개지 않는다.
  assert.doesNotMatch(pintles.message, /#\d/);
});
