/*
 * Envelope fields mirror the rule set the report itself declares, so a custom profile id and
 * version reach every surface. Built-in profiles keep reporting RULE_SET_ID / RULE_SET_VERSION.
 */
import { CORE_VERSION, type InspectionReport, type OptimizationResult, type Passport } from "./index";

export function inspectEnvelope(report: InspectionReport) {
  return {
    schemaVersion: "1.0" as const,
    operation: "inspect" as const,
    coreBuildId: CORE_VERSION,
    ruleSetId: report.ruleSetId,
    ruleSetVersion: report.ruleSetVersion,
    inputHash: report.inputHash,
    resultDigest: report.resultDigest,
    report,
  };
}

export function validateEnvelope(valid: boolean, report: InspectionReport) {
  /*
   * `valid` 가 무엇을 뜻하는지 응답이 직접 말한다.
   *
   * 2026-09-05 마을 광장 키트 실측: 등받이 기둥이 좌판을 35 mm, 돌 팔걸이를 75 mm
   * 뚫고 있는 벤치 파일이 `valid: true` 로 돌아왔다. 그 파일에는 GEO-PART-INTERSECTION
   * 이 네 건 들어 있었지만 어느 것도 ERROR 가 아니므로 valid 는 참이다. 도구 이름이
   * "validate" 라서, 이것만 부르는 연동 상대는 그것을 "검증 통과" 로 읽는다.
   * 그래서 무엇을 세고 무엇을 안 세는지, 그리고 지금 몇 건이 남아 있는지 같이 싣는다.
   */
  const physical = report.findings.filter(
    (finding) => finding.severity === "WARNING" || finding.severity === "INFO",
  );
  return {
    schemaVersion: "1.0" as const,
    operation: "validate" as const,
    coreBuildId: CORE_VERSION,
    ruleSetId: report.ruleSetId,
    ruleSetVersion: report.ruleSetVersion,
    inputHash: report.inputHash,
    resultDigest: report.resultDigest,
    valid,
    validBasis: {
      counts: "ERROR and CRITICAL findings only",
      hardBlockerCount: report.score.hardBlockerCount,
      score: report.score.score,
      threshold: report.score.threshold,
      ready: report.score.ready,
      nonBlockingFindingCount: physical.length,
      note:
        "valid true means no ERROR or CRITICAL rule fired. The physical-plausibility rules "
        + "(ground contact, floating parts, part intersections, thin shells, inverted winding) are "
        + "WARNING or INFO by design and never flip it, so a file whose parts pass through each "
        + "other can still be valid. Read report.findings before shipping; `ready` is the stricter "
        + "flag and is true only when every finding is INFO.",
    },
    report,
  };
}

export function optimizeEnvelope(result: OptimizationResult, outputPath?: string, passportPath?: string) {
  return {
    schemaVersion: "1.0" as const,
    operation: "optimize" as const,
    coreBuildId: CORE_VERSION,
    ruleSetId: result.after.ruleSetId,
    ruleSetVersion: result.after.ruleSetVersion,
    inputHash: result.inputHash,
    outputHash: result.outputHash,
    resultDigest: result.after.resultDigest,
    outputPath,
    passportPath,
    operations: result.operations,
    before: result.before,
    after: result.after,
    passport: result.passport,
  };
}

export function passportEnvelope(passport: Passport, resultDigest: string) {
  return {
    schemaVersion: "1.0" as const,
    operation: "passport" as const,
    coreBuildId: CORE_VERSION,
    ruleSetId: passport.ruleSetId,
    ruleSetVersion: passport.ruleSetVersion,
    inputHash: passport.sourceHash,
    outputHash: passport.outputHash,
    resultDigest,
    passport,
  };
}
