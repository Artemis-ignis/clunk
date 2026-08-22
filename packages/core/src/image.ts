/**
 * 2D 런타임 에셋 검사.
 *
 * 왜 코어에 있나: 게임 프로젝트의 런타임 자산은 GLB만이 아니다. Harvest Frontier의
 * 실측(2026-08-22)에서 GLB는 8개인데 그 사이 늘어난 2D 자산이 33개였고 자동 검증이
 * 0이었다. GLB만 보는 도구는 파이프라인에 물리지 않는다.
 *
 * 디코딩과 계산을 나눈 이유: 브라우저는 PNG·JPEG·WebP·AVIF를 이미 디코딩할 수 있고
 * Node는 못 한다. 코어가 인코딩된 바이트를 받으면 두 환경 중 하나는 반드시 못 쓴다.
 * 그래서 코어는 픽셀만 받는다 — 웹은 canvas로 풀어서 넘기고, CLI는 PNG 디코더를 통해
 * 넘긴다. 코어에는 포맷 파서가 아니라 판정만 남는다.
 *
 * 이 파일이 답하는 질문은 하나다: **실제로 그려지는 크기에서 이 그림이 제 일을 하는가.**
 * 미학, 화풍, 인물의 매력은 재지 않는다. 그건 사람이 볼 일이다.
 */
import type { Finding, Severity } from "./index";
import { sha256Hex, stableStringify, utf8 } from "./index";

export const IMAGE_RULE_SET_ID = "clunk-ui-readability-v1";
export const IMAGE_RULE_SET_VERSION = "1.0.0";

export type ImageRuleId =
  | "IMG-DECODED"
  | "IMG-NO-RENDER-SIZE"
  | "IMG-DETAIL-LOST"
  | "IMG-STRUCTURE-LOST"
  | "IMG-OVERSIZED"
  | "IMG-CONFUSABLE";

export type ImageFindingCategory = "format" | "readability" | "resolution" | "distinctness";

export const IMAGE_CATEGORY_ORDER: ImageFindingCategory[] = [
  "format",
  "readability",
  "resolution",
  "distinctness",
];

/** 화면에 그려지는 상자. 정사각이 아닐 수 있다(캡슐, 배너). */
export interface RenderBox {
  width: number;
  height: number;
}

export interface ImagePixels {
  width: number;
  height: number;
  /** sRGB 8비트 RGB. 알파는 판독성에 쓰지 않는다 — 합성 결과를 알 수 없기 때문이다. */
  rgb: Uint8Array;
}

export interface ImagePolicy {
  /**
   * 이 이미지가 실제로 그려지는 픽셀 크기.
   *
   * 없으면 판독성을 판정하지 않는다. "이 그림이 읽히는가"는 그려지는 크기를 모르면
   * 물을 수 없는 질문이고, 모르는 채로 점수를 내면 그 점수가 거짓말이 된다.
   */
  renderPx?: RenderBox | number;
  /**
   * 원본 해상도가 다른 노출 지점에서도 그대로 쓰이는가.
   *
   * 상점 스크린샷처럼 1920×1080이 규격인 자산은 썸네일만 보고 "줄여라"라고 하면 틀린
   * 조언이 된다. 이 검사가 보는 렌더 크기는 여러 노출 지점 중 하나일 뿐이다.
   */
  sourceAlsoShown?: boolean;
}

export interface ImageMetrics {
  sourceWidth: number;
  sourceHeight: number;
  renderWidth: number | null;
  renderHeight: number | null;
  byteLength: number;
  /** 원본 픽셀 ÷ 렌더 픽셀. 화면에 쓰지 않는 픽셀을 내려받게 만드는 배수. */
  pixelRatio: number | null;
  /** 렌더 크기에서 남는 RMS 대비 ÷ 원본의 RMS 대비. 큰 명암 구조가 살아남는지. */
  contrastRetention: number | null;
  /** 원본에 그린 명암 변화 중 실제로 화면 픽셀에 도달하는 비율. */
  detailRetention: number | null;
  /** 2배 DPI를 덮는 가장 작은 2의 거듭제곱. 권장 크기. */
  sufficientSide: number | null;
}

export interface ImageInspectionReport {
  schemaVersion: "1.0";
  ruleSetId: string;
  ruleSetVersion: string;
  fileName: string;
  inputHash: string;
  metrics: ImageMetrics;
  findings: Finding[];
  score: {
    score: number;
    ready: boolean;
    hardBlockerCount: number;
    ruleSetId: string;
  };
  resultDigest: string;
}

/* ------------------------------------------------------------------ 임계값 */

/**
 * 물리 상수가 아니라 판단 기준이다. 그렇게 밝혀 두고 쓴다.
 *
 * DETAIL_FLOOR: 그린 것의 절반도 화면에 도달하지 않으면, 세부를 더 얹는 작업이
 *   화면에 나타나지 않는다는 뜻이다. 결함이라기보다 낭비의 신호다.
 * CONTRAST_FLOOR: 큰 명암 구조까지 절반 아래로 무너지면 실루엣이 뭉개진다.
 * DELTA_E_FLOOR: ΔE76에서 2.3이 "겨우 구별되는 차이"로 통용된다. UI 칩은 스쳐 보는
 *   물건이라 그 배수를 요구한다. 6은 "빠르게 훑어도 다르다"에 해당한다.
 * PIXEL_RATIO_FLOOR: 4배(가로세로 2배)까지는 DPI 여유로 정당화된다.
 */
export const IMAGE_THRESHOLDS = {
  detailRetention: 0.5,
  contrastRetention: 0.5,
  deltaE: 6,
  pixelRatio: 4,
} as const;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  INFO: 0,
  WARNING: 3,
  ERROR: 18,
  CRITICAL: 50,
};

/* -------------------------------------------------------------- 신호 처리 */

const SRGB_TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return table;
})();

function linearLuminance({ width, height, rgb }: ImagePixels): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    out[i] =
      0.2126 * SRGB_TO_LINEAR[rgb[i * 3]] +
      0.7152 * SRGB_TO_LINEAR[rgb[i * 3 + 1]] +
      0.0722 * SRGB_TO_LINEAR[rgb[i * 3 + 2]];
  }
  return out;
}

/**
 * 박스 필터 축소. 브라우저가 큰 이미지를 작은 상자에 그릴 때 하는 일에 가깝고,
 * 무엇보다 모든 소스 픽셀이 결과에 기여한다 — 최근접으로 재면 있지도 않은
 * 앨리어싱을 대비로 착각한다.
 */
function boxDownsample(
  values: Float32Array,
  width: number,
  height: number,
  channels: number,
  targetW: number,
  targetH: number,
): Float32Array {
  const out = new Float32Array(targetW * targetH * channels);
  for (let ty = 0; ty < targetH; ty += 1) {
    const y0 = Math.floor((ty * height) / targetH);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / targetH));
    for (let tx = 0; tx < targetW; tx += 1) {
      const x0 = Math.floor((tx * width) / targetW);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / targetW));
      const count = (y1 - y0) * (x1 - x0);
      for (let c = 0; c < channels; c += 1) {
        let sum = 0;
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) sum += values[(y * width + x) * channels + c];
        }
        out[(ty * targetW + tx) * channels + c] = sum / count;
      }
    }
  }
  return out;
}

function upsampleNearest(
  values: Float32Array,
  width: number,
  height: number,
  targetW: number,
  targetH: number,
): Float32Array {
  const out = new Float32Array(targetW * targetH);
  for (let y = 0; y < targetH; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y * height) / targetH));
    for (let x = 0; x < targetW; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x * width) / targetW));
      out[y * targetW + x] = values[sy * width + sx];
    }
  }
  return out;
}

function meanOf(values: Float32Array): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function varianceOf(values: Float32Array, mean = meanOf(values)): number {
  let sum = 0;
  for (const value of values) sum += (value - mean) ** 2;
  return sum / values.length;
}

/** RMS 대비: 평균 휘도로 정규화한 표준편차. 밝기가 다른 이미지끼리도 비교된다. */
function rmsContrast(values: Float32Array): number {
  const mean = meanOf(values);
  if (mean <= 1e-6) return 0;
  return Math.sqrt(varianceOf(values, mean)) / mean;
}

/** 선형 RGB → CIE Lab (D65). 색차를 눈에 가깝게 재기 위한 것이다. */
function linearRgbToLab(r: number, g: number, b: number): [number, number, number] {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t: number) => (t > 0.008856451679 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function resolveRenderBox(renderPx: ImagePolicy["renderPx"]): RenderBox | null {
  if (typeof renderPx === "number") {
    if (!Number.isFinite(renderPx) || renderPx <= 0) return null;
    return { width: Math.round(renderPx), height: Math.round(renderPx) };
  }
  if (!renderPx) return null;
  const { width, height } = renderPx;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

/* ---------------------------------------------------------------- 렌더 뷰 */

/** 렌더 크기로 줄인 Lab. 이미지끼리 구별성을 비교할 때 쓴다. */
export interface RenderedView {
  fileName: string;
  width: number;
  height: number;
  lab: Float32Array;
}

/* ------------------------------------------------------------------ 검사 */

export function inspectImage(
  fileName: string,
  pixels: ImagePixels,
  sourceBytes: Uint8Array,
  policy: ImagePolicy = {},
): { report: ImageInspectionReport; view: RenderedView | null } {
  const findings: Finding[] = [];
  const add = (
    ruleId: ImageRuleId,
    category: ImageFindingCategory,
    severity: Severity,
    title: string,
    message: string,
    observed: string | number,
    threshold: string | number,
    action: string,
  ) => {
    findings.push({
      id: `${ruleId}:${fileName}`,
      ruleId,
      category: category as Finding["category"],
      severity,
      path: "/",
      title,
      message,
      observed,
      threshold,
      autoFixable: false,
      action,
    });
  };

  const inputHash = sha256Hex(sourceBytes);
  add(
    "IMG-DECODED",
    "format",
    "INFO",
    "Image decoded",
    `Decoded ${pixels.width}x${pixels.height} pixels.`,
    `${pixels.width}x${pixels.height}`,
    "decodable",
    "No action needed.",
  );

  const box = resolveRenderBox(policy.renderPx);
  const metrics: ImageMetrics = {
    sourceWidth: pixels.width,
    sourceHeight: pixels.height,
    renderWidth: box?.width ?? null,
    renderHeight: box?.height ?? null,
    byteLength: sourceBytes.byteLength,
    pixelRatio: null,
    contrastRetention: null,
    detailRetention: null,
    sufficientSide: null,
  };

  let view: RenderedView | null = null;

  if (!box) {
    // 모르는 채로 점수를 내면 그 점수가 거짓말이 된다. 못 잰다고 말한다.
    add(
      "IMG-NO-RENDER-SIZE",
      "readability",
      "ERROR",
      "Render size was not declared",
      "Readability is a question about the size this image is actually drawn at. Without that size there is nothing to measure, so no readability verdict was produced.",
      "not declared",
      "required",
      "Declare the pixel box this asset is drawn in — read it from the stylesheet or layout that renders it.",
    );
  } else {
    const source = linearLuminance(pixels);
    const shrunkLuma = boxDownsample(source, pixels.width, pixels.height, 1, box.width, box.height);

    const linearRgb = new Float32Array(pixels.width * pixels.height * 3);
    for (let i = 0; i < linearRgb.length; i += 1) linearRgb[i] = SRGB_TO_LINEAR[pixels.rgb[i]];
    const shrunkRgb = boxDownsample(
      linearRgb,
      pixels.width,
      pixels.height,
      3,
      box.width,
      box.height,
    );

    const lab = new Float32Array(box.width * box.height * 3);
    for (let i = 0; i < box.width * box.height; i += 1) {
      const [l, a, b] = linearRgbToLab(shrunkRgb[i * 3], shrunkRgb[i * 3 + 1], shrunkRgb[i * 3 + 2]);
      lab[i * 3] = l;
      lab[i * 3 + 1] = a;
      lab[i * 3 + 2] = b;
    }
    view = { fileName, width: box.width, height: box.height, lab };

    const sourceContrast = rmsContrast(source);
    const contrastRetention = sourceContrast > 0 ? rmsContrast(shrunkLuma) / sourceContrast : 0;

    // 도달률: 렌더 크기를 거쳐 돌아온 신호의 분산 ÷ 원본의 분산.
    //
    // RMS 대비만 재면 거의 항상 통과한다. 축소는 미세한 결을 지우지 그림 전체의 큰
    // 명암 덩어리를 지우지 않고, 전역 표준편차는 후자가 지배하기 때문이다. 늘 통과하는
    // 지표는 검사가 아니다.
    const roundTrip = upsampleNearest(
      shrunkLuma,
      box.width,
      box.height,
      pixels.width,
      pixels.height,
    );
    const sourceVar = varianceOf(source);
    const detailRetention = sourceVar > 0 ? varianceOf(roundTrip) / sourceVar : 0;

    const renderSide = Math.max(box.width, box.height);
    const sourceSide = Math.max(pixels.width, pixels.height);
    const sufficientSide = 1 << Math.ceil(Math.log2(renderSide * 2));

    metrics.pixelRatio = (pixels.width * pixels.height) / (box.width * box.height);
    metrics.contrastRetention = Number(contrastRetention.toFixed(4));
    metrics.detailRetention = Number(detailRetention.toFixed(4));
    metrics.sufficientSide = sufficientSide;

    if (contrastRetention < IMAGE_THRESHOLDS.contrastRetention) {
      add(
        "IMG-STRUCTURE-LOST",
        "readability",
        "WARNING",
        "Large-scale structure does not survive the render size",
        `Only ${(contrastRetention * 100).toFixed(0)}% of the source contrast is left at ${box.width}px. What survives at this size is silhouette and large blocks, so those are what must carry the image.`,
        Number((contrastRetention * 100).toFixed(1)),
        IMAGE_THRESHOLDS.contrastRetention * 100,
        "Widen the silhouette and the large light/dark masses rather than adding detail.",
      );
    }

    if (detailRetention < IMAGE_THRESHOLDS.detailRetention) {
      add(
        "IMG-DETAIL-LOST",
        "readability",
        "INFO",
        "Most drawn detail never reaches the screen",
        `${(detailRetention * 100).toFixed(1)}% of the variation drawn into this image survives to ${box.width}px. The rest is removed by downscaling, so further detail work on this asset will not be visible.`,
        Number((detailRetention * 100).toFixed(1)),
        IMAGE_THRESHOLDS.detailRetention * 100,
        "Stop adding detail at this scale, or draw the detail larger.",
      );
    }

    // 원본 해상도가 다른 곳에서도 쓰이면 줄이라는 말은 틀린 조언이다. 그리고 권장값이
    // 이미 현재 크기 이상이면 조언할 것이 없다 — 조언을 따른 뒤에도 같은 조언이 남으면
    // 상시 검사에서 그것은 노이즈가 된다.
    const headroom = !policy.sourceAlsoShown && sufficientSide < sourceSide;
    if (headroom && metrics.pixelRatio >= IMAGE_THRESHOLDS.pixelRatio) {
      add(
        "IMG-OVERSIZED",
        "resolution",
        "WARNING",
        "Source carries pixels the screen never shows",
        `The source holds ${metrics.pixelRatio.toFixed(0)}x the pixels of the box it is drawn in. ${sufficientSide}x${sufficientSide} covers 2x DPI, and the file is currently ${(sourceBytes.byteLength / 1024).toFixed(0)}KB.`,
        `${pixels.width}x${pixels.height}`,
        `${sufficientSide}x${sufficientSide}`,
        "Re-derive the runtime asset at the smaller size; keep the master at full resolution.",
      );
    }
  }

  return { report: finishReport(fileName, inputHash, metrics, findings), view };
}

/* -------------------------------------------------------------- 구별성 */

export interface ImagePairComparison {
  pair: [string, string];
  deltaE: number;
  lightness: number;
  chroma: number;
  distinguishable: boolean;
}

/**
 * 같은 자리에 번갈아 나오는 이미지들이 렌더 크기에서 서로 구별되는가.
 *
 * 이건 파일 하나로는 물을 수 없는 질문이다. NPC 초상화 다섯 장이 각각 훌륭해도 칩
 * 크기에서 서로 같아 보이면 그 UI는 제 일을 못 한다. 사람이 특히 못 잡는 종류이기도
 * 하다 — 나란히 놓고 보면 다르고, 대화 중에 하나씩 스쳐 보면 같다.
 */
export function compareRenderedViews(views: RenderedView[]): ImagePairComparison[] {
  const pairs: ImagePairComparison[] = [];
  for (let i = 0; i < views.length; i += 1) {
    for (let j = i + 1; j < views.length; j += 1) {
      const a = views[i];
      const b = views[j];
      if (a.width !== b.width || a.height !== b.height) continue;
      const count = a.width * a.height;
      let deltaSum = 0;
      let lightnessSum = 0;
      let chromaSum = 0;
      for (let k = 0; k < count; k += 1) {
        const dl = a.lab[k * 3] - b.lab[k * 3];
        const da = a.lab[k * 3 + 1] - b.lab[k * 3 + 1];
        const db = a.lab[k * 3 + 2] - b.lab[k * 3 + 2];
        deltaSum += Math.sqrt(dl * dl + da * da + db * db);
        lightnessSum += Math.abs(dl);
        chromaSum += Math.sqrt(da * da + db * db);
      }
      const deltaE = deltaSum / count;
      pairs.push({
        pair: [a.fileName, b.fileName],
        deltaE: Number(deltaE.toFixed(2)),
        lightness: Number((lightnessSum / count).toFixed(2)),
        chroma: Number((chromaSum / count).toFixed(2)),
        distinguishable: deltaE >= IMAGE_THRESHOLDS.deltaE,
      });
    }
  }
  return pairs.sort((a, b) => a.deltaE - b.deltaE);
}

/** 구별성 결과를 각 파일의 리포트에 되먹인다. 집합 판정이라 검사 뒤에 붙는다. */
export function applyDistinctness(
  reports: ImageInspectionReport[],
  pairs: ImagePairComparison[],
): ImageInspectionReport[] {
  return reports.map((report) => {
    const worst = pairs.find(
      (pair) => !pair.distinguishable && pair.pair.includes(report.fileName),
    );
    if (!worst) return report;
    const other = worst.pair.find((name) => name !== report.fileName) ?? worst.pair[0];
    const lever = worst.chroma < worst.lightness ? "chroma" : "lightness";
    const findings = [
      ...report.findings,
      {
        id: `IMG-CONFUSABLE:${report.fileName}`,
        ruleId: "IMG-CONFUSABLE",
        category: "distinctness" as Finding["category"],
        severity: "WARNING" as Severity,
        path: "/",
        title: "Two images look alike at the size they are drawn",
        message: `At ${report.metrics.renderWidth}px this image averages only deltaE ${worst.deltaE} from ${other}. They are meant to be told apart at a glance and they cannot be.`,
        observed: worst.deltaE,
        threshold: IMAGE_THRESHOLDS.deltaE,
        autoFixable: false,
        action: `Separate them on ${lever} across a large area that survives downscaling — background or clothing, not facial detail.`,
      } satisfies Finding,
    ];
    return finishReport(report.fileName, report.inputHash, report.metrics, findings);
  });
}

/* ------------------------------------------------------------------ 점수 */

function finishReport(
  fileName: string,
  inputHash: string,
  metrics: ImageMetrics,
  findings: Finding[],
): ImageInspectionReport {
  const sorted = [...findings].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const deduction = new Map<ImageFindingCategory, number>();
  for (const category of IMAGE_CATEGORY_ORDER) deduction.set(category, 0);
  for (const finding of sorted) {
    const category = finding.category as ImageFindingCategory;
    deduction.set(category, (deduction.get(category) ?? 0) + SEVERITY_WEIGHT[finding.severity]);
  }
  const score = Math.round(
    IMAGE_CATEGORY_ORDER.reduce(
      (sum, category) => sum + Math.max(0, 100 - Math.min(100, deduction.get(category) ?? 0)),
      0,
    ) / IMAGE_CATEGORY_ORDER.length,
  );
  const hardBlockerCount = sorted.filter(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  ).length;

  const canonical = {
    schemaVersion: "1.0" as const,
    ruleSetId: IMAGE_RULE_SET_ID,
    ruleSetVersion: IMAGE_RULE_SET_VERSION,
    fileName,
    inputHash,
    metrics,
    findings: sorted,
    score: {
      score,
      // 판독성을 재지 못했으면 READY라고 말할 수 없다. 그것이 hard blocker인 이유다.
      ready: hardBlockerCount === 0 && !sorted.some((f) => f.severity === "WARNING"),
      hardBlockerCount,
      ruleSetId: IMAGE_RULE_SET_ID,
    },
  };
  return { ...canonical, resultDigest: sha256Hex(utf8(stableStringify(canonical))) };
}
