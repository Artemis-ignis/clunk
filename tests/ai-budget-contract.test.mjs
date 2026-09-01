import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The free beta runs on Cloudflare's free Workers AI allowance and must never cross it.
 * These pin the shape of the guard rather than its arithmetic: the ceiling sits under the
 * allowance, the measured per-image cost is the one on the wrapper, the route asks before
 * it generates, and a refusal is free.
 */
const budget = readFileSync("app/api/_lib/ai-budget.ts", "utf8");
const route = readFileSync("app/api/generation/route.ts", "utf8");
const wrapper = readFileSync("app/api/_lib/image-generation.ts", "utf8");
const schema = readFileSync("app/api/_lib/clunk.ts", "utf8");

const constant = (name) => Number(budget.match(new RegExp(`export const ${name} = ([0-9_.]+);`))[1].replace(/_/g, ""));

test("우리 상한선은 Cloudflare 무료 한도보다 아래에 있다", () => {
  const ceiling = constant("DAILY_NEURON_CEILING");
  const free = constant("FREE_NEURONS_PER_DAY");
  assert.equal(free, 10_000, "무료 한도 상수가 Cloudflare 공개 수치와 다르다");
  assert.ok(ceiling < free, `상한 ${ceiling}이 무료 한도 ${free} 아래가 아니다`);
  assert.ok(free - ceiling >= 1_000, "동시 요청과 측정 오차를 흡수할 여유가 1,000뉴런은 있어야 한다");
});

test("이미지 1장 비용은 실측값이고 래퍼가 말하는 값과 같다", () => {
  assert.equal(constant("NEURONS_PER_IMAGE"), 129.6);
  assert.match(wrapper, /129\.6 neurons per image/, "image-generation.ts의 실측 주석과 어긋난다");
});

test("생성 라우트는 모델을 부르기 전에 예산을 잡고, 거절은 크레딧을 건드리지 않는다", () => {
  const reserveAt = route.indexOf("reserveImageBudget(db, workspaceId");
  const generateAt = route.indexOf("await generateImage({ prompt })");
  assert.ok(reserveAt > -1, "reserveImageBudget 호출이 없다");
  assert.ok(reserveAt < generateAt, "예산 확인이 모델 호출보다 뒤에 있다");
  assert.match(route, /budgetRefusal\(budget\)/);
  assert.match(route, /status: 429/);
  // The refusal happens before any credit reservation in this route.
  const creditAt = route.indexOf("applyCreditOperation");
  assert.ok(creditAt === -1 || reserveAt < creditAt, "크레딧 예약이 예산 확인보다 앞에 있다");
});

test("바인딩이 없어 모델을 부르지 못했을 때만 자리를 돌려준다", () => {
  assert.match(route, /generated\.status === "BINDING_UNAVAILABLE"\) await releaseImageBudget/);
  assert.ok(!/status === "FAILED"[\s\S]{0,120}releaseImageBudget/.test(route), "실패한 호출도 뉴런을 쓴다 — 돌려주면 안 된다");
});

test("사용량 원장 테이블이 스키마에 있다", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS clunk_ai_usage \(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, day TEXT NOT NULL, model TEXT NOT NULL, neurons REAL NOT NULL/);
});

test("예약은 먼저 기록하고 나중에 세어, 초과 쪽으로는 틀리지 않는다", () => {
  const insertAt = budget.indexOf("INSERT INTO clunk_ai_usage");
  const sumAt = budget.indexOf("SELECT COALESCE(SUM(neurons), 0)");
  assert.ok(insertAt > -1 && sumAt > -1);
  assert.ok(insertAt < sumAt, "합계를 먼저 읽고 나중에 기록하면 동시 요청 둘이 같이 통과한다");
  assert.match(budget, /globalUsed > DAILY_NEURON_CEILING[\s\S]{0,80}releaseImageBudget/);
});
