import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The site sells the claim that a lane stays NOT_EVALUATED until someone supplies it. The
 * wave-1 seeder shipped 19 listings with every lane PASS, including a player-facing verdict
 * nobody had produced and a renderer verdict the texture audit itself contradicted.
 */
const seed = readFileSync("scripts/seed-wave1-qa.mjs", "utf8");
const sql = readFileSync("scripts/seed-wave1-qa.sql", "utf8");

test("씨더가 세 레인을 한꺼번에 PASS로 박지 않는다", () => {
  assert.ok(
    !/'PASS', 'PASS', 'PASS'/.test(seed),
    "visual_runtime·player_facing·human_decision을 리터럴 PASS 세 개로 쓰면 안 된다",
  );
  assert.match(seed, /player_facing[\s\S]{0,400}'NOT_EVALUATED'/);
});

test("사람이 본 적 없는 레인은 어느 상품도 PASS가 아니다", () => {
  const reviews = sql.split("\n").filter((line) => line.includes("clunk_asset_reviews"));
  assert.ok(reviews.length >= 19, `리뷰 문장이 ${reviews.length}개뿐이다`);
  for (const line of reviews) {
    assert.ok(!/'PASS', 'PASS', 'PASS'/.test(line), `player_facing이 PASS다: ${line.slice(0, 120)}`);
  }
});

test("텍스처는 렌더러 확인 PASS를 주장하지 않는다", () => {
  // Its own audit file writes visualRuntime: NOT_EVALUATED, measurementScope: texture-only.
  const audit = JSON.parse(
    readFileSync("outputs/market-launch/wave1/assets/textures-vol1/audit/vol1-final.audit.json", "utf8"),
  );
  assert.equal(audit.visualRuntime, "NOT_EVALUATED");
  assert.equal(audit.measurementScope, "texture-only");
  for (const line of sql.split("\n")) {
    if (!line.includes("clunk_asset_reviews")) continue;
    if (!/review-w1-(tex-|verified-seamless)/.test(line)) continue;
    assert.match(line, /'NOT_EVALUATED', 'NOT_EVALUATED', 'PASS'/, `텍스처가 렌더러 PASS를 주장한다: ${line.slice(0, 120)}`);
  }
});

/**
 * The line under a verdict used to describe the check in the past tense no matter what the
 * verdict said, so "not checked yet" sat above "we loaded it into a real three.js renderer".
 */
test("근거 카드는 통과했을 때만 '했습니다'라고 말한다", () => {
  const ui = readFileSync("app/components/MarketplaceCatalog.tsx", "utf8");
  assert.match(ui, /pending: string/, "EvidenceCard가 미통과 문구를 따로 받아야 한다");
  assert.match(ui, /safeValue === "PASS" \? detail : pending/);
  for (const match of ui.matchAll(/<EvidenceCard\b[^>]*\/>/g)) {
    assert.ok(match[0].includes("pending="), `pending 문구가 빠졌다: ${match[0].slice(0, 90)}`);
  }
});
