#!/usr/bin/env node
/**
 * Clunk UI 판독성 검사 — 2D 런타임 에셋이 "실제로 그려지는 크기"에서 읽히는가.
 *
 * 왜 만들었나 (Harvest Frontier 세션, 2026-08-22): 그 프로젝트의 런타임 자산은 GLB 8개인데
 * 그 사이 늘어난 2D 자산이 33개이고 자동 검증이 0이었다. NPC 초상화는 512x512로 만들어져
 * 대화 카드의 48px 칩에 그려진다. "이 얼굴이 48px에서 식별되는가"는 눈으로는 확인이
 * 되는 듯 마는 듯한 질문이고, 다섯 명이 서로 구별되는가는 사람이 특히 못 잡는다.
 *
 * texture-audit.mjs와 같은 계약을 따른다: sRGB를 선형으로 푼 뒤 분석하고, 진단만 내지 않고
 * 처방까지 적는다. HF 세션이 "처방 없는 진단은 진단서일 뿐"이라고 못박았다.
 *
 *   node scripts/ui-readability-audit.mjs <config.json> [--out report.json]
 *
 * 설정 형태: examples/ui-readability/harvest-frontier.portraits.json 참고.
 *
 * 재는 것
 *   1) 대비 보존   렌더 크기에서 남는 RMS 대비 ÷ 원본의 RMS 대비 (선형 휘도).
 *                  큰 명암 구조가 살아남는지를 본다. 웬만하면 높게 나온다.
 *   1b) 도달률     원본에 그린 명암 변화 중 실제로 화면 픽셀에 도달하는 비율.
 *                  '세부를 더 그리는 것이 화면에 보이는가'에 답한다.
 *   2) 구별성      같은 그룹 이미지끼리 렌더 크기에서의 평균 색차(CIE Lab, ΔE76).
 *                  두 NPC가 48px에서 같아 보이면 대화 UI가 제 일을 못 한다.
 *   3) 해상도 낭비 원본 픽셀 ÷ 렌더 픽셀. 화면에 쓰지 않는 픽셀을 내려받게 만든다.
 *                  원본 해상도도 따로 노출되는 자산(상점 스크린샷처럼 규격이 정해진
 *                  것)은 설정에 sourceAlsoShown: true를 두면 이 판정을 하지 않는다.
 *
 * 재지 않는 것: 미학, 화풍, 인물의 매력. 그건 사람이 볼 일이다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { decodePngSrgb, linearLuminance, SRGB_TO_LINEAR } from "./lib/png.mjs";

/* --------------------------------------------------------------------- 리샘플 */

/**
 * 박스 필터 다운샘플. 브라우저가 큰 이미지를 작은 상자에 그릴 때 하는 일에 가깝고,
 * 무엇보다 모든 소스 픽셀이 결과에 기여한다 — 최근접 샘플링으로 재면 있지도 않은
 * 앨리어싱을 대비로 착각한다.
 */
function boxDownsample(values, width, height, channels, targetW, targetH) {
  const out = new Float32Array(targetW * targetH * channels);
  for (let ty = 0; ty < targetH; ty++) {
    const y0 = Math.floor((ty * height) / targetH);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / targetH));
    for (let tx = 0; tx < targetW; tx++) {
      const x0 = Math.floor((tx * width) / targetW);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / targetW));
      const count = (y1 - y0) * (x1 - x0);
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) sum += values[(y * width + x) * channels + c];
        }
        out[(ty * targetW + tx) * channels + c] = sum / count;
      }
    }
  }
  return out;
}

/** 최근접 업샘플. 축소본이 담고 있는 정보만으로 원래 크기를 되돌린다. */
function upsampleNearest(values, width, height, targetW, targetH) {
  const out = new Float32Array(targetW * targetH);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(height - 1, Math.floor((y * height) / targetH));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / targetW));
      out[y * targetW + x] = values[sy * width + sx];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 색 공간 */

/** 선형 RGB → CIE Lab (D65). 색차를 눈에 가깝게 재기 위한 것이다. */
function linearRgbToLab(r, g, b) {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 0.008856451679 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* ---------------------------------------------------------------------- 지표 */

/** RMS 대비: 평균 휘도로 정규화한 표준편차. 밝기가 다른 이미지끼리도 비교된다. */
function rmsContrast(luminance) {
  let mean = 0;
  for (const value of luminance) mean += value;
  mean /= luminance.length;
  if (mean <= 1e-6) return 0;
  let variance = 0;
  for (const value of luminance) variance += (value - mean) ** 2;
  return Math.sqrt(variance / luminance.length) / mean;
}

function analyseImage(path, renderPx) {
  const image = decodePngSrgb(readFileSync(path));
  const { width, height } = image;
  const source = linearLuminance(image);

  // 렌더 상자는 정사각이 아닐 수 있다. object-fit: cover 기준으로 짧은 변을 채운다.
  const [boxW, boxH] = Array.isArray(renderPx) ? renderPx : [renderPx, renderPx];
  const targetW = Math.max(1, Math.round(boxW));
  const targetH = Math.max(1, Math.round(boxH));

  const shrunkLuma = boxDownsample(source, width, height, 1, targetW, targetH);
  const linearRgb = new Float32Array(width * height * 3);
  for (let i = 0; i < linearRgb.length; i++) linearRgb[i] = SRGB_TO_LINEAR[image.rgb[i]];
  const shrunkRgb = boxDownsample(linearRgb, width, height, 3, targetW, targetH);

  const lab = new Float32Array(targetW * targetH * 3);
  for (let i = 0; i < targetW * targetH; i++) {
    const [l, a, b] = linearRgbToLab(shrunkRgb[i * 3], shrunkRgb[i * 3 + 1], shrunkRgb[i * 3 + 2]);
    lab[i * 3] = l;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }

  const sourceContrast = rmsContrast(source);
  const renderedContrast = rmsContrast(shrunkLuma);
  const pixelRatio = (width * height) / (targetW * targetH);

  // 디테일 보존: 46px를 거쳐 돌아온 신호의 분산 ÷ 원본의 분산.
  //
  // RMS 대비만 재면 거의 항상 통과한다. 축소는 미세한 결을 지우지 그림 전체의 큰
  // 명암 덩어리를 지우지 않고, 전역 표준편차는 후자가 지배하기 때문이다. 늘 통과하는
  // 지표는 검사가 아니다. 이 값은 '원본에 그린 것 중 실제로 화면에 도달하는 비율'이라
  // 세부를 더 그리는 일이 헛수고인지 아닌지를 바로 말해 준다.
  const roundTrip = upsampleNearest(shrunkLuma, targetW, targetH, width, height);
  let sourceMean = 0;
  for (const value of source) sourceMean += value;
  sourceMean /= source.length;
  let sourceVar = 0;
  let keptVar = 0;
  let roundMean = 0;
  for (const value of roundTrip) roundMean += value;
  roundMean /= roundTrip.length;
  for (let i = 0; i < source.length; i++) {
    sourceVar += (source[i] - sourceMean) ** 2;
    keptVar += (roundTrip[i] - roundMean) ** 2;
  }
  const detailRetention = sourceVar > 0 ? keptVar / sourceVar : 0;

  return {
    file: basename(path),
    path,
    source: { width, height },
    rendered: { width: targetW, height: targetH },
    contrast: {
      source: Number(sourceContrast.toFixed(4)),
      rendered: Number(renderedContrast.toFixed(4)),
      retention: sourceContrast > 0 ? Number((renderedContrast / sourceContrast).toFixed(4)) : 0,
    },
    detailRetention: Number(detailRetention.toFixed(4)),
    pixelRatio: Number(pixelRatio.toFixed(1)),
    byteLength: readFileSync(path).byteLength,
    lab,
  };
}

/** 두 이미지의 렌더 크기 평균 색차와, 그 차이가 어디서 오는지. */
function comparePair(a, b) {
  if (a.rendered.width !== b.rendered.width || a.rendered.height !== b.rendered.height) return null;
  const pixels = a.rendered.width * a.rendered.height;
  let deltaSum = 0;
  let lightnessSum = 0;
  let chromaSum = 0;
  for (let i = 0; i < pixels; i++) {
    const dl = a.lab[i * 3] - b.lab[i * 3];
    const da = a.lab[i * 3 + 1] - b.lab[i * 3 + 1];
    const db = a.lab[i * 3 + 2] - b.lab[i * 3 + 2];
    deltaSum += Math.sqrt(dl * dl + da * da + db * db);
    lightnessSum += Math.abs(dl);
    chromaSum += Math.sqrt(da * da + db * db);
  }
  const deltaE = deltaSum / pixels;
  return {
    pair: [a.file, b.file],
    deltaE: Number(deltaE.toFixed(2)),
    // 어느 쪽 지렛대를 당겨야 하는지 알려주기 위해 나눈다.
    lightness: Number((lightnessSum / pixels).toFixed(2)),
    chroma: Number((chromaSum / pixels).toFixed(2)),
  };
}

/* ------------------------------------------------------------------- 임계값 */

/**
 * 아래 값들은 물리 상수가 아니라 판단 기준이다. 그렇게 밝혀 두고 쓴다.
 *
 * CONTRAST_FLOOR: 렌더 크기에서 원본 대비의 절반도 남지 않으면, 축소가 형태를 지웠다는 뜻.
 * DELTA_E_FLOOR:  ΔE76에서 2.3이 "겨우 구별되는 차이"로 통용된다. UI 칩은 서로 스쳐 보는
 *                 물건이라 그 배수를 요구한다. 6은 "빠르게 훑어도 다르다"에 해당한다.
 */
const CONTRAST_FLOOR = 0.5;
const DELTA_E_FLOOR = 6;

function prescribe(entry, worstPair, sourceAlsoShown) {
  const notes = [];

  // 권장 크기: 2배 DPI를 덮는 가장 작은 2의 거듭제곱.
  //
  // 여유가 있는지를 먼저 판정한다. 예전에는 pixelRatio만 보고 처방을 냈는데, 그러면
  // 128×128 파일에 대고 "128×128이면 충분합니다"라고 말한다. 조언을 따르고 나서도
  // 같은 문장이 그대로 남으니 상시 검사에 걸어 두면 매번 '아직 할 일이 있다'로 읽힌다.
  // 이미 적정한 것은 적정하다고 말해야 검사가 끝난다.
  const sourceSide = Math.max(entry.source.width, entry.source.height);
  const renderSide = Math.max(entry.rendered.width, entry.rendered.height);
  const enough = 1 << Math.ceil(Math.log2(renderSide * 2));
  const headroom = !sourceAlsoShown && enough < sourceSide;

  if (entry.contrast.retention < CONTRAST_FLOOR) {
    notes.push(
      `${entry.rendered.width}px에서 큰 명암 구조가 원본의 ${(entry.contrast.retention * 100).toFixed(0)}%만 남습니다. ` +
        `이 크기에서 살아남는 것은 실루엣과 큰 덩어리뿐이니 그쪽을 벌리세요.`,
    );
  }

  // 이 수치는 두 방향 모두에서 쓸모가 있다. 낮으면 "그려도 안 보인다", 높으면
  // "이미 큰 덩어리 그림"이라는 뜻이다.
  const survives = (entry.detailRetention * 100).toFixed(1);
  if (entry.detailRetention < 0.5) {
    notes.push(
      `원본에 그린 명암 변화 중 ${survives}%만 ${entry.rendered.width}px에 도달합니다. ` +
        `나머지는 축소가 지웁니다 — 이 그림에 세부를 더 얹는 작업은 화면에 나타나지 않습니다.`,
    );
  } else {
    notes.push(
      `원본에 그린 명암 변화의 ${survives}%가 ${entry.rendered.width}px에서도 남습니다. ` +
        `축소에 강한 그림(큰 덩어리 위주)이라는 뜻입니다.` +
        (headroom ? ` 동시에 이 노출 지점만 보면 원본 해상도가 필요 없다는 뜻이기도 합니다.` : ``),
    );
  }

  if (headroom) {
    notes.push(
      `원본이 렌더 크기의 ${entry.pixelRatio.toFixed(0)}배 픽셀을 담고 있습니다. ` +
        `${enough}×${enough}면 2배 DPI까지 충분하고, 지금 파일 ${(entry.byteLength / 1024).toFixed(0)}KB를 크게 줄입니다.`,
    );
  } else if (!sourceAlsoShown) {
    notes.push(
      `${entry.source.width}×${entry.source.height}는 ${entry.rendered.width}px 렌더에 적정합니다` +
        `(2배 DPI 기준 ${enough}×${enough}). 더 줄일 여지 없음.`,
    );
  }

  if (worstPair) {
    const other = worstPair.pair.find((name) => name !== entry.file) ?? worstPair.pair[0];
    const lever = worstPair.chroma < worstPair.lightness ? "색상" : "명도";
    notes.push(
      `${other}와 ${entry.rendered.width}px에서 평균 ΔE ${worstPair.deltaE}로 가깝습니다(기준 ${DELTA_E_FLOOR}). ` +
        `${lever} 쪽이 특히 붙어 있으니, 배경색이나 의상처럼 축소해도 남는 큰 면적의 ${lever}을(를) 벌리세요.`,
    );
  }
  return notes;
}

/* --------------------------------------------------------------------- 실행 */

const [configPath] = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
if (!configPath) {
  console.error("usage: node scripts/ui-readability-audit.mjs <config.json> [--out report.json]");
  process.exit(1);
}
const outIndex = process.argv.indexOf("--out");
const outPath = outIndex > 0 ? process.argv[outIndex + 1] : null;

const config = JSON.parse(readFileSync(configPath, "utf8"));
const root = dirname(resolve(configPath));
const groups = [];

for (const group of config.groups ?? []) {
  const entries = group.files.map((file) =>
    analyseImage(resolve(root, group.baseDir ?? ".", file), group.renderPx),
  );
  const pairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const result = comparePair(entries[i], entries[j]);
      if (result) pairs.push(result);
    }
  }
  pairs.sort((a, b) => a.deltaE - b.deltaE);
  groups.push({
    name: group.name,
    note: group.note ?? null,
    renderPx: group.renderPx,
    sourceAlsoShown: group.sourceAlsoShown === true,
    entries,
    pairs,
  });
}

const report = {
  schemaVersion: "1.0",
  tool: "clunk-ui-readability",
  analysis: "sRGB decode -> linear -> box downsample to render size -> RMS contrast + CIE Lab ΔE76",
  thresholds: { contrastRetention: CONTRAST_FLOOR, deltaE: DELTA_E_FLOOR },
  groups: groups.map((group) => ({
    name: group.name,
    note: group.note,
    renderPx: group.renderPx,
    sourceAlsoShown: group.sourceAlsoShown,
    images: group.entries.map((entry) => {
      const worst = group.pairs.find(
        (pair) => pair.deltaE < DELTA_E_FLOOR && pair.pair.includes(entry.file),
      );
      return {
        file: entry.file,
        source: entry.source,
        rendered: entry.rendered,
        byteLength: entry.byteLength,
        pixelRatio: entry.pixelRatio,
        contrast: entry.contrast,
        detailRetention: entry.detailRetention,
        pass: entry.contrast.retention >= CONTRAST_FLOOR && !worst,
        prescriptions: prescribe(entry, worst, group.sourceAlsoShown),
      };
    }),
    pairs: group.pairs.map(({ pair, deltaE, lightness, chroma }) => ({
      pair,
      deltaE,
      lightness,
      chroma,
      distinguishable: deltaE >= DELTA_E_FLOOR,
    })),
  })),
};

const failures = report.groups.flatMap((group) => group.images.filter((image) => !image.pass));
report.pass = failures.length === 0;

for (const group of report.groups) {
  console.log(`\n[${group.name}] 렌더 ${JSON.stringify(group.renderPx)}px`);
  if (group.note) console.log(`  ${group.note}`);
  for (const image of group.images) {
    const mark = image.pass ? "OK  " : "FAIL";
    console.log(
      `  ${mark} ${image.file.padEnd(26)} ${image.source.width}×${image.source.height}` +
        ` → ${image.rendered.width}px · 대비 보존 ${(image.contrast.retention * 100).toFixed(0)}%` +
        ` · 축소 후 남는 변화 ${(image.detailRetention * 100).toFixed(1)}% · ${(image.byteLength / 1024).toFixed(0)}KB`,
    );
    for (const note of image.prescriptions) console.log(`       → ${note}`);
  }
  if (group.pairs.length) {
    const closest = group.pairs[0];
    const farthest = group.pairs[group.pairs.length - 1];
    console.log(
      `  구별성: 가장 닮은 쌍 ${closest.pair.join(" ↔ ")} ΔE ${closest.deltaE}` +
        ` · 가장 다른 쌍 ${farthest.pair.join(" ↔ ")} ΔE ${farthest.deltaE}`,
    );
  }
}
console.log(`\n판정: ${report.pass ? "통과" : `${failures.length}건 조치 필요`}`);

if (outPath) {
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[ui-readability] report -> ${outPath}`);
}
process.exitCode = report.pass ? 0 : 1;
