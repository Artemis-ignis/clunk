import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_VERSION = "clunk-texture-audit/1.0.0";
const SCHEMA = "clunk.texture-audit.v1";
const EXIT = { pass: 0, policy: 2, input: 3, unavailable: 4 };
const AUDITOR = resolve(dirname(fileURLToPath(import.meta.url)), "texture-audit.mjs");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const args = {
    config: null,
    format: "human",
    out: null,
    strict: false,
    passthrough: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--config") args.config = argv[++index] ?? null;
    else if (token === "--format") args.format = argv[++index] ?? null;
    else if (token === "--out") args.out = argv[++index] ?? null;
    else if (token === "--strict") args.strict = true;
    else if (token === "--sigma-floor" || token === "--calibrate") {
      args.passthrough.push(token);
      if (token === "--sigma-floor") args.passthrough.push(argv[++index] ?? "");
    } else if (!token.startsWith("--") && !args.config) args.config = token;
    else throw new Error(`Unknown texture audit option: ${token}`);
  }
  if (!args.config) throw new InputError("A texture audit config is required.");
  if (!["human", "json"].includes(args.format)) throw new InputError("--format must be human or json.");
  if (args.out === "") throw new InputError("--out requires a file path.");
  return args;
}

class InputError extends Error {
  code = EXIT.input;
}

class UnavailableError extends Error {
  code = EXIT.unavailable;
}

function loadConfig(configArgument) {
  const configPath = resolve(configArgument);
  if (!existsSync(configPath)) throw new InputError(`Config file not found: ${configArgument}`);
  const configBytes = readFileSync(configPath);
  let config;
  try {
    config = JSON.parse(configBytes.toString("utf8"));
  } catch {
    throw new InputError("Texture audit config is not valid JSON.");
  }
  if (!config || typeof config !== "object" || !Array.isArray(config.textures) || config.textures.length === 0) {
    throw new InputError("Texture audit config must contain a non-empty textures array.");
  }
  const baseDir = config.baseDir ? resolve(dirname(configPath), config.baseDir) : dirname(configPath);
  const inputHash = createHash("sha256");
  const seen = new Set();
  for (const texture of config.textures) {
    if (!texture || typeof texture.path !== "string" || !texture.path.trim()) {
      throw new InputError("Every texture entry must contain a path.");
    }
    const relativePath = texture.path.replaceAll("\\", "/");
    const extension = extname(relativePath).toLowerCase();
    if (extension !== ".png") {
      throw new UnavailableError(`Texture format is not supported by the current auditor: ${relativePath}`);
    }
    const filePath = resolve(baseDir, relativePath);
    if (!isAbsolute(filePath) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new InputError(`Texture input not found: ${relativePath}`);
    }
    if (seen.has(relativePath)) throw new InputError(`Texture path is duplicated: ${relativePath}`);
    seen.add(relativePath);
    inputHash.update(relativePath);
    inputHash.update("\0");
    inputHash.update(readFileSync(filePath));
  }
  return {
    config,
    configPath,
    configHash: sha256(configBytes),
    inputHash: inputHash.digest("hex"),
  };
}

function collectViolations(report) {
  const config = report.assumptions ?? {};
  const thresholds = config.thresholds ?? {};
  const strictChecks = new Set(report.strictChecks ?? []);
  const violations = [];
  for (const texture of report.textures ?? []) {
    if (strictChecks.has("seam") && texture.seam?.exposure === "EXPOSED") {
      violations.push(`${texture.path}: VISIBLE-SEAM 노출`);
    }
    if (strictChecks.has("readability")) {
      const gameplayBand = texture.usages?.[0]?.bands?.[report.gameplayBandIndex ?? 1];
      if (gameplayBand?.grade === "D") violations.push(`${texture.path}: 게임플레이 밴드 D`);
    }
  }
  if (
    strictChecks.has("memory") &&
    typeof report.textureSet?.budgetBytes === "number" &&
    report.textureSet.totalGpuBytesWithMips > report.textureSet.budgetBytes
  ) {
    violations.push(`GPU 메모리 예산 초과: ${report.textureSet.totalGpuMB}MB`);
  }
  void thresholds;
  return violations;
}

function buildEnvelope(report, input) {
  const violations = collectViolations({
    ...report,
    strictChecks: input.config.strictChecks ?? ["seam", "memory", "readability"],
    gameplayBandIndex: input.config.gameplayBandIndex ?? 1,
  });
  const status = violations.length ? (input.strict ? "FAIL" : "WARN") : "PASS";
  return {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status,
    inputHash: input.inputHash,
    configHash: input.configHash,
    violations,
    ...report,
    generatedBy: TOOL_VERSION,
  };
}

function writeOutput(path, value) {
  if (!path) return;
  const outputPath = resolve(path);
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeError(args, error) {
  const code = Number(error?.code ?? EXIT.input);
  const envelope = {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status: code === EXIT.unavailable ? "UNAVAILABLE" : "ERROR",
    errorCode: code,
    error: error instanceof Error ? error.message : String(error),
    violations: [],
  };
  try {
    writeOutput(args?.out, envelope);
  } catch {
    // The original error is more useful than a secondary output-path error.
  }
  if (args?.format === "json") process.stdout.write(`${JSON.stringify(envelope)}\n`);
  else process.stderr.write(`${envelope.error}\n`);
  return code;
}

function run() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    const input = loadConfig(args.config);
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "clunk-texture-audit-"));
    const rawReportPath = join(temporaryDirectory, "measurement.json");
    try {
      const childArgs = [AUDITOR, input.configPath, "--out", rawReportPath, ...args.passthrough];
      if (args.strict) childArgs.push("--strict");
      const child = spawnSync(process.execPath, childArgs, {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      if (child.error) throw new UnavailableError(child.error.message);
      if (![0, EXIT.policy].includes(child.status ?? -1) || !existsSync(rawReportPath)) {
        throw new UnavailableError((child.stderr || child.stdout || "Texture auditor did not produce a report.").trim());
      }
      const rawReport = JSON.parse(readFileSync(rawReportPath, "utf8"));
      const envelope = buildEnvelope(rawReport, { ...input, config: input.config, strict: args.strict });
      writeOutput(args.out, envelope);
      if (args.format === "json") process.stdout.write(`${JSON.stringify(envelope)}\n`);
      else process.stdout.write(child.stdout);
      return envelope.violations.length && args.strict ? EXIT.policy : EXIT.pass;
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    return writeError(args, error);
  }
}

process.exitCode = run();
