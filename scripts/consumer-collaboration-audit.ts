#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import {
  createAssetBundle,
  createConsumerValidationReport,
  inspectAsset,
  inspectAssetForTarget,
  type AssetEvidence,
  type AssetKind,
  type AssetPolicy,
  type ConsumerAssetRecord,
  type ConsumerCheckStatus,
  type ConsumerClunkInspection,
  type ConsumerFileRef,
  type ConsumerProjectRecord,
  type ConsumerProvenance,
  type ConsumerRuntimeEvidence,
} from "../packages/core/src/index";
import { inspectEnvelope } from "../packages/core/src/contract";

const CLUNK_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_HARVEST_ROOT = "C:\\Users\\50106\\Desktop\\Harvest Frontier";
const DEFAULT_FORGE_ROOT = "C:\\Users\\50106\\Desktop\\FORGE FRONT";
const ZERO_HASH = "0".repeat(64);

interface Options {
  harvestRoot: string;
  forgeRoot: string;
  runId: string;
  outputPath: string;
  strict: boolean;
}

interface GitInfo {
  head: string | null;
  dirty: boolean;
  dirtyEntryCount: number;
}

interface RuntimeCandidate {
  path: string;
  value: Record<string, unknown>;
  modifiedAt: number;
}

interface InspectionResult {
  record: ConsumerClunkInspection;
  evidence: AssetEvidence | null;
}

interface ForgeManifestAsset {
  id: string;
  assetId?: string;
  source?: FileManifestRef;
  derived?: FileManifestRef;
  runtime?: FileManifestRef;
  sourcePath?: string;
  derivedPath?: string;
  clunk?: Record<string, unknown>;
  evidencePaths?: Record<string, unknown>;
}

interface FileManifestRef {
  path?: string;
  sha256?: string;
  bytes?: number;
}

function main(): void {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed === null) return;
    const options = resolveOptions(parsed);
    const outputPath = resolve(options.outputPath);
    assertOutputIsClunkOwned(outputPath, options.harvestRoot, options.forgeRoot);
    if (existsSync(outputPath)) throw new Error(`Output already exists; use a new --run-id: ${outputPath}`);
    mkdirSync(dirname(outputPath), { recursive: true });

    const runRoot = dirname(outputPath);
    const harvest = collectHarvestFrontier(options.harvestRoot, runRoot, options.runId);
    const forge = collectForgeFront(options.forgeRoot, runRoot, options.runId);
    const report = createConsumerValidationReport({
      runId: options.runId,
      generatedAt: new Date().toISOString(),
      clunk: {
        root: CLUNK_ROOT,
        gitHead: gitInfo(CLUNK_ROOT).head,
        coreBuildId: "0.1.0",
      },
      projects: [harvest.project, forge.project],
      readOnly: true,
      limitations: [
        "Consumer checkouts are read-only inputs; this run writes only below the Clunk evidence directory.",
        "Clunk structural inspection, consumer runtime evidence, and human player-facing review remain separate gates.",
        "A project-level runtime PASS does not prove that every individual asset was visually approved.",
      ],
    });
    writeJsonExclusive(outputPath, report);

    const result = {
      ok: report.summary.integrityFailureCount === 0,
      reportPath: outputPath,
      runId: report.runId,
      status: report.summary.readiness,
      summary: report.summary,
      projects: report.projects.map((project) => ({
        id: project.id,
        status: project.status,
        gitHead: project.gitHead,
        assetCount: project.assets.length,
        runtime: project.runtime.status,
        humanReview: project.runtime.humanReview,
      })),
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (report.summary.integrityFailureCount > 0) process.exitCode = 1;
    else if (options.strict && report.summary.readiness !== "VALIDATED") process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

function parseArgs(args: readonly string[]): Partial<Options> | null {
  const result: Partial<Options> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write([
        "Usage: npm run consumer:audit -- [options]",
        "",
        "  --run-id <id>          Immutable evidence run id",
        "  --harvest-root <path>  Harvest Frontier checkout",
        "  --forge-root <path>    FORGE FRONT checkout",
        "  --out <path>           Clunk-side report path",
        "  --strict               Return exit 2 while any non-blocking gate remains",
      ].join("\n") + "\n");
      return null;
    }
    if (arg === "--strict") {
      result.strict = true;
      continue;
    }
    if (arg === "--run-id" || arg === "--harvest-root" || arg === "--forge-root" || arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      index += 1;
      if (arg === "--run-id") result.runId = value;
      if (arg === "--harvest-root") result.harvestRoot = value;
      if (arg === "--forge-root") result.forgeRoot = value;
      if (arg === "--out") result.outputPath = value;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

function resolveOptions(input: Partial<Options>): Options {
  const runId = input.runId ?? makeRunId();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(runId)) {
    throw new Error("--run-id must contain only letters, numbers, dot, underscore, or hyphen.");
  }
  const harvestRoot = resolve(input.harvestRoot ?? DEFAULT_HARVEST_ROOT);
  const forgeRoot = resolve(input.forgeRoot ?? DEFAULT_FORGE_ROOT);
  const outputPath = input.outputPath
    ? resolve(input.outputPath)
    : join(CLUNK_ROOT, ".clunk-evidence", "consumer-validation", runId, "report.json");
  return { harvestRoot, forgeRoot, runId, outputPath, strict: input.strict === true };
}

function makeRunId(): string {
  return `clunk-consumer-${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
}

function collectHarvestFrontier(root: string, runRoot: string, runId: string): { project: ConsumerProjectRecord; handoffPath: string } {
  const runtimeRoot = join(root, "public", "assets", "runtime");
  const git = gitInfo(root);
  const projectEvidenceRoot = join(runRoot, "harvest-frontier");
  mkdirSync(projectEvidenceRoot, { recursive: true });
  const provenance = harvestProvenance(root);
  const runtimeEvidence = latestHarvestRuntimeEvidence(root, git.head);
  const glbPaths = existsSync(runtimeRoot)
    ? readdirSync(runtimeRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".glb")
      .map((entry) => join(runtimeRoot, entry.name))
      .sort((left, right) => basename(left).localeCompare(basename(right)))
    : [];

  const assets: ConsumerAssetRecord[] = [];
  const handoffAssets: Record<string, unknown>[] = [];
  for (const filePath of glbPaths) {
    const id = basename(filePath, ".glb");
    const source = fileRef(filePath);
    const targetInspection = inspectForConsumer(
      source,
      "harvest-frontier-web-three",
      "3d-model",
      `${runId}-hf-${id}`,
      join(projectEvidenceRoot, `${safeFileName(id)}-clunk-inspection.json`),
      "source",
    );
    const compatibility = compatibilityInspection(filePath, source, join(projectEvidenceRoot, `${safeFileName(id)}-pc-inspection.json`));
    const runtimeInspection = source.hashVerified
      ? { ...targetInspection.record, input: "runtime" as const }
      : undefined;
    const integrity = checksToIntegrity({
      sourceHash: source.hashVerified ? "PASS" : "FAIL",
      runtimeHash: source.hashVerified ? "PASS" : "FAIL",
      clunkInputHash: targetInspection.record.inputHash === source.sha256 ? "PASS" : "FAIL",
      compatibilityInspection: compatibility.report.inputHash === source.sha256 ? "PASS" : "FAIL",
    });
    const runtimeAttachment = {
      status: !source.hashVerified ? "FAIL" as const : runtimeEvidence.status === "PASS" ? "PASS" as const : "GAP" as const,
      pathPresent: source.hashVerified,
      observation: source.hashVerified && runtimeEvidence.status === "PASS" ? "PATH_ONLY" as const : "NOT_OBSERVED" as const,
      note: "현재 HF 런타임 증거는 프로젝트·화면 범위이며, GLB별 loader 사용은 별도 계측되지 않았습니다.",
      ...(runtimeEvidence.evidencePath ? { evidencePath: runtimeEvidence.evidencePath } : {}),
    };
    assets.push({
      id,
      projectId: "harvest-frontier",
      kind: "3d-model",
      role: id.includes("lod1") ? "near/far LOD runtime model" : "runtime model",
      source,
      runtime: source,
      clunk: targetInspection.record,
      ...(runtimeInspection ? { runtimeInspection } : {}),
      runtimeAttachment,
      provenance,
      integrity,
    });
    handoffAssets.push({
      fileName: basename(filePath),
      sourcePath: filePath,
      bytes: source.bytes,
      sha256: source.sha256,
      clunkInspection: compatibility.envelope,
    });
  }

  const handoffPath = join(projectEvidenceRoot, "harvest-frontier-handoff.json");
  writeJsonExclusive(handoffPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceProject: root,
    runtimeRoot,
    readOnly: true,
    optimizerAllowed: false,
    clunkProfile: "pc",
    ruleSetId: "clunk-game-ready-v1",
    assets: handoffAssets,
    collaborationBoundary: [
      "This compatibility manifest reads current Harvest Frontier GLB bytes and never writes to the Harvest Frontier checkout.",
      "Clunk target inspection and Harvest semantic/runtime validation remain separate gates.",
      "A changed SHA-256 requires a new run and invalidates earlier evidence for that asset.",
    ],
  });
  const handoffCheck = runHarvestVerifier(root, handoffPath);
  const checks: Record<string, ConsumerCheckStatus> = {
    sourceCheckout: git.head ? "PASS" : "NOT_CHECKED",
    provenanceManifest: provenance.status === "PASS" ? "PASS" : provenance.status === "FAIL" ? "FAIL" : "NOT_CHECKED",
    currentClunkHandoff: handoffCheck.status,
    currentRuntimeEvidence: runtimeEvidence.status === "PASS" ? "PASS" : runtimeEvidence.status === "FAIL" ? "FAIL" : "NOT_CHECKED",
  };
  const project: ConsumerProjectRecord = {
    id: "harvest-frontier",
    name: "Harvest Frontier",
    root,
    gitHead: git.head,
    dirty: git.dirty,
    readOnly: true,
    runtime: runtimeEvidence,
    checks,
    assets,
    status: "PASS_WITH_GAPS",
    limitations: [
      "Clunk inspection is fresh for the current GLB bytes, but the target import/runtime stages are not executed by Clunk itself.",
      "The current game evidence proves a shipped-path game session, not a per-GLB loader telemetry map.",
      "Human player-facing visual review remains NOT_EVALUATED in the imported evidence.",
    ],
  };
  return { project, handoffPath };
}

function collectForgeFront(root: string, runRoot: string, runId: string): { project: ConsumerProjectRecord } {
  const projectEvidenceRoot = join(runRoot, "forge-front");
  mkdirSync(projectEvidenceRoot, { recursive: true });
  const git = gitInfo(root);
  const gameReady = latestForgeGameReadyEvidence(root);
  const pipelinePath = resolveForgePipelinePath(root, gameReady.value);
  const pipeline = pipelinePath ? readRecord(pipelinePath) : null;
  const pipelineHash = pipelinePath ? fileRef(pipelinePath) : missingFileRef(join(root, "artifacts", "clunk", "evidence", "pipeline-manifest.json"));
  const runtimeAssets = forgeRuntimeAssets(gameReady.value);
  const assets: ConsumerAssetRecord[] = [];

  for (const raw of arrayRecords(pipeline?.assets)) {
    const record = {
      ...raw,
      id: stringValue(raw.id) ?? stringValue(raw.assetId) ?? "",
    } as unknown as ForgeManifestAsset;
    if (!record.id) continue;
    const sourcePath = record.source?.path ?? record.sourcePath;
    const derivedPath = record.derived?.path ?? record.derivedPath;
    const runtimePath = record.runtime?.path ?? runtimePathFromEvidence(root, runtimeAssets, record);
    const source = sourcePath ? fileRef(sourcePath) : missingFileRef(join(root, "artifacts", "clunk", "source", `${record.id}-source.png`));
    const derived = derivedPath ? fileRef(derivedPath) : missingFileRef(join(root, "artifacts", "clunk", "derived", `${record.id}.png`));
    const runtime = runtimePath ? fileRef(runtimePath) : missingFileRef(join(root, "public", "assets", "clunk", record.id));
    const sourceInspection = inspectForConsumer(
      source,
      "yeongheo-pixi-2d",
      "2d-image",
      `${runId}-ff-${record.id}-source`,
      join(projectEvidenceRoot, `${safeFileName(record.id)}-source-clunk-inspection.json`),
      "source",
    );
    const runtimeInspection = inspectForConsumer(
      runtime,
      "yeongheo-pixi-2d",
      "2d-image",
      `${runId}-ff-${record.id}-runtime`,
      join(projectEvidenceRoot, `${safeFileName(record.id)}-runtime-clunk-inspection.json`),
      "runtime",
    );
    const runtimeEntry = runtimeAssets.find((candidate) => pathMatchesRuntime(candidate.url, runtime.path, root));
    const runtimeLoaded = runtimeEntry?.loaded === true;
    const runtimeExternal = runtimeEntry?.externalRequests === true;
    const runtimeLoadedValue = runtimeEntry?.loaded;
    const runtimeExternalValue = runtimeEntry?.externalRequests;
    const pipelineClunk = record.clunk ?? {};
    const checks = checksToIntegrity({
      sourceHash: matchesManifest(source, record.source) ? "PASS" : "FAIL",
      derivedHash: matchesManifest(derived, record.derived) ? "PASS" : "FAIL",
      runtimeHash: matchesManifest(runtime, record.runtime) ? "PASS" : "FAIL",
      sourceClunk: sourceInspection.record.inputHash === source.sha256 ? "PASS" : "FAIL",
      runtimeClunk: runtimeInspection.record.inputHash === runtime.sha256 ? "PASS" : "FAIL",
      spriteAudit: pipelineClunk.spriteAuditStatus === "PASS" ? "PASS" : "FAIL",
      runtimeLoad: runtimeLoaded && !runtimeExternal ? "PASS" : "FAIL",
      pipelineManifest: pipelineHash.hashVerified ? "PASS" : "FAIL",
    });
    const provenance = forgeProvenance(record, pipelinePath, pipelineHash);
    assets.push({
      id: record.id,
      projectId: "forge-front",
      kind: "2d-image",
      role: "Clunk-promoted PixiJS runtime asset",
      source,
      derived,
      runtime,
      clunk: sourceInspection.record,
      runtimeInspection: runtimeInspection.record,
      runtimeAttachment: {
        status: runtimeLoaded && !runtimeExternal && runtime.hashVerified ? "PASS" : runtime.hashVerified ? "GAP" : "FAIL",
        pathPresent: runtime.hashVerified,
        observation: runtimeLoaded && !runtimeExternal ? "LOADED" : runtime.hashVerified ? "PATH_ONLY" : "NOT_OBSERVED",
        ...(typeof runtimeLoadedValue === "boolean" ? { loaded: runtimeLoadedValue } : {}),
        ...(typeof runtimeExternalValue === "boolean" ? { externalRequests: runtimeExternalValue } : {}),
        ...(gameReady.path ? { evidencePath: gameReady.path } : {}),
        note: runtimeEntry ? "FORGE FRONT game-ready evidence의 runtime asset URL·loaded 값을 해시 경로와 대조했습니다." : "게임 런타임 evidence에서 대응 URL을 찾지 못했습니다.",
      },
      provenance,
      integrity: checks,
    });
  }

  const runtime = forgeRuntimeEvidence(root, gameReady, runtimeAssets);
  const checks: Record<string, ConsumerCheckStatus> = {
    sourceCheckout: git.head ? "PASS" : "NOT_CHECKED",
    pipelineManifest: pipeline && pipelineHash.hashVerified ? "PASS" : "FAIL",
    runtimeEvidence: runtime.status === "PASS" ? "PASS" : runtime.status === "FAIL" ? "FAIL" : "NOT_CHECKED",
    runtimeAssetCount: runtime.expectedAssetCount === assets.length && runtime.loadedAssetCount === assets.length ? "PASS" : "FAIL",
  };
  const project: ConsumerProjectRecord = {
    id: "forge-front",
    name: "FORGE FRONT",
    root,
    gitHead: git.head,
    dirty: git.dirty,
    readOnly: true,
    runtime,
    checks,
    assets,
    status: "PASS_WITH_GAPS",
    limitations: [
      "현재 게임-ready evidence는 자동 브라우저·런타임 로드를 증명하지만 human visual review는 NOT_EVALUATED입니다.",
      "Clunk Core import stage는 기존 consumer pipeline에서 ENVIRONMENT_UNAVAILABLE로 보존되어 있습니다.",
      "이 실행은 FORGE FRONT 게임 로직이나 파일을 수정하지 않았습니다.",
    ],
  };
  return { project };
}

function inspectForConsumer(
  ref: ConsumerFileRef,
  targetProfileId: string,
  assetKind: AssetKind,
  runId: string,
  evidencePath: string,
  input: "source" | "derived" | "runtime",
): InspectionResult {
  if (!ref.hashVerified) {
    return {
      record: {
        input,
        targetProfileId,
        ruleSetId: assetKind === "3d-model" ? "harvest-frontier-runtime-v1" : "pixi-sprite-atlas-v1",
        status: "BLOCKED",
        productionReady: false,
        inputHash: ref.sha256,
        evidencePath,
      },
      evidence: null,
    };
  }
  const bytes = new Uint8Array(readFileSync(ref.path));
  const evidence = inspectAssetForTarget({
    runId,
    sourcePath: ref.path,
    fileName: basename(ref.path),
    bytes,
    targetProfileId,
    assetKind,
  });
  writeJsonExclusive(evidencePath, evidence);
  return {
    record: {
      input,
      targetProfileId,
      ruleSetId: evidence.ruleSetId ?? evidence.target.semanticRules?.[0] ?? "unknown",
      status: evidence.status,
      productionReady: evidence.productionReady,
      inputHash: evidence.source.sha256,
      evidencePath,
      warningCount: evidence.qualityWarnings.length,
      hardBlockerCount: evidence.findings.filter((finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL").length,
    },
    evidence,
  };
}

function compatibilityInspection(
  filePath: string,
  ref: ConsumerFileRef,
  evidencePath: string,
): { report: ReturnType<typeof inspectAsset>; envelope: ReturnType<typeof inspectEnvelope> } {
  const policy: AssetPolicy = { profileId: "pc" };
  const report = inspectAsset(createAssetBundle(basename(filePath), new Uint8Array(readFileSync(filePath))), policy);
  const envelope = inspectEnvelope(report);
  writeJsonExclusive(evidencePath, envelope);
  if (report.inputHash !== ref.sha256) throw new Error(`Compatibility inspection hash mismatch: ${filePath}`);
  return { report, envelope };
}

function harvestProvenance(root: string): ConsumerProvenance {
  const paths = [join(root, "assets", "provenance.json"), join(root, "public", "assets", "provenance.json")];
  const refs = paths.map((path) => resolve(path));
  const files = refs.map(fileRef);
  const same = files.every((file) => file.hashVerified) && new Set(files.map((file) => file.sha256)).size === 1;
  return {
    status: same ? "PASS" : files.some((file) => file.hashVerified) ? "FAIL" : "GAP",
    refs,
    ...(files[0]?.hashVerified ? { manifestHash: files[0].sha256 } : {}),
    note: same ? "Harvest Frontier provenance manifests are byte-identical for this run." : "Both provenance manifests could not be proven byte-identical.",
  };
}

function forgeProvenance(record: ForgeManifestAsset, pipelinePath: string | null, pipelineHash: ConsumerFileRef): ConsumerProvenance {
  const refs = [
    pipelinePath,
    stringPath(record.source?.path ?? record.sourcePath),
    stringPath(record.derived?.path ?? record.derivedPath),
    stringPath(record.runtime?.path),
    stringPath(record.evidencePaths?.inspect),
    stringPath(record.evidencePaths?.spriteAudit),
  ].filter((value): value is string => value !== null).map((path) => resolve(path));
  const licenseStatus = stringValue((record.source as Record<string, unknown> | undefined)?.licenseStatus);
  const status = pipelineHash.hashVerified && refs.length >= 3 && Boolean(licenseStatus) ? "PASS" : refs.length > 0 ? "GAP" : "FAIL";
  return {
    status,
    refs,
    ...(pipelineHash.hashVerified ? { manifestHash: pipelineHash.sha256 } : {}),
    note: licenseStatus ? `licenseStatus=${licenseStatus}` : "원본 라이선스 상태가 pipeline manifest에 없습니다.",
  };
}

function latestHarvestRuntimeEvidence(root: string, sourceHead: string | null): ConsumerRuntimeEvidence {
  const verificationRoot = join(root, ".logs", "verification");
  const candidate = latestJson(verificationRoot, (value) => {
    const shippedPath = value.shippedPath === true;
    const status = passValue(value.status);
    const current = sourceHead === null || value.sourceHead === undefined || value.sourceHead === sourceHead;
    return shippedPath && status && current && harvestScreenshotPaths(value).length > 0;
  });
  if (!candidate) {
    return {
      status: "UNAVAILABLE",
      scope: "project",
      humanReview: "NOT_EVALUATED",
      productionReady: false,
      note: "현재 체크아웃과 연결되는 shipped-path Harvest Frontier runtime evidence를 찾지 못했습니다.",
    };
  }
  const value = candidate.value;
  const screenshots = harvestScreenshotPaths(value).map((path) => fileRef(resolve(root, path)));
  const missingCapture = screenshots.some((file) => !file.hashVerified);
  const errors = numberValue(value.consoleErrorCount) ?? 0;
  const warnings = numberValue(value.consoleWarningCount) ?? 0;
  return {
    status: !missingCapture && errors === 0 && warnings === 0 ? "PASS" : "FAIL",
    scope: "project",
    ...(stringValue(value.runId) ? { runId: stringValue(value.runId)! } : {}),
    evidencePath: candidate.path,
    sourceCommit: stringValue(value.sourceHead),
    shippedPath: true,
    pageErrors: errors,
    pageWarnings: warnings,
    humanReview: "NOT_EVALUATED",
    productionReady: false,
    evidenceFiles: screenshots,
    note: "프로젝트·화면 범위의 shipped-path 자동 검증입니다. 개별 GLB loader 사용과 사람의 시각 승인은 별도입니다.",
  };
}

function harvestScreenshotPaths(value: Record<string, unknown>): string[] {
  const flow = asRecord(value.flow);
  const flowScreenshots = arrayStrings(flow?.screenshots);
  if (flowScreenshots.length > 0) return flowScreenshots;
  const screenshot = asRecord(value.screenshot);
  const screenshotPath = stringValue(screenshot?.path);
  return screenshotPath ? [screenshotPath] : [];
}

function latestForgeGameReadyEvidence(root: string): RuntimeCandidate {
  const candidate = latestJson(join(root, "artifacts", "clunk", "evidence", "game-ready"), (value) => value.schema === "forge-front.game-ready-evidence.v8");
  if (!candidate) throw new Error(`FORGE FRONT game-ready evidence not found below ${root}`);
  return candidate;
}

function resolveForgePipelinePath(root: string, gameReady: Record<string, unknown>): string | null {
  const runId = stringValue(gameReady.assetPipelineRunId);
  if (runId) {
    const exact = join(root, "artifacts", "clunk", "evidence", `clunk-manifest-${runId}.json`);
    if (existsSync(exact)) return exact;
  }
  const candidate = latestJson(join(root, "artifacts", "clunk", "evidence"), (value) => value.schema === "forge-front.clunk-pipeline.v1");
  return candidate?.path ?? null;
}

function forgeRuntimeAssets(gameReady: Record<string, unknown>): Record<string, unknown>[] {
  const start = asRecord(gameReady.start);
  const nested = asRecord(start?.runtimeAssetEvidence);
  const direct = arrayRecords(nested?.assets);
  return direct.length > 0 ? direct : arrayRecords(gameReady.runtimeAssets);
}

function forgeRuntimeEvidence(
  root: string,
  candidate: RuntimeCandidate,
  runtimeAssets: readonly Record<string, unknown>[],
): ConsumerRuntimeEvidence {
  const value = candidate.value;
  const start = asRecord(value.start);
  const nested = asRecord(start?.runtimeAssetEvidence);
  const assets = runtimeAssets;
  const expected = numberValue(nested?.assetCount) ?? assets.length;
  const loaded = assets.filter((asset) => asset.loaded === true).length;
  const externalRequests = nested?.externalRequests === true || assets.some((asset) => asset.externalRequests === true);
  const pageErrors = arrayRecords(asRecord(value.runtimeErrors)?.pageErrors).length
    + arrayStrings(asRecord(value.runtimeErrors)?.errors).length
    + arrayStrings(asRecord(value.runtimeErrors)?.rejections).length;
  const resourceAudit = asRecord(value.resourceAudit);
  const external = arrayRecords(resourceAudit?.external).length;
  const captures = arrayStrings(value.captures).map((path) => fileRef(resolve(root, path)));
  const missingCapture = captures.some((file) => !file.hashVerified);
  const status = candidate.value.verdicts && !missingCapture && expected === loaded && !externalRequests && external === 0 && pageErrors === 0
    ? "PASS" as const
    : "FAIL" as const;
  return {
    status,
    scope: "project",
    ...(stringValue(value.runId) ? { runId: stringValue(value.runId)! } : {}),
    evidencePath: candidate.path,
    sourceCommit: null,
    shippedPath: true,
    expectedAssetCount: expected,
    loadedAssetCount: loaded,
    externalRequests,
    pageErrors,
    pageWarnings: 0,
    humanReview: stringValue(asRecord(value.verdicts)?.humanReview) === "PASS" ? "PASS" : "NOT_EVALUATED",
    productionReady: false,
    evidenceFiles: captures,
    note: "FORGE FRONT 자동 game-ready evidence에서 2D Clunk runtime asset URL·로드·외부 요청을 대조했습니다.",
  };
}

function runtimePathFromEvidence(root: string, runtimeAssets: readonly Record<string, unknown>[], record: ForgeManifestAsset): string | null {
  const candidate = runtimeAssets.find((entry) => {
    const url = stringValue(entry.url);
    return url !== null && (url.includes(`/assets/clunk/${record.id}/`) || url.toLowerCase().includes(record.id.replace(/-/g, "").toLowerCase()));
  });
  const url = candidate ? stringValue(candidate.url) : null;
  return url ? pathFromUrl(root, url) : null;
}

function pathMatchesRuntime(url: unknown, runtimePath: string, root: string): boolean {
  return typeof url === "string" && resolve(pathFromUrl(root, url)) === resolve(runtimePath);
}

function pathFromUrl(root: string, url: string): string {
  const pathname = url.split("?", 1)[0].replace(/^\/+/, "");
  return resolve(root, "public", ...pathname.split("/"));
}

function runHarvestVerifier(root: string, handoffPath: string): { status: ConsumerCheckStatus; output: unknown } {
  const verifier = join(root, "tools", "verify-clunk-handoff.cjs");
  if (!existsSync(verifier)) return { status: "NOT_CHECKED", output: null };
  try {
    const stdout = execFileSync(process.execPath, [verifier], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CLUNK_HANDOFF_MANIFEST: handoffPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { status: parsed.status === "PASS" ? "PASS" : "FAIL", output: parsed };
  } catch (error) {
    const output = asRecord(error) ?? { error: error instanceof Error ? error.message : String(error) };
    return { status: "FAIL", output };
  }
}

function checksToIntegrity(checks: Record<string, ConsumerCheckStatus>): { status: "PASS" | "FAIL"; checks: Record<string, ConsumerCheckStatus> } {
  return {
    status: Object.values(checks).some((status) => status === "FAIL") ? "FAIL" : "PASS",
    checks,
  };
}

function matchesManifest(actual: ConsumerFileRef, expected: FileManifestRef | undefined): ConsumerCheckStatus {
  if (!expected || !actual.hashVerified) return "FAIL";
  return actual.sha256.toLowerCase() === String(expected.sha256 ?? "").toLowerCase()
    && actual.bytes === Number(expected.bytes)
    ? "PASS"
    : "FAIL";
}

function fileRef(filePath: string): ConsumerFileRef {
  const path = resolve(filePath);
  if (!existsSync(path) || !statSync(path).isFile()) return missingFileRef(path);
  const bytes = readFileSync(path);
  return { path, bytes: bytes.byteLength, sha256: sha256(bytes), hashVerified: true };
}

function missingFileRef(filePath: string): ConsumerFileRef {
  return { path: resolve(filePath), bytes: 0, sha256: ZERO_HASH, hashVerified: false };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitInfo(root: string): GitInfo {
  try {
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
    const status = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const dirtyEntryCount = status ? status.split(/\r?\n/).filter(Boolean).length : 0;
    return { head, dirty: dirtyEntryCount > 0, dirtyEntryCount };
  } catch {
    return { head: null, dirty: false, dirtyEntryCount: 0 };
  }
}

function latestJson(root: string, predicate: (value: Record<string, unknown>) => boolean): RuntimeCandidate | null {
  if (!existsSync(root)) return null;
  const candidates: RuntimeCandidate[] = [];
  for (const filePath of walkFiles(root)) {
    if (extname(filePath).toLowerCase() !== ".json") continue;
    try {
      const value = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
      if (predicate(value)) candidates.push({ path: filePath, value, modifiedAt: statSync(filePath).mtimeMs });
    } catch {
      // An unrelated or partially written evidence file must not stop the audit.
    }
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return candidates[0] ?? null;
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function writeJsonExclusive(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function readRecord(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function arrayStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function passValue(value: unknown): boolean {
  return value === "PASS" || value === "pass" || value === "passed";
}

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

function stringPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function assertOutputIsClunkOwned(outputPath: string, harvestRoot: string, forgeRoot: string): void {
  const path = resolve(outputPath);
  for (const consumerRoot of [resolve(harvestRoot), resolve(forgeRoot)]) {
    const rel = relative(consumerRoot, path);
    if (rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${pathSeparator()}`) && !isAbsolutePath(rel))) {
      throw new Error(`Consumer audit output must remain Clunk-owned: ${path}`);
    }
  }
}

function pathSeparator(): string {
  return "\\";
}

function isAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\") || value.startsWith("/");
}

main();
