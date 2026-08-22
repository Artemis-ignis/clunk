/**
 * 씬 단위 검사 — 파일 하나가 아니라 함께 로드되는 에셋 전부를 본다.
 *
 * 왜 필요한가: 게임은 파일 하나가 아니다. Clunk는 지금까지 에셋을 하나씩만 봤고,
 * 모든 에셋이 개별로 통과해도 함께 로드하면 프레임이 무너지는 경우를 말할 수 없었다.
 * Harvest Frontier가 보내온 실측(2026-08-22)이 정확히 그 경우였다 — 에셋들은
 * 멀쩡한데 씬 전체 드로우콜이 909개였고 p95가 31~39ms였다.
 *
 * 그 실측이 이 파일의 근거다. 한 세션 안에서 씬 그룹을 하나씩 끄며 12.95ms 프레임을
 * 분해한 결과:
 *
 *   farmBuildings      메시 187 · 삼각형  82,100 → 5.67 ms
 *   field.crop-tomato  메시   7 · 삼각형 157,560 → 0.15 ms
 *
 * 삼각형은 절반인데 비용은 38배다. 비용이 삼각형이 아니라 그려지는 오브젝트 수에
 * 붙어 있다는 뜻이고, 거기서 나온 수치가 메인 패스 메시당 약 25µs다.
 *
 * 이 파일이 하는 일은 그 수치를 프레임 시간으로 바꿔 말하는 것이다. "드로우콜 909개"는
 * 많은지 적은지 알 수 없지만 "22.7ms, 60fps 예산 16.7ms 초과"는 결정을 내릴 수 있는
 * 문장이다.
 */
import type { Finding, InspectionReport, Severity } from "./index";
import { sha256Hex, stableStringify, utf8 } from "./index";

export const SCENE_RULE_SET_ID = "clunk-scene-budget-v1";
export const SCENE_RULE_SET_VERSION = "1.0.0";

export type SceneRuleId =
  | "SCENE-FRAME-BUDGET"
  | "SCENE-DRAW-CALL-HEADROOM"
  | "SCENE-TEXTURE-MEMORY"
  | "LOD-NOT-CHEAPER"
  | "LOD-INEFFECTIVE"
  | "LOD-MATERIAL-DRIFT"
  | "LOD-MISSING"
  | "SCENE-UNREFERENCED-ASSET";

/**
 * 그리기 비용 모델.
 *
 * 기본값은 Harvest Frontier의 WebGL2 측정에서 나왔다(메인 패스 메시당 25µs,
 * 그림자 드로우당 5µs). **그쪽 하드웨어와 렌더러의 값이다.** 다른 기기, 다른 엔진,
 * 다른 드라이버에서는 다르다. 그래서 기본값이지 상수가 아니고, 프로젝트가 자기
 * 계측으로 덮어쓸 수 있게 열어 둔다.
 *
 * 이 값을 재는 법은 어렵지 않다: 씬 그룹을 하나씩 끄고 프레임 시간 차이를 그룹의
 * 메시 수로 나누면 된다. 그렇게 잰 값을 넣는 것이 이 기본값을 쓰는 것보다 항상 낫다.
 */
export interface DrawCostModel {
  /** 메인 패스 드로우콜 하나당 마이크로초. */
  microsecondsPerDrawCall: number;
  /** 목표 프레임 예산(밀리초). 60fps면 16.67. */
  frameBudgetMs: number;
  /** 그리기 외 나머지(로직, 물리, 애니메이션)에 남겨 둘 프레임 비율. */
  reservedFraction: number;
}

export const DEFAULT_DRAW_COST: DrawCostModel = {
  microsecondsPerDrawCall: 25,
  frameBudgetMs: 16.67,
  reservedFraction: 0.4,
};

export interface SceneBudget {
  /** 텍스처 메모리 상한(바이트). 씬 전체 합계로 본다. */
  maxTextureMemoryBytes?: number;
  cost?: Partial<DrawCostModel>;
  /**
   * 빌드에 실제로 들어가는 에셋 파일 목록.
   *
   * 주면 씬이 참조하지 않는 파일을 짚는다. 만들어지고, 최적화되고, 출하되고, 아무도
   * 요청하지 않는 파일이 실제로 생긴다 — 없어진 기능의 잔해, 붙지 않은 LOD 체인,
   * 코드가 절차적으로 만들게 바뀐 뒤 남은 원본. 이용자는 그걸 전부 내려받는다.
   *
   * 없는 것보다 찾기 어렵다. 없으면 눈에 띄지만, 있는데 안 읽히면 있다는 사실이
   * 오히려 안심시킨다.
   *
   * **이 목록은 씬 하나가 아니라 빌드 전체를 덮어야 의미가 있다.** 여러 씬으로 나뉜
   * 게임이라면 씬마다 부르는 것이 아니라, 모든 씬의 에셋을 합쳐 한 번 불러야 한다.
   * 그렇지 않으면 다른 씬에서 쓰는 파일을 죽었다고 말하게 된다.
   */
  shipped?: Array<{ fileName: string; byteLength: number }>;
}

export interface SceneAssetInput {
  report: InspectionReport;
  /**
   * 이 에셋이 씬에 몇 번 등장하는가.
   *
   * 나무 한 그루가 200번 배치되면 드로우콜도 200배다. 파일을 한 번 검사하고
   * 통과시키는 것으로는 절대 볼 수 없는 비용이고, 실제로 프레임을 무너뜨리는 것은
   * 대개 이쪽이다.
   */
  instances?: number;
  /** 이 에셋이 어느 LOD 단계인가. 같은 lodGroup 안에서 단계끼리 비교한다. */
  lodGroup?: string;
  lodLevel?: number;
}

export interface SceneMetrics {
  /** 프레임 예산에 합산된 에셋 수(LOD0만). */
  assetCount: number;
  /** 예산에서 제외된 먼 LOD 파일 수. LOD 계약 검사에는 그대로 쓰인다. */
  lodVariantCount: number;
  instanceCount: number;
  drawCalls: number;
  triangles: number;
  /** 씬 전체에서 병합 여지가 있는 드로우콜 수(중복 없이 합산). */
  mergeableDrawCalls: number;
  /** 고유 에셋의 텍스처 메모리 합. 같은 파일을 여러 번 배치해도 텍스처는 한 번 올라간다. */
  textureMemoryBytes: number;
  estimatedDrawMs: number;
  drawBudgetMs: number;
}

export interface SceneReport {
  schemaVersion: "1.0";
  ruleSetId: string;
  ruleSetVersion: string;
  cost: DrawCostModel;
  metrics: SceneMetrics;
  assets: Array<{
    fileName: string;
    instances: number;
    drawCalls: number;
    estimatedDrawMs: number;
    sharePct: number;
  }>;
  findings: Finding[];
  score: { ready: boolean; hardBlockerCount: number; ruleSetId: string };
  resultDigest: string;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  INFO: 0,
  WARNING: 3,
  ERROR: 18,
  CRITICAL: 50,
};

function resolveCost(budget: SceneBudget): DrawCostModel {
  return { ...DEFAULT_DRAW_COST, ...(budget.cost ?? {}) };
}

export function inspectScene(assets: SceneAssetInput[], budget: SceneBudget = {}): SceneReport {
  const cost = resolveCost(budget);
  const findings: Finding[] = [];
  const add = (
    ruleId: SceneRuleId,
    severity: Severity,
    path: string,
    title: string,
    message: string,
    observed: string | number,
    threshold: string | number,
    action: string,
  ) => {
    findings.push({
      id: `${ruleId}:${path}`,
      ruleId,
      category: "runtime" as Finding["category"],
      severity,
      path,
      title,
      message,
      observed,
      threshold,
      autoFixable: false,
      action,
    });
  };

  let drawCalls = 0;
  let triangles = 0;
  let mergeableDrawCalls = 0;
  let instanceCount = 0;
  const seenHashes = new Set<string>();
  let textureMemoryBytes = 0;

  // 프레임 예산은 LOD0만 더한다.
  //
  // 같은 오브젝트의 near/far LOD는 동시에 그려지지 않는다. 둘 다 더하면 존재하지 않는
  // 비용이 만들어지고, LOD를 성실하게 만든 프로젝트가 그 성실함 때문에 예산 초과로
  // 표시된다. 전부 최근접 LOD라고 가정하는 것은 최악의 경우이고, 예산은 최악의
  // 경우에 맞춰 잡는 것이 맞다. 먼 단계는 계약 검사(LOD-*)에만 쓴다.
  const resident = assets.filter((asset) => (asset.lodLevel ?? 0) === 0);
  const perAsset = resident.map((asset) => {
    const instances = Math.max(1, Math.round(asset.instances ?? 1));
    const assetDrawCalls = asset.report.metrics.drawCallCount * instances;
    drawCalls += assetDrawCalls;
    triangles += asset.report.metrics.triangleCount * instances;
    mergeableDrawCalls +=
      (asset.report.metrics.mergeablePrimitiveCount + asset.report.metrics.mergeableAcrossMeshCount) *
      instances;
    instanceCount += instances;
    // 같은 파일을 여러 번 배치해도 텍스처는 GPU에 한 번만 올라간다. 인스턴스를 곱하면
    // 없는 메모리를 만들어 낸다.
    if (!seenHashes.has(asset.report.inputHash)) {
      seenHashes.add(asset.report.inputHash);
      textureMemoryBytes += asset.report.metrics.textureMemoryBytes;
    }
    return {
      fileName: asset.report.fileName,
      instances,
      drawCalls: assetDrawCalls,
      estimatedDrawMs: Number(((assetDrawCalls * cost.microsecondsPerDrawCall) / 1000).toFixed(3)),
      sharePct: 0,
    };
  });

  const estimatedDrawMs = Number(((drawCalls * cost.microsecondsPerDrawCall) / 1000).toFixed(3));
  const drawBudgetMs = Number((cost.frameBudgetMs * (1 - cost.reservedFraction)).toFixed(3));
  for (const entry of perAsset) {
    entry.sharePct = drawCalls > 0 ? Number(((entry.drawCalls / drawCalls) * 100).toFixed(1)) : 0;
  }
  perAsset.sort((a, b) => b.drawCalls - a.drawCalls);

  if (estimatedDrawMs > drawBudgetMs) {
    const worst = perAsset[0];
    add(
      "SCENE-FRAME-BUDGET",
      "ERROR",
      "/scene",
      "Draw calls alone exceed the frame budget",
      `${drawCalls} draw calls at ${cost.microsecondsPerDrawCall}us each is about ${estimatedDrawMs}ms of draw submission. The budget leaves ${drawBudgetMs}ms for drawing out of a ${cost.frameBudgetMs}ms frame. ${worst ? `${worst.fileName} is the largest single contributor at ${worst.sharePct}%.` : ""}`,
      `${estimatedDrawMs}ms`,
      `${drawBudgetMs}ms`,
      "Merge static meshes, instance repeated props, or cull more aggressively. Triangle reduction will not help — per-object cost is largely independent of triangle count.",
    );
  } else if (estimatedDrawMs > drawBudgetMs * 0.8) {
    add(
      "SCENE-DRAW-CALL-HEADROOM",
      "WARNING",
      "/scene",
      "Draw submission is close to the frame budget",
      `About ${estimatedDrawMs}ms of the ${drawBudgetMs}ms draw budget is already spent before any content is added.`,
      `${estimatedDrawMs}ms`,
      `${drawBudgetMs}ms`,
      "Leave headroom before adding more props to this scene.",
    );
  }

  if (mergeableDrawCalls > 0) {
    const after = drawCalls - mergeableDrawCalls;
    add(
      "SCENE-DRAW-CALL-HEADROOM",
      "INFO",
      "/scene/mergeable",
      "Draw calls that merging could remove",
      `${mergeableDrawCalls} of ${drawCalls} draw calls come from primitives that share a material, attribute set, and draw mode. Merging the ones that never move independently would leave ${after} (about ${((after * cost.microsecondsPerDrawCall) / 1000).toFixed(2)}ms). Which ones move is something only the project knows.`,
      mergeableDrawCalls,
      0,
      "Decide which parts are static, merge those in the source assets, and keep moving parts separate.",
    );
  }

  if (budget.maxTextureMemoryBytes && textureMemoryBytes > budget.maxTextureMemoryBytes) {
    add(
      "SCENE-TEXTURE-MEMORY",
      "ERROR",
      "/scene/textures",
      "Scene texture memory is over budget",
      `Unique assets in this scene hold ${(textureMemoryBytes / 1048576).toFixed(1)}MB of texture memory.`,
      Math.round(textureMemoryBytes),
      budget.maxTextureMemoryBytes,
      "Resize or recompress the largest textures, or split the scene so they are not resident together.",
    );
  }

  findings.push(...checkLodGroups(assets, cost));

  if (budget.shipped?.length) {
    const referenced = new Set(assets.map((asset) => asset.report.fileName));
    const orphans = budget.shipped.filter((file) => !referenced.has(file.fileName));
    if (orphans.length) {
      const orphanBytes = orphans.reduce((sum, file) => sum + file.byteLength, 0);
      const totalBytes = budget.shipped.reduce((sum, file) => sum + file.byteLength, 0);
      const sharePct = totalBytes > 0 ? (orphanBytes / totalBytes) * 100 : 0;
      const named = orphans
        .slice()
        .sort((a, b) => b.byteLength - a.byteLength)
        .slice(0, 4)
        .map((file) => `${file.fileName} (${(file.byteLength / 1024).toFixed(0)}KB)`)
        .join(", ");
      add(
        "SCENE-UNREFERENCED-ASSET",
        "WARNING",
        "/scene/shipped",
        "Assets ship but nothing in the scene asks for them",
        `${orphans.length} of ${budget.shipped.length} shipped assets are not referenced by this scene: ${named}${orphans.length > 4 ? ", ..." : ""}. That is ${(orphanBytes / 1024).toFixed(0)}KB, ${sharePct.toFixed(0)}% of the asset payload people download. This only holds if the manifest covers every scene in the build.`,
        Math.round(orphanBytes),
        0,
        "Confirm nothing else loads them, then drop them from the build. If they are for another scene, pass that scene's assets in the same call.",
      );
    }
  }

  const hardBlockerCount = findings.filter(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  ).length;
  const sorted = [...findings].sort((a, b) => a.id.localeCompare(b.id));
  void SEVERITY_WEIGHT;

  const canonical = {
    schemaVersion: "1.0" as const,
    ruleSetId: SCENE_RULE_SET_ID,
    ruleSetVersion: SCENE_RULE_SET_VERSION,
    cost,
    metrics: {
      assetCount: resident.length,
      // 예산에서 빠진 먼 LOD 파일 수. 검사에서 빠진 것이 아니라 합산에서 빠진 것이다.
      lodVariantCount: assets.length - resident.length,
      instanceCount,
      drawCalls,
      triangles,
      mergeableDrawCalls,
      textureMemoryBytes,
      estimatedDrawMs,
      drawBudgetMs,
    },
    assets: perAsset,
    findings: sorted,
    score: {
      ready: hardBlockerCount === 0,
      hardBlockerCount,
      ruleSetId: SCENE_RULE_SET_ID,
    },
  };
  return { ...canonical, resultDigest: sha256Hex(utf8(stableStringify(canonical))) };
}

/* ------------------------------------------------------------------- LOD */

/**
 * LOD 단계가 실제로 싸졌는가.
 *
 * "먼 LOD는 가까운 LOD보다 싸야 한다"는 두 파일을 함께 봐야 확인되는 계약이라
 * 파일 단위 검사로는 표현할 수 없다. Harvest Frontier가 자기 프로파일의 한계로
 * 그걸 적어 뒀다. 실제로 LOD를 만들어 놓고 삼각형만 줄이고 드로우콜은 그대로 두는
 * 일이 흔한데, 비용이 드로우콜에 붙어 있으므로 그런 LOD는 아무것도 아낀 게 없다.
 */
function checkLodGroups(assets: SceneAssetInput[], cost: DrawCostModel): Finding[] {
  const findings: Finding[] = [];
  const groups = new Map<string, SceneAssetInput[]>();
  for (const asset of assets) {
    if (!asset.lodGroup) continue;
    const list = groups.get(asset.lodGroup) ?? [];
    list.push(asset);
    groups.set(asset.lodGroup, list);
  }

  for (const [group, members] of groups) {
    const ordered = [...members].sort((a, b) => (a.lodLevel ?? 0) - (b.lodLevel ?? 0));
    if (ordered.length < 2) {
      findings.push({
        id: `LOD-MISSING:${group}`,
        ruleId: "LOD-MISSING",
        category: "runtime" as Finding["category"],
        severity: "INFO",
        path: `/lod/${group}`,
        title: "LOD group has a single level",
        message: `Only one level was supplied for "${group}", so no cheaper-at-distance contract could be checked.`,
        observed: ordered.length,
        threshold: 2,
        autoFixable: false,
        action: "Supply the other levels, or drop the group label if this asset has no LOD chain.",
      });
      continue;
    }
    for (let i = 1; i < ordered.length; i += 1) {
      const near = ordered[i - 1];
      const far = ordered[i];
      const nearDraws = near.report.metrics.drawCallCount;
      const farDraws = far.report.metrics.drawCallCount;
      const nearTris = near.report.metrics.triangleCount;
      const farTris = far.report.metrics.triangleCount;

      if (farDraws >= nearDraws) {
        findings.push({
          id: `LOD-NOT-CHEAPER:${far.report.fileName}`,
          ruleId: "LOD-NOT-CHEAPER",
          category: "runtime" as Finding["category"],
          severity: "ERROR",
          path: `/lod/${group}`,
          title: "Far LOD does not reduce draw calls",
          message: `${far.report.fileName} has ${farDraws} draw calls against ${nearDraws} in ${near.report.fileName}. Triangles went ${nearTris} to ${farTris}, but per-object cost is largely independent of triangle count, so this level does not get cheaper where it matters.`,
          observed: farDraws,
          threshold: nearDraws - 1,
          autoFixable: false,
          action: "Merge parts in the far level. Reducing triangles alone does not make a LOD cheaper.",
        });
      }

      // LOD가 비용이 붙지 않은 축을 깎고 있는가.
      //
      // 삼각형을 줄이는 것은 눈에 보이고 만들기도 쉬워서 LOD 작업이 그쪽으로 쏠린다.
      // 그런데 비용은 드로우콜에 붙어 있다. 삼각형만 세게 줄인 LOD는 통과는 하지만
      // 실제로 사는 시간이 거의 없다.
      //
      // Harvest Frontier의 LOD 넷을 재 보니 전부 이 모양이었다(삼각형 -38~52%,
      // 드로우콜 -13~27%, 배율 1.6~3.1x). 체인 전체가 사는 시간이 1.4ms였다.
      // 먼 LOD의 지렛대는 감면이 아니라 병합이다.
      const callDrop = nearDraws > 0 ? (nearDraws - farDraws) / nearDraws : 0;
      const triDrop = nearTris > 0 ? (nearTris - farTris) / nearTris : 0;
      const savedMs = ((nearDraws - farDraws) * cost.microsecondsPerDrawCall) / 1000;
      // 2배는 판단 기준이다. 삼각형을 드로우콜보다 두 배 넘게 깎았다면 그 LOD의
      // 노력이 비용이 없는 쪽에 쓰였다는 뜻으로 본다.
      if (farDraws < nearDraws && callDrop > 0 && triDrop >= callDrop * 2) {
        findings.push({
          id: `LOD-INEFFECTIVE:${far.report.fileName}`,
          ruleId: "LOD-INEFFECTIVE",
          category: "runtime" as Finding["category"],
          severity: "WARNING",
          path: `/lod/${group}`,
          title: "Far LOD cuts triangles much harder than cost",
          message: `${far.report.fileName} drops triangles by ${(triDrop * 100).toFixed(0)}% but draw calls by only ${(callDrop * 100).toFixed(0)}%. At ${cost.microsecondsPerDrawCall}us per draw call that is ${savedMs.toFixed(2)}ms saved. Triangle count is close to free; the leverage in a far LOD is merging parts, not decimating them.`,
          observed: Number((triDrop / callDrop).toFixed(1)),
          threshold: 2,
          autoFixable: false,
          action: "Merge parts in the far level instead of only reducing triangles. Combining meshes that share a material is what makes a distant object cheap.",
        });
      }

      const nearMaterials = near.report.metrics.materialCount;
      const farMaterials = far.report.metrics.materialCount;
      if (farMaterials > nearMaterials) {
        findings.push({
          id: `LOD-MATERIAL-DRIFT:${far.report.fileName}`,
          ruleId: "LOD-MATERIAL-DRIFT",
          category: "runtime" as Finding["category"],
          severity: "WARNING",
          path: `/lod/${group}`,
          title: "Far LOD adds materials",
          message: `${far.report.fileName} uses ${farMaterials} materials against ${nearMaterials} in the nearer level. More materials at distance means more state changes exactly where the budget is tightest.`,
          observed: farMaterials,
          threshold: nearMaterials,
          autoFixable: false,
          action: "Keep the material set of a far LOD a subset of the nearer level.",
        });
      }
    }
  }
  return findings;
}

/** `tractor.compact.m1.lod1.glb` 같은 관행적 이름에서 LOD 그룹과 단계를 읽는다. */
export function inferLod(fileName: string): { lodGroup: string; lodLevel: number } | null {
  const match = /^(.*?)[._-]lod(\d+)\.(glb|gltf)$/i.exec(fileName);
  if (match) return { lodGroup: match[1], lodLevel: Number(match[2]) };
  const base = /^(.*)\.(glb|gltf)$/i.exec(fileName);
  return base ? { lodGroup: base[1], lodLevel: 0 } : null;
}
