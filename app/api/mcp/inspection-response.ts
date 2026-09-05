/*
 * 업로드 검사 두 도구(clunk_asset_inspect / clunk_asset_validate)의 응답 본문.
 *
 * 핸들러에서 떼어 낸 이유. 이 계약은 테스트가 직접 불러 봐야 지킬 수 있다 —
 * "엔진 환경이 없었는데 100점" 같은 조합은 응답을 실제로 만들어 보지 않으면 막을 수
 * 없다. 핸들러 본문은 인증·라우팅 때문에 Next 런타임을 끌어오므로 여기 따로 둔다.
 */
import {
  PHYSICAL_RULE_IDS,
  inspectAsset,
  inspectAssetForTarget,
  targetInspectionPolicy,
  type AssetPolicy,
} from "../../../packages/core/src/index";
import {
  parseAssetInspectionRequest,
  summarizeAssetBundle,
} from "../assetops/inspect/bundle-contract";

/** 물리적 타당성 규칙의 id. 어느 것도 hardBlocker가 아니라는 사실을 응답이 직접 말합니다. */
const PHYSICAL_RULE_ID_SET: ReadonlySet<string> = new Set<string>(PHYSICAL_RULE_IDS);

/**
 * 업로드한 바이트의 구조 리포트. 모델(.glb/.gltf)이 아니면 null.
 *
 * inspectAsset은 glTF 컨테이너를 전제로 하므로, 스프라이트 시트나 Spine JSON을 넘기면
 * 실패 리포트를 만들어 냅니다. 그 실패는 에셋의 문제가 아니라 잘못된 검사기를 부른
 * 것이므로, 확장자를 보고 부를 수 있을 때만 부릅니다.
 */
function structuralReportFor(
  entryFileName: string,
  files: ReadonlyMap<string, Uint8Array>,
  policy: AssetPolicy,
) {
  if (!/\.(?:glb|gltf)$/iu.test(entryFileName)) return null;
  try {
    return inspectAsset({ entry: entryFileName, files }, policy);
  } catch {
    return null;
  }
}

export function buildAssetInspectionPayload(
  operation: "inspect" | "validate",
  parsed: ReturnType<typeof parseAssetInspectionRequest>,
) {
    const evidence = inspectAssetForTarget({
      ...(parsed.runId ? { runId: parsed.runId } : {}),
      sourcePath: `http-upload:${parsed.entryFileName}`,
      fileName: parsed.entryFileName,
      bytes: parsed.entryBytes,
      targetProfileId: parsed.targetProfileId,
      ...(parsed.assetKind ? { assetKind: parsed.assetKind } : {}),
      bundleFiles: parsed.bundleFiles,
    });
    // AssetEvidence는 게이트 상태만 싣고 측정 수치는 싣지 않습니다. 2026-09-05 실측: 에이전트가
    // "이 GLB 폴리곤 몇 개냐"를 물으면 응답 어디에도 답이 없었습니다. 모델일 때는 같은
    // 바이트를 구조 검사기에도 통과시켜 metrics와 점수를 함께 돌려줍니다.
    /*
     * 점수는 요청한 목표 프로파일의 예산으로 낸다.
     *
     * 2026-09-05 실측: 예전에는 policy 인자 없이 inspectAsset 을 불러 언제나 기본 `web`
     * 예산으로 점수를 냈다. 그래서 unreal(삼각형 250,000) 과 web-three-mobile(25,000) 이
     * 같은 파일에 같은 99 점을 돌려주었다 — 프로파일을 골라도 예산이 안 바뀌었다.
     */
    const policy = targetInspectionPolicy(parsed.targetProfileId);
    const structural = structuralReportFor(parsed.entryFileName, parsed.bundleFiles, policy);
    /*
     * 무엇이 이 파일을 막는가 — 한 곳에 모은다.
     *
     * 두 가지를 고쳤다. (1) CRITICAL 도 hardBlockerCount 가 세는 등급인데 걸러 담는 쪽은
     * ERROR 만 보고 있어서, hardBlockerCount 1 인데 blockingFindings 가 빈 배열로 나가는
     * 응답이 있었다. (2) 목표 프로파일의 계약 규칙(HF-*, TARGET-*)은 구조 리포트가 아니라
     * evidence 에만 있었다. 그래서 같은 JSON 안에서 위쪽이 "valid true · 100점 · 차단 0",
     * 아래쪽 evidence 가 "BLOCKED · ERROR 4건"이라고 말했다(부두 키트 보고서 2절).
     * 이제 valid 와 hardBlockerCount 는 둘을 합친 결과이고, evidence.status 와 어긋나지 않는다.
     */
    const structuralBlocking = (structural?.findings ?? []).filter(
      (item) => item.severity === "ERROR" || item.severity === "CRITICAL",
    );
    const structuralIds = new Set(structuralBlocking.map((item) => `${item.ruleId}:${item.path}`));
    const targetBlocking = evidence.findings
      .filter((item) => item.severity === "ERROR" || item.severity === "CRITICAL")
      .filter((item) => !structuralIds.has(item.id))
      .map((item) => ({
        id: item.id,
        ruleId: item.id.split(":")[0],
        severity: item.severity,
        message: item.message,
        path: item.path ?? "/asset",
        // 이 지적은 구조 규칙이 아니라 고른 목표 프로파일의 계약에서 나왔다.
        source: `target-profile:${evidence.target.id}`,
      }));
    const blocking = [...structuralBlocking, ...targetBlocking];
    const warnings = (structural?.findings ?? []).filter((item) => item.severity === "WARNING");
    return {
      schema: "clunk.asset-inspection-response.v2",
      operation,
      /*
       * 어느 검사가 돌았고 어느 검사가 못 돌았는가.
       *
       * evidence.status 하나로는 "환경이 없어서 못 돌았다"와 "돌았는데 통과했다"를
       * 가를 수 없었다. 레인별 상태를 최상위로 올려 valid/score 옆에 둔다.
       */
      coverage: evidence.coverage,
      engineVerified: evidence.coverage.engineEnvironment === "RAN",
      ...(operation === "validate"
        ? {
            // /agents가 이 도구에 대해 "valid, score, hardBlockers"를 약속하고 있었는데
            // 응답에는 그 셋 중 무엇도 없었습니다. 약속한 것을 실제로 싣습니다.
            valid: structural
              ? blocking.length === 0
              : evidence.status !== "BLOCKED" && evidence.status !== "UNSUPPORTED",
            score: structural?.score.score ?? null,
            hardBlockerCount: structural ? blocking.length : null,
            blockingFindings: blocking,
            /*
             * 점수가 무엇의 결과인지 한 줄로 말한다.
             *
             * `valid`/`score`는 언제나 파일만으로 도는 레인의 결과다. 엔진 임포터를
             * 돌린 적이 없으므로 "이 파일이 유니티에서 열린다"는 주장이 아니다.
             */
            scoreBasis: structural
              ? `${structural.ruleSetId} file-only rules over the uploaded bytes, judged against ${parsed.targetProfileId}'s budgets (${policy.maxTriangles ?? "-"} triangles, ${policy.maxMaterials ?? "-"} materials, ${policy.maxTextureDimension ?? "-"} px textures).`
                + (evidence.coverage.engineEnvironment === "RAN"
                  ? ""
                  : ` The ${evidence.target.engine} import and runtime lanes did not run (${evidence.coverage.skippedLanes.map((lane) => `${lane.id}=${lane.status}`).join(", ")}), so this score says nothing about opening or rendering the asset in ${evidence.target.label}.`)
              : "no structural score: this asset kind is not scored by the 3D rule set",
            /*
             * 점수 100 인데 ready:false 인 조합이 왜 나오는지 응답이 직접 말한다.
             *
             * 2026-09-05 지적: 경고 1건은 한 항목에서 3점을 깎고 여섯 항목 평균으로
             * 나눠지므로 반올림하면 점수가 100 으로 남는다. 그런데 ready 는 지적이
             * 전부 INFO 일 때만 참이다. 점수만 화면에 실으면 통과로 읽힌다.
             */
            readiness: structural
              ? {
                  ready: structural.score.ready && blocking.length === 0,
                  threshold: structural.score.threshold,
                  warningCount: warnings.length,
                  reason: blocking.length === 0 && structural.score.ready
                    ? `Score ${structural.score.score} ≥ ${structural.score.threshold}, no hard blockers, and every finding is INFO.`
                    : blocking.length > 0
                      ? `${blocking.length} hard blocker(s): ${blocking.map((item) => item.ruleId).join(", ")}.`
                      : warnings.length > 0
                        ? `Score ${structural.score.score} clears the ${structural.score.threshold} threshold and there are no hard blockers, but ${warnings.length} WARNING finding(s) keep ready false: ${[...new Set(warnings.map((item) => item.ruleId))].join(", ")}. A rounded score can stay at 100 while a warning stands — read readiness, not the score alone.`
                        : `Score ${structural.score.score} is below the ${structural.score.threshold} threshold.`,
                }
              : null,
            /*
             * 무엇이 hard 인가.
             *
             * hardBlockerCount는 ERROR/CRITICAL만 셉니다. 물리적 타당성 규칙
             * (GEO-FLOATING-PART / GEO-PART-INTERSECTION / GEO-GROUND-CONTACT /
             * GEO-THIN-SHELL)은 어느 것도 그 등급이 아니므로 이 숫자를 바꾸지 않습니다.
             * 같은 측정이 어떤 파일에서는 결함이고 다른 파일에서는 의도이기 때문입니다 —
             * 땅 밑으로 내려간 나무 뿌리, 베어링을 지나는 축, 옷 안에 든 몸, 잎사귀 카드.
             * 그래서 값과 노드 이름을 실어 보내고 판단은 사람이나 에이전트가 합니다.
             */
            physicalPlausibility: structural
              ? {
                  countedInHardBlockers: false,
                  reason:
                    "GEO-GROUND-CONTACT, GEO-FLOATING-PART, GEO-PART-INTERSECTION and GEO-THIN-SHELL are WARNING or INFO by design: the same measurement is a defect in one file and the author's intent in the next (roots under the ground, a shaft through its bearing, a body inside a jacket, a leaf card). They carry the measured millimetres and the node names instead of a verdict.",
                  findings: structural.findings.filter((item) => PHYSICAL_RULE_ID_SET.has(item.ruleId)),
                }
              : null,
          }
        : {}),
      evidence,
      ...(structural ? { metrics: structural.metrics } : {}),
      // AssetEvidence의 findings는 id·심각도·메시지만 싣습니다. 물리적 타당성 규칙은
      // 재 온 값(간격 mm, 관통 깊이 mm)과 그 값이 나온 노드 이름이 본문이므로,
      // observed/threshold/title이 붙은 구조 리포트의 findings를 그대로 함께 보냅니다.
      ...(structural ? { findings: structural.findings } : {}),
      bundle: summarizeAssetBundle(parsed),
      source: "HTTP_UPLOAD",
      visualRuntime: "GAP",
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
      reviewBoundary:
        "These three stay unevaluated on purpose: nothing here rendered the asset. A structural pass is not a statement that it looks right in a game.",
      rawBytesPersisted: false,
    };
}
