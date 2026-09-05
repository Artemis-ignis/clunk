import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

/**
 * 문 없이 나가는 판매 파일이 늘어나지 않게 한다.
 *
 * /api/marketplace/assets/{id} 는 등급에 따라 로그인과 구독을 요구한다. 그런데 같은
 * 바이트가 /market/<slug>/<file> 정적 경로에도 놓여 있고, 그 경로에는 문이 없다.
 * 2026-09-05 실측:
 *
 *   GET /api/marketplace/assets/asset-w1-clunk-heli-h145 → 401 (유료 에셋)
 *   GET /market/clunk-heli-h145/h145.glb                 → 200, 2,833,676 bytes
 *
 * 이 배치는 랜딩과 마켓의 3D 뷰어가 그 파일을 직접 읽기 때문에 생긴 것이고, 고치는 일은
 * 미리보기용 파일을 따로 굽는 작업이다(이 테스트가 할 일이 아니다). 이 테스트가 하는 일은
 * 하나다 — 지금 노출된 목록을 못 박아 두고, 거기서 한 개라도 늘어나면 깨진다.
 *
 * 실판매 개시 전에 fixtures 의 files 는 비어야 한다.
 */

const ROOT = new URL("../", import.meta.url);
const MARKET_DIR = new URL("public/market/", ROOT);
/** 미리보기와 대표 그림은 원래 공개다 — 카드가 그것을 그린다. */
const PREVIEW = /^(preview-|hero-)/u;

function exposedSaleFiles() {
  const base = MARKET_DIR.pathname.replace(/^\/([A-Za-z]:)/u, "$1");
  const files = [];
  for (const slug of readdirSync(base).sort()) {
    const dir = `${base}/${slug}`;
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!PREVIEW.test(name)) files.push(`${slug}/${name}`);
    }
  }
  return files;
}

test("public/market 의 무인증 노출은 못 박은 목록보다 늘지 않는다", { skip: !existsSync(MARKET_DIR) && "public/market 이 이 트리에 없다(배포 트리에서만 실행된다)" }, () => {
  const allow = JSON.parse(
    readFileSync(new URL("fixtures/public-market-exposure.allow.json", import.meta.url), "utf8"),
  );
  const allowed = new Set(allow.files);
  const found = exposedSaleFiles();
  const added = found.filter((file) => !allowed.has(file));
  assert.deepEqual(
    added,
    [],
    `문 없이 나가는 판매 파일이 늘었습니다. 미리보기(preview-/hero-)가 아닌 파일을 public/market 에 새로 두지 마세요:\n${added.join("\n")}`,
  );
});

/**
 * 목록이 줄어드는 것은 환영이지만, 조용히 줄어들면 아무도 언제 끝났는지 모른다.
 * 다 비운 날 이 테스트가 알려 준다.
 */
test("실판매 개시 전 남은 무인증 노출 수를 기록으로 남긴다", { skip: !existsSync(MARKET_DIR) && "public/market 이 이 트리에 없다" }, () => {
  const allow = JSON.parse(
    readFileSync(new URL("fixtures/public-market-exposure.allow.json", import.meta.url), "utf8"),
  );
  const remaining = exposedSaleFiles().length;
  assert.ok(
    remaining <= allow.files.length,
    `노출 파일이 ${allow.files.length} 개에서 ${remaining} 개로 늘었습니다`,
  );
});
