/**
 * API boundary suite for the one-command E2E runner.
 *
 * Fast subset of `scripts/api-credit-smoke.ts`: it proves the auth, credit and
 * CSRF boundaries hold on a freshly started server without re-running the deep
 * idempotency/race matrix the smoke owns. Every check is recorded instead of
 * aborting on the first failure, so one run reports every broken boundary.
 *
 * Driven by `scripts/e2e.mjs`; it prints one machine-readable JSON line prefixed
 * with `__CLUNK_E2E_JSON__` and exits non-zero when any check fails.
 *
 * Env:
 *   CLUNK_E2E_BASE_URL  server under test (default http://localhost:3100)
 *   CLUNK_E2E_USER_ID   workspace actor; must be unused so credits start at 25
 */
import { readFile } from "node:fs/promises";
import {
  createAssetBundle,
  inspectAsset,
  optimizeAsset,
} from "../packages/core/src/index";
import { apiRequest, runPayloadFor, siwcHeaders } from "./lib/clunk-api-contract";

const baseUrl = process.env.CLUNK_E2E_BASE_URL ?? "http://localhost:3100";
const userId = process.env.CLUNK_E2E_USER_ID ?? `clunk-e2e-${Date.now()}`;
const samplePath =
  process.env.CLUNK_E2E_SAMPLE ?? "public/samples/clunk-messy-sample.glb";

type CheckResult = { name: string; ok: boolean; detail: string; ms: number };
const checks: CheckResult[] = [];

async function check(name: string, run: () => Promise<string>): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const detail = await run();
    checks.push({ name, ok: true, detail, ms: Date.now() - startedAt });
    return true;
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
    });
    return false;
  }
}

function want(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const api = (path: string, init: RequestInit = {}) => apiRequest(baseUrl, userId, path, init);

// --- 1. Unauthenticated API surface -----------------------------------------
for (const path of ["/api/me", "/api/credits", "/api/runs", "/api/passports"]) {
  await check(`unauth ${path} → 401`, async () => {
    const response = await fetch(new URL(path, baseUrl));
    want(response.status, 401, `${path} without SIWC headers`);
    return "401";
  });
}

// --- 2. Protected pages redirect to the ChatGPT sign-in ----------------------
for (const path of ["/app", "/dashboard", "/settings"]) {
  await check(`unauth ${path} → 307 signin`, async () => {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    want(response.status, 307, `${path} without SIWC headers`);
    const location = response.headers.get("location") ?? "";
    if (!location.startsWith("/signin-with-chatgpt")) {
      throw new Error(`${path} redirected to ${location || "(no location)"}`);
    }
    return `307 ${location}`;
  });
}

// --- 3. Authenticated workspace bootstraps with 25 demo credits --------------
await check("SIWC /api/me → 200", async () => {
  const result = await api("/api/me");
  want(result.status, 200, "/api/me with SIWC headers");
  want((result.body.user as { userId?: string } | undefined)?.userId, userId, "/api/me actor");
  return "200";
});

await check("SIWC /api/credits → 200, 25", async () => {
  const result = await api("/api/credits");
  want(result.status, 200, "/api/credits with SIWC headers");
  want(Number(result.body.credits), 25, "fresh workspace balance");
  return "credits=25";
});

// --- 4. A real inspection debits exactly one credit --------------------------
const bytes = new Uint8Array(await readFile(samplePath));
const report = inspectAsset(createAssetBundle("clunk-messy-sample.glb", bytes));
const runPayload = runPayloadFor(report);
let assetId = "";

await check("run POST → 200, 24", async () => {
  const result = await api("/api/runs", { method: "POST", body: JSON.stringify(runPayload) });
  want(result.status, 200, "first inspection");
  want(Number(result.body.credits), 24, "balance after one inspection");
  assetId = String(result.body.assetId ?? "");
  return "credits=24";
});

await check("duplicate run → idempotent, 24", async () => {
  const result = await api("/api/runs", { method: "POST", body: JSON.stringify(runPayload) });
  want(result.status, 200, "duplicate inspection");
  want(result.body.idempotent, true, "duplicate inspection idempotency flag");
  want(Number(result.body.credits), 24, "balance after duplicate inspection");
  return "idempotent=true credits=24";
});

// --- 5. Cross-origin writes are rejected before any ledger change ------------
await check("evil-origin write → 403", async () => {
  const result = await apiRequest(baseUrl, userId, "/api/credits", {
    method: "POST",
    headers: { ...siwcHeaders(userId, baseUrl), origin: "https://evil.example" },
    body: JSON.stringify({ action: "simulate-upgrade" }),
  });
  want(result.status, 403, "cross-origin credit write");
  const after = await api("/api/credits");
  want(Number(after.body.credits), 24, "balance after rejected cross-origin write");
  return "403, credits=24";
});

// --- 6. An invalid optimization is refused and never debits ------------------
await check("invalid optimization → 4xx, no debit", async () => {
  const optimization = optimizeAsset(createAssetBundle("clunk-messy-sample.glb", bytes));
  const result = await api("/api/optimizations", {
    method: "POST",
    body: JSON.stringify({
      optimizationId: `e2e-invalid-${optimization.inputHash.slice(0, 12)}`,
      assetId,
      sourceHash: optimization.inputHash,
      // Claiming the output equals the input makes the evidence self-contradictory.
      outputHash: optimization.inputHash,
      operations: optimization.operations,
      passport: optimization.passport,
      reinspection: { ...optimization.after, inputHash: optimization.inputHash },
    }),
  });
  if (result.status < 400 || result.status >= 500) {
    throw new Error(`invalid optimization: expected 4xx, got ${result.status} ${JSON.stringify(result.body)}`);
  }
  const after = await api("/api/credits");
  want(Number(after.body.credits), 24, "balance after rejected optimization");
  return `${result.status}, credits=24`;
});

const failed = checks.filter((entry) => !entry.ok);
console.log(
  `__CLUNK_E2E_JSON__ ${JSON.stringify({ ok: failed.length === 0, userId, baseUrl, checks })}`,
);
if (failed.length > 0) process.exitCode = 1;
