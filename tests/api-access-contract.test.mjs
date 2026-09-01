import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const access = readFileSync("app/api/_lib/access.ts", "utf8");
const clunk = readFileSync("app/api/_lib/clunk.ts", "utf8");

/**
 * The `access` block states, to a caller who has not signed in, what a workspace would
 * start with. That number is only useful if it is the number the grant actually inserts —
 * a hardcoded copy would be a promise the product silently stops keeping.
 */
test("가입 지급 크레딧은 실제 원장 INSERT와 같은 상수를 쓴다", () => {
  assert.match(clunk, /export const SIGNUP_GRANT_CREDITS = \d+;/);
  assert.match(
    clunk,
    /INSERT OR IGNORE INTO clunk_credit_ledger \(id, workspace_id, amount, reason, reference_id\) VALUES \(\?, \?, \?,/,
    "원장 INSERT가 금액을 리터럴로 박아두면 안 된다",
  );
  assert.match(clunk, /\.bind\(creditId, workspaceId, SIGNUP_GRANT_CREDITS\)/);
  assert.match(access, /credits_on_signup: SIGNUP_GRANT_CREDITS,/);
  assert.ok(
    !/credits_on_signup:\s*\d/.test(access),
    "access 블록이 가입 지급액을 숫자로 다시 적으면 안 된다",
  );
});

/**
 * The anonymous branch runs on public, cacheable routes. If it ever grows a balance the
 * shared cache would hand one workspace's number to every other visitor.
 */
test("익명 access 블록은 잔액을 절대 담지 않는다", () => {
  const anonymous = access.slice(
    access.indexOf("if (!options.authenticated)"),
    access.indexOf("const credits = options.credits"),
  );
  assert.ok(anonymous.length > 100, "익명 분기를 못 찾았다");
  for (const leaked of [/credits:/, /generates_remaining/, /options.credits/]) {
    assert.ok(!leaked.test(anonymous), `익명 응답에 ${leaked} 가 들어갔다`);
  }
});

/**
 * Every public listing/pricing response carries it, or an agent still has to guess.
 */
test("공개 API 응답이 access 블록을 싣는다", () => {
  for (const route of ["app/api/marketplace/route.ts", "app/api/credits/packs/route.ts"]) {
    assert.match(readFileSync(route, "utf8"), /access: accessFor\(\{ authenticated: false \}\)/, route);
  }
  assert.match(
    readFileSync("app/api/credits/route.ts", "utf8"),
    /access: accessFor\(\{ authenticated: true, credits \}\)/,
  );
});
