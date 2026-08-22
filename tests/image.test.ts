import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDistinctness,
  compareRenderedViews,
  inspectImage,
  IMAGE_THRESHOLDS,
  type ImagePixels,
} from "../packages/core/src/image";

/**
 * 합성 이미지로 검증한다. 실제 프로젝트 파일에 걸면 그 파일이 바뀌는 날 테스트가
 * 무너지고, 무너진 이유가 코드 때문인지 파일 때문인지 알 수 없다.
 */
function makeImage(size: number, paint: (x: number, y: number) => [number, number, number]): ImagePixels {
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = paint(x, y);
      const i = (y * size + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return { width: size, height: size, rgb };
}

/** 저주파: 부드러운 그라디언트. 축소해도 거의 그대로 남는다. */
const gradient = (size: number) =>
  makeImage(size, (x, y) => {
    const v = Math.round(((x + y) / (2 * (size - 1))) * 200) + 27;
    return [v, v, v];
  });

/** 고주파: 1픽셀 체커보드. 축소가 통째로 지운다. */
const checker = (size: number) =>
  makeImage(size, (x, y) => {
    const v = (x + y) % 2 === 0 ? 235 : 20;
    return [v, v, v];
  });

const bytesFor = (label: string, length: number) => {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (label.charCodeAt(i % label.length) + i) & 0xff;
  return out;
};

test("렌더 크기를 모르면 판독성을 판정하지 않는다", () => {
  const { report, view } = inspectImage("x.png", gradient(128), bytesFor("x", 2048));
  assert.equal(view, null, "비교할 렌더 뷰가 만들어지면 안 된다");
  assert.equal(report.metrics.detailRetention, null);
  const finding = report.findings.find((entry) => entry.ruleId === "IMG-NO-RENDER-SIZE");
  // 모르는 채로 통과시키면 그 통과가 거짓말이 된다.
  assert.equal(finding?.severity, "ERROR");
  assert.equal(report.score.ready, false);
});

test("축소가 실제로 지우는 양을 재고, 저주파와 고주파를 가른다", () => {
  const smooth = inspectImage("smooth.png", gradient(256), bytesFor("s", 4096), { renderPx: 32 }).report;
  const noisy = inspectImage("noisy.png", checker(256), bytesFor("n", 4096), { renderPx: 32 }).report;

  // 그라디언트는 큰 덩어리라 32px에서도 거의 그대로 남는다.
  assert.ok((smooth.metrics.detailRetention ?? 0) > 0.9, `저주파 도달률 ${smooth.metrics.detailRetention}`);
  // 1픽셀 체커보드는 32px 박스 필터가 평균으로 뭉갠다.
  assert.ok((noisy.metrics.detailRetention ?? 1) < 0.05, `고주파 도달률 ${noisy.metrics.detailRetention}`);

  // 늘 통과하는 지표는 검사가 아니다. 갈라지는지가 이 테스트의 요점이다.
  assert.ok(noisy.findings.some((entry) => entry.ruleId === "IMG-DETAIL-LOST"));
  assert.equal(smooth.findings.some((entry) => entry.ruleId === "IMG-DETAIL-LOST"), false);
});

test("이미 적정한 크기에는 줄이라고 하지 않는다", () => {
  const big = inspectImage("big.png", gradient(512), bytesFor("b", 300_000), { renderPx: 46 }).report;
  const right = inspectImage("right.png", gradient(128), bytesFor("r", 20_000), { renderPx: 46 }).report;

  const oversized = big.findings.find((entry) => entry.ruleId === "IMG-OVERSIZED");
  assert.ok(oversized, "512는 46px 렌더에 과합니다");
  assert.equal(big.metrics.sufficientSide, 128);

  // 조언을 따르고 나서도 같은 조언이 남으면, 상시 검사에서 그것은 노이즈가 된다.
  assert.equal(
    right.findings.some((entry) => entry.ruleId === "IMG-OVERSIZED"),
    false,
    "권장값과 같은 크기에는 처방이 없어야 한다",
  );
});

test("원본 해상도가 다른 곳에서도 쓰이면 줄이라고 하지 않는다", () => {
  const pixels = gradient(512);
  const thumbOnly = inspectImage("a.png", pixels, bytesFor("a", 300_000), { renderPx: 46 }).report;
  const alsoFull = inspectImage("a.png", pixels, bytesFor("a", 300_000), {
    renderPx: 46,
    sourceAlsoShown: true,
  }).report;

  assert.ok(thumbOnly.findings.some((entry) => entry.ruleId === "IMG-OVERSIZED"));
  // 상점 스크린샷처럼 원본 크기가 규격인 자산에 "줄여라"는 틀린 조언이다.
  assert.equal(alsoFull.findings.some((entry) => entry.ruleId === "IMG-OVERSIZED"), false);
});

test("같은 자리에 나오는 이미지가 렌더 크기에서 서로 구별되는지 본다", () => {
  // 두 장은 거의 같은 회색, 한 장은 확실히 다른 색.
  const grayA = makeImage(128, () => [128, 128, 128]);
  const grayB = makeImage(128, () => [131, 129, 128]);
  const orange = makeImage(128, () => [220, 120, 30]);

  const entries = [
    inspectImage("gray-a.png", grayA, bytesFor("ga", 512), { renderPx: 46 }),
    inspectImage("gray-b.png", grayB, bytesFor("gb", 512), { renderPx: 46 }),
    inspectImage("orange.png", orange, bytesFor("o", 512), { renderPx: 46 }),
  ];
  const views = entries.map((entry) => entry.view).filter((view) => view !== null);
  const pairs = compareRenderedViews(views);

  const closest = pairs[0];
  assert.deepEqual(closest.pair.slice().sort(), ["gray-a.png", "gray-b.png"]);
  assert.equal(closest.distinguishable, false, `ΔE ${closest.deltaE} < ${IMAGE_THRESHOLDS.deltaE}`);
  assert.ok(pairs[pairs.length - 1].distinguishable, "주황과 회색은 구별되어야 한다");

  const reports = applyDistinctness(entries.map((entry) => entry.report), pairs);
  const grayReport = reports.find((report) => report.fileName === "gray-a.png");
  const orangeReport = reports.find((report) => report.fileName === "orange.png");
  assert.ok(grayReport?.findings.some((entry) => entry.ruleId === "IMG-CONFUSABLE"));
  // 헷갈리는 쌍에 속하지 않은 파일까지 깎으면 안 된다.
  assert.equal(orangeReport?.findings.some((entry) => entry.ruleId === "IMG-CONFUSABLE"), false);
});

test("같은 바이트는 같은 digest를 낸다", () => {
  const pixels = gradient(128);
  const bytes = bytesFor("d", 4096);
  const first = inspectImage("d.png", pixels, bytes, { renderPx: 46 }).report;
  const second = inspectImage("d.png", pixels, bytes, { renderPx: 46 }).report;
  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.resultDigest, second.resultDigest);

  // 렌더 크기가 다르면 다른 검사다.
  const other = inspectImage("d.png", pixels, bytes, { renderPx: 64 }).report;
  assert.notEqual(other.resultDigest, first.resultDigest);
});
