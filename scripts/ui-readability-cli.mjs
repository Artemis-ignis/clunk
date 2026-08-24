import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

const SCHEMA = "clunk.ui-readability.v1";
const TOOL_VERSION = "clunk-ui-readability/1.1.0";
const EXIT = { pass: 0, policy: 2, input: 3, unavailable: 4 };
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DEFAULT_THRESHOLDS = {
  minLuminanceRange: 0.18,
  minEdgeDensity: 0.015,
  minLocalContrastCoverage: 0.04,
  minPairwiseDeltaE76: 2,
  edgeThreshold: 0.08,
  localContrastThreshold: 0.08,
};

class InputError extends Error {
  code = EXIT.input;
}

class UnavailableError extends Error {
  code = EXIT.unavailable;

  constructor(message, capability = "unavailable") {
    super(message);
    this.capability = capability;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const args = { config: null, input: null, format: "human", out: null, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--config") args.config = argv[++index] ?? null;
    else if (token === "--input") args.input = argv[++index] ?? null;
    else if (token === "--format") args.format = argv[++index] ?? null;
    else if (token === "--out") args.out = argv[++index] ?? null;
    else if (token === "--strict") args.strict = true;
    else if (!token.startsWith("--") && !args.config && !args.input) args.config = token;
    else throw new InputError(`Unknown UI readability option: ${token}`);
  }
  if (!args.config) throw new InputError("A UI readability config is required.");
  if (!["human", "json"].includes(args.format)) throw new InputError("--format must be human or json.");
  if (args.out === "") throw new InputError("--out requires a file path.");
  return args;
}

function loadConfig(configArgument) {
  const configPath = resolve(configArgument);
  if (!existsSync(configPath) || !statSync(configPath).isFile()) {
    throw new InputError(`UI readability config not found: ${configArgument}`);
  }
  const configBytes = readFileSync(configPath);
  let config;
  try {
    config = JSON.parse(configBytes.toString("utf8"));
  } catch {
    throw new InputError("UI readability config is not valid JSON.");
  }
  if (!config || typeof config !== "object" || !Array.isArray(config.groups) || config.groups.length === 0) {
    throw new InputError("UI readability config must contain a non-empty groups array.");
  }

  const inputHash = createHash("sha256");
  const seen = new Set();
  const groups = config.groups.map((group, groupIndex) => {
    if (!group || typeof group !== "object") throw new InputError(`UI readability group ${groupIndex + 1} is invalid.`);
    if (!Array.isArray(group.files) || group.files.length === 0) {
      throw new InputError(`UI readability group ${groupIndex + 1} must contain a non-empty files array.`);
    }
    const name = typeof group.name === "string" && group.name.trim() ? group.name.trim() : `group-${groupIndex + 1}`;
    const renderPx = group.renderPx ?? config.renderPx;
    if (!Number.isInteger(renderPx) || renderPx < 8 || renderPx > 1024) {
      throw new InputError(`${name}: renderPx must be an integer between 8 and 1024.`);
    }
    const sourcePx = group.sourcePx ?? config.sourcePx ?? 128;
    if (!Number.isInteger(sourcePx) || sourcePx < 1 || sourcePx > 8192) {
      throw new InputError(`${name}: sourcePx must be a positive integer.`);
    }
    const baseDir = group.baseDir ? resolve(dirname(configPath), group.baseDir) : dirname(configPath);
    const thresholds = { ...DEFAULT_THRESHOLDS, ...(config.thresholds ?? {}), ...(group.thresholds ?? {}) };
    const files = group.files.map((file) => {
      if (typeof file !== "string" || !file.trim()) throw new InputError(`${name}: every file must be a non-empty path.`);
      const relativePath = file.replaceAll("\\", "/");
      if (isAbsolute(relativePath)) throw new InputError(`${name}: file paths must be relative: ${relativePath}`);
      const extension = extname(relativePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        throw new UnavailableError(`Portrait format is not supported by the current auditor: ${relativePath}`, "unsupported-input");
      }
      const filePath = resolve(baseDir, relativePath);
      const relativeToBase = relative(resolve(baseDir), filePath);
      if (relativeToBase.startsWith("..") || isAbsolute(relativeToBase) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        throw new InputError(`${name}: portrait input not found: ${relativePath}`);
      }
      const identity = `${name}\0${relativePath}`;
      if (seen.has(identity)) throw new InputError(`Duplicate portrait input: ${identity}`);
      seen.add(identity);
      inputHash.update(identity);
      inputHash.update("\0");
      inputHash.update(readFileSync(filePath));
      return { path: relativePath, filePath };
    });
    return { name, note: group.note ?? null, renderPx, sourcePx, thresholds, files };
  });

  return {
    config,
    configPath,
    configHash: sha256(configBytes),
    inputHash: inputHash.digest("hex"),
    renderContext: normalizeRenderContext(config.renderContext, dirname(configPath)),
    groups,
  };
}

function normalizeRenderContext(value, configDirectory) {
  const context = value && typeof value === "object" ? value : {};
  const css = normalizeCssContext(context.css, configDirectory);
  const viewport = normalizeViewportContext(context.viewport);
  const font = normalizeFontContext(context.font);
  const render = normalizeRenderDetails(context.render);
  const cssPx = context.cssPx === undefined ? null : positiveInteger(context.cssPx, "renderContext.cssPx");
  const complete = Boolean(css && viewport && font && render);
  return {
    css,
    cssPx,
    viewport,
    font,
    render,
    metadataCompleteness: complete ? "COMPLETE" : "PARTIAL",
  };
}

function normalizeCssContext(value, configDirectory) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object") throw new InputError("renderContext.css must be an object.");
  const path = typeof value.path === "string" && value.path.trim() ? value.path.replaceAll("\\", "/") : null;
  const suppliedHash = value.sha256 === undefined ? null : String(value.sha256).toLowerCase();
  if (suppliedHash !== null && !/^[a-f0-9]{64}$/.test(suppliedHash)) {
    throw new InputError("renderContext.css.sha256 must be a 64-character hexadecimal hash.");
  }
  if (!path && !suppliedHash) throw new InputError("renderContext.css needs path or sha256.");
  if (!path) return { sha256: suppliedHash };
  if (isAbsolute(path)) throw new InputError("renderContext.css.path must be relative to the config.");
  const cssPath = resolve(configDirectory, path);
  const relativePath = relative(resolve(configDirectory), cssPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath) || !existsSync(cssPath) || !statSync(cssPath).isFile()) {
    throw new InputError(`renderContext.css.path not found: ${path}`);
  }
  const bytes = readFileSync(cssPath);
  return { path, sha256: sha256(bytes) };
}

function normalizeViewportContext(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object") throw new InputError("renderContext.viewport must be an object.");
  const viewport = {
    width: positiveInteger(value.width, "renderContext.viewport.width"),
    height: positiveInteger(value.height, "renderContext.viewport.height"),
  };
  if (value.dpr !== undefined) viewport.dpr = positiveNumber(value.dpr, "renderContext.viewport.dpr");
  return viewport;
}

function normalizeFontContext(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object") throw new InputError("renderContext.font must be an object.");
  if (typeof value.family !== "string" || !value.family.trim()) throw new InputError("renderContext.font.family is required.");
  const font = { family: value.family.trim() };
  if (value.sizePx !== undefined) font.sizePx = positiveNumber(value.sizePx, "renderContext.font.sizePx");
  if (value.weight !== undefined) font.weight = positiveInteger(value.weight, "renderContext.font.weight");
  if (value.lineHeight !== undefined) font.lineHeight = positiveNumber(value.lineHeight, "renderContext.font.lineHeight");
  return font;
}

function normalizeRenderDetails(value) {
  if (value === undefined || value === null) return { engine: "raster", renderer: "sharp-raster", kernel: "lanczos3" };
  if (!value || typeof value !== "object") throw new InputError("renderContext.render must be an object.");
  const render = {};
  for (const key of ["engine", "renderer", "kernel", "colorSpace"]) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string" || !value[key].trim()) throw new InputError(`renderContext.render.${key} must be a non-empty string.`);
      render[key] = value[key].trim();
    }
  }
  if (!render.engine || !render.renderer) throw new InputError("renderContext.render needs engine and renderer.");
  return render;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new InputError(`${label} must be a positive integer.`);
  return value;
}

function positiveNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new InputError(`${label} must be a positive number.`);
  return value;
}

async function loadSharp() {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default ?? sharpModule;
  } catch (error) {
    throw new UnavailableError(`Raster decoder is unavailable: ${error instanceof Error ? error.message : String(error)}`, "decoder-unavailable");
  }
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function luminance(red, green, blue, alpha) {
  const opacity = alpha / 255;
  return ((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255) * opacity;
}

function rgbToLab(red, green, blue) {
  const linear = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(red);
  const g = linear(green);
  const b = linear(blue);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (value) => value > 0.008856 ? value ** (1 / 3) : (7.787 * value) + (16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower));
}

function calculateMetrics(data, width, height, thresholds) {
  const luma = new Float64Array(width * height);
  const labs = new Float64Array(width * height * 3);
  let opaquePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const sourceIndex = pixelIndex * 4;
      const red = data[sourceIndex];
      const green = data[sourceIndex + 1];
      const blue = data[sourceIndex + 2];
      const alpha = data[sourceIndex + 3];
      luma[pixelIndex] = luminance(red, green, blue, alpha);
      if (alpha >= 128) opaquePixels += 1;
      const lab = rgbToLab(red, green, blue);
      labs[pixelIndex * 3] = lab[0];
      labs[pixelIndex * 3 + 1] = lab[1];
      labs[pixelIndex * 3 + 2] = lab[2];
    }
  }

  let edgeCount = 0;
  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) {
        const difference = Math.abs(luma[index] - luma[index + 1]);
        edgeSum += difference;
        if (difference >= thresholds.edgeThreshold) edgeCount += 1;
        edgeSamples += 1;
      }
      if (y + 1 < height) {
        const difference = Math.abs(luma[index] - luma[index + width]);
        edgeSum += difference;
        if (difference >= thresholds.edgeThreshold) edgeCount += 1;
        edgeSamples += 1;
      }
    }
  }

  let localContrastCount = 0;
  let localContrastSamples = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = y * width + x;
      let minimum = 1;
      let maximum = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const value = luma[center + (offsetY * width) + offsetX];
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }
      }
      if (maximum - minimum >= thresholds.localContrastThreshold) localContrastCount += 1;
      localContrastSamples += 1;
    }
  }

  const p05 = percentile(luma, 0.05);
  const p95 = percentile(luma, 0.95);
  return {
    luminanceP05: round(p05),
    luminanceP95: round(p95),
    luminanceRange: round(p95 - p05),
    edgeDensity: round(edgeSamples ? edgeCount / edgeSamples : 0),
    meanGradient: round(edgeSamples ? edgeSum / edgeSamples : 0),
    localContrastCoverage: round(localContrastSamples ? localContrastCount / localContrastSamples : 0),
    opaquePixelRatio: round(opaquePixels / (width * height)),
    resizedPixelHash: sha256(data),
    _labs: labs,
  };
}

function compareLab(left, right) {
  const distances = [];
  for (let index = 0; index < left.length; index += 3) {
    const deltaL = left[index] - right[index];
    const deltaA = left[index + 1] - right[index + 1];
    const deltaB = left[index + 2] - right[index + 2];
    distances.push(Math.sqrt((deltaL ** 2) + (deltaA ** 2) + (deltaB ** 2)));
  }
  return {
    meanDeltaE76: round(distances.reduce((sum, value) => sum + value, 0) / distances.length),
    p95DeltaE76: round(percentile(distances, 0.95)),
  };
}

async function measureImage(sharp, file, renderPx, thresholds) {
  let metadata;
  let resized;
  try {
    metadata = await sharp(file.filePath).metadata();
    resized = await sharp(file.filePath)
      .resize({ width: renderPx, height: renderPx, fit: "fill", kernel: "lanczos3" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    throw new InputError(`Unable to decode portrait ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const metrics = calculateMetrics(resized.data, resized.info.width, resized.info.height, thresholds);
  return {
    path: file.path,
    source: {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      format: metadata.format ?? null,
      channels: metadata.channels ?? null,
    },
    rendered: {
      width: resized.info.width,
      height: resized.info.height,
      channels: resized.info.channels,
      kernel: "lanczos3",
    },
    metrics,
  };
}

function imageViolations(image, group) {
  const violations = [];
  const thresholds = group.thresholds;
  if (image.source.width !== group.sourcePx || image.source.height !== group.sourcePx) {
    violations.push(`${image.path}: source ${image.source.width}x${image.source.height}, expected ${group.sourcePx}x${group.sourcePx}`);
  }
  if (image.metrics.luminanceRange < thresholds.minLuminanceRange) {
    violations.push(`${image.path}: luminance range ${image.metrics.luminanceRange} < ${thresholds.minLuminanceRange}`);
  }
  if (image.metrics.edgeDensity < thresholds.minEdgeDensity) {
    violations.push(`${image.path}: edge density ${image.metrics.edgeDensity} < ${thresholds.minEdgeDensity}`);
  }
  if (image.metrics.localContrastCoverage < thresholds.minLocalContrastCoverage) {
    violations.push(`${image.path}: local contrast coverage ${image.metrics.localContrastCoverage} < ${thresholds.minLocalContrastCoverage}`);
  }
  return violations;
}

async function measureGroup(sharp, group) {
  const measured = [];
  for (const file of group.files) {
    const image = await measureImage(sharp, file, group.renderPx, group.thresholds);
    image.violations = imageViolations(image, group);
    image.status = image.violations.length ? "FAIL" : "PASS";
    measured.push(image);
  }

  const pairwise = [];
  const pairwiseViolations = [];
  for (let leftIndex = 0; leftIndex < measured.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < measured.length; rightIndex += 1) {
      const comparison = compareLab(measured[leftIndex].metrics._labs, measured[rightIndex].metrics._labs);
      const pair = {
        left: measured[leftIndex].path,
        right: measured[rightIndex].path,
        ...comparison,
      };
      pairwise.push(pair);
      if (comparison.meanDeltaE76 < group.thresholds.minPairwiseDeltaE76) {
        pairwiseViolations.push(`${pair.left} ↔ ${pair.right}: mean ΔE76 ${comparison.meanDeltaE76} < ${group.thresholds.minPairwiseDeltaE76}`);
      }
    }
  }

  const violations = [...measured.flatMap((image) => image.violations), ...pairwiseViolations];
  for (const image of measured) delete image.metrics._labs;
  return {
    name: group.name,
    note: group.note,
    sourcePx: group.sourcePx,
    renderPx: group.renderPx,
    resize: { fit: "fill", kernel: "lanczos3" },
    thresholds: group.thresholds,
    status: violations.length ? "FAIL" : "PASS",
    images: measured,
    pairwise,
    violations,
  };
}

function buildEnvelope(input, args, groups) {
  const violations = groups.flatMap((group) => group.violations.map((violation) => `${group.name}: ${violation}`));
  const findings = groups.flatMap((group) => group.images.map((image) => ({
    scope: "portrait-ui-raster",
    path: image.path,
    status: image.status,
    renderPx: group.renderPx,
    metrics: image.metrics,
    violations: image.violations,
  })));
  return {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status: violations.length ? "FAIL" : "PASS",
    capability: "shipped",
    requestedConfig: input.configPath,
    requestedInput: args.input,
    strict: args.strict,
    inputHash: input.inputHash,
    configHash: input.configHash,
    metadataCompleteness: input.renderContext.metadataCompleteness,
    renderContext: input.renderContext,
    criteria: {
      deltaE76: groups.map((group) => ({
        group: group.name,
        metric: "meanDeltaE76",
        threshold: group.thresholds.minPairwiseDeltaE76,
        renderPx: group.renderPx,
      })),
    },
    auditScope: "portrait-ui-raster",
    groups,
    violations,
    findings,
    assetAudit: {
      status: "NOT_EVALUATED",
      reason: "This command measures portrait raster readability; it is not a GLB or texture asset audit.",
    },
    playerFacing: {
      status: "NOT_EVALUATED",
      reason: "A 46px raster preview is measured, but no engine import, shipped scene, or player-facing browser frame is executed.",
    },
    engineReadiness: "not-evaluated",
    generatedBy: TOOL_VERSION,
  };
}

function writeOutput(path, value) {
  if (path) writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeError(args, error) {
  const code = Number(error?.code ?? EXIT.input);
  const format = args?.format ?? (process.argv.includes("--format") && process.argv.includes("json") ? "json" : "human");
  const envelope = {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status: code === EXIT.unavailable ? "UNAVAILABLE" : "ERROR",
    capability: error?.capability ?? (code === EXIT.unavailable ? "unavailable" : "shipped"),
    errorCode: code,
    requestedConfig: args?.config ?? null,
    requestedInput: args?.input ?? null,
    strict: args?.strict ?? false,
    metadataCompleteness: "UNKNOWN",
    renderContext: null,
    criteria: { deltaE76: [] },
    violations: [],
    findings: [],
    assetAudit: { status: "NOT_EVALUATED" },
    playerFacing: { status: "NOT_EVALUATED" },
    engineReadiness: "not-evaluated",
    error: error instanceof Error ? error.message : String(error),
    generatedBy: TOOL_VERSION,
  };
  try {
    writeOutput(args?.out, envelope);
  } catch {
    // The original error is more useful than a secondary output-path error.
  }
  if (format === "json") process.stdout.write(`${JSON.stringify(envelope)}\n`);
  else process.stderr.write(`${envelope.error}\n`);
  return code;
}

async function run() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    const input = loadConfig(args.config);
    const sharp = await loadSharp();
    const groups = [];
    for (const group of input.groups) groups.push(await measureGroup(sharp, group));
    const envelope = buildEnvelope(input, args, groups);
    writeOutput(args.out, envelope);
    if (args.format === "json") process.stdout.write(`${JSON.stringify(envelope)}\n`);
    else {
      process.stdout.write(`UI readability: ${envelope.status} · ${envelope.auditScope}\n`);
      for (const group of envelope.groups) process.stdout.write(`${group.name}: ${group.status} · ${group.renderPx}px · ${group.images.length} portrait(s)\n`);
      if (envelope.violations.length) process.stdout.write(`${envelope.violations.join("\n")}\n`);
    }
    return envelope.status === "FAIL" && args.strict ? EXIT.policy : EXIT.pass;
  } catch (error) {
    return writeError(args, error);
  }
}

process.exitCode = await run();
