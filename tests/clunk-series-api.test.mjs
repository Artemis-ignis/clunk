import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/series/route.ts", import.meta.url);

test("series API is authenticated, same-origin, and uses Clunk-native jobs", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /requireClunkContext/);
  assert.match(source, /assertSameOrigin/);
  assert.match(source, /createClunkSeriesJob/);
  assert.match(source, /createSeriesBundle/);
  assert.match(source, /clunk-series-native-v1/);
  assert.match(source, /hasRuntimeAssets/);
  assert.match(source, /STORAGE_NOT_CONFIGURED/);
  assert.match(source, /storageStatus: "UNAVAILABLE"/);
  assert.match(source, /크레딧은 차감되지 않았습니다/);
  const blockedGuard = source.indexOf('if (job.status === "BLOCKED")');
  const bundleCreation = source.indexOf("const bundle = createSeriesBundle(job)");
  const firstAssetPut = source.indexOf("bucket.put");
  const storageGuard = source.indexOf("if (!hasRuntimeAssets())");
  assert.ok(blockedGuard > 0 && blockedGuard < bundleCreation, "blocked jobs must be handled before bundle creation");
  assert.ok(blockedGuard < firstAssetPut, "blocked jobs must be handled before R2 writes");
  assert.ok(storageGuard > blockedGuard && storageGuard < firstAssetPut, "storage must be required before R2 writes and after blocked handling");
  assert.match(source, /storage_status/);
  assert.match(source, /'BLOCKED'/);
  assert.match(source, /artifacts: \[\]/);
  assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/\.\.\/packages\/clunk-series\/src["']/);
  assert.doesNotMatch(source, /packages\/clunk-series\/src\/mesh-lab/);
  assert.doesNotMatch(source, /fal-ai|TRELLIS|fetch\(/i);
});

test("series API persists the series identity through the existing generation and artifact tables", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /clunk_generation_jobs/);
  assert.match(source, /clunk_asset_artifacts/);
  assert.match(source, /seriesId/);
  assert.match(source, /provenanceJson/);
  assert.match(source, /reserveCreditOperation/);
  assert.match(source, /confirmCreditOperation/);
  assert.match(source, /refundCreditOperation/);
  assert.match(source, /readIdempotencyKey/);
  assert.match(source, /verifyStorageEvidence/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /stored\.size|byteLength/);
  assert.doesNotMatch(source, /applyCreditOperation/);
  assert.doesNotMatch(source, /payload\.(artifactStored|storageAvailable)/);
  assert.doesNotMatch(source, /const storageAvailable/);
  assert.match(source, /storageStatus/);

  const blockedGuard = source.indexOf('if (job.status === "BLOCKED")');
  const firstAssetPut = source.indexOf("bucket.put");
  const bundleCreation = source.indexOf("const bundle = createSeriesBundle(job)");
  const storageProof = source.indexOf("storageStatus = await verifyStorageEvidence");
  const confirmation = source.indexOf("const confirmation = await confirmCreditOperation");
  assert.ok(storageProof >= 0, "series must reopen every R2 object before confirmation");
  assert.ok(confirmation > storageProof, "credit confirmation must follow storage evidence");
  const reservation = source.indexOf("const reservation = await reserveCreditOperation");
  assert.ok(reservation > bundleCreation, "credit reservation must happen after native authoring");
  assert.ok(reservation < firstAssetPut, "credit reservation must happen before storage writes");
  assert.ok(blockedGuard < reservation, "blocked jobs must not reserve credits");
  assert.match(source, /key: `series:\$\{idempotencyKey\}`/);
  assert.match(source, /status = 'applied'/);
  assert.match(source, /persistenceStatements/);
  assert.match(source, /storageVerified/);
  assert.match(source, /if \(creditOperationId\)/);
});
