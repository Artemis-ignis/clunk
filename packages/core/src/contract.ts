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
  return {
    schemaVersion: "1.0" as const,
    operation: "validate" as const,
    coreBuildId: CORE_VERSION,
    ruleSetId: report.ruleSetId,
    ruleSetVersion: report.ruleSetVersion,
    inputHash: report.inputHash,
    resultDigest: report.resultDigest,
    valid,
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
