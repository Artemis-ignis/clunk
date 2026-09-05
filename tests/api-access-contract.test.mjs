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
  // 2026-09-04: 공개 응답에서 "크레딧"이라는 말과 그 값을 뺐다. 남은 것은 몇 번 쓸 수
  // 있는지뿐이고, 그 숫자는 여전히 원장이 실제로 넣는 상수와 같아야 한다.
  assert.match(access, /runs_on_signup: SIGNUP_GRANT_CREDITS,/);
  assert.ok(
    !/runs_on_signup:\s*\d/.test(access),
    "access 블록이 가입 지급량을 숫자로 다시 적으면 안 된다",
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
  for (const route of ["app/api/marketplace/route.ts"]) {
    assert.match(readFileSync(route, "utf8"), /access: accessFor\(\{ authenticated: false \}\)/, route);
  }
  assert.match(
    readFileSync("app/api/credits/route.ts", "utf8"),
    /access: accessFor\(\{ authenticated: true, credits, imageBudget \}\)/,
  );
});

/**
 * 키 발급은 D1 에 행을 만드는 쓰기인데 아무 상한이 없었다. 한 세션이 반복해서 눌러
 * 워크스페이스마다 수천 개의 유효한 자격증명을 만들 수 있었다. 두 겹으로 막는다 —
 * 분당 요청 수(rate-limit)와 동시에 살아 있는 키 수(라우트).
 */
test("연결 키 발급에는 요청 상한과 개수 상한이 둘 다 있다", () => {
  const rateLimit = readFileSync("app/api/_lib/rate-limit.ts", "utf8");
  assert.match(rateLimit, /id: "mcp-keys"/u, "키 라우트가 rate-limit 정책에 없다");
  assert.match(rateLimit, /\/api\/mcp\/keys/u);
  assert.match(rateLimit, /id: "mcp-rpc"/u, "MCP 호출에 상한이 없다");

  const keysRoute = readFileSync("app/api/mcp/keys/route.ts", "utf8");
  assert.match(keysRoute, /MAX_ACTIVE_KEYS_PER_WORKSPACE = \d+;/u, "워크스페이스당 키 상한 상수가 없다");
  assert.match(
    keysRoute,
    /SELECT COUNT\(\*\) AS count FROM clunk_api_keys WHERE workspace_id = \? AND revoked_at IS NULL/u,
    "상한을 재는 조회가 없다",
  );
  assert.match(keysRoute, /status: 409/u, "상한을 넘겼을 때 거절하지 않는다");
});

/**
 * 무료 등급 다운로드는 로그인으로 막혀 있다. 그런데 그 응답이
 * `public, max-age=31536000, immutable` 로 나가면 공유 캐시가 저장해 다음 사람에게
 * 그대로 내줄 수 있다. 문이 있는 응답은 문 뒤에 머문다.
 */
test("문이 있는 다운로드 응답에 공개 캐시 헤더가 붙지 않는다", () => {
  const download = readFileSync("app/api/marketplace/assets/[assetId]/route.ts", "utf8");
  const body = download.slice(download.indexOf("return new Response(object.body"));
  assert.ok(body.length > 100, "다운로드 응답을 못 찾았다");
  assert.doesNotMatch(body, /max-age=31536000/u, "로그인으로 막은 파일에 1년짜리 공개 캐시가 붙어 있다");
  assert.match(body, /publicPreview \? "public, max-age=300" : "private, no-store"/u);
});
