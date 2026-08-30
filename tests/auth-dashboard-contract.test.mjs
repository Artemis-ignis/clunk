import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname, requestHeaders = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()) + "-" + pathname);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost" + pathname, {
      headers: { accept: "text/html", ...requestHeaders },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("login preserves the dashboard return path and explains ChatGPT signup", async () => {
  const response = await render("/login?return_to=%2Fdashboard");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /곧 회원가입/);
  assert.match(html, /\/signin-with-chatgpt\?return_to=%2Fdashboard/);
});

test("signup is a first-class route and links back to login", async () => {
  const response = await render("/signup");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /회원가입/);
  assert.match(html, /회원가입하기/);
  assert.match(html, /href="\/login/);
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
  assert.match(html, /이미 Clunk에/);
  assert.match(html, /href="\/dashboard/);
});

test("dashboard keeps unauthenticated users behind the host sign-in gate", async () => {
  const response = await render("/dashboard");
  assert.ok([307, 308].includes(response.status));
  const location = response.headers.get("location");
  assert.ok(location);
  const target = new URL(location, "http://localhost");
  assert.equal(target.pathname, "/signin-with-chatgpt");
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
  assert.match(source, /\/api\/projects/);
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
  assert.match(source, /정적 재검사 결과/);
  assert.match(source, /Game Ready READY/);
  assert.match(source, /연결된 에셋 보기/);
});
