import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAssetBundle,
  createAssetInspectionEvidenceV2,
  createCustomProfile,
  normalizeAssetInspectionEvidenceV2,
  sha256Hex,
  inspectAsset,
  type CustomProfileDefinition,
} from "../packages/core/src/index";

async function readySample() {
  const bytes = new Uint8Array(await readFile("public/samples/clunk-ready-sample.glb"));
  return { bytes, bundle: createAssetBundle("clunk-ready-sample.glb", bytes) };
}

test("v2 CONTRACT_FIXTURE preserves structural PASS but cannot claim visual approval", async () => {
  const { bundle } = await readySample();
  const report = inspectAsset(bundle);
  const evidence = createAssetInspectionEvidenceV2(report, {
    evidenceKind: "CONTRACT_FIXTURE",
    inspectionRunId: "fixture-ready-01",
  });

  assert.equal(evidence.schema, "clunk.asset-inspection-evidence.v2");
  assert.equal(evidence.identity.inputHash, report.inputHash);
  assert.equal(evidence.identity.resultDigest, report.resultDigest);
  assert.equal(evidence.identity.byteLength, report.byteLength);
  assert.equal(evidence.identity.coreBuildId, report.coreVersion);
  assert.equal(evidence.identity.inspectionRunId, "fixture-ready-01");
  assert.equal(evidence.statuses.structural, "PASS");
  assert.equal(evidence.statuses.visualRuntime, "GAP");
  assert.equal(evidence.statuses.playerFacing, "NOT_EVALUATED");
  assert.equal(evidence.statuses.humanDecision, "NOT_EVALUATED");
  assert.equal(evidence.readiness, "conditional");
  assert.equal(evidence.limitation, "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL");
  assert.ok(evidence.findings.some((finding) => finding.code === "OBS-TEXTURE-COUNT"));
  assert.ok(evidence.findings.every((finding) => finding.rationale && finding.recommendation && finding.ownership && finding.enforcement));
});

test("quality policy modes are explicit and do not rewrite the legacy score", async () => {
  const { bundle } = await readySample();
  const profile = createCustomProfile({
    id: "v2-policy-test",
    version: "1.0.0",
    basedOn: "pc",
    qualityPolicy: {
      requireTextures: { value: true, mode: "ADVISORY", rationale: "The sample may be procedural." },
      requireRuntimeEvidence: { value: true, mode: "BLOCKING" },
    },
  } satisfies CustomProfileDefinition);
  const report = inspectAsset(bundle, { customProfile: profile });
  assert.equal(report.score.ready, true);
  assert.equal(report.qualityPolicy?.requireRuntimeEvidence?.mode, "BLOCKING");
  const evidence = createAssetInspectionEvidenceV2(report, {
    evidenceKind: "CONTRACT_FIXTURE",
    inspectionRunId: "fixture-policy-01",
  });
  assert.equal(evidence.statuses.structural, "PASS");
  assert.equal(evidence.qualityPolicy.status, "BLOCKED");
  assert.equal(evidence.qualityPolicy.blockingViolationCount, 1);
  assert.equal(evidence.readiness, "blocked");
  assert.equal(evidence.findings.find((finding) => finding.code === "OBS-RUNTIME-EVIDENCE")?.enforcement, "BLOCKING");
  assert.equal(evidence.findings.find((finding) => finding.code === "OBS-RUNTIME-EVIDENCE")?.severity, "ERROR");
});

test("PLAYER_FACING_CAPTURE requires a real hashed capture and keeps human decision separate", async () => {
  const { bytes, bundle } = await readySample();
  const report = inspectAsset(bundle);
  const capture = {
    media: "screenshot" as const,
    path: "C:/evidence/hf/no-hud.png",
    sha256: sha256Hex(new Uint8Array([1, 2, 3])),
    bytes: 3,
    renderer: "WEBGPU",
    viewport: { width: 1920, height: 1080 },
    cameraPoseHash: "c".repeat(64),
    sourceTreeHash: "a".repeat(64),
    shippedPath: true,
    console: { errors: 0, warnings: 0 },
  };
  assert.throws(
    () => createAssetInspectionEvidenceV2(report, { evidenceKind: "PLAYER_FACING_CAPTURE", inspectionRunId: "capture-missing" }),
    /requires at least one screenshot or frame capture/,
  );
  const evidence = createAssetInspectionEvidenceV2(report, {
    evidenceKind: "PLAYER_FACING_CAPTURE",
    inspectionRunId: "capture-no-go-01",
    captureEvidence: [capture],
    humanDecision: "NO_GO",
  });
  assert.equal(evidence.statuses.visualRuntime, "GAP");
  assert.equal(evidence.statuses.playerFacing, "NO_GO");
  assert.equal(evidence.statuses.humanDecision, "NO_GO");
  assert.equal(evidence.statuses.reviewStatus, "EVALUATED");
  assert.equal(evidence.readiness, "conditional");
  assert.equal(evidence.source.bytes, bytes.byteLength);
  const normalized = normalizeAssetInspectionEvidenceV2({
    ...evidence,
    statuses: { structural: "PASS", visualRuntime: "APPROVED", playerFacing: "PASS", humanDecision: "PASS", reviewStatus: "EVALUATED" },
  });
  assert.equal(normalized.statuses.visualRuntime, "APPROVED");
  assert.equal(normalized.statuses.playerFacing, "PASS");
});

test("normalization rejects forged validation flags", async () => {
  const { bundle } = await readySample();
  const report = inspectAsset(bundle);
  const evidence = createAssetInspectionEvidenceV2(report, { inspectionRunId: "validation-boundary-01" });
  assert.throws(
    () => normalizeAssetInspectionEvidenceV2({ ...evidence, validation: { valid: false, structuralValid: false, qualityPolicyValid: false } }),
    /validation fields must match/,
  );
});

test("fixture and player evidence lanes reject cross-contamination", async () => {
  const { bundle } = await readySample();
  const report = inspectAsset(bundle);
  const capture = {
    media: "screenshot" as const,
    path: "C:/evidence/capture.png",
    sha256: "b".repeat(64),
    bytes: 1,
  };
  assert.throws(
    () => createAssetInspectionEvidenceV2(report, {
      evidenceKind: "CONTRACT_FIXTURE",
      captureEvidence: [capture],
    }),
    /CONTRACT_FIXTURE cannot carry/,
  );
  assert.throws(
    () => normalizeAssetInspectionEvidenceV2({
      schema: "clunk.asset-inspection-evidence.v2",
      schemaVersion: "2",
      evidenceKind: "PLAYER_FACING_CAPTURE",
      identity: {},
    }),
    /identity\./,
  );
});

test("audio evidence keeps capture bytes separate from measured audio metadata", async () => {
  const { bundle } = await readySample();
  const report = inspectAsset(bundle);
  const evidence = createAssetInspectionEvidenceV2(report, {
    evidenceKind: "CONTRACT_FIXTURE",
    inspectionRunId: "audio-r01",
    audioEvidence: [],
  });
  assert.deepEqual(evidence.audioEvidence, []);
  const audioEvidence = createAssetInspectionEvidenceV2(report, {
    evidenceKind: "PLAYER_FACING_CAPTURE",
    inspectionRunId: "audio-r02",
    captureEvidence: [{
      media: "screenshot",
      path: "C:/evidence/frame.png",
      sha256: "c".repeat(64),
      bytes: 1,
      renderer: "WEBGPU",
      viewport: { width: 1920, height: 1080 },
      cameraPoseHash: "e".repeat(64),
      sourceTreeHash: "f".repeat(64),
      shippedPath: true,
      console: { errors: 0, warnings: 0 },
    }],
    audioEvidence: [{
      media: "audio",
      path: "C:/evidence/hoe.wav",
      sha256: "d".repeat(64),
      bytes: 48000,
      audio: {
        queueId: "hoe-r01",
        channels: 2,
        sampleRateHz: 48000,
        durationMs: 1000,
        rmsDb: -18.2,
        peakDb: -1.1,
        leftRightBalanceDb: -0.4,
      },
    }],
  });
  assert.equal(audioEvidence.audioEvidence[0]?.audio?.queueId, "hoe-r01");
  assert.equal(audioEvidence.audioEvidence[0]?.audio?.sampleRateHz, 48000);
});
