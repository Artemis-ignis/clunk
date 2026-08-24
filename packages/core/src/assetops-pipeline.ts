import {
  inspectAsset,
  sha256Hex,
  type AssetBundle,
  type AssetPolicy,
  type Finding,
} from "./index";
import {
  createEvidenceEnvelope,
  type AssetEvidence,
  type AssetEvidenceFinding,
  type AssetEvidenceRecipe,
  type AssetQualityWarning,
  type AssetEvidenceStages,
  type AssetKind,
  type GateResult,
  type TargetProfile,
} from "./assetops-contract";
import { getBuiltInTargetProfile } from "./assetops-profiles";
import {
  analyzeAnimation,
  analyzeImage,
  analyzeSpineProject,
  analyzeSpriteAtlas,
} from "./analyzers/asset-analyzers";
import { inspectHarvestFrontierSemanticContract } from "./semantic-contracts/harvest-frontier";

export interface AssetOpsGateOverrides {
  import?: GateResult;
  runtime?: GateResult;
  device?: GateResult;
  outputReopen?: GateResult;
}

export interface InspectAssetForTargetRequest {
  runId?: string;
  sourcePath?: string;
  fileName: string;
  bytes: Uint8Array;
  targetProfileId: string;
  assetKind?: AssetKind;
  recipe?: AssetEvidenceRecipe;
  bundleFiles?: ReadonlyMap<string, Uint8Array>;
  stageOverrides?: AssetOpsGateOverrides;
}

const IMAGE_KINDS = new Set<AssetKind>(["2d-image"]);
const ATLAS_KINDS = new Set<AssetKind>(["sprite-atlas"]);
const SPINE_KINDS = new Set<AssetKind>(["spine-project"]);
const ANIMATION_KINDS = new Set<AssetKind>(["animation-clip"]);

export function inspectAssetForTarget(request: InspectAssetForTargetRequest): AssetEvidence {
  const target = getBuiltInTargetProfile(request.targetProfileId);
  if (!target) throw new Error(`Unknown target profile: ${request.targetProfileId}`);
  const sourceBytes = new Uint8Array(request.bytes);
  const format = extensionOf(request.fileName);
  const assetKind = request.assetKind ?? inferAssetKind(format, sourceBytes);
  const sourceHash = sha256Hex(sourceBytes);
  const findings: AssetEvidenceFinding[] = [];
  const targetAcceptsFormat = target.acceptedFormats.includes(format);
  const targetAcceptsKind = target.assetKinds.includes(assetKind);
  if (!targetAcceptsFormat) findings.push(finding("TARGET-FORMAT", "ERROR", `.${format || "unknown"} is not accepted by ${target.id}.`, request.fileName));
  if (!targetAcceptsKind) findings.push(finding("TARGET-ASSET-KIND", "ERROR", `${assetKind} is not declared by ${target.id}.`, request.fileName));

  const bytesStage = !sourceBytes.byteLength
    ? gate("fail", "Input bytes are empty.", [evidence("bytes", sourceBytes.byteLength)])
    : !targetAcceptsFormat
      ? gate("unsupported", `Target ${target.id} does not accept .${format || "unknown"}.`, [evidence("format", format)])
      : gate("pass", "Input bytes and target format were received.", [evidence("bytes", sourceBytes.byteLength), evidence("format", format), evidence("sha256", sourceHash)]);

  let structuralStage: GateResult;
  let policyStage: GateResult;
  const bundle = bundleFor(request);

  if (!targetAcceptsFormat || !targetAcceptsKind) {
    structuralStage = gate("unsupported", "Structural analyzer was not run because the target contract rejected this input.", []);
    policyStage = gate("unsupported", "Policy analyzer was not run because the target contract rejected this input.", []);
  } else if (IMAGE_KINDS.has(assetKind)) {
    const result = analyzeImage({ fileName: request.fileName, bytes: sourceBytes, target });
    structuralStage = result.gate;
    policyStage = result.gate;
    findings.push(...result.findings.map(toEvidenceFinding));
  } else if (ATLAS_KINDS.has(assetKind)) {
    const result = analyzeSpriteAtlas({ entry: request.fileName, files: bundle.files, target });
    structuralStage = result.gate;
    policyStage = result.gate;
    findings.push(...result.findings.map(toEvidenceFinding));
  } else if (SPINE_KINDS.has(assetKind)) {
    const result = analyzeSpineProject({ entry: request.fileName, files: bundle.files, target });
    structuralStage = result.gate;
    policyStage = result.gate;
    findings.push(...result.findings.map(toEvidenceFinding));
  } else if (ANIMATION_KINDS.has(assetKind)) {
    const result = analyzeAnimation({ bundle, target });
    structuralStage = result.gate;
    policyStage = result.gate;
    findings.push(...result.findings.map(toEvidenceFinding));
  } else {
    const result = inspectModel(bundle, target);
    structuralStage = result.structure;
    policyStage = result.policy;
    findings.push(...result.findings);
    if (target.semanticRules?.includes("harvest-frontier-runtime-v1")) {
      const document = parseGltfJson(sourceBytes, format);
      if (document) {
        const semantic = inspectHarvestFrontierSemanticContract(document);
        findings.push(...semantic.findings.map(toEvidenceFinding));
        if (semantic.gate.status === "fail") {
          structuralStage = mergeGateFailure(structuralStage, semantic.gate, "Harvest Frontier semantic contract failed.");
          policyStage = mergeGateFailure(policyStage, semantic.gate, "Harvest Frontier semantic contract failed.");
        }
      }
    }
  }

  const stages: AssetEvidenceStages = {
    bytes: bytesStage,
    structure: structuralStage,
    policy: policyStage,
    import: request.stageOverrides?.import ?? unavailableGate(target, "import"),
    runtime: request.stageOverrides?.runtime ?? unavailableGate(target, "runtime"),
    ...(target.requiresDeviceGate
      ? { device: request.stageOverrides?.device ?? unavailableGate(target, "device") }
      : {}),
    ...(request.stageOverrides?.outputReopen ? { outputReopen: request.stageOverrides.outputReopen } : {}),
  };
  const qualityWarnings = findings
    .filter((item) => item.severity === "WARNING")
    .map(toQualityWarning);

  return {
    ...createEvidenceEnvelope({
      runId: request.runId ?? `assetops-${sourceHash.slice(0, 12)}`,
      assetKind,
      ...(request.recipe ? { recipe: request.recipe } : {}),
      source: {
        path: request.sourcePath ?? request.fileName,
        bytes: sourceBytes.byteLength,
        sha256: sourceHash,
        format,
      },
      ruleSetId: target.semanticRules?.[0] ?? `clunk-assetops-${assetKind}-v1`,
      ruleSetVersion: "1.0.0",
      target,
      stages,
      findings,
      qualityWarnings,
    }),
  };
}

function inspectModel(bundle: AssetBundle, target: TargetProfile): {
  structure: GateResult;
  policy: GateResult;
  findings: AssetEvidenceFinding[];
} {
  const report = inspectAsset(bundle, legacyPolicy(target));
  const blockingFormat = report.findings.some((item) => item.category === "format" && isBlocking(item.severity));
  const blockingPolicy = report.findings.some((item) => isBlocking(item.severity));
  return {
    structure: gate(
      blockingFormat ? "fail" : "pass",
      blockingFormat ? "GLB/glTF structure parsing failed." : "GLB/glTF structure parsed.",
      [evidence("analysisId", report.analysisId), evidence("resultDigest", report.resultDigest)],
    ),
    policy: gate(
      blockingPolicy ? "fail" : "pass",
      blockingPolicy ? "3D target policy has blocking findings." : "3D target policy has no blocking findings.",
      [evidence("score", report.score.score), evidence("hardBlockerCount", report.score.hardBlockerCount), evidence("legacyRuleSetId", report.ruleSetId)],
    ),
    findings: report.findings.map(toLegacyFinding),
  };
}

function legacyPolicy(target: TargetProfile): AssetPolicy {
  const profileId = target.platform === "android" || target.platform === "ios"
    ? "mobile"
    : target.platform === "web"
      ? (target.id.includes("mobile") ? "mobile" : "web")
      : "pc";
  const declared = target.inspectionPolicy;
  return {
    profileId,
    ...(declared?.maxTriangles !== undefined ? { maxTriangles: declared.maxTriangles } : {}),
    ...(declared?.maxMaterials !== undefined ? { maxMaterials: declared.maxMaterials } : {}),
    maxTextureDimension: declared?.maxTextureDimension ?? target.texturePolicy.maxDimension,
    ...(declared?.maxTextureMemoryBytes !== undefined
      ? { maxTextureMemoryBytes: declared.maxTextureMemoryBytes }
      : target.texturePolicy.memoryBudgetBytes !== undefined
        ? { maxTextureMemoryBytes: target.texturePolicy.memoryBudgetBytes }
        : {}),
    ...(declared?.readyScoreThreshold !== undefined ? { readyScoreThreshold: declared.readyScoreThreshold } : {}),
  };
}

function bundleFor(request: InspectAssetForTargetRequest): AssetBundle {
  const files = new Map<string, Uint8Array>();
  for (const [fileName, bytes] of request.bundleFiles ?? []) files.set(fileName, new Uint8Array(bytes));
  if (!files.has(request.fileName)) files.set(request.fileName, new Uint8Array(request.bytes));
  return { entry: request.fileName, files };
}

function inferAssetKind(format: string, bytes: Uint8Array): AssetKind {
  if (format === "png" || format === "jpg" || format === "jpeg" || format === "webp") return "2d-image";
  if (format === "atlas") return "sprite-atlas";
  if (format === "skel") return "spine-project";
  if (format === "glb" || format === "gltf") return "3d-model";
  if (format === "json") {
    try {
      const value = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      if (value.skeleton || value.bones || value.slots || value.skins) return "spine-project";
      if (value.asset && (value.animations || value.nodes || value.scenes)) return "animation-clip";
    } catch {
      // The analyzer will report the parse error after the caller declares the ambiguous JSON kind.
    }
    throw new Error("JSON input is ambiguous; pass assetKind spine-project or animation-clip.");
  }
  throw new Error(`Cannot infer asset kind from .${format || "unknown"}; pass assetKind explicitly.`);
}

function parseGltfJson(bytes: Uint8Array, format: string): unknown | undefined {
  try {
    if (format === "gltf") return JSON.parse(new TextDecoder().decode(bytes));
    if (format !== "glb" || bytes.byteLength < 20) return undefined;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x46546c67) return undefined;
    const totalLength = Math.min(view.getUint32(8, true), bytes.byteLength);
    let offset = 12;
    while (offset + 8 <= totalLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      offset += 8;
      if (offset + length > totalLength) return undefined;
      if (type === 0x4e4f534a) return JSON.parse(new TextDecoder().decode(bytes.slice(offset, offset + length)));
      offset += length;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function extensionOf(fileName: string): string {
  const match = /\.([^.\\/]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

function unavailableGate(target: TargetProfile, stage: string): GateResult {
  return gate("environmentUnavailable", `No ${target.engine} ${stage} runner was supplied; structural evidence only.`, [
    evidence("engine", target.engine),
    evidence("engineVersion", target.engineVersion),
    evidence("profileId", target.id),
  ]);
}

function mergeGateFailure(current: GateResult, failure: GateResult, message: string): GateResult {
  return {
    status: "fail",
    message,
    evidence: [...current.evidence, ...failure.evidence],
    durationMs: current.durationMs + failure.durationMs,
  };
}

function gate(status: GateResult["status"], message: string, evidenceItems: GateResult["evidence"]): GateResult {
  return { status, message, evidence: evidenceItems, durationMs: 0 };
}

function evidence(key: string, value: string | number | boolean | null) {
  return { key, value };
}

function finding(id: string, severity: AssetEvidenceFinding["severity"], message: string, path?: string): AssetEvidenceFinding {
  return { id, severity, message, ...(path ? { path } : {}) };
}

function toEvidenceFinding(value: { id: string; severity: AssetEvidenceFinding["severity"]; message: string; path?: string }): AssetEvidenceFinding {
  return finding(value.id, value.severity, value.message, value.path);
}

function toLegacyFinding(value: Finding): AssetEvidenceFinding {
  return finding(value.id, value.severity, value.message, value.path);
}

function toQualityWarning(value: AssetEvidenceFinding): AssetQualityWarning {
  return {
    id: `quality-${value.id.toLowerCase()}`,
    domain: qualityWarningDomain(value.id),
    status: "NON_BLOCKING",
    message: value.message,
    ...(value.path ? { path: value.path } : {}),
  };
}

function qualityWarningDomain(id: string): AssetQualityWarning["domain"] {
  if (/^(?:IMAGE|ATLAS|TEX)/i.test(id)) return "texture";
  if (/^SPINE/i.test(id)) return "spine";
  if (/^ANIM/i.test(id)) return "animation";
  if (/^SPRITE/i.test(id)) return "sprite";
  return "model";
}

function isBlocking(severity: Finding["severity"]): boolean {
  return severity === "ERROR" || severity === "CRITICAL";
}
