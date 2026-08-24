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
const GRADE_RANK = { A: 0, B: 1, C: 2, D: 3 };

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
  validateEvaluationProfile(config);
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
    validateTextureWorldContext(texture, relativePath);
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

function validateTextureWorldContext(texture, relativePath) {
  for (const key of ["sceneRole", "surfaceRole"]) {
    if (texture[key] !== undefined && (typeof texture[key] !== "string" || !texture[key].trim())) {
      throw new InputError(`${relativePath}.${key} must be non-empty text.`);
    }
  }
  if (texture.worldScale !== undefined) validateWorldScale(texture.worldScale, `${relativePath}.worldScale`);
}

function validateWorldScale(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError(`${label} must be an object.`);
  if (value.unit !== undefined && (typeof value.unit !== "string" || !value.unit.trim())) throw new InputError(`${label}.unit must be non-empty text.`);
  for (const key of ["metersPerWorldUnit", "coverageWidthM", "coverageHeightM"]) {
    if (value[key] !== undefined && (!Number.isFinite(value[key]) || value[key] <= 0)) throw new InputError(`${label}.${key} must be positive.`);
  }
}

function validateEvaluationProfile(config) {
  const profile = config.evaluationProfile;
  if (profile === undefined) return;
  if (!profile || typeof profile !== "object") throw new InputError("evaluationProfile must be an object.");
  if (profile.viewport !== undefined && (!profile.viewport || typeof profile.viewport !== "object")) {
    throw new InputError("evaluationProfile.viewport must be an object.");
  }
  if (profile.distanceBands !== undefined) {
    if (!Array.isArray(profile.distanceBands) || profile.distanceBands.length === 0) {
      throw new InputError("evaluationProfile.distanceBands must be a non-empty array.");
    }
    const ids = new Set();
    for (const [index, band] of profile.distanceBands.entries()) {
      if (!band || typeof band !== "object" || typeof band.distanceM !== "number" || band.distanceM <= 0) {
        throw new InputError(`evaluationProfile.distanceBands[${index}].distanceM must be positive.`);
      }
      if (band.id !== undefined) {
        if (typeof band.id !== "string" || !band.id.trim() || ids.has(band.id)) {
          throw new InputError(`evaluationProfile.distanceBands[${index}].id must be unique text.`);
        }
        ids.add(band.id);
      }
      if (band.requiredGrade !== undefined && !["A", "B", "C", "D"].includes(band.requiredGrade)) {
        throw new InputError(`evaluationProfile.distanceBands[${index}].requiredGrade must be A, B, C, or D.`);
      }
    }
  }
  const resolution = profile.resolutionPolicy;
  if (resolution !== undefined && (!resolution || typeof resolution !== "object" || !["reported", "minimum"].includes(resolution.mode ?? "reported"))) {
    throw new InputError("evaluationProfile.resolutionPolicy.mode must be reported or minimum.");
  }
  if (resolution?.mode === "minimum" && (!["minWidthPx", "minHeightPx"].every((key) => Number.isFinite(resolution[key]) && resolution[key] > 0))) {
    throw new InputError("evaluationProfile.resolutionPolicy minimum requires positive minWidthPx and minHeightPx.");
  }
  if (profile.banding?.maxGradeDrop !== undefined && (!Number.isFinite(profile.banding.maxGradeDrop) || profile.banding.maxGradeDrop < 0)) {
    throw new InputError("evaluationProfile.banding.maxGradeDrop must be non-negative.");
  }
  if (profile.worldScale !== undefined) validateWorldScale(profile.worldScale, "evaluationProfile.worldScale");
}

function collectViolations(report) {
  const strictChecks = new Set(report.strictChecks ?? []);
  const violations = [];
  for (const texture of report.textures ?? []) {
    if (strictChecks.has("seam") && texture.seam?.exposure === "EXPOSED") {
      violations.push(`${texture.path}: VISIBLE-SEAM 노출`);
    }
    if (strictChecks.has("readability")) {
      for (const usage of texture.usages ?? []) {
        const gameplayBand = usage.bands?.[report.evaluationProfile?.gameplayBandIndex ?? report.gameplayBandIndex ?? 1];
        const requiredGrade = gameplayBand?.requiredGrade ?? "B";
        if (gameplayBand && GRADE_RANK[gameplayBand.grade] > GRADE_RANK[requiredGrade]) {
          violations.push(`${texture.path} @ ${usage.mPerTile} m/타일: 게임플레이 밴드 ${gameplayBand.grade} (required ${requiredGrade})`);
        }
      }
    }
    if (strictChecks.has("banding")) {
      for (const usage of texture.usages ?? []) {
        if (usage.banding?.status === "FAIL") {
          violations.push(`${texture.path} @ ${usage.label ?? usage.mPerTile}: banding grade drop ${usage.banding.maxGradeDrop}`);
        }
      }
    }
    if (strictChecks.has("resolution") && texture.resolutionCheck?.status === "FAIL") {
      violations.push(`${texture.path}: source resolution below evaluation profile minimum`);
    }
  }
  if (
    strictChecks.has("memory") &&
    typeof report.textureSet?.budgetBytes === "number" &&
    report.textureSet.totalGpuBytesWithMips > report.textureSet.budgetBytes
  ) {
    violations.push(`GPU 메모리 예산 초과: ${report.textureSet.totalGpuMB}MB`);
  }
  return violations;
}

function buildEnvelope(report, input) {
  const violations = collectViolations({
    ...report,
    strictChecks: input.config.strictChecks ?? ["seam", "memory", "readability"],
  });
  const status = violations.length ? (input.strict ? "FAIL" : "WARN") : "PASS";
  return {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status,
    inputHash: input.inputHash,
    configHash: input.configHash,
    strictChecks: input.config.strictChecks ?? ["seam", "memory", "readability"],
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
