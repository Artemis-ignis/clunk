/*
 * What a capture is measured for.
 *
 * Every number here is read off the pixels that were actually written to disk, so a reader can
 * decode the PNG and recompute it. The luminance, edge-density and local-contrast formulas are
 * the ones scripts/ui-readability-cli.mjs uses for the 46 px UI readability contract (same
 * Rec.709 luma, same 0.08 edge and local-contrast thresholds, same 5th/95th percentile range);
 * they are restated here in TypeScript because core may not import sharp or node:crypto.
 */

import { sha256Hex } from "../index";
import type { CaptureMetrics, RasterResult, VisualScene } from "./types";
import { RASTER_BACKGROUND } from "./raster";

/** Matches DEFAULT_THRESHOLDS in scripts/ui-readability-cli.mjs. */
export const EDGE_THRESHOLD = 0.08;
export const LOCAL_CONTRAST_THRESHOLD = 0.08;
/** The size the UI readability contract rasterises to (tests/ui-readability-contract.test.mjs). */
export const READABILITY_PX = 46;
/** A colour bucket has to hold this share of the subject before it counts as part of the palette. */
export const PALETTE_BUCKET_MIN_SHARE = 0.005;
/** Subject alpha at or above this counts as the asset rather than the background. */
export const SUBJECT_ALPHA = 0.5;

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

export function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function rgbToLab(red: number, green: number, blue: number): [number, number, number] {
  const linear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(red);
  const g = linear(green);
  const b = linear(blue);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function percentile(sorted: Float64Array, fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Area-average resample of an RGB8 image into a target box. No library, no interpolation kernel. */
export function resampleRgb(
  rgb: Uint8Array,
  width: number,
  height: number,
  crop: { x: number; y: number; width: number; height: number },
  outWidth: number,
  outHeight: number,
): Uint8Array {
  const out = new Uint8Array(outWidth * outHeight * 3);
  const scaleX = crop.width / outWidth;
  const scaleY = crop.height / outHeight;
  for (let oy = 0; oy < outHeight; oy += 1) {
    const y0 = crop.y + oy * scaleY;
    const y1 = y0 + scaleY;
    const startY = Math.max(0, Math.floor(y0));
    const endY = Math.min(height - 1, Math.ceil(y1) - 1);
    for (let ox = 0; ox < outWidth; ox += 1) {
      const x0 = crop.x + ox * scaleX;
      const x1 = x0 + scaleX;
      const startX = Math.max(0, Math.floor(x0));
      const endX = Math.min(width - 1, Math.ceil(x1) - 1);
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const offset = (y * width + x) * 3;
          r += rgb[offset];
          g += rgb[offset + 1];
          b += rgb[offset + 2];
          n += 1;
        }
      }
      const offset = (oy * outWidth + ox) * 3;
      if (n === 0) {
        const sx = Math.min(width - 1, Math.max(0, Math.round(x0)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(y0)));
        const source = (sy * width + sx) * 3;
        out[offset] = rgb[source];
        out[offset + 1] = rgb[source + 1];
        out[offset + 2] = rgb[source + 2];
        continue;
      }
      out[offset] = Math.round(r / n);
      out[offset + 1] = Math.round(g / n);
      out[offset + 2] = Math.round(b / n);
    }
  }
  return out;
}

export interface ReadabilityMetrics {
  luminanceRange: number;
  edgeDensity: number;
  meanGradient: number;
  localContrastCoverage: number;
}

/** The UI readability contract's three numbers, on any RGB8 raster. */
export function measureReadability(rgb: Uint8Array, width: number, height: number): ReadabilityMetrics {
  const lumaValues = new Float64Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    lumaValues[i] = luma(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  }
  let edgeCount = 0;
  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) {
        const difference = Math.abs(lumaValues[index] - lumaValues[index + 1]);
        edgeSum += difference;
        if (difference >= EDGE_THRESHOLD) edgeCount += 1;
        edgeSamples += 1;
      }
      if (y + 1 < height) {
        const difference = Math.abs(lumaValues[index] - lumaValues[index + width]);
        edgeSum += difference;
        if (difference >= EDGE_THRESHOLD) edgeCount += 1;
        edgeSamples += 1;
      }
    }
  }
  let localContrastCount = 0;
  let localContrastSamples = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const centre = y * width + x;
      let minimum = 1;
      let maximum = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const value = lumaValues[centre + oy * width + ox];
          if (value < minimum) minimum = value;
          if (value > maximum) maximum = value;
        }
      }
      if (maximum - minimum >= LOCAL_CONTRAST_THRESHOLD) localContrastCount += 1;
      localContrastSamples += 1;
    }
  }
  const sorted = Float64Array.from(lumaValues).sort();
  return {
    luminanceRange: round(percentile(sorted, 0.95) - percentile(sorted, 0.05)),
    edgeDensity: round(edgeSamples ? edgeCount / edgeSamples : 0),
    meanGradient: round(edgeSamples ? edgeSum / edgeSamples : 0),
    localContrastCoverage: round(localContrastSamples ? localContrastCount / localContrastSamples : 0),
  };
}

export interface GroundContactMeasurement {
  columnRatio: number;
  medianGapRatio: number;
  maxGapRatio: number;
  evaluatedColumns: number;
}

/**
 * The empty band under a part, summarised over the silhouette.
 *
 * The rasteriser has already read every column's gap out of the z-buffer: the lowest drawn pixel
 * is unprojected to a world position and the floor point directly beneath it is projected back,
 * so the gap is the real daylight under that part rather than the distance to a floor line that
 * happens to be drawn somewhere else in the frame. This function only turns that column of
 * numbers into a share and two percentiles, normalised by the silhouette's own height.
 *
 * Two statistics, because they answer different questions. columnRatio is how much of the
 * silhouette reaches the floor: zero means the asset floats. medianGapRatio is how far the
 * typical column sits above it: an overhanging mudguard raises the maximum but not the median,
 * while a model authored a hand's width above the origin raises both.
 *
 * The honest limit: this reads one silhouette from one camera. It cannot see a part that floats
 * behind another part that is itself grounded.
 */
export function measureGroundContact(raster: RasterResult): GroundContactMeasurement {
  const { width, bbox, groundGapPx } = raster;
  if (!bbox || bbox.height <= 0) return { columnRatio: 0, medianGapRatio: 0, maxGapRatio: 0, evaluatedColumns: 0 };
  const ratios: number[] = [];
  let contact = 0;
  for (let x = 0; x < width; x += 1) {
    const gap = groundGapPx[x];
    if (Number.isNaN(gap)) continue;
    ratios.push(gap / bbox.height);
    if (gap <= 1) contact += 1;
  }
  if (ratios.length === 0) return { columnRatio: 0, medianGapRatio: 0, maxGapRatio: 0, evaluatedColumns: 0 };
  ratios.sort((left, right) => left - right);
  return {
    columnRatio: round(contact / ratios.length),
    medianGapRatio: round(ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * 0.5))]),
    maxGapRatio: round(ratios[ratios.length - 1]),
    evaluatedColumns: ratios.length,
  };
}

export interface MeasureOptions {
  measureGround: boolean;
}

export function measureCapture(raster: RasterResult, options: MeasureOptions): CaptureMetrics {
  const { width, height, rgb, alpha, bbox } = raster;
  const subject: number[] = [];
  const buckets = new Map<number, number>();
  let labL = 0;
  let labA = 0;
  let labB = 0;
  let crushed = 0;
  let blown = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (alpha[i] < SUBJECT_ALPHA) continue;
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const value = luma(r, g, b);
    subject.push(value);
    if (value <= 0.02) crushed += 1;
    if (value >= 0.98) blown += 1;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    const lab = rgbToLab(r, g, b);
    labL += lab[0];
    labA += lab[1];
    labB += lab[2];
  }
  const subjectCount = subject.length;
  const sorted = Float64Array.from(subject).sort();
  const p05 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  const mean = subjectCount ? subject.reduce((sum, value) => sum + value, 0) / subjectCount : 0;
  let paletteColorCount = 0;
  for (const count of buckets.values()) {
    if (count / Math.max(1, subjectCount) >= PALETTE_BUCKET_MIN_SHARE) paletteColorCount += 1;
  }
  const backgroundLab = rgbToLab(RASTER_BACKGROUND[0], RASTER_BACKGROUND[1], RASTER_BACKGROUND[2]);
  const meanLab: [number, number, number] = subjectCount
    ? [labL / subjectCount, labA / subjectCount, labB / subjectCount]
    : backgroundLab;
  const separation = Math.hypot(
    meanLab[0] - backgroundLab[0],
    meanLab[1] - backgroundLab[1],
    meanLab[2] - backgroundLab[2],
  );

  const crop = bbox
    ? { x: Math.floor(bbox.x), y: Math.floor(bbox.y), width: Math.max(1, Math.ceil(bbox.width)), height: Math.max(1, Math.ceil(bbox.height)) }
    : { x: 0, y: 0, width, height };
  const longSide = Math.max(crop.width, crop.height);
  const readWidth = Math.max(1, Math.round((crop.width / longSide) * READABILITY_PX));
  const readHeight = Math.max(1, Math.round((crop.height / longSide) * READABILITY_PX));
  const thumbnail = resampleRgb(rgb, width, height, crop, readWidth, readHeight);
  const readability46 = measureReadability(thumbnail, readWidth, readHeight);

  const ground = options.measureGround ? measureGroundContact(raster) : null;

  const clippedEdgeCount = Number(raster.clipped.top) + Number(raster.clipped.bottom)
    + Number(raster.clipped.left) + Number(raster.clipped.right);

  return {
    silhouetteFillRatio: round(raster.coverageRatio),
    boundingFillRatio: bbox ? round(Math.max(bbox.width, bbox.height) / Math.min(width, height)) : 0,
    clippedEdgeCount,
    subjectMeanLuma: round(mean),
    subjectLumaP05: round(p05),
    subjectLumaP95: round(p95),
    subjectLumaRange: round(p95 - p05),
    crushedBlackRatio: round(subjectCount ? crushed / subjectCount : 0),
    blownWhiteRatio: round(subjectCount ? blown / subjectCount : 0),
    paletteColorCount,
    backgroundSeparationDeltaE76: round(separation, 2),
    groundContactColumnRatio: ground ? ground.columnRatio : null,
    groundMedianGapRatio: ground ? ground.medianGapRatio : null,
    groundMaxGapRatio: ground ? ground.maxGapRatio : null,
    readability46,
  };
}

export interface MotionMeasurement {
  movedPixelRatio: number;
  meanAbsLumaDelta: number;
}

/** How much of the frame actually changes between the sampled animation phases. */
export function measureMotion(frames: readonly { rgb: Uint8Array; width: number; height: number }[]): MotionMeasurement {
  if (frames.length < 2) return { movedPixelRatio: 0, meanAbsLumaDelta: 0 };
  const { width, height } = frames[0];
  const pixels = width * height;
  const moved = new Uint8Array(pixels);
  let sum = 0;
  let comparisons = 0;
  for (let f = 1; f < frames.length; f += 1) {
    const a = frames[0];
    const b = frames[f];
    if (b.width !== width || b.height !== height) continue;
    comparisons += 1;
    for (let i = 0; i < pixels; i += 1) {
      const la = luma(a.rgb[i * 3], a.rgb[i * 3 + 1], a.rgb[i * 3 + 2]);
      const lb = luma(b.rgb[i * 3], b.rgb[i * 3 + 1], b.rgb[i * 3 + 2]);
      const delta = Math.abs(la - lb);
      sum += delta;
      if (delta >= 0.02) moved[i] = 1;
    }
  }
  let movedCount = 0;
  for (let i = 0; i < pixels; i += 1) movedCount += moved[i];
  return {
    movedPixelRatio: round(movedCount / pixels),
    meanAbsLumaDelta: round(comparisons ? sum / (pixels * comparisons) : 0, 6),
  };
}

/** A digest over the decoded triangle stream: same file plus same decoder, same digest. */
export function digestScene(scene: VisualScene): string {
  const bytes = new Uint8Array(
    scene.positions.buffer,
    scene.positions.byteOffset,
    scene.triangleCount * 9 * 4,
  );
  const colors = new Uint8Array(
    scene.colors.buffer,
    scene.colors.byteOffset,
    scene.triangleCount * 3 * 4,
  );
  const joined = new Uint8Array(bytes.length + colors.length);
  joined.set(bytes, 0);
  joined.set(colors, bytes.length);
  return sha256Hex(joined);
}
