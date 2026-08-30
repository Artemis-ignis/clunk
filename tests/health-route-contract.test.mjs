import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("health route reports core runtime and optional capability states without secrets", async () => {
  await access(new URL("app/api/health/route.ts", root));
  const route = await readFile(new URL("app/api/health/route.ts", root), "utf8");
  assert.match(route, /clunk\.health\.v1/);
  assert.match(route, /getRuntimeDb/);
  assert.match(route, /getRuntimeAssets/);
  assert.match(route, /getOAuthProviderStatuses/);
  assert.match(route, /getProviderRuntimeStatus/);
  assert.match(route, /getBillingStatus/);
  assert.match(route, /missing/);
  assert.doesNotMatch(route, /SECRET_KEY|CLIENT_SECRET|API_KEY/);
});

test("Cloudflare worker applies the deployment security header contract", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  for (const header of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy", "Content-Security-Policy"]) {
    assert.match(worker, new RegExp(header));
  }
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /form-action 'self' https:\/\/accounts\.google\.com https:\/\/github\.com/);
});
