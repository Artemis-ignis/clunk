import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

import { isPublicMarketFile, parseMarketPath, previewGlbFileName } from "../app/api/_lib/market-path.ts";

/**
 * 문 없이 나가는 판매 파일이 하나도 없게 한다.
 *
 * 2026-09-05 실측에서 이 자리는 이랬다:
 *
 *   GET /api/marketplace/assets/asset-w1-clunk-heli-h145 → 401 (유료 에셋)
 *   GET /market/clunk-heli-h145/h145.glb                 → 200, 2,833,676 bytes
 *
 * 같은 바이트인데 API 는 막고 정적 경로는 열려 있었다. 미리보기(preview-/hero-)가 아닌
 * 파일 195개가 그렇게 나갔고, 이 파일은 그 195개를 fixture 에 못 박아 두고 늘어나면
 * 깨지는 테스트였다.
 *
 * 지금은 그 195개가 0개다. 어떻게 0이 되었는지 — 그리고 이 테스트가 무엇을 재는지:
 *
 *   1. `assets.run_worker_first: ["/market/*"]`(vite.config.ts)이 그 경로만 정적 자산
 *      층보다 워커가 먼저 받게 한다.
 *   2. 워커(worker/index.ts)가 `gateStaticMarketRequest` 를 부른다. 그 함수는 파일 이름을
 *      `isPublicMarketFile` 로 가르고, 미리보기가 아닌 파일에는 API 라우트와 **같은**
 *      판정(app/api/_lib/market-gate.ts 의 authorizeMarketDownload)을 건다.
 *   3. 로그인하지 않은 방문자의 뷰어는 판매 파일 대신 미리보기 GLB 를 연다
 *      (app/components/model-source.ts, scripts/market-preview-glb.mjs).
 *
 * 이 테스트는 워커를 띄우지 않는다. 대신 (a) 디스크에 있는 모든 파일을 문지기가 쓰는 바로
 * 그 함수에 넣어 무인증으로 나가는 것이 미리보기뿐임을 확인하고, (b) 그 함수가 실제로
 * 워커와 설정에 연결돼 있는지를 소스에서 확인한다. 둘 중 하나만 맞고 다른 하나가 틀리면
 * 문은 서 있지 않다.
 */

const ROOT = new URL("../", import.meta.url);
const MARKET_DIR = new URL("public/market/", ROOT);
/** 미리보기와 대표 그림은 원래 공개다 — 카드가 그것을 그린다. 195개를 셀 때 쓴 그 잣대. */
const PREVIEW = /^(preview-|hero-)/u;

function marketPath(url) {
  return url.pathname.replace(/^\/([A-Za-z]:)/u, "$1");
}

function marketFiles() {
  const base = marketPath(MARKET_DIR);
  const files = [];
  for (const slug of readdirSync(base).sort()) {
    const dir = `${base}/${slug}`;
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) files.push(`${slug}/${name}`);
  }
  return files;
}

/** 문지기가 로그인 없이 내주는 파일 중, 미리보기가 아닌 것. 여기 뭔가 있으면 문이 샌다. */
function exposedSaleFiles() {
  return marketFiles().filter((file) => {
    const name = file.slice(file.indexOf("/") + 1);
    return isPublicMarketFile(name) && !PREVIEW.test(name);
  });
}

function readSource(relative) {
  return readFileSync(new URL(relative, ROOT), "utf8");
}

const skipWithoutMarket = { skip: !existsSync(MARKET_DIR) && "public/market 이 이 트리에 없다" };

test("문지기가 무인증으로 내주는 것은 미리보기뿐이다", skipWithoutMarket, () => {
  const allow = JSON.parse(
    readFileSync(new URL("fixtures/public-market-exposure.allow.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(allow.files, [], "fixture 의 files 는 비어 있어야 한다 — 문 없이 나가는 판매 파일은 0개다");
  assert.deepEqual(
    exposedSaleFiles(),
    [],
    "미리보기(preview-/hero-)가 아닌 파일이 문 없이 나갑니다. public/market 에 그런 파일을 두지 마세요.",
  );
});

test("정적 경로의 문이 실제로 워커와 설정에 연결돼 있다", () => {
  const worker = readSource("worker/index.ts");
  assert.match(worker, /gateStaticMarketRequest/u, "워커가 문지기를 부르지 않으면 문은 서 있지 않다");
  assert.match(worker, /STATIC_ASSETS/u, "통과한 파일을 워커가 내줄 손잡이가 있어야 한다");

  const viteConfig = readSource("vite.config.ts");
  assert.match(viteConfig, /run_worker_first/u, "이 설정이 없으면 정적 자산 층이 워커보다 먼저 답한다");
  assert.match(viteConfig, /"\/market\/\*"/u);
  assert.match(viteConfig, /binding: "STATIC_ASSETS"/u);

  const gate = readSource("app/api/_lib/market-gate.ts");
  // 판정을 못 하면 파일을 내주지 않는다. D1 이 흔들릴 때 문이 열리는 쪽으로 떨어지면
  // 문을 세운 의미가 없다.
  assert.match(gate, /GATE_UNAVAILABLE/u);
  assert.match(gate, /AUTHENTICATION_REQUIRED/u);
  // 라우트와 같은 판정을 부른다.
  assert.match(gate, /authorizeMarketDownload\(/u);
});

test("파는 GLB 마다 미리보기 GLB 가 옆에 있다", skipWithoutMarket, () => {
  const files = new Set(marketFiles());
  const missing = [];
  for (const file of files) {
    const [slug, name] = [file.slice(0, file.indexOf("/")), file.slice(file.indexOf("/") + 1)];
    if (!/\.glb$/iu.test(name) || PREVIEW.test(name)) continue;
    const preview = `${slug}/${previewGlbFileName(name)}`;
    if (!files.has(preview)) missing.push(preview);
  }
  assert.deepEqual(
    missing,
    [],
    `미리보기 파일이 없는 판매 GLB 가 있습니다. node scripts/market-preview-glb.mjs 를 돌리세요:\n${missing.join("\n")}`,
  );
});

test("정적 경로 파서는 슬러그와 파일 이름 두 칸만 받는다", () => {
  assert.deepEqual(parseMarketPath("/market/clunk-heli-h145/h145.glb"), {
    slug: "clunk-heli-h145",
    fileName: "h145.glb",
  });
  // 경로를 거슬러 올라가거나 한 칸 더 파고드는 주소는 문지기가 알아보지 못한다.
  assert.equal(parseMarketPath("/market/a/../b/c.glb"), null);
  assert.equal(parseMarketPath("/market/a/b/c.glb"), null);
  assert.equal(parseMarketPath("/market/a"), null);
  assert.equal(parseMarketPath("/markets/a/b.glb"), null);
});
