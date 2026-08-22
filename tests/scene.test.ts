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
