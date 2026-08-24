import assert from "node:assert/strict";
import test from "node:test";
import { parseAssetInspectionEvidencePayload } from "../app/api/_lib/asset-inspection-evidence";
import { createAssetBundle, createAssetInspectionEvidenceV2, inspectAsset } from "../packages/core/src/index";

test("asset inspection evidence API parser accepts v2 and preserves the visual boundary", () => {
  const bytes = new Uint8Array([1]);
  // The parser test uses a real report shape from the deterministic Core sample fixture.
  const report = inspectAsset(createAssetBundle("fixture.glb", bytes));
  const evidence = createAssetInspectionEvidenceV2(report, { inspectionRunId: "api-fixture-01" });
  const parsed = parseAssetInspectionEvidencePayload({ evidence });
  assert.equal(parsed.schema, "clunk.asset-inspection-evidence.v2");
  assert.equal(parsed.statuses.visualRuntime, "GAP");
  assert.equal(parsed.statuses.playerFacing, "NOT_EVALUATED");
});

test("asset inspection evidence API parser rejects malformed identity instead of storing it", () => {
  assert.throws(
    () => parseAssetInspectionEvidencePayload({ schema: "clunk.asset-inspection-evidence.v2", schemaVersion: "2", evidenceKind: "CONTRACT_FIXTURE" }),
    /Invalid asset inspection evidence: identity is required/,
  );
});
