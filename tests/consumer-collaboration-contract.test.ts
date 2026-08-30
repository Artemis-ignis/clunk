import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSUMER_VALIDATION_SCHEMA,
  createConsumerValidationReport,
  normalizeConsumerValidationReport,
  type ConsumerAssetRecord,
  type ConsumerProjectRecord,
} from "../packages/core/src/consumer-collaboration";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function file(path: string, sha256: string = HASH_A) {
  return { path, bytes: 128, sha256, hashVerified: true as const };
}

function asset(
  projectId: ConsumerAssetRecord["projectId"],
  id: string,
  kind: ConsumerAssetRecord["kind"],
): ConsumerAssetRecord {
  return {
    id,
    projectId,
    kind,
    role: "runtime asset",
    source: file(`source/${id}`),
    runtime: file(`runtime/${id}`, HASH_B),
    clunk: {
      input: "source",
      targetProfileId: kind === "3d-model" ? "harvest-frontier-web-three" : "yeongheo-pixi-2d",
      ruleSetId: kind === "3d-model" ? "harvest-frontier-runtime-v1" : "pixi-sprite-atlas-v1",
      status: "ENVIRONMENT_UNAVAILABLE",
      productionReady: false,
      inputHash: HASH_A,
    },
    runtimeAttachment: {
      status: "PASS",
      pathPresent: true,
      observation: "LOADED",
      loaded: true,
      evidencePath: `evidence/${id}.json`,
    },
    provenance: {
      status: "PASS",
      refs: [`provenance/${id}.json`],
    },
    integrity: {
      status: "PASS",
      checks: {
        sourceHash: "PASS",
        runtimeHash: "PASS",
      },
    },
  };
}

function project(
  id: ConsumerProjectRecord["id"],
  assets: ConsumerAssetRecord[],
): ConsumerProjectRecord {
  return {
    id,
    name: id === "harvest-frontier" ? "Harvest Frontier" : "FORGE FRONT",
    root: `C:/games/${id}`,
    gitHead: "c".repeat(40),
    dirty: true,
    readOnly: true,
    runtime: {
      status: "PASS",
      scope: "project",
      runId: `${id}-runtime-1`,
      evidencePath: `evidence/${id}-runtime.json`,
      shippedPath: true,
      expectedAssetCount: assets.length,
      loadedAssetCount: assets.length,
      externalRequests: false,
      pageErrors: 0,
      pageWarnings: 0,
      humanReview: "NOT_EVALUATED",
      productionReady: false,
    },
    checks: { sourceCheckout: "PASS" },
    assets,
    status: "PASS_WITH_GAPS",
    limitations: ["Human visual review remains separate."],
  };
}

test("consumer report preserves both game projects and derives truthful readiness", () => {
  const report = createConsumerValidationReport({
    runId: "clunk-consumer-contract-1",
    generatedAt: "2026-08-28T00:00:00.000Z",
    clunk: {
      root: "C:/games/Clunk",
      gitHead: "d".repeat(40),
      coreBuildId: "0.1.0",
    },
    projects: [
      project("harvest-frontier", [asset("harvest-frontier", "tractor.glb", "3d-model")]),
      project("forge-front", [asset("forge-front", "forge-rig.png", "2d-image"), asset("forge-front", "warden.png", "2d-image")]),
    ],
    readOnly: true,
  });

  assert.equal(report.schema, CONSUMER_VALIDATION_SCHEMA);
  assert.equal(report.readOnly, true);
  assert.equal(report.summary.projectCount, 2);
  assert.equal(report.summary.assetCount, 3);
  assert.equal(report.summary.integrityFailureCount, 0);
  assert.equal(report.summary.readiness, "VALIDATED_WITH_GAPS");
  assert.equal(report.projects[0]?.assets[0]?.runtimeAttachment.loaded, true);
  assert.equal(report.projects[1]?.assets[1]?.kind, "2d-image");
});

test("normalization rejects a report that claims production readiness without human review", () => {
  const invalid = createConsumerValidationReport({
    runId: "clunk-consumer-contract-2",
    generatedAt: "2026-08-28T00:00:00.000Z",
    clunk: { root: "C:/games/Clunk", gitHead: "d".repeat(40), coreBuildId: "0.1.0" },
    projects: [
      project("harvest-frontier", [asset("harvest-frontier", "tractor.glb", "3d-model")]),
      project("forge-front", [asset("forge-front", "forge-rig.png", "2d-image")]),
    ],
    readOnly: true,
  });
  invalid.projects[0]!.runtime.productionReady = true;

  assert.throws(
    () => normalizeConsumerValidationReport(invalid),
    /productionReady cannot be true while humanReview is NOT_EVALUATED/,
  );
});

test("normalization rejects missing or malformed evidence hashes", () => {
  const report = createConsumerValidationReport({
    runId: "clunk-consumer-contract-3",
    generatedAt: "2026-08-28T00:00:00.000Z",
    clunk: { root: "C:/games/Clunk", gitHead: "d".repeat(40), coreBuildId: "0.1.0" },
    projects: [
      project("harvest-frontier", [asset("harvest-frontier", "tractor.glb", "3d-model")]),
      project("forge-front", [asset("forge-front", "forge-rig.png", "2d-image")]),
    ],
    readOnly: true,
  });
  report.projects[0]!.assets[0]!.source.sha256 = "not-a-hash";

  assert.throws(
    () => normalizeConsumerValidationReport(report),
    /source\.sha256 must be a 64-character hexadecimal hash/,
  );
});
