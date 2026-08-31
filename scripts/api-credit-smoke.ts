import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createAssetBundle,
  createPassport,
  inspectAsset,
  optimizeAsset,
} from "../packages/core/src/index";
import {
  apiRequest,
  expectStatus,
  runPayloadFor,
  type ApiResult,
} from "./lib/clunk-api-contract";

const baseUrl = process.env.CLUNK_SMOKE_BASE_URL ?? "http://localhost:3000";
const userId = process.env.CLUNK_SMOKE_USER_ID ?? `clunk-api-smoke-${randomUUID()}`;

async function apiFor(actor: string, path: string, init: RequestInit = {}): Promise<ApiResult> {
  return apiRequest(baseUrl, actor, path, init);
}

async function api(path: string, init: RequestInit = {}): Promise<ApiResult> {
  return apiFor(userId, path, init);
}

const unauthenticated = await fetch(new URL("/api/credits", baseUrl));
assert.equal(unauthenticated.status, 401, "protected API must reject requests without SIWC headers");

const bytes = new Uint8Array(await readFile("public/samples/clunk-messy-sample.glb"));
const report = inspectAsset(createAssetBundle("clunk-messy-sample.glb", bytes));
const runPayload = runPayloadFor(report);

const firstRun = await api("/api/runs", { method: "POST", body: JSON.stringify(runPayload) });
expectStatus(firstRun, 200, "first inspection");
assert.equal(typeof firstRun.body.idempotent, "boolean", "inspection must report idempotency state");
const firstBalance = Number(firstRun.body.credits);
const assetId = String(firstRun.body.assetId);

const duplicateRun = await api("/api/runs", { method: "POST", body: JSON.stringify(runPayload) });
expectStatus(duplicateRun, 200, "duplicate inspection");
assert.equal(duplicateRun.body.idempotent, true, "same inspection must be idempotent");
assert.equal(Number(duplicateRun.body.credits), firstBalance, "duplicate inspection must not debit again");

const conflictingRun = await api("/api/runs", {
  method: "POST",
  body: JSON.stringify({ ...runPayload, report: { ...report, clientNote: "different valid payload" } }),
});
expectStatus(conflictingRun, 409, "conflicting idempotency key");

const tamperedRun = await api("/api/runs", {
  method: "POST",
  body: JSON.stringify({ ...runPayload, report: { ...report, resultDigest: "0".repeat(64) } }),
});
expectStatus(tamperedRun, 400, "tampered inspection digest");

const concurrentUserId = `${userId}-same-key-race`;
const concurrentRuns = await Promise.all([
  apiFor(concurrentUserId, "/api/runs", { method: "POST", body: JSON.stringify(runPayload) }),
  apiFor(concurrentUserId, "/api/runs", { method: "POST", body: JSON.stringify(runPayload) }),
]);
assert.deepEqual(concurrentRuns.map((result) => result.status).sort(), [200, 200], "same-key concurrent requests must both resolve successfully");
const concurrentCredits = await apiFor(concurrentUserId, "/api/credits");
expectStatus(concurrentCredits, 200, "same-key concurrent balance");
assert.equal(Number(concurrentCredits.body.credits), 24, "same-key concurrent requests must debit exactly once");

const raceUserId = `${userId}-different-key-race`;
for (let index = 0; index < 24; index += 1) {
  const seedReport = inspectAsset(createAssetBundle(`credit-race-seed-${index}.glb`, bytes));
  const seed = await apiFor(raceUserId, "/api/runs", { method: "POST", body: JSON.stringify(runPayloadFor(seedReport)) });
  expectStatus(seed, 200, `different-key race seed ${index + 1}`);
}
const raceReportA = inspectAsset(createAssetBundle("credit-race-a.glb", bytes));
const raceReportB = inspectAsset(createAssetBundle("credit-race-b.glb", bytes));
const differentKeyRuns = await Promise.all([
  apiFor(raceUserId, "/api/runs", { method: "POST", body: JSON.stringify(runPayloadFor(raceReportA)) }),
  apiFor(raceUserId, "/api/runs", { method: "POST", body: JSON.stringify(runPayloadFor(raceReportB)) }),
]);
assert.deepEqual(differentKeyRuns.map((result) => result.status).sort(), [200, 402], "different-key concurrent requests must not overspend the last credit");
const raceCredits = await apiFor(raceUserId, "/api/credits");
expectStatus(raceCredits, 200, "different-key concurrent balance");
assert.equal(Number(raceCredits.body.credits), 0, "different-key concurrent requests must leave a non-negative balance");

const optimization = optimizeAsset(createAssetBundle("clunk-messy-sample.glb", bytes));
const optimizationPayload = {
  optimizationId: `smoke-optimization-${optimization.inputHash.slice(0, 12)}-${optimization.outputHash.slice(0, 12)}`,
  assetId,
  sourceHash: optimization.inputHash,
  outputHash: optimization.outputHash,
  operations: optimization.operations,
  passport: optimization.passport,
  reinspection: optimization.after,
};
const firstOptimization = await api("/api/optimizations", { method: "POST", body: JSON.stringify(optimizationPayload) });
expectStatus(firstOptimization, 200, "first optimization");
assert.equal(typeof firstOptimization.body.idempotent, "boolean", "optimization must report idempotency state");
const optimizedBalance = Number(firstOptimization.body.credits);

const duplicateOptimization = await api("/api/optimizations", { method: "POST", body: JSON.stringify(optimizationPayload) });
expectStatus(duplicateOptimization, 200, "duplicate optimization");
assert.equal(duplicateOptimization.body.idempotent, true, "same optimization must be idempotent");
assert.equal(Number(duplicateOptimization.body.credits), optimizedBalance, "duplicate optimization must not debit again");

const invalidOptimization = await api("/api/optimizations", {
  method: "POST",
  body: JSON.stringify({
    ...optimizationPayload,
    optimizationId: `${optimizationPayload.optimizationId}-invalid`,
    outputHash: optimization.inputHash,
    reinspection: { ...optimization.after, inputHash: optimization.inputHash },
  }),
});
expectStatus(invalidOptimization, 400, "invalid optimization");
const afterInvalid = await api("/api/credits");
expectStatus(afterInvalid, 200, "credits after invalid optimization");
assert.equal(Number(afterInvalid.body.credits), optimizedBalance, "invalid optimization must not debit credits");

const blockedAfter = inspectAsset(
  createAssetBundle(optimization.outputFileName, optimization.outputBytes),
  { readyScoreThreshold: 101 },
);
const blockedOptimization = await api("/api/optimizations", {
  method: "POST",
  body: JSON.stringify({
    ...optimizationPayload,
    optimizationId: `${optimizationPayload.optimizationId}-blocked-policy`,
    passport: createPassport(optimization.before, blockedAfter, optimization.operations),
    reinspection: blockedAfter,
  }),
});
expectStatus(blockedOptimization, 200, "blocked optimization evidence");
assert.equal(blockedOptimization.body.status, "blocked", "blocked fresh reinspection must not be stored as ready");

const externalOrigin = await api("/api/credits", {
  method: "POST",
  headers: { origin: "https://evil.example" },
  body: JSON.stringify({ action: "simulate-upgrade" }),
});
expectStatus(externalOrigin, 403, "cross-origin credit write");

const firstUpgrade = await api("/api/credits", {
  method: "POST",
  body: JSON.stringify({ action: "simulate-upgrade" }),
});
expectStatus(firstUpgrade, 200, "first demo upgrade");
assert.equal(typeof firstUpgrade.body.idempotent, "boolean", "demo upgrade must report idempotency state");
const secondUpgrade = await api("/api/credits", {
  method: "POST",
  body: JSON.stringify({ action: "simulate-upgrade" }),
});
expectStatus(secondUpgrade, 200, "duplicate demo upgrade");
assert.equal(secondUpgrade.body.idempotent, true, "demo upgrade must be idempotent");
assert.equal(Number(secondUpgrade.body.credits), Number(firstUpgrade.body.credits), "duplicate demo upgrade must not pay twice");

const exhaustedUserId = process.env.CLUNK_SMOKE_EXHAUSTED_USER_ID ?? `${userId}-exhausted`;
for (let index = 0; index < 25; index += 1) {
  const exhaustedReport = inspectAsset(createAssetBundle(`smoke-exhaust-${index}.glb`, bytes));
  const exhaustedRun = await apiFor(exhaustedUserId, "/api/runs", {
    method: "POST",
    body: JSON.stringify(runPayloadFor(exhaustedReport)),
  });
  expectStatus(exhaustedRun, 200, `exhausted workspace seed ${index + 1}`);
}
const deniedReport = inspectAsset(createAssetBundle("smoke-exhaust-denied.glb", bytes));
const deniedRun = await apiFor(exhaustedUserId, "/api/runs", {
  method: "POST",
  body: JSON.stringify(runPayloadFor(deniedReport)),
});
expectStatus(deniedRun, 402, "no-credit inspection");
const exhaustedRuns = await apiFor(exhaustedUserId, "/api/runs");
expectStatus(exhaustedRuns, 200, "no-credit run history");
const storedExhaustedRunReports = Array.isArray(exhaustedRuns.body.runs)
  ? exhaustedRuns.body.runs.flatMap((run) => {
      try {
        const reportJson = (run as { reportJson?: string }).reportJson;
        return reportJson ? [JSON.parse(reportJson) as { analysisId?: string }] : [];
      } catch {
        return [];
      }
    })
  : [];
assert.equal(storedExhaustedRunReports.some((stored) => stored.analysisId === deniedReport.analysisId), false, "rejected inspection must not create a run record");
const exhaustedCredits = await apiFor(exhaustedUserId, "/api/credits");
expectStatus(exhaustedCredits, 200, "no-credit balance");
assert.equal(Number(exhaustedCredits.body.credits), 0, "exhausted workspace must remain at zero credits");

console.log(JSON.stringify({
  ok: true,
  userId,
  inputHash: report.inputHash,
  firstRunBalance: firstBalance,
  optimizedBalance,
  invalidOptimizationStatus: invalidOptimization.status,
  duplicateUpgradeBalance: Number(secondUpgrade.body.credits),
  noCreditStatus: deniedRun.status,
  exhaustedBalance: Number(exhaustedCredits.body.credits),
  checks: [
    "unauthenticated API rejected",
    "inspection debit exactly once",
    "conflicting idempotency key rejected",
    "tampered inspection digest rejected",
    "same-key concurrent debit exactly once",
    "different-key concurrent balance protected",
    "optimization debit exactly once",
    "invalid optimization did not debit",
    "blocked optimization status preserved",
    "cross-origin write rejected",
    "demo upgrade credited exactly once",
  ],
}));
