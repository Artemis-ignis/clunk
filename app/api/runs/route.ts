import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  errorBody,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
  isSafeRecordId,
  verifyClientLocalInspection,
} from "../_lib/clunk";

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
      return privateJson(
        errorBody("검사 기록에 필요한 항목이 빠졌습니다. 파일을 다시 검사한 뒤 저장해 주세요.", "run_incomplete"),
        { status: 400 },
      );
    }
    if (!/^[a-f0-9]{64}$/.test(payload.inputHash!) || !["glb", "gltf"].includes(payload.format!)) {
      return privateJson(
        errorBody(
          "GLB 또는 GLTF 파일만 저장할 수 있으며, 파일 해시 형식도 올바라야 합니다. 파일을 다시 검사한 뒤 저장해 주세요.",
          "run_invalid_hash",
        ),
        { status: 400 },
      );
    }
    if (!Number.isSafeInteger(payload.byteLength) || Number(payload.byteLength) < 1 || Number(payload.byteLength) > 250_000_000) {
      return privateJson(
        errorBody(
          "파일 크기가 저장 가능한 범위를 벗어났습니다. 1바이트 이상 250MB 이하 파일만 저장할 수 있습니다.",
          "run_invalid_byte_length",
        ),
        { status: 400 },
      );
    }
    if (!["web", "mobile", "pc"].includes(payload.profileId!) || payload.ruleSetId !== "clunk-game-ready-v1") {
      return privateJson(
        errorBody(
          "지원하지 않는 정책 프로필입니다. web, mobile, pc 중 하나를 선택한 뒤 다시 시도해 주세요.",
          "run_unsupported_profile",
        ),
        { status: 400 },
      );
    }
    if (!Number.isInteger(payload.score) || Number(payload.score) < 0 || Number(payload.score) > 100 || !Number.isInteger(payload.hardBlockerCount) || Number(payload.hardBlockerCount) < 0 || !Number.isInteger(payload.findingCount) || Number(payload.findingCount) < 0) {
      return privateJson(
        errorBody("검사 점수나 위반 건수 값이 올바르지 않습니다. 파일을 다시 검사한 뒤 저장해 주세요.", "run_invalid_score"),
        { status: 400 },
      );
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
    const storedReport = {
      ...verified.report,
      verificationMode: "client-local-attested",
      verificationDigest: verified.resultDigest,
    };
    const reportJson = JSON.stringify(storedReport);
    if (reportJson.length > 180_000) {
      return privateJson(
        errorBody(
          "검사 리포트 용량이 저장 한도를 넘었습니다. 에셋을 더 작은 단위로 나눠 검사한 뒤 저장해 주세요.",
          "run_report_too_large",
        ),
        { status: 413 },
      );
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
