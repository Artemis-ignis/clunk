import assert from "node:assert/strict";
import test from "node:test";
import { createAssetBundle, inspectAsset, type InspectionReport } from "../packages/core/src/index";
import { DEFAULT_DRAW_COST, inferLod, inspectScene } from "../packages/core/src/scene";

/** 프리미티브 수만 정확하면 되는 최소 glTF. 씬 합산은 metrics만 보기 때문이다. */
function asset(fileName: string, meshes: number, materials: number, triangles = 300): InspectionReport {
  const perMesh = Math.max(1, Math.floor(triangles / meshes / 3) * 3);
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: Array.from({ length: meshes }, (_, i) => i) }],
    nodes: Array.from({ length: meshes }, (_, i) => ({ mesh: i })),
    meshes: Array.from({ length: meshes }, (_, i) => ({
      primitives: [{ attributes: { POSITION: 0, NORMAL: 0 }, indices: 1, material: i % materials }],
    })),
    materials: Array.from({ length: materials }, (_, i) => ({
      pbrMetallicRoughness: { baseColorFactor: [i / materials, 0.5, 0.5, 1] },
    })),
    accessors: [
      { componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] },
      { componentType: 5125, count: perMesh, type: "SCALAR" },
    ],
    bufferViews: [],
    buffers: [],
  };
  return inspectAsset(
    createAssetBundle(fileName, new TextEncoder().encode(JSON.stringify(document))),
    { profileId: "pc" },
  );
}

test("드로우콜을 프레임 시간으로 바꿔 말한다", () => {
  // "드로우콜 600개"는 많은지 알 수 없지만 "15ms, 예산 10ms 초과"는 결정할 수 있다.
  const scene = inspectScene([{ report: asset("heavy.glb", 600, 4) }]);
  assert.equal(scene.metrics.drawCalls, 600);
  assert.equal(scene.metrics.estimatedDrawMs, 15);
  assert.equal(scene.metrics.drawBudgetMs, 10.002);
  const finding = scene.findings.find((entry) => entry.ruleId === "SCENE-FRAME-BUDGET");
  assert.equal(finding?.severity, "ERROR");
  assert.equal(scene.score.ready, false);

  // 같은 파일이라도 프로젝트가 자기 계측값을 넣으면 답이 달라져야 한다.
  const cheap = inspectScene([{ report: asset("heavy.glb", 600, 4) }], {
    cost: { microsecondsPerDrawCall: 5 },
  });
  assert.equal(cheap.metrics.estimatedDrawMs, 3);
  assert.equal(cheap.score.ready, true);
});

test("인스턴스 수를 곱한다 — 파일 하나만 봐서는 보이지 않는 비용이다", () => {
  const tree = asset("tree.glb", 3, 2);
  const one = inspectScene([{ report: tree }]);
  const forest = inspectScene([{ report: tree, instances: 200 }]);

  assert.equal(one.metrics.drawCalls, 3);
  assert.equal(forest.metrics.drawCalls, 600);
  assert.equal(forest.score.ready, false, "나무 한 그루는 통과해도 숲은 통과하면 안 된다");

  // 같은 파일을 200번 배치해도 텍스처는 GPU에 한 번 올라간다.
  assert.equal(forest.metrics.textureMemoryBytes, one.metrics.textureMemoryBytes);
});

test("먼 LOD는 예산에 더하지 않는다", () => {
  // near/far는 동시에 그려지지 않는다. 둘 다 더하면 없는 비용이 만들어지고,
  // LOD를 성실하게 만든 프로젝트가 그 성실함 때문에 초과로 표시된다.
  const scene = inspectScene([
    { report: asset("prop.glb", 40, 4), lodGroup: "prop", lodLevel: 0 },
    { report: asset("prop.lod1.glb", 12, 4), lodGroup: "prop", lodLevel: 1 },
  ]);
  assert.equal(scene.metrics.drawCalls, 40);
  assert.equal(scene.metrics.assetCount, 1);
  assert.equal(scene.metrics.lodVariantCount, 1);
});

test("먼 LOD가 실제로 싸졌는지 본다", () => {
  // 삼각형만 줄이고 드로우콜은 그대로 둔 LOD는 아무것도 아끼지 않는다.
  const lazy = inspectScene([
    { report: asset("rock.glb", 20, 3, 9000), lodGroup: "rock", lodLevel: 0 },
    { report: asset("rock.lod1.glb", 20, 3, 900), lodGroup: "rock", lodLevel: 1 },
  ]);
  const finding = lazy.findings.find((entry) => entry.ruleId === "LOD-NOT-CHEAPER");
  assert.equal(finding?.severity, "ERROR");
  assert.match(String(finding?.message), /per-object cost is largely independent of triangle count/);

  const real = inspectScene([
    { report: asset("rock.glb", 20, 3, 9000), lodGroup: "rock", lodLevel: 0 },
    { report: asset("rock.lod1.glb", 6, 3, 900), lodGroup: "rock", lodLevel: 1 },
  ]);
  assert.equal(real.findings.some((entry) => entry.ruleId === "LOD-NOT-CHEAPER"), false);
});

test("먼 LOD가 머티리얼을 늘리면 말한다", () => {
  const scene = inspectScene([
    { report: asset("hut.glb", 20, 2), lodGroup: "hut", lodLevel: 0 },
    { report: asset("hut.lod1.glb", 8, 6), lodGroup: "hut", lodLevel: 1 },
  ]);
  const finding = scene.findings.find((entry) => entry.ruleId === "LOD-MATERIAL-DRIFT");
  assert.equal(finding?.severity, "WARNING");
});

test("관행적인 LOD 파일 이름을 읽는다", () => {
  assert.deepEqual(inferLod("tractor.compact.m1.lod1.glb"), {
    lodGroup: "tractor.compact.m1",
    lodLevel: 1,
  });
  assert.deepEqual(inferLod("tractor.compact.m1.glb"), {
    lodGroup: "tractor.compact.m1",
    lodLevel: 0,
  });
  assert.equal(inferLod("notes.txt"), null);
});

test("기본 비용 모델은 상수가 아니라 출처가 있는 기본값이다", () => {
  // Harvest Frontier의 WebGL2 측정에서 나온 값이다. 다른 기기에서는 다르고,
  // 그래서 덮어쓸 수 있어야 한다. 이 테스트는 그 사실이 코드에 남아 있는지를 지킨다.
  assert.equal(DEFAULT_DRAW_COST.microsecondsPerDrawCall, 25);
  assert.equal(DEFAULT_DRAW_COST.frameBudgetMs, 16.67);
  const overridden = inspectScene([{ report: asset("a.glb", 10, 2) }], {
    cost: { frameBudgetMs: 33.33, reservedFraction: 0.2 },
  });
  assert.equal(overridden.cost.frameBudgetMs, 33.33);
  assert.equal(overridden.cost.microsecondsPerDrawCall, 25, "덮어쓰지 않은 값은 기본값을 유지한다");
});

test("비용이 붙지 않은 축만 깎은 LOD를 짚는다", () => {
  // 삼각형을 줄이는 것은 눈에 보이고 만들기 쉬워서 LOD 작업이 그쪽으로 쏠린다.
  // 그런데 비용은 드로우콜에 붙어 있다. 통과는 하지만 실제로 사는 시간이 거의 없는
  // LOD가 그렇게 만들어진다.
  const lopsided = inspectScene([
    { report: asset("cart.glb", 88, 6, 30_000), lodGroup: "cart", lodLevel: 0 },
    { report: asset("cart.lod1.glb", 77, 6, 18_600), lodGroup: "cart", lodLevel: 1 },
  ]);
  const finding = lopsided.findings.find((entry) => entry.ruleId === "LOD-INEFFECTIVE");
  assert.equal(finding?.severity, "WARNING");
  // 실제로 사는 시간을 숫자로 말해야 결정이 된다.
  assert.match(String(finding?.message), /0.28ms saved/);
  assert.match(String(finding?.message), /merging parts, not decimating/);

  // 드로우콜을 삼각형만큼 줄인 LOD는 짚지 않는다.
  const balanced = inspectScene([
    { report: asset("cart.glb", 88, 6, 30_000), lodGroup: "cart", lodLevel: 0 },
    { report: asset("cart.lod1.glb", 30, 6, 18_600), lodGroup: "cart", lodLevel: 1 },
  ]);
  assert.equal(balanced.findings.some((entry) => entry.ruleId === "LOD-INEFFECTIVE"), false);

  // 아예 안 싼 LOD는 이쪽이 아니라 LOD-NOT-CHEAPER가 잡는다. 두 규칙이 같은 파일에
  // 대해 동시에 떠들면 사람이 무엇부터 고칠지 알 수 없다.
  const flat = inspectScene([
    { report: asset("cart.glb", 88, 6, 30_000), lodGroup: "cart", lodLevel: 0 },
    { report: asset("cart.lod1.glb", 88, 6, 18_600), lodGroup: "cart", lodLevel: 1 },
  ]);
  assert.ok(flat.findings.some((entry) => entry.ruleId === "LOD-NOT-CHEAPER"));
  assert.equal(flat.findings.some((entry) => entry.ruleId === "LOD-INEFFECTIVE"), false);
});

test("출하되지만 아무도 요청하지 않는 파일을 짚는다", () => {
  // 만들어지고, 최적화되고, 출하되고, 아무도 요청하지 않는 파일이 실제로 생긴다.
  // 없는 것보다 찾기 어렵다 — 없으면 눈에 띄지만, 있는데 안 읽히면 있다는 사실이
  // 오히려 안심시킨다.
  const scene = inspectScene([{ report: asset("hero.glb", 10, 2) }], {
    shipped: [
      { fileName: "hero.glb", byteLength: 400_000 },
      { fileName: "hero.lod1.glb", byteLength: 500_000 },
      { fileName: "cut-feature.glb", byteLength: 100_000 },
    ],
  });
  const finding = scene.findings.find((entry) => entry.ruleId === "SCENE-UNREFERENCED-ASSET");
  assert.equal(finding?.severity, "WARNING");
  assert.equal(finding?.observed, 600_000);
  // 사람이 결정하려면 비율이 필요하다. 600KB가 큰지 작은지는 전체를 알아야 안다.
  assert.match(String(finding?.message), /60% of the asset payload/);
  // 가장 큰 것부터 이름을 댄다.
  assert.ok(String(finding?.message).includes("hero.lod1.glb (488KB)"));

  // 매니페스트가 씬 하나만 덮으면 다른 씬 파일을 죽었다고 말하게 된다. 그 전제를
  // 메시지가 스스로 밝혀야 한다.
  assert.match(String(finding?.message), /covers every scene in the build/);
});

test("참조된 파일만 출하되면 아무 말도 하지 않는다", () => {
  const scene = inspectScene([{ report: asset("hero.glb", 10, 2) }], {
    shipped: [{ fileName: "hero.glb", byteLength: 400_000 }],
  });
  assert.equal(scene.findings.some((entry) => entry.ruleId === "SCENE-UNREFERENCED-ASSET"), false);

  // 목록을 안 주면 이 검사를 하지 않는다. 모르는 것을 추측하지 않는다.
  const noManifest = inspectScene([{ report: asset("hero.glb", 10, 2) }]);
  assert.equal(noManifest.findings.some((entry) => entry.ruleId === "SCENE-UNREFERENCED-ASSET"), false);
});

test("리포트가 무엇을 덮고 무엇을 못 덮는지 스스로 말한다", () => {
  // 지금까지 이 경계는 사람이 말로 전했다. 사람이 매번 다시 말해서 유지되는 경계는
  // 사람이 바뀌면 사라진다. 리포트를 나중에 읽는 사람은 그 말을 들은 적이 없고,
  // 숫자만 남으면 "드로우콜 283"이 "이 씬의 드로우콜은 283"으로 읽힌다.
  const scene = inspectScene([
    { report: asset("a.glb", 10, 2), lodGroup: "a", lodLevel: 0 },
    { report: asset("a.lod1.glb", 4, 2), lodGroup: "a", lodLevel: 1 },
  ]);
  const coverage = scene.findings.find((entry) => entry.ruleId === "SCENE-COVERAGE");
  assert.ok(coverage, "항상 떠야 한다 — 조용하면 숫자가 전부인 줄 안다");
  assert.equal(coverage?.severity, "INFO");
  assert.ok(String(coverage?.message).includes("1 far-LOD variant excluded"));
  assert.ok(String(coverage?.message).includes("geometry the engine builds at runtime"));

  // 남의 하드웨어에서 잰 기본값을 쓰고 있다는 사실을 리포트가 밝혀야 한다.
  assert.ok(String(coverage?.message).includes("a default measured on one project"));
  assert.ok(String(coverage?.action).includes("your own renderer"));
});

test("프로젝트가 자기 단가를 주면 그렇다고 말한다", () => {
  const scene = inspectScene([{ report: asset("a.glb", 10, 2) }], {
    cost: { microsecondsPerDrawCall: 18 },
  });
  const coverage = scene.findings.find((entry) => entry.ruleId === "SCENE-COVERAGE");
  assert.ok(String(coverage?.message).includes("18us per draw call, supplied by this project"));
  assert.equal(String(coverage?.message).includes("a default measured"), false);
});
