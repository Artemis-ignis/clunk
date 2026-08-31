import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/** Exactly what an attacker would put on the wire with `curl -H`. */
const FORGED_SITES_HEADERS = {
  "oai-authenticated-user-id": "auth-boundary-forged-user",
  "oai-authenticated-user-email": "forged@example.test",
  "oai-authenticated-user-full-name": "Forged",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

const ASSETS = { fetch: async () => new Response("Not found", { status: 404 }) };

/**
 * Each import of the built Worker gets its own module instance, which also
 * means its own rate-limit state. Tests that measure the limiter must reuse a
 * single instance; tests that only render pages may load a fresh one.
 */
async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}-${label}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function render(pathname, { headers = {}, env = {} } = {}) {
  const worker = await loadWorker(pathname);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS, CLUNK_RATE_LIMIT_DISABLED: "1", ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("forged Sites identity headers cannot authenticate a deployment that did not opt in", async () => {
  const login = await render("/login?return_to=%2Fdashboard", { headers: FORGED_SITES_HEADERS });
  assert.equal(login.status, 200);
  const html = await login.text();
  // The authenticated affordance must be absent: no session was ever proven.
  assert.doesNotMatch(html, /요청한 Workspace 열기/);
  assert.doesNotMatch(html, /forged@example\.test/);
  // An untrusted deployment must not advertise the Sites host sign-in it
  // cannot honor; the truthful provider inventory renders instead.
  assert.doesNotMatch(html, /ChatGPT로 계속하기/);
  assert.match(html, /Google로 계속하기/);
  assert.match(html, /GitHub로 계속하기/);

  const dashboard = await render("/dashboard", { headers: FORGED_SITES_HEADERS });
  assert.ok([307, 308].includes(dashboard.status));
  const target = new URL(dashboard.headers.get("location"), "http://localhost");
  assert.equal(target.pathname, "/signin-with-chatgpt");
  assert.equal(target.searchParams.get("return_to"), "/dashboard");
});

test("the Sites trust flag restores host identity for the proxied deployment", async () => {
  const login = await render("/login?return_to=%2Fdashboard", {
    headers: FORGED_SITES_HEADERS,
    env: { CLUNK_TRUST_SIWC_HEADERS: "1" },
  });
  assert.equal(login.status, 200);
  const html = await login.text();
  assert.match(html, /요청한 Workspace 열기/);
  assert.match(html, /href="\/dashboard/);
});

test("only the exact flag value \"1\" enables header trust", async () => {
  for (const value of ["true", "yes", "0", ""]) {
    const response = await render("/login?return_to=%2Fdashboard", {
      headers: FORGED_SITES_HEADERS,
      env: { CLUNK_TRUST_SIWC_HEADERS: value },
    });
    const html = await response.text();
    assert.doesNotMatch(html, /요청한 Workspace 열기/, `flag value ${JSON.stringify(value)} must not grant trust`);
  }
});

test("the signed session cookie is resolved before any host identity header", async () => {
  const auth = await source("app/auth.ts");
  const resolver = auth.slice(
    auth.indexOf("export async function getCurrentUser"),
    auth.indexOf("async function readSignedSessionUser"),
  );
  assert.ok(resolver.length > 0, "getCurrentUser must exist");

  const sessionIndex = resolver.indexOf("readSignedSessionUser");
  const headerIndex = resolver.indexOf("readUpstreamIdentityUser");
  assert.ok(sessionIndex >= 0 && headerIndex >= 0);
  assert.ok(sessionIndex < headerIndex, "the verified session must win over headers");

  // The header branch is unreachable unless the runtime opted in.
  assert.match(resolver, /if \(!trustsUpstreamIdentityHeaders\(environment\)\) return null;/);
  assert.match(auth, /decodeOAuthSession/);
});

test("the Worker strips inbound identity headers unless the deployment is trusted", async () => {
  const worker = await source("worker/index.ts");
  const identity = await source("app/api/_lib/identity-headers.ts");
  assert.match(worker, /stripUpstreamIdentityHeaders/);
  assert.match(worker, /trustsUpstreamIdentityHeaders\(runtimeEnvironment\)/);
  assert.match(worker, /enforceRateLimit/);
  // Stripping must happen before the request reaches the handler.
  assert.ok(worker.indexOf("stripUpstreamIdentityHeaders") < worker.indexOf("handler.fetch(inbound"));

  assert.match(identity, /CLUNK_TRUST_SIWC_HEADERS/);
  assert.match(identity, /headers\.delete\(name\)/);
  for (const name of [
    "oai-authenticated-user-id",
    "oai-authenticated-user-email",
    "oai-authenticated-user-full-name",
    "oai-authenticated-user-full-name-encoding",
  ]) {
    assert.ok(identity.includes(name), `${name} must be stripped`);
  }
  assert.match(identity, /=== "1"/);
});

test("rate limiting covers the expensive routes and states its own limits honestly", async () => {
  const limiter = await source("app/api/_lib/rate-limit.ts");
  assert.match(limiter, /isolate/i);
  assert.match(limiter, /NOT a global quota|not a global/i);
  assert.match(limiter, /429/);
  assert.match(limiter, /retry-after/);
  assert.match(limiter, /CLUNK_RATE_LIMIT_DISABLED/);

  const expected = [
    ["/api/generation", 20],
    ["/api/assetops/inspect", 10],
    ["/api/credits", 10],
    ["/api/marketplace/checkout", 10],
    ["/api/auth/", 30],
  ];
  for (const [route, limit] of expected) {
    assert.ok(limiter.includes(route), `${route} must be rate limited`);
    assert.match(limiter, new RegExp(`limit: ${limit}`), `${route} needs a limit of ${limit}`);
  }
  // Key derivation: authenticated principal first, edge client IP as fallback.
  assert.match(limiter, /cf-connecting-ip/);
  assert.match(limiter, /user:\$\{/);
});

test("repeated writes are rejected with 429 once the window limit is passed", async () => {
  const worker = await loadWorker("rate-limit-live");
  const env = { ASSETS, CLUNK_AUTH_SESSION_SECRET: "contract-only-secret-value" };
  const statuses = [];

  for (let attempt = 0; attempt < 22; attempt += 1) {
    const response = await worker.fetch(
      new Request("http://localhost/api/generation", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ prompt: "contract" }),
      }),
      env,
      { waitUntil() {}, passThroughOnException() {} },
    );
    statuses.push(response.status);
    await response.arrayBuffer();
  }

  const limitedIndex = statuses.indexOf(429);
  assert.ok(limitedIndex >= 0, `expected a 429, saw ${JSON.stringify(statuses)}`);
  assert.equal(limitedIndex, 20, `POST /api/generation allows 20 per window, saw ${JSON.stringify(statuses)}`);
  assert.ok(statuses.slice(0, 20).every((status) => status !== 429));
});

test("a distinct client keeps its own window and the disable flag opts out", async () => {
  const worker = await loadWorker("rate-limit-scope");
  const call = (ip, extraEnv = {}) => worker.fetch(
    new Request("http://localhost/api/generation", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: "{}",
    }),
    { ASSETS, ...extraEnv },
    { waitUntil() {}, passThroughOnException() {} },
  );

  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await call("198.51.100.1");
    await response.arrayBuffer();
  }
  const exhausted = await call("198.51.100.1");
  await exhausted.arrayBuffer();
  assert.equal(exhausted.status, 429);
  assert.equal(exhausted.headers.get("retry-after"), String(Number(exhausted.headers.get("retry-after"))));
  assert.ok(Number(exhausted.headers.get("retry-after")) >= 1);

  const otherClient = await call("198.51.100.2");
  await otherClient.arrayBuffer();
  assert.notEqual(otherClient.status, 429);

  const disabled = await call("198.51.100.1", { CLUNK_RATE_LIMIT_DISABLED: "1" });
  await disabled.arrayBuffer();
  assert.notEqual(disabled.status, 429);
});
