import assert from "node:assert/strict";
import test from "node:test";
import { parseEvidencePayload } from "../app/api/_lib/collaboration-evidence";
import { ClunkHttpError } from "../app/api/_lib/http-error";

const inputHash = "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c";
const resultDigest = "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df";

function manifestWithEvidence(evidenceRef: Record<string, unknown>) {
  return {
    schema: "clunk.frame-manifest.v1",
    runId: "HF-M113-tractor-r01",
    sourceProject: "Harvest Frontier",
    sourceCommit: "7a9433e",
    reviewStatus: "NOT_EVALUATED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    frames: [{ id: "frame", path: "frame.png", hud: "off" }],
    sceneGaps: [],
    assetInspections: [{
      id: "tractor-runtime-r01",
      sourcePath: "public/assets/runtime/tractor.compact.m1.glb",
      inputHash,
      assetKind: "3d-model",
      targetProfileId: "harvest-frontier-runtime-v1",
      inspectionRunId: "analysis-d92ae93240cc-4789a69a",
      evidenceStatus: "CONDITIONAL",
      productionReady: false,
      origin: "file",
      playerFacing: "NOT_EVALUATED",
      evidenceRef,
    }],
  };
}

test("authenticated evidence parser returns normalized asset provenance", () => {
  const parsed = parseEvidencePayload(manifestWithEvidence({
    schema: "clunk.asset-evidence-ref.v1",
    inputHash,
    resultDigest,
    byteLength: 680412,
    coreBuildId: "0.1.0",
    ruleSetId: "harvest-frontier-runtime-v1",
    ruleSetVersion: "0.1.0",
    profileId: "pc",
    freshness: "CURRENT",
  }));

  assert.equal(parsed?.assetInspections?.[0]?.evidenceRef?.resultDigest, resultDigest);
  assert.equal(parsed?.reviewStatus, "NOT_EVALUATED");
  assert.equal(parsed?.visualRuntime, "GAP");
  assert.equal(parsed?.playerFacing, "NOT_EVALUATED");
});

test("authenticated evidence parser maps malformed provenance to HTTP 400", () => {
  assert.throws(
    () => parseEvidencePayload(manifestWithEvidence({
      schema: "clunk.asset-evidence-ref.v1",
      inputHash: "b".repeat(64),
      resultDigest,
      byteLength: 680412,
      coreBuildId: "0.1.0",
      ruleSetId: "harvest-frontier-runtime-v1",
      ruleSetVersion: "0.1.0",
      profileId: "pc",
      freshness: "CURRENT",
    })),
    (error: unknown) => error instanceof ClunkHttpError
      && error.status === 400
      && /evidenceRef\.inputHash must match/.test(error.message),
  );
});

test("current evidence requires the concrete Core profile", () => {
  assert.throws(
    () => parseEvidencePayload(manifestWithEvidence({
      schema: "clunk.asset-evidence-ref.v1",
      inputHash,
      resultDigest,
      byteLength: 680412,
      coreBuildId: "0.1.0",
      ruleSetId: "harvest-frontier-runtime-v1",
      ruleSetVersion: "0.1.0",
      freshness: "CURRENT",
    })),
    (error: unknown) => error instanceof ClunkHttpError
      && error.status === 400
      && /evidenceRef\.profileId is required/.test(error.message),
  );
});
