import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// These contracts describe a deployment that sits behind the ChatGPT Sites
// identity proxy, so the runtime opts into header trust exactly as production
// Sites does. Without CLUNK_TRUST_SIWC_HEADERS the Worker strips the headers.
async function render(pathname, requestHeaders = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()) + "-" + pathname);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost" + pathname, {
      headers: { accept: "text/html", ...requestHeaders },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      CLUNK_TRUST_SIWC_HEADERS: "1",
      CLUNK_RATE_LIMIT_DISABLED: "1",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("login preserves the dashboard return path and lists truthful providers", async () => {
  const response = await render("/login?return_to=%2Fdashboard");
  assert.equal(response.status, 200);
  const html = await response.text();
  // cv5 login: OAuth inventory (live or 준비 중) instead of the Sites-host
  // button this deployment cannot honor; the return path stays visible.
  assert.match(html, /Google로 계속하기/);
  assert.match(html, /GitHub로 계속하기/);
  assert.match(html, /가입하고 시작하기/);
  assert.match(html, /\/dashboard/);
});

test("signup is a first-class route and links back to login", async () => {
  const response = await render("/signup");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ChatGPT 계정으로 시작하기/);
  // 2026-09-03: 가입 문은 가운데 카드 하나다. 카드가 말하는 것은 "여기서 계정이
  // 만들어진다"는 사실 하나뿐이다.
  assert.match(html, /내 작업공간이 만들어지고/);
  assert.match(html, /로그인하기/);
  assert.match(html, /href="\/login/);
});

test("the door a visitor lands on answers the button they pressed", async () => {
  // 의도는 return_to 안에 실려 온다(OAuth 상태 스키마는 그대로다). 가입 화면은 그
  // 의도를 읽어 자기가 눌린 이유를 말한다.
  const create = await render("/signup?return_to=%2Fstudio%3Fintent%3Dcreate");
  assert.equal(create.status, 200);
  const createHtml = await create.text();
  assert.match(createHtml, /첫 에셋 만들기부터/);
  assert.match(createHtml, /return_to=%2Fstudio%3Fintent%3Dcreate/);

  const inspect = await render("/signup?return_to=%2Fapp%3Fintent%3Dinspect");
  assert.equal(inspect.status, 200);
  const inspectHtml = await inspect.text();
  assert.match(inspectHtml, /파일 검사부터/);
  assert.match(inspectHtml, /return_to=%2Fapp%3Fintent%3Dinspect/);

  // 의도가 없으면 오늘까지 쓰던 기본 문구가 그대로 나온다.
  const plain = await (await render("/signup")).text();
  assert.doesNotMatch(plain, /첫 에셋 만들기부터|파일 검사부터/);
});

test("a guard sends a stranger to the sign-up door, intent and all", async () => {
  const response = await render("/studio");
  assert.ok([307, 308].includes(response.status));
  const target = new URL(response.headers.get("location"), "http://localhost");
  assert.equal(target.pathname, "/signup");
  assert.equal(target.searchParams.get("return_to"), "/studio?intent=create");

  const inspector = await render("/app");
  assert.ok([307, 308].includes(inspector.status));
  const inspectorTarget = new URL(inspector.headers.get("location"), "http://localhost");
  assert.equal(inspectorTarget.pathname, "/signup");
  assert.equal(inspectorTarget.searchParams.get("return_to"), "/app?intent=inspect");
});

test("authenticated login remains visible instead of redirecting away", async () => {
  const response = await render("/login?return_to=%2Fdashboard", {
    "oai-authenticated-user-id": "auth-route-test-user",
    "oai-authenticated-user-email": "master@example.test",
    "oai-authenticated-user-full-name": "Master",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  const html = await response.text();
  assert.match(html, /요청한 화면 열기/);
  assert.match(html, /href="\/dashboard/);
});

test("dashboard keeps unauthenticated users behind the host sign-in gate", async () => {
  const response = await render("/dashboard");
  assert.ok([307, 308].includes(response.status));
  const location = response.headers.get("location");
  assert.ok(location);
  const target = new URL(location, "http://localhost");
  // 2026-09-03: 문 앞에서 막힌 사람은 여기 와 본 적이 없다. /login 은 "돌아오는
  // 사람"의 문구라서, 가로막힌 사람은 /signup 으로 간다. 돌아갈 화면은 그대로 실려 간다.
  assert.equal(target.pathname, "/signup");
  assert.equal(target.searchParams.get("return_to"), "/dashboard");
});

test("dashboard client exposes loading, auth-required, error, and retry states", async () => {
  const source = await readFile(
    new URL("../app/components/DashboardClient.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /auth-required/);
  assert.match(source, /다시 시도/);
  assert.match(source, /연결 확인 중/);
  assert.match(source, /로그인 · 회원가입/);
});

test("dashboard uses real workspace endpoints and does not render demo ledger or sample asset data", async () => {
  const source = await readFile(
    new URL("../app/components/DashboardClient.tsx", import.meta.url),
    "utf8",
  );
  // 2026-09-02: project listing moved to KitsClient; the dashboard shows files and inspections.
  assert.match(source, /\/api\/generation/);
  assert.match(source, /\/assets/);
  assert.doesNotMatch(source, /DEMO MODE|데모 원장|clunk-messy-sample|DemoUpgradeButton/);
});

test("passport surface is backed by stored API rows and keeps final readiness separate", async () => {
  const source = await readFile(
    new URL("../app/components/PassportClient.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\/api\/passports/);
  // 2026-09-05: 화면이 "정적 재검사 결과"와 "Game Ready READY" 라는 내부 용어를 그대로
  // 찍고 있었다. 말은 한국어로 바뀌었지만 지켜야 하는 것은 그대로다 — 정리한 파일을
  // 다시 검사한 결과라는 사실과, 그것이 게임 화면 승인이 아니라는 경계.
  assert.match(source, /정리 후 다시 검사한 결과/);
  assert.match(source, /게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어 있지 않습니다/);
  assert.match(source, /연결된 에셋 보기/);
});
