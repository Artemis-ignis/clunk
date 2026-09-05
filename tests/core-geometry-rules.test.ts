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
    "SCENE-ANIMATED-SCALE",
    "SCENE-UNNAMED-MESH",
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
    { slug: "hf-tractor-compact", file: "tractor.compact.m1.glb", triangles: 58_156 },
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
  assert.ok(sleeve, "the windmill shaft sleeve intersection is missing");
  assert.equal(sleeve.observed, "271.6 mm");

  const barn = inspectAsset(await market("hf-barn", "barn.m1.glb"));
  const silo = byRule(barn.findings, "GEO-PART-INTERSECTION")
    .find((finding) => finding.message.includes("siloHardware") && finding.message.includes("barnRoof"));
  assert.ok(silo, "the silo-through-roof intersection is missing");
  assert.equal(silo.observed, "1094.5 mm");
});
