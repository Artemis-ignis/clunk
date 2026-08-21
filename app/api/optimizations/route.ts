import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  errorBody,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
  verifyClientLocalInspection,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{
      optimizationId?: string;
      assetId?: string;
      sourceHash?: string;
      outputHash?: string;
      operations?: unknown;
      passport?: unknown;
      reinspection?: unknown;
    }>(request);
    if (
      !isSafeRecordId(payload.optimizationId) ||
      !isSafeRecordId(payload.assetId) ||
      typeof payload.sourceHash !== "string" ||
      typeof payload.outputHash !== "string"
    ) {
      return privateJson(
        errorBody("최적화 기록에 필요한 항목이 빠졌습니다. 최적화를 다시 실행한 뒤 저장해 주세요.", "optimization_incomplete"),
        { status: 400 },
      );
    }
    if (!/^[a-f0-9]{64}$/.test(payload.sourceHash) || !/^[a-f0-9]{64}$/.test(payload.outputHash) || payload.sourceHash === payload.outputHash) {
      return privateJson(
        errorBody(
          "최적화 전후 파일 해시가 올바르지 않거나 서로 같습니다. 실제로 변경된 결과물로 다시 저장해 주세요.",
          "optimization_invalid_hashes",
        ),
        { status: 400 },
      );
    }
    const reinspection = payload.reinspection as {
      analysisId?: string;
      fileName?: string;
      format?: string;
      byteLength?: number;
      inputHash?: string;
      profileId?: string;
      ruleSetId?: string;
      findings?: unknown[];
      score?: { score?: number; hardBlockerCount?: number; ready?: boolean };
    } | undefined;
    if (
      !reinspection ||
      !isSafeRecordId(reinspection.analysisId) ||
      typeof reinspection.fileName !== "string" ||
      reinspection.fileName.length < 1 ||
      reinspection.fileName.length > 255 ||
      !["glb", "gltf"].includes(reinspection.format ?? "") ||
      !Number.isSafeInteger(reinspection.byteLength) ||
      Number(reinspection.byteLength) < 1 ||
      Number(reinspection.byteLength) > 250_000_000 ||
      !/^[a-f0-9]{64}$/.test(reinspection.inputHash ?? "") ||
      reinspection.inputHash !== payload.outputHash ||
      !["web", "mobile", "pc"].includes(reinspection.profileId ?? "") ||
      reinspection.ruleSetId !== "clunk-game-ready-v1" ||
      !Array.isArray(reinspection.findings) ||
      !reinspection.score ||
      !Number.isInteger(reinspection.score.score) ||
      Number(reinspection.score.score) < 0 ||
      Number(reinspection.score.score) > 100 ||
      !Number.isInteger(reinspection.score.hardBlockerCount) ||
      Number(reinspection.score.hardBlockerCount) < 0
    ) {
      return privateJson(
        errorBody(
          "최적화 결과물을 다시 검사한 리포트가 필요하며, 그 리포트가 결과물 해시와 일치해야 합니다. 결과물을 재검사한 뒤 저장해 주세요.",
          "optimization_reinspection_required",
        ),
        { status: 400 },
      );
    }
    const verifiedReinspection = verifyClientLocalInspection(payload.reinspection, {
      analysisId: reinspection.analysisId!,
      fileName: reinspection.fileName,
      format: reinspection.format as "glb" | "gltf",
      byteLength: Number(reinspection.byteLength),
      inputHash: reinspection.inputHash!,
      profileId: reinspection.profileId as "web" | "mobile" | "pc",
      ruleSetId: reinspection.ruleSetId!,
      score: Number(reinspection.score.score),
      hardBlockerCount: Number(reinspection.score.hardBlockerCount),
      findingCount: reinspection.findings.length,
    });
    const verifiedReport = verifiedReinspection.report;
    const verifiedScore = verifiedReport.score as { score: number; hardBlockerCount: number; ready: boolean };
    const verifiedFindings = verifiedReport.findings as unknown[];
    const operations = payload.operations;
    const allowedOperationIds = new Set(["prune-empty-nodes", "dedupe-materials", "clean-metadata", "repack"]);
    if (
      !Array.isArray(operations) ||
      operations.some((operation) => {
        if (!operation || typeof operation !== "object" || Array.isArray(operation)) return true;
        const record = operation as Record<string, unknown>;
        return (
          !allowedOperationIds.has(String(record.id)) ||
          typeof record.description !== "string" ||
          !Number.isSafeInteger(record.count) ||
          Number(record.count) < 1 ||
          !["lossless", "metadata-only"].includes(String(record.safety))
        );
      })
    ) {
      return privateJson(
        errorBody(
          "v1에서 허용하지 않는 최적화 작업이 포함되어 있습니다. 기본 무손실 최적화만 사용한 뒤 다시 저장해 주세요.",
          "optimization_operation_not_allowed",
        ),
        { status: 400 },
      );
    }
    const passport = payload.passport;
    if (
      !passport ||
      typeof passport !== "object" ||
      Array.isArray(passport) ||
      (passport as Record<string, unknown>).sourceHash !== payload.sourceHash ||
      (passport as Record<string, unknown>).outputHash !== payload.outputHash ||
      (passport as Record<string, unknown>).outputInspectionDigest !== verifiedReinspection.resultDigest ||
      typeof (passport as Record<string, unknown>).passportId !== "string"
    ) {
      return privateJson(
        errorBody(
          "결과물 재검사와 연결된 Passport가 필요합니다. 최적화를 다시 실행해 Passport를 새로 발급한 뒤 저장해 주세요.",
          "optimization_passport_required",
        ),
        { status: 400 },
      );
    }
    const storedReinspection = {
      ...verifiedReport,
      verificationMode: "client-local-attested",
      verificationDigest: verifiedReinspection.resultDigest,
    };
    const storedPassport = {
      ...(passport as Record<string, unknown>),
      verificationMode: "client-local-attested",
    };
    const operationJson = JSON.stringify(operations);
    const passportJson = JSON.stringify(storedPassport);
    const reinspectionJson = JSON.stringify(storedReinspection);
    if (operationJson.length > 50_000 || passportJson.length > 180_000 || reinspectionJson.length > 180_000) {
      return privateJson(
        errorBody(
          "최적화 증빙 데이터 용량이 저장 한도를 넘었습니다. 에셋을 더 작은 단위로 나눠 처리한 뒤 저장해 주세요.",
          "optimization_evidence_too_large",
        ),
        { status: 413 },
      );
    }
    const db = getRuntimeDb();
    const asset = await db
      .prepare(`SELECT id, sha256 FROM clunk_assets WHERE id = ? AND workspace_id = ?`)
      .bind(payload.assetId, workspaceId)
      .first<{ id: string; sha256: string }>();
    if (!asset) {
      return privateJson(
        errorBody(
          "이 워크스페이스에서 해당 에셋을 찾을 수 없습니다. 원본 파일을 먼저 검사해 저장한 뒤 최적화를 저장해 주세요.",
          "asset_not_found",
        ),
        { status: 404 },
      );
    }
    if (asset.sha256 !== payload.sourceHash) {
      return privateJson(
        errorBody(
          "최적화한 원본 파일이 워크스페이스에 저장된 에셋과 일치하지 않습니다. 같은 원본 파일로 다시 실행해 주세요.",
          "optimization_source_mismatch",
        ),
        { status: 400 },
      );
    }
    const outputAssetId = scopedStorageId("asset", workspaceId, payload.outputHash);
    const outputAnalysisStorageId = scopedStorageId("analysis", workspaceId, reinspection.analysisId!);
    const optimizationStorageId = scopedStorageId("optimization", workspaceId, payload.optimizationId!);
    const passportStorageId = scopedStorageId("passport", workspaceId, payload.optimizationId!);
    const persistedStatus = verifiedScore.ready === true && Number(verifiedScore.hardBlockerCount) === 0 ? "ready" : "blocked";
    const credit = await applyCreditOperation(
      db,
      workspaceId,
      {
        key: `optimize:${payload.optimizationId}`,
        fingerprint: canonicalFingerprint({
          kind: "optimize",
          optimizationId: payload.optimizationId,
          assetId: payload.assetId,
          sourceHash: payload.sourceHash,
          outputHash: payload.outputHash,
          operations,
          passport: storedPassport,
          reinspection: verifiedReport,
        }),
        kind: "optimize",
        amount: -1,
      },
      (operationId) => {
        const statements: D1PreparedStatement[] = [
          db
            .prepare(
              `INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256)
               SELECT ?, ?, ?, ?, ?, ?
               WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
            )
            .bind(outputAssetId, workspaceId, reinspection.fileName, reinspection.format, Number(reinspection.byteLength), payload.outputHash, operationId, workspaceId),
          db
            .prepare(
              `INSERT OR IGNORE INTO clunk_analysis_runs (id, workspace_id, asset_id, input_hash, profile_id, rule_set_id, status, score, hard_blocker_count, finding_count, report_json)
               SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
               WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
            )
            .bind(
              outputAnalysisStorageId,
              workspaceId,
              outputAssetId,
              payload.outputHash,
              reinspection.profileId,
              reinspection.ruleSetId,
              persistedStatus,
              Number(verifiedScore.score),
              Number(verifiedScore.hardBlockerCount),
              verifiedFindings.length,
              reinspectionJson,
              operationId,
              workspaceId,
            ),
          db
            .prepare(
              `INSERT OR IGNORE INTO clunk_optimization_runs (id, workspace_id, asset_id, source_hash, output_hash, status, operations_json)
               SELECT ?, ?, ?, ?, ?, ?, ?
               WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
            )
            .bind(optimizationStorageId, workspaceId, payload.assetId, payload.sourceHash, payload.outputHash, persistedStatus, operationJson, operationId, workspaceId),
        ];
        if (payload.passport) {
          statements.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO clunk_passports (id, workspace_id, asset_id, optimization_run_id, source_hash, output_hash, passport_json)
                 SELECT ?, ?, ?, ?, ?, ?, ?
                 WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
              )
              .bind(passportStorageId, workspaceId, payload.assetId, optimizationStorageId, payload.sourceHash, payload.outputHash, passportJson, operationId, workspaceId),
          );
        }
        return statements;
      },
    );
    return privateJson({ ok: true, optimizationId: payload.optimizationId, reinspectionId: reinspection.analysisId, credits: credit.balance, idempotent: credit.idempotent, verificationMode: "client-local-attested", status: persistedStatus });
  } catch (error) {
    return jsonError(error);
  }
}
