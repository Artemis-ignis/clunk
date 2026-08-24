import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  ClunkHttpError,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
  isSafeRecordId,
  verifyClientLocalInspection,
} from "../_lib/clunk";
import { parseAssetInspectionEvidencePayload } from "../_lib/asset-inspection-evidence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const rows = await db
      .prepare(
        `SELECT r.id AS id, r.asset_id AS assetId, r.input_hash AS inputHash, r.profile_id AS profileId,
          r.rule_set_id AS ruleSetId, r.status AS status, r.score AS score,
          r.hard_blocker_count AS hardBlockerCount, r.finding_count AS findingCount,
          r.report_json AS reportJson, r.created_at AS createdAt,
          a.file_name AS fileName, a.format AS format, a.byte_length AS byteLength
         FROM clunk_analysis_runs r
         LEFT JOIN clunk_assets a ON a.id = r.asset_id AND a.workspace_id = r.workspace_id
         WHERE r.workspace_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 50`,
      )
      .bind(workspaceId)
      .all();
    return privateJson({ ok: true, runs: rows.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{
      analysisId?: string;
      fileName?: string;
      format?: string;
      byteLength?: number;
      inputHash?: string;
      profileId?: string;
      ruleSetId?: string;
      score?: number;
      hardBlockerCount?: number;
      findingCount?: number;
      report?: unknown;
      evidenceV2?: unknown;
    }>(request);
    const fields = [
      payload.analysisId,
      payload.fileName,
      payload.format,
      payload.inputHash,
      payload.profileId,
      payload.ruleSetId,
    ];
    if (
      !isSafeRecordId(payload.analysisId) ||
      typeof payload.fileName !== "string" ||
      payload.fileName.length < 1 ||
      payload.fileName.length > 255 ||
      fields.some((value) => typeof value !== "string" || !value.trim())
    ) {
      return privateJson({ ok: false, error: "Incomplete analysis record." }, { status: 400 });
    }
    if (!/^[a-f0-9]{64}$/.test(payload.inputHash!) || !["glb", "gltf"].includes(payload.format!)) {
      return privateJson({ ok: false, error: "Invalid format or SHA-256 input hash." }, { status: 400 });
    }
    if (!Number.isSafeInteger(payload.byteLength) || Number(payload.byteLength) < 1 || Number(payload.byteLength) > 250_000_000) {
      return privateJson({ ok: false, error: "Invalid asset byte length." }, { status: 400 });
    }
    if (!["web", "mobile", "pc"].includes(payload.profileId!) || payload.ruleSetId !== "clunk-game-ready-v1") {
      return privateJson({ ok: false, error: "Unsupported policy profile." }, { status: 400 });
    }
    if (!Number.isInteger(payload.score) || Number(payload.score) < 0 || Number(payload.score) > 100 || !Number.isInteger(payload.hardBlockerCount) || Number(payload.hardBlockerCount) < 0 || !Number.isInteger(payload.findingCount) || Number(payload.findingCount) < 0) {
      return privateJson({ ok: false, error: "Invalid report counts or score." }, { status: 400 });
    }
    const db = getRuntimeDb();
    const verified = verifyClientLocalInspection(payload.report, {
      analysisId: payload.analysisId!,
      fileName: payload.fileName!,
      format: payload.format as "glb" | "gltf",
      byteLength: Number(payload.byteLength),
      inputHash: payload.inputHash!,
      profileId: payload.profileId as "web" | "mobile" | "pc",
      ruleSetId: payload.ruleSetId!,
      score: Number(payload.score),
      hardBlockerCount: Number(payload.hardBlockerCount),
      findingCount: Number(payload.findingCount),
    });
    const evidenceV2 = payload.evidenceV2 === undefined
      ? undefined
      : parseAssetInspectionEvidencePayload(payload.evidenceV2);
    if (evidenceV2 && (
      evidenceV2.identity.inputHash !== verified.report.inputHash ||
      evidenceV2.identity.resultDigest !== verified.report.resultDigest ||
      evidenceV2.identity.byteLength !== verified.report.byteLength ||
      evidenceV2.identity.coreBuildId !== verified.report.coreVersion ||
      evidenceV2.identity.ruleSetId !== verified.report.ruleSetId ||
      evidenceV2.identity.ruleSetVersion !== verified.report.ruleSetVersion ||
      evidenceV2.identity.profileId !== verified.report.profileId ||
      evidenceV2.report.resultDigest !== verified.report.resultDigest
    )) {
      throw new ClunkHttpError("evidenceV2 identity must match the locally verified report.", 400);
    }
    const storedReport = {
      ...verified.report,
      ...(evidenceV2 ? { evidenceV2 } : {}),
      verificationMode: "client-local-attested",
      verificationDigest: verified.resultDigest,
    };
    const reportJson = JSON.stringify(storedReport);
    if (reportJson.length > 180_000) {
      return privateJson({ ok: false, error: "Analysis report is too large." }, { status: 413 });
    }
    const verifiedScore = verified.report.score as { ready: boolean };
    const persistedStatus = verifiedScore.ready === true && Number(payload.hardBlockerCount) === 0 ? "ready" : "blocked";
    const assetId = scopedStorageId("asset", workspaceId, payload.inputHash!);
    const analysisStorageId = scopedStorageId("analysis", workspaceId, payload.analysisId!);
    const credit = await applyCreditOperation(
      db,
      workspaceId,
      {
        key: `inspect:${payload.analysisId}`,
        fingerprint: canonicalFingerprint({
          kind: "inspect",
          analysisId: payload.analysisId,
          fileName: payload.fileName,
          format: payload.format,
          byteLength: Number(payload.byteLength),
          inputHash: payload.inputHash,
          profileId: payload.profileId,
          ruleSetId: payload.ruleSetId,
          score: Number(payload.score),
          hardBlockerCount: Number(payload.hardBlockerCount),
          findingCount: Number(payload.findingCount),
          evidenceV2: evidenceV2 ?? null,
          report: verified.report,
        }),
        kind: "inspect",
        amount: -1,
      },
      (operationId) => [
      db
        .prepare(
          `INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
        )
        .bind(assetId, workspaceId, payload.fileName, payload.format, Number(payload.byteLength ?? 0), payload.inputHash, operationId, workspaceId),
      db
        .prepare(
          `INSERT OR IGNORE INTO clunk_analysis_runs (id, workspace_id, asset_id, input_hash, profile_id, rule_set_id, status, score, hard_blocker_count, finding_count, report_json)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
        )
        .bind(
          analysisStorageId,
          workspaceId,
          assetId,
          payload.inputHash,
          payload.profileId,
          payload.ruleSetId,
          persistedStatus,
          Number(payload.score ?? 0),
          Number(payload.hardBlockerCount ?? 0),
          Number(payload.findingCount ?? 0),
          reportJson,
          operationId,
          workspaceId,
        ),
      ],
    );
    return privateJson({ ok: true, assetId, analysisId: payload.analysisId, credits: credit.balance, idempotent: credit.idempotent, verificationMode: "client-local-attested" });
  } catch (error) {
    return jsonError(error);
  }
}
