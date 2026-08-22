#!/usr/bin/env node
/**
 * Clunk texture-set audit prototype — mip readability prediction (P0, HF spec).
 *
 * Answers, per texture and usage density: "at this camera distance, does the texture still
 * read, and if not, what exactly do I change?" The acceptance contract comes from the
 * Harvest Frontier session (2026-08-21): grade must be justified by local-contrast
 * preservation vs mip0, analysed in linear after sRGB decode, and the output must include a
 * prescription (raise m/tile to N, or add structure at wavelength >= Y m) — a diagnosis
 * without a prescription was declared "진단서일 뿐".
 *
 *   npx tsx scripts/texture-audit.mjs <config.json> [--out report.json]
 *
 * Config shape: see examples/texture-audit/harvest-frontier.textures.json.
 * Zero dependencies: PNG decoding is done here on top of node:zlib (8-bit,
 * non-interlaced, colour types 0/2/3/4/6 — what sharp and ImageGen pipelines emit).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodePngSrgb, linearLuminance } from "./lib/png.mjs";

// --------------------------------------------------------------------------- PNG decoding

/**
 * PNG를 읽어 선형 휘도 한 장으로 만든다.
 *
 * 디코더 자체는 scripts/lib/png.mjs로 옮겼다. ui-readability-audit이 휘도가 아니라 색을
 * 필요로 했고, 디코더를 두 벌 두면 한쪽만 고쳐지는 날이 오기 때문이다. 여기서 하는 일은
 * 그 결과를 이 도구가 쓰는 형태(선형 휘도)로 바꾸는 것뿐이다.
 */
function decodePng(buffer) {
  const image = decodePngSrgb(buffer);
  return { width: image.width, height: image.height, luminance: linearLuminance(image) };
}
/**
 * 이 usage를 채점할 밴드.
 *
 * viewingDistanceM: [min, max]가 있으면 그 범위 안에서 가장 먼 밴드를 고른다. 없으면
 * 설정의 gameplayBandIndex를 그대로 쓴다(기존 동작).
 */
/**
 * usage가 선언한 관측 거리를 밴드 목록에 합친다.
 *
 * 합치지 않으면 1~3m에서만 보이는 텍스처가 가장 가까운 밴드인 5m에서 채점된다. 실제보다
 * 가혹한 조건이라 없는 문제를 만들어 낸다. 선언한 거리가 있으면 그 거리에 밴드를 둔다.
 */
function effectiveBands(config) {
  const declared = [];
  for (const texture of config.textures ?? []) {
    for (const usage of texture.usages ?? []) {
      const range = usage.viewingDistanceM;
      if (Array.isArray(range) && range.length === 2) declared.push(range[1]);
    }
  }
  return [...new Set([...config.distanceBandsM, ...declared])].sort((a, b) => a - b);
}

function pickJudgementBand(bands, usage, config) {
  const range = usage?.viewingDistanceM;
  if (Array.isArray(range) && range.length === 2) {
    const [near, far] = range;
    const inside = bands.filter((band) => band.distanceM >= near && band.distanceM <= far);
    if (inside.length) return inside[inside.length - 1];
    // 선언한 범위에 걸치는 밴드가 없으면 가장 가까운 밴드를 고른다.
    return bands.reduce((best, band) =>
      Math.abs(band.distanceM - far) < Math.abs(best.distanceM - far) ? band : best,
    );
  }
  return bands[config.gameplayBandIndex ?? 1];
}

// ------------------------------------------------------------------ mip / contrast analysis

function buildMips(image) {
  const mips = [image];
  let current = image;
  while (current.width > 1 && current.height > 1) {
    const width = Math.max(1, current.width >> 1);
    const height = Math.max(1, current.height >> 1);
    const luminance = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = x * 2;
        const sy = y * 2;
        const x1 = Math.min(sx + 1, current.width - 1);
        const y1 = Math.min(sy + 1, current.height - 1);
        luminance[y * width + x] =
          (current.luminance[sy * current.width + sx] +
            current.luminance[sy * current.width + x1] +
            current.luminance[y1 * current.width + sx] +
            current.luminance[y1 * current.width + x1]) /
          4;
      }
    }
    current = { width, height, luminance };
    mips.push(current);
  }
  return mips;
}

function upsampleBilinear(mip, width, height) {
  if (mip.width === width && mip.height === height) return mip.luminance;
  const out = new Float32Array(width * height);
  const scaleX = mip.width / width;
  const scaleY = mip.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(mip.height - 1, (y + 0.5) * scaleY - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(mip.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(mip.width - 1, (x + 0.5) * scaleX - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(mip.width - 1, x0 + 1);
      const wx = fx - x0;
      const top = mip.luminance[y0 * mip.width + x0] * (1 - wx) + mip.luminance[y0 * mip.width + x1] * wx;
      const bottom = mip.luminance[y1 * mip.width + x0] * (1 - wx) + mip.luminance[y1 * mip.width + x1] * wx;
      out[y * width + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

/** Mean of per-tile standard deviation over non-overlapping windows — the "does it still
 *  have local structure" number the grades are built on. */
function meanLocalStd(luminance, width, height, window) {
  let total = 0;
  let count = 0;
  for (let ty = 0; ty + window <= height; ty += window) {
    for (let tx = 0; tx + window <= width; tx += window) {
      let sum = 0;
      let sumSq = 0;
      for (let y = ty; y < ty + window; y++) {
        for (let x = tx; x < tx + window; x++) {
          const v = luminance[y * width + x];
          sum += v;
          sumSq += v * v;
        }
      }
      const n = window * window;
      const mean = sum / n;
      total += Math.sqrt(Math.max(0, sumSq / n - mean * mean));
      count++;
    }
  }
  return count ? total / count : 0;
}

// ----------------------------------------------------------------------------- audit core

/**
 * Grade = f(preservation ratio, absolute local sigma at the effective mip).
 * The sigma floor is the HF-calibrated third knob: a texture whose residual detail is
 * low-amplitude ripple (grass blades after mip 2+) can keep a decent ratio while reading as
 * a flat wash in game; below the floor it is D no matter what the ratio says (JND-style
 * absolute perceptual threshold, linear domain).
 */
function gradeFor(preservation, absoluteSigma, thresholds) {
  if (
    typeof thresholds.sigmaFloorLinear === "number" &&
    absoluteSigma < thresholds.sigmaFloorLinear
  ) {
    return "D";
  }
  if (preservation >= thresholds.A) return "A";
  if (preservation >= thresholds.B) return "B";
  if (preservation >= thresholds.C) return "C";
  return "D";
}

/**
 * Tile seam check: how much bigger is the wrap-around jump (last column -> first column,
 * last row -> first row) than an ordinary neighbour step inside the image? ~1.0 means the
 * tile wraps as smoothly as its interior; the ratio thresholds grade seam visibility.
 * Luminance-only, like the rest of the audit — a chroma-only seam would slip through.
 */
function seamCheck(image, thresholds, expectedRepeats, coveredEdges) {
  const { width, height, luminance } = image;

  // Per-axis interior step populations. Kept separate because a course texture is bimodal
  // along the stacking axis (flat inside a course, big jump at each course boundary): the
  // MEAN under-states such steps and inflates the seam ratio, while the P90 sits on the
  // course-boundary jumps themselves — the HF "structure-parallel masking" discovery.
  const stepsH = new Float32Array((width - 1) * height);
  let indexH = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      stepsH[indexH++] = Math.abs(luminance[y * width + x] - luminance[y * width + x - 1]);
    }
  }
  const stepsV = new Float32Array(width * (height - 1));
  let indexV = 0;
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      stepsV[indexV++] = Math.abs(luminance[y * width + x] - luminance[(y - 1) * width + x]);
    }
  }
  const meanOf = (steps) => {
    let sum = 0;
    for (let i = 0; i < steps.length; i++) sum += steps[i];
    return sum / steps.length || 1e-6;
  };
  const quantileOf = (values, q) => {
    const sorted = values.slice().sort();
    return sorted[Math.floor(q * (sorted.length - 1))] || 1e-6;
  };

  // Line-aggregated jump profiles: a wrap seam is a whole LINE, so "does it read as one
  // more course line?" must compare line against line, not line against per-pixel steps —
  // course boundaries are ~1-2% of pixel steps and vanish in an element-wise quantile.
  // perLineV[y] = mean jump crossing row boundary y (horizontal structure lines live here);
  // perLineH[x] = mean jump crossing column boundary x.
  const perLineV = new Float32Array(height - 1);
  for (let y = 1; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += stepsV[(y - 1) * width + x];
    perLineV[y - 1] = sum / width;
  }
  const perLineH = new Float32Array(width - 1);
  for (let x = 1; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += stepsH[y * (width - 1) + (x - 1)];
    perLineH[x - 1] = sum / height;
  }

  let horizontalSeam = 0;
  for (let y = 0; y < height; y++) {
    horizontalSeam += Math.abs(luminance[y * width] - luminance[y * width + width - 1]);
  }
  horizontalSeam /= height;
  let verticalSeam = 0;
  for (let x = 0; x < width; x++) {
    verticalSeam += Math.abs(luminance[x] - luminance[(height - 1) * width + x]);
  }
  verticalSeam /= width;

  const ok = thresholds?.seamOkRatio ?? 1.5;
  const warn = thresholds?.seamWarnRatio ?? 2.5;
  const maskedRatio = thresholds?.seamMaskedRatio ?? 1.5;
  const coverRepeats = thresholds?.seamCoverRepeats ?? 1.5;
  const structureQuantile = thresholds?.seamStructureQuantile ?? 0.99;

  /**
   * Axis verdict ladder:
   *   SEAMLESS / SOFT-SEAM  — by mean-denominator ratio (unchanged semantics)
   *   MASKED                — mean says visible, but the wrap line jump is comparable to
   *                           the texture's strongest interior structure lines
   *                           (seam / lineProfile-quantile ≤ maskedRatio): the seam reads
   *                           as one more course line (HF structure-parallel masking).
   *   VISIBLE-SEAM          — visible and stronger than any interior structure line.
   * Exposure then applies the placement context: repeats ≤ coverRepeats → COVERED.
   */
  const judgeAxis = (seamJump, steps, lineProfile, repeats, trimCovered) => {
    const ratioMean = seamJump / meanOf(steps);
    const ratioStructure = seamJump / quantileOf(lineProfile, structureQuantile);
    let verdict;
    if (ratioMean < ok) verdict = "SEAMLESS";
    else if (ratioMean < warn) verdict = "SOFT-SEAM";
    else if (ratioStructure <= maskedRatio) verdict = "MASKED";
    else verdict = "VISIBLE-SEAM";
    // Placement context, in priority order: geometry trim covering the wrap boundary
    // (ridge caps, eave boards — declared per axis), then low repeat counts.
    const exposed =
      verdict === "VISIBLE-SEAM" &&
      !trimCovered &&
      !(typeof repeats === "number" && repeats <= coverRepeats);
    return {
      ratioMean: Number(ratioMean.toFixed(2)),
      ratioStructure: Number(ratioStructure.toFixed(2)),
      verdict,
      trimCovered: Boolean(trimCovered),
      exposed,
    };
  };

  // The horizontal seam (left<->right wrap) is a vertical LINE -> compare against column
  // structure lines; the vertical seam is a horizontal line -> row structure lines.
  const axisH = judgeAxis(
    horizontalSeam,
    stepsH,
    perLineH,
    expectedRepeats?.horizontal,
    coveredEdges?.includes("horizontal"),
  );
  const axisV = judgeAxis(
    verticalSeam,
    stepsV,
    perLineV,
    expectedRepeats?.vertical,
    coveredEdges?.includes("vertical"),
  );

  const exposedAxes = [
    ...(axisH.exposed ? ["horizontal"] : []),
    ...(axisV.exposed ? ["vertical"] : []),
  ];
  const rank = { SEAMLESS: 0, "SOFT-SEAM": 1, MASKED: 2, "VISIBLE-SEAM": 3 };
  const worstVerdict = rank[axisH.verdict] >= rank[axisV.verdict] ? axisH.verdict : axisV.verdict;

  return {
    horizontal: axisH,
    vertical: axisV,
    seamRatioHorizontal: axisH.ratioMean,
    seamRatioVertical: axisV.ratioMean,
    verdict: worstVerdict,
    expectedRepeats: expectedRepeats ?? null,
    exposedAxes,
    exposure:
      worstVerdict !== "VISIBLE-SEAM" && worstVerdict !== "MASKED"
        ? "N/A"
        : exposedAxes.length
          ? "EXPOSED"
          : worstVerdict === "MASKED"
            ? "MASKED"
            : "COVERED",
  };
}

function auditTexture(config, textureConfig, judgementDistances) {
  const imagePath = resolve(config.baseDir, textureConfig.path);
  const image = decodePng(readFileSync(imagePath));
  const mips = buildMips(image);
  const window = config.contrastWindowPx ?? 24;

  // Preservation curve: local contrast of each mip (upsampled to full res) vs mip0.
  const baseStd = meanLocalStd(image.luminance, image.width, image.height, window);
  const preservationByMip = mips.map((mip) => {
    const up = upsampleBilinear(mip, image.width, image.height);
    return baseStd > 0 ? meanLocalStd(up, image.width, image.height, window) / baseStd : 0;
  });
  const preservationAt = (mipLevel) => {
    const clamped = Math.max(0, Math.min(mips.length - 1, mipLevel));
    const low = Math.floor(clamped);
    const high = Math.min(mips.length - 1, low + 1);
    const t = clamped - low;
    return preservationByMip[low] * (1 - t) + preservationByMip[high] * t;
  };

  // Residual granularity per mip: mean |gradient| of the mip (upsampled) over its absolute
  // local sigma. High values in the marginal band mean the surviving variance is fine-grain
  // noise ("wash") rather than legible blobs — the discriminator that separated grass(D)
  // from dirt/plaster(C) in the HF ground-truth calibration where ratio, absolute sigma and
  // surviving-octave energy all failed.
  const gradientPerSigmaByMip = mips.map((mip, k) => {
    const up = upsampleBilinear(mip, image.width, image.height);
    let gradientSum = 0;
    for (let y = 1; y < image.height; y++) {
      for (let x = 1; x < image.width; x++) {
        const i = y * image.width + x;
        gradientSum += Math.abs(up[i] - up[i - 1]) + Math.abs(up[i] - up[i - image.width]);
      }
    }
    const meanGradient = gradientSum / ((image.width - 1) * (image.height - 1));
    const sigma = preservationByMip[k] * baseStd;
    return sigma > 1e-6 ? meanGradient / sigma : 0;
  });
  const gradientPerSigmaAt = (mipLevel) => {
    const clamped = Math.max(0, Math.min(mips.length - 1, mipLevel));
    const low = Math.floor(clamped);
    const high = Math.min(mips.length - 1, low + 1);
    const t = clamped - low;
    return gradientPerSigmaByMip[low] * (1 - t) + gradientPerSigmaByMip[high] * t;
  };

  // Octave contrast energy → "80% of the energy lives below wavelength X".
  const octaveEnergy = [];
  for (let k = 0; k < mips.length - 1; k++) {
    const fine = upsampleBilinear(mips[k], image.width, image.height);
    const coarse = upsampleBilinear(mips[k + 1], image.width, image.height);
    let energy = 0;
    for (let i = 0; i < fine.length; i++) {
      const difference = fine[i] - coarse[i];
      energy += difference * difference;
    }
    octaveEnergy.push(energy);
  }
  const totalEnergy = octaveEnergy.reduce((a, b) => a + b, 0) || 1;

  const camera = config.camera;
  const worldPerPixelAt = (distance) =>
    (2 * distance * Math.tan(((camera.fovDeg / 2) * Math.PI) / 180)) / camera.viewportWidthPx;
  const anisotropy = config.groundAnisotropy ?? 1;

  const usages = textureConfig.usages.map((usage) => {
    const texelWorldM = usage.mPerTile / image.width;
    const cumulative80 = (() => {
      let acc = 0;
      for (let k = 0; k < octaveEnergy.length; k++) {
        acc += octaveEnergy[k];
        if (acc / totalEnergy >= 0.8) return texelWorldM * 2 ** (k + 1) * 100;
      }
      return texelWorldM * 2 ** octaveEnergy.length * 100;
    })();

    const bands = judgementDistances.map((distance) => {
      const texelsPerPixel = (worldPerPixelAt(distance) / texelWorldM) * anisotropy;
      const mipLevel = Math.max(0, Math.log2(Math.max(1e-6, texelsPerPixel)));
      const preservation = preservationAt(mipLevel);
      const absoluteSigma = preservation * baseStd;
      const granularity = gradientPerSigmaAt(mipLevel);
      let grade = gradeFor(preservation, absoluteSigma, config.thresholds);
      let washDemoted = false;
      if (
        grade === "C" &&
        typeof config.thresholds.washGradientPerSigma === "number" &&
        granularity > config.thresholds.washGradientPerSigma
      ) {
        grade = "D";
        washDemoted = true;
      }
      return {
        distanceM: distance,
        effectiveMip: Number(mipLevel.toFixed(2)),
        contrastPreservedPct: Number((preservation * 100).toFixed(1)),
        absoluteSigmaLinear: Number(absoluteSigma.toFixed(4)),
        gradientPerSigma: Number(granularity.toFixed(3)),
        grade,
        ...(washDemoted ? { washDemoted: true } : {}),
      };
    });

    // 판정 밴드는 이 usage가 실제로 보이는 거리에서 고른다.
    //
    // 예전에는 usage와 무관하게 전역 gameplayBandIndex(15m)에서만 등급을 매겼다. 그러면
    // 60~200m에서만 보이는 원경 텍스처가 15m에서 100%라고 통과하고, 3~15m짜리 벽은
    // 자기 밴드의 맨 끝에서 채점된다. 둘 다 의미 없는 판정이다. usage가
    // viewingDistanceM으로 자기 거리를 선언하면 그 범위에서 가장 먼 밴드를 쓴다 —
    // 가장 가혹한 지점이 그 usage가 실제로 견뎌야 하는 조건이다.
    // 선언이 없으면 예전처럼 전역 밴드를 쓴다.
    const gameplay = pickJudgementBand(bands, usage, config);
    let prescription = null;
    if (gameplay && gameplay.grade > "B") {
      const passes = (level) => {
        const ratio = preservationAt(level);
        if (ratio < config.thresholds.B) return false;
        if (typeof config.thresholds.sigmaFloorLinear === "number") {
          return ratio * baseStd >= config.thresholds.sigmaFloorLinear;
        }
        return true;
      };
      let readableMip = 0;
      for (let level = 0; level <= mips.length - 1; level += 0.25) {
        if (passes(level)) readableMip = level;
        else break;
      }
      const usageNeeded = usage.mPerTile * 2 ** (gameplay.effectiveMip - readableMip);
      const structureWavelengthM = texelWorldM * 2 ** (gameplay.effectiveMip + 1);
      prescription = {
        targetGrade: "B",
        raiseUsageToMPerTile: Number(usageNeeded.toFixed(1)),
        orAddStructureWavelengthAtLeastM: Number(structureWavelengthM.toFixed(2)),
        note: `판정 거리 ${gameplay.distanceM}m에서 B 등급이 되려면 usage를 ${usageNeeded.toFixed(1)} m/타일로 올리거나, 파장 ≥ ${structureWavelengthM.toFixed(2)}m 대역에 구조(제2 레이어 등)를 추가하세요.`,
      };
    }

    // Calibration probes (--calibrate): candidate discriminators for the "high-ratio wash
    // vs low-ratio legible mottling" problem the sigma floor failed to solve.
    let calibration = null;
    if (config.debugCalibration && gameplay) {
      const mipFloor = Math.min(mips.length - 1, Math.max(0, Math.floor(gameplay.effectiveMip)));
      const surviving = octaveEnergy.reduce(
        (acc, energy, k) => (k >= Math.round(gameplay.effectiveMip) ? acc + energy : acc),
        0,
      );
      const up = upsampleBilinear(mips[mipFloor], image.width, image.height);
      let gradientSum = 0;
      for (let y = 1; y < image.height; y++) {
        for (let x = 1; x < image.width; x++) {
          const i = y * image.width + x;
          gradientSum += Math.abs(up[i] - up[i - 1]) + Math.abs(up[i] - up[i - image.width]);
        }
      }
      const meanGradient = gradientSum / ((image.width - 1) * (image.height - 1));
      const sigmaAtMip = gameplay.absoluteSigmaLinear || 1e-6;
      calibration = {
        octaveEnergyPct: octaveEnergy.map((energy) => Number(((energy / totalEnergy) * 100).toFixed(1))),
        survivingOctaveEnergyPct: Number(((surviving / totalEnergy) * 100).toFixed(1)),
        gradientPerSigma: Number((meanGradient / sigmaAtMip).toFixed(4)),
      };
    }

    return {
      label: usage.label,
      mPerTile: usage.mPerTile,
      texelMm: Number((texelWorldM * 1000).toFixed(2)),
      contrastEnergy80PctBelowCm: Number(cumulative80.toFixed(1)),
      bands,
      prescription,
      ...(calibration ? { calibration } : {}),
    };
  });

  // GPU memory: RGBA8 + full mip chain (x4/3). Assumption stated in the report so a team
  // using compressed formats can rescale.
  const gpuBytesWithMips = Math.round(image.width * image.height * 4 * (4 / 3));

  return {
    path: textureConfig.path,
    resolution: `${image.width}x${image.height}`,
    baseSigmaLinear: Number(baseStd.toFixed(4)),
    gpuBytesWithMips,
    seam: seamCheck(image, config.thresholds, textureConfig.expectedRepeats, textureConfig.coveredEdges),
    preservationByMipPct: preservationByMip.map((value) => Number((value * 100).toFixed(1))),
    usages,
  };
}

// ----------------------------------------------------------------------------------- main

const [configPath] = process.argv.slice(2).filter((token) => !token.startsWith("--"));
if (!configPath) {
  process.stderr.write("Usage: texture-audit.mjs <config.json> [--out report.json]\n");
  process.exit(1);
}
const outIndex = process.argv.indexOf("--out");
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : null;

const config = JSON.parse(readFileSync(resolve(configPath), "utf8"));
const JUDGEMENT_DISTANCES = effectiveBands(config);
config.baseDir = config.baseDir ? resolve(dirname(resolve(configPath)), config.baseDir) : dirname(resolve(configPath));

// Calibration override without touching the config file: --sigma-floor <linear sigma>.
const sigmaFloorIndex = process.argv.indexOf("--sigma-floor");
if (sigmaFloorIndex >= 0) {
  config.thresholds.sigmaFloorLinear = Number(process.argv[sigmaFloorIndex + 1]);
}
if (process.argv.includes("--calibrate")) config.debugCalibration = true;

const report = {
  generatedBy: "clunk texture-audit prototype v0.1",
  assumptions: {
    camera: config.camera,
    groundAnisotropy: config.groundAnisotropy ?? 1,
    thresholds: config.thresholds,
    contrastWindowPx: config.contrastWindowPx ?? 24,
    analysis: "sRGB decode -> linear luminance -> box mip chain -> per-window stddev vs mip0",
  },
  // 밴드는 설정값과 usage가 선언한 관측 거리의 합집합이다.
  distanceBandsM: JUDGEMENT_DISTANCES,
  textures: config.textures.map((textureConfig) =>
    auditTexture(config, textureConfig, JUDGEMENT_DISTANCES),
  ),
};

// Texture-set aggregate: mip-inclusive GPU memory vs budget.
const totalGpuBytes = report.textures.reduce((acc, texture) => acc + texture.gpuBytesWithMips, 0);
report.textureSet = {
  assumption: "RGBA8, full mip chain (x4/3)",
  totalGpuBytesWithMips: totalGpuBytes,
  totalGpuMB: Number((totalGpuBytes / (1024 * 1024)).toFixed(2)),
  budgetBytes: config.gpuMemoryBudgetBytes ?? null,
  budgetUsePct:
    typeof config.gpuMemoryBudgetBytes === "number"
      ? Number(((totalGpuBytes / config.gpuMemoryBudgetBytes) * 100).toFixed(1))
      : null,
};

for (const texture of report.textures) {
  process.stdout.write(
    `\n${texture.path} (${texture.resolution}) · GPU ${(texture.gpuBytesWithMips / (1024 * 1024)).toFixed(2)}MB · 심리스 ${texture.seam.verdict} (H ${texture.seam.seamRatioHorizontal} / V ${texture.seam.seamRatioVertical})${
      texture.seam.exposure !== "N/A" ? ` · 노출 ${texture.seam.exposure}` : ""
    }\n`,
  );
  for (const usage of texture.usages) {
    process.stdout.write(
      `  ${usage.label ?? ""} ${usage.mPerTile} m/타일 · ${usage.texelMm} mm/텍셀 · 에너지 80% < ${usage.contrastEnergy80PctBelowCm}cm\n`,
    );
    for (const band of usage.bands) {
      process.stdout.write(
        `    ${String(band.distanceM).padStart(3)}m → mip ${band.effectiveMip.toFixed(2)} · 보존 ${band.contrastPreservedPct}% · σ ${band.absoluteSigmaLinear} · ${band.grade}\n`,
      );
    }
    if (usage.prescription) process.stdout.write(`    ★ ${usage.prescription.note}\n`);
  }
}

process.stdout.write(
  `\n텍스처 세트 GPU 메모리(밉 포함, RGBA8): ${report.textureSet.totalGpuMB}MB${
    report.textureSet.budgetBytes
      ? ` / ${(report.textureSet.budgetBytes / (1024 * 1024)).toFixed(0)}MB 예산 (${report.textureSet.budgetUsePct}%)`
      : ""
  }\n`,
);

if (outPath) {
  writeFileSync(resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`\n[texture-audit] report -> ${outPath}\n`);
}

// --strict: CI gate mode. Exit 2 when the set violates policy — a visible seam, a D grade
// in the gameplay band, or a blown memory budget — so the audit can sit in a pipeline the
// same way `clunk validate` does.
if (process.argv.includes("--strict")) {
  // Which classes fail the gate is policy, not measurement: HF's CI wants seams (exposed
  // only) + memory, while readability D stays informational for layers that are mitigated
  // by design (e.g. a second broad layer). Default is all three, conservative.
  const strictChecks = new Set(config.strictChecks ?? ["seam", "memory", "readability"]);
  const violations = [];
  for (const texture of report.textures) {
    if (strictChecks.has("seam") && texture.seam.exposure === "EXPOSED") {
      violations.push(`${texture.path}: VISIBLE-SEAM 노출 (${texture.seam.exposedAxes.join(", ")})`);
    }
    if (strictChecks.has("readability")) {
      for (const usage of texture.usages) {
        const gameplay = pickJudgementBand(usage.bands, usage, config);
        if (gameplay && gameplay.grade === "D") {
          violations.push(`${texture.path} @ ${usage.mPerTile} m/타일: 판정 거리 ${gameplay.distanceM}m에서 D`);
        }
      }
    }
  }
  if (
    strictChecks.has("memory") &&
    report.textureSet.budgetBytes &&
    report.textureSet.totalGpuBytesWithMips > report.textureSet.budgetBytes
  ) {
    violations.push(`GPU 메모리 예산 초과: ${report.textureSet.totalGpuMB}MB`);
  }
  if (violations.length) {
    process.stdout.write(`\n[texture-audit] STRICT 위반 ${violations.length}건:\n`);
    for (const violation of violations) process.stdout.write(`  - ${violation}\n`);
    process.exitCode = 2;
  } else {
    process.stdout.write(`\n[texture-audit] STRICT 통과 (검사 클래스: ${[...strictChecks].join(", ")})\n`);
  }
}
