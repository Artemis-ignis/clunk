import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  createAssetBundle,
  createPassport,
  inspectAsset,
  optimizeAsset,
  reinspectAsset,
  sha256Hex,
  type AssetPolicy,
  type InspectionReport,
  type Passport,
  type RepairOperation,
} from "../packages/core/src/index";
import { resolveProfilePolicy } from "../integrations/shared/custom-profile";

const CLUNK_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DEFAULT_HARVEST_ROOT = "C:\\Users\\50106\\Desktop\\Harvest Frontier";
const DEFAULT_PROFILE_FILE = resolve(
  CLUNK_ROOT,
  "examples",
  "profiles",
  "harvest-frontier.example.json",
);
const DEFAULT_REPORT_FILE = resolve(
  CLUNK_ROOT,
  "docs",
  "pilot",
  "harvest-frontier-clunk-pilot.ko.md",
);

const RUNTIME_ASSET_NAMES = [
  "cultivator.compact.m1.glb",
  "cultivator.compact.m1.lod1.glb",
  "processing.line.m1.glb",
  "processing.line.m1.lod1.glb",
  "seeder.compact.m1.glb",
  "seeder.compact.m1.lod1.glb",
  "tractor.compact.m1.glb",
  "tractor.compact.m1.lod1.glb",
] as const;

interface PilotOptions {
  workspaceRoot: string;
  runtimeRoot: string;
  profileFile: string;
  reportFile: string;
  optimize: boolean;
}

interface PilotAsset {
  name: string;
  sourcePath: string;
  sourceHash: string;
  sourceBytes: number;
  before: InspectionReport;
  blockingFindings: InspectionReport["findings"];
  optimization: {
    enabled: boolean;
    applied: boolean;
    outputFileName: string;
    outputHash: string;
    outputBytes: number;
    outputReopened: boolean;
    operations: RepairOperation[];
    after: InspectionReport | null;
    passport: Passport | null;
    error: string | null;
  };
}

interface PilotReport {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  sourceProject: string;
  sourceCommit: string | null;
  workspaceRoot: string;
  runtimeRoot: string;
  readOnly: true;
  optimizerWritesToHarvest: false;
  profileFile: string;
  ruleSetId: string;
  productionReady: false;
  optimizationMode: "temporary-copy-and-reopen" | "inspect-only";
  collaborationBoundary: string[];
  assets: PilotAsset[];
}

function parseArgs(rawArgs: string[]): PilotOptions | null {
  let workspaceRoot = DEFAULT_HARVEST_ROOT;
  let runtimeRoot: string | null = null;
  let profileFile = DEFAULT_PROFILE_FILE;
  let reportFile = DEFAULT_REPORT_FILE;
  let optimize = true;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Harvest Frontier x Clunk read-only pilot",
          "",
          "Options:",
          "  --workspace-root <path>  Harvest Frontier checkout root",
          "  --runtime-root <path>   Override public/assets/runtime (test use)",
          "  --profile-file <path>   Clunk custom profile JSON",
          "  --report <path>         Markdown report output",
          "  --no-optimize           Inspect only; skip temporary optimization",
        ].join("\n"),
      );
      return null;
    }
    if (arg === "--no-optimize") {
      optimize = false;
      continue;
    }
    if (
      arg === "--workspace-root" ||
      arg === "--runtime-root" ||
      arg === "--profile-file" ||
      arg === "--report"
    ) {
      const value = rawArgs[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(arg + " requires a path value.");
      }
      index += 1;
      if (arg === "--workspace-root") workspaceRoot = value;
      if (arg === "--runtime-root") runtimeRoot = value;
      if (arg === "--profile-file") profileFile = value;
      if (arg === "--report") reportFile = value;
      continue;
    }
    throw new Error("Unknown option: " + arg);
  }

  const absoluteWorkspaceRoot = resolve(workspaceRoot);
  return {
    workspaceRoot: absoluteWorkspaceRoot,
    runtimeRoot: resolve(
      runtimeRoot ?? join(absoluteWorkspaceRoot, "public", "assets", "runtime"),
    ),
    profileFile: resolve(profileFile),
    reportFile: resolve(reportFile),
    optimize,
  };
}

function readSourceCommit(root: string): string | null {
  try {
    const commit = execFileSync(
      "git",
      ["-C", root, "rev-parse", "HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return commit || null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatScore(asset: PilotAsset): string {
  const score = asset.before.score;
  return (
    String(score.score) +
    "/" +
    String(score.threshold) +
    " " +
    (score.ready ? "READY" : "BLOCKED")
  );
}

function buildMarkdown(report: PilotReport): string {
  const rows = report.assets
    .map((asset) => {
      const optimization = asset.optimization;
      const operations =
        optimization.operations.length > 0
          ? optimization.operations.map((operation) => operation.id).join(", ")
          : "없음";
      const reopened = optimization.enabled
        ? optimization.outputReopened
          ? "YES"
          : "NO"
        : "SKIPPED";
      return (
        "| " +
        asset.name +
        " | " +
        String(asset.sourceBytes) +
        " | " +
        String(asset.before.metrics.triangleCount) +
        " | " +
        formatScore(asset) +
        " | " +
        reopened +
        " | " +
        operations +
        " |"
      );
    })
    .join("\n");

  const assetSections = report.assets
    .map((asset) => {
      const findingLines =
        asset.before.findings.length > 0
          ? asset.before.findings
              .map(
                (finding) =>
                  "- " +
                  finding.severity +
                  " " +
                  finding.ruleId +
                  ": " +
                  finding.title,
              )
              .join("\n")
          : "- 없음";
      const optimization = asset.optimization;
      const passportHash = optimization.passport
        ? optimization.passport.outputHash
        : "없음";
      return [
        "### " + asset.name,
        "",
        "- 원본 경로: " + asset.sourcePath,
        "- 원본 SHA-256: " + asset.sourceHash,
        "- 원본 결과 digest: " + asset.before.resultDigest,
        "- Clunk 점수: " + formatScore(asset),
        "- 차단 finding: " + String(asset.blockingFindings.length),
        "- 최적화 출력: " +
          (optimization.enabled
            ? optimization.outputFileName || "생성 실패"
            : "실행하지 않음"),
        "- 출력 reopen: " +
          (optimization.enabled
            ? optimization.outputReopened
              ? "확인됨"
              : "확인되지 않음"
            : "해당 없음"),
        "- Passport output hash: " + passportHash,
        "",
        "Findings",
        "",
        findingLines,
        "",
        "Operations",
        "",
        optimization.operations.length > 0
          ? optimization.operations
              .map(
                (operation) =>
                  "- " +
                  operation.id +
                  " (" +
                  operation.safety +
                  ", " +
                  String(operation.count) +
                  ")",
              )
              .join("\n")
          : "- 없음",
        optimization.error ? "" : "",
        optimization.error ? "Optimization error: " + optimization.error : "",
      ]
        .filter((line) => line !== "")
        .join("\n");
    })
    .join("\n\n");

  const fence = String.fromCharCode(96, 96, 96);
  return [
    "# Harvest Frontier x Clunk 파일럿 리포트",
    "",
    "실제 Harvest Frontier 런타임 GLB를 Clunk에 읽기 전용 입력으로 연결한 재현 가능한 파일럿입니다.",
    "",
    "## 판정",
    "",
    "- 실행 ID: " + report.runId,
    "- 생성 시각: " + report.generatedAt,
    "- Harvest Frontier commit: " + (report.sourceCommit ?? "확인 불가"),
    "- rule set: " + report.ruleSetId,
    "- readOnly: " + String(report.readOnly),
    "- Harvest 원본에 optimizer가 쓰였는가: " + String(report.optimizerWritesToHarvest),
    "- productionReady: " + String(report.productionReady),
    "",
    "Clunk의 READY/점수는 GLB 구조·정책 검사 결과입니다. Harvest Frontier의 named pivot/socket/collider, Meshopt 보존, decoded bounds, near/far LOD 관계, 엔진 플레이 검증과 판매 승인까지 대신 판정하지 않습니다.",
    "",
    "## 요약",
    "",
    "| Asset | Bytes | Triangles | Clunk score | Output reopen | Operations |",
    "| --- | ---: | ---: | --- | --- | --- |",
    rows,
    "",
    "## 협업 경계",
    "",
    ...report.collaborationBoundary.map((item) => "- " + item),
    "",
    "## 자산별 증거",
    "",
    assetSections,
    "",
    "## Machine-readable payload",
    "",
    "아래 JSON은 이 Markdown과 함께 보관되는 실행 원장입니다.",
    "",
    fence + "json",
    "<!-- clunk-pilot-report-json -->",
    JSON.stringify(report, null, 2),
    "<!-- /clunk-pilot-report-json -->",
    fence,
    "",
  ].join("\n");
}

export async function runPilot(options: PilotOptions): Promise<PilotReport> {
  const policy: AssetPolicy = await resolveProfilePolicy({
    profileFile: options.profileFile,
  });
  const runId =
    "hf-clunk-" +
    new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "clunk-hf-pilot-"));
  const assets: PilotAsset[] = [];

  try {
    for (const assetName of RUNTIME_ASSET_NAMES) {
      const sourcePath = join(options.runtimeRoot, assetName);
      const sourceBytes = new Uint8Array(await readFile(sourcePath));
      const sourceHash = sha256Hex(sourceBytes);
      const bundle = createAssetBundle(assetName, sourceBytes);
      const before = inspectAsset(bundle, policy);
      if (before.inputHash !== sourceHash) {
        throw new Error("Input hash mismatch for " + assetName + ".");
      }
      if (before.ruleSetId !== "harvest-frontier-runtime-v1") {
        throw new Error(
          "Unexpected rule set for " +
            assetName +
            ": " +
            before.ruleSetId,
        );
      }

      const optimization = {
        enabled: options.optimize,
        applied: false,
        outputFileName: "",
        outputHash: "",
        outputBytes: 0,
        outputReopened: false,
        operations: [] as RepairOperation[],
        after: null as InspectionReport | null,
        passport: null as Passport | null,
        error: null as string | null,
      };

      if (options.optimize) {
        try {
          const optimized = optimizeAsset(bundle, policy);
          optimization.applied = optimized.applied;
          optimization.outputFileName = optimized.outputFileName;
          optimization.outputHash = optimized.outputHash;
          optimization.outputBytes = optimized.outputBytes.byteLength;
          optimization.operations = optimized.operations;

          const outputPath = join(
            temporaryRoot,
            basename(optimized.outputFileName),
          );
          await writeFile(outputPath, optimized.outputBytes);
          const reopenedBytes = new Uint8Array(await readFile(outputPath));
          const reopenedHash = sha256Hex(reopenedBytes);
          const reopenedAfter = reinspectAsset(
            createAssetBundle(optimized.outputFileName, reopenedBytes),
            policy,
          );
          optimization.after = reopenedAfter;
          optimization.outputReopened =
            reopenedHash === optimized.outputHash &&
            reopenedAfter.inputHash === optimized.outputHash;
          optimization.passport = createPassport(
            before,
            reopenedAfter,
            optimized.operations,
          );
        } catch (error) {
          optimization.error = errorMessage(error);
        }
      }

      assets.push({
        name: assetName,
        sourcePath,
        sourceHash,
        sourceBytes: sourceBytes.byteLength,
        before,
        blockingFindings: before.findings.filter(
          (finding) =>
            finding.severity === "ERROR" || finding.severity === "CRITICAL",
        ),
        optimization,
      });
    }

    const report: PilotReport = {
      schemaVersion: 1,
      runId,
      generatedAt: new Date().toISOString(),
      sourceProject: "Harvest Frontier",
      sourceCommit: readSourceCommit(options.workspaceRoot),
      workspaceRoot: options.workspaceRoot,
      runtimeRoot: options.runtimeRoot,
      readOnly: true,
      optimizerWritesToHarvest: false,
      profileFile: options.profileFile,
      ruleSetId: assets[0]?.before.ruleSetId ?? "harvest-frontier-runtime-v1",
      productionReady: false,
      optimizationMode: options.optimize
        ? "temporary-copy-and-reopen"
        : "inspect-only",
      collaborationBoundary: [
        "Harvest Frontier public/assets/runtime GLB files were opened as read-only inputs.",
        "All optimizer outputs were written below a temporary directory outside the Harvest Frontier checkout.",
        "The source asset hash is compared with Clunk before inspection, and each output is reopened and re-inspected.",
        "Passport records source/output hashes, inspection digests, operations, metrics, and scores.",
        "productionReady remains false because Clunk does not certify Harvest engine semantics or gameplay.",
      ],
      assets,
    };

    await mkdir(dirname(options.reportFile), { recursive: true });
    await writeFile(options.reportFile, buildMarkdown(report), "utf8");
    return report;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options) {
      const report = await runPilot(options);
      console.log(
        JSON.stringify(
          {
            runId: report.runId,
            reportFile: options.reportFile,
            assetCount: report.assets.length,
            productionReady: report.productionReady,
            reopenedCount: report.assets.filter(
              (asset) => asset.optimization.outputReopened,
            ).length,
          },
          null,
          2,
        ),
      );
    }
  } catch (error) {
    console.error("Harvest Frontier x Clunk pilot failed: " + errorMessage(error));
    process.exitCode = 1;
  }
}
