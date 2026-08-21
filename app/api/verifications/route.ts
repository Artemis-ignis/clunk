/*
 * POST /api/verifications — opt-in server verification.
 *
 * This is the only Clunk endpoint that ever receives asset bytes, and it is entered only when the
 * user explicitly asks for a server-verified passport. Everything else in the product stays
 * local-first.
 *
 * BYTE RETENTION: none. The uploaded bytes exist only inside `inspectUploadedAsset` below, which
 * returns an InspectionReport — numbers, rule ids, and hashes. After it returns there is no
 * reference to the buffer anywhere in this module, and no statement in this file writes bytes to
 * D1 or anywhere else. The deployment has no object store at all (`.openai/hosting.json` sets
 * `"r2": null`), so there is not even a binding an accidental write could target. What persists is
 * the sha256, the derived report, and the signed passport.
 */
import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  errorBody,
  getRuntimeDb,
  jsonError,
  privateJson,
  requireClunkContext,
  scopedStorageId,
  ClunkHttpError,
} from "../_lib/clunk";
import {
  MAX_VERIFICATION_UPLOAD_BYTES,
  VERIFICATION_CREDIT_COST,
  formatMegabytes,
  issueVerificationPassport,
  requireVerificationKeys,
} from "../_lib/server-verification";
import { SERVER_VERIFIED_MODE } from "../../../packages/core/src/verification";
import {
  createAssetBundle,
  inspectAsset,
  type InspectionReport,
  type ProfileId,
} from "../../../packages/core/src/index";

export const dynamic = "force-dynamic";

const PROFILE_IDS: ProfileId[] = ["web", "mobile", "pc"];

/** Advertise the policy so a client can refuse an oversized file before uploading it. */
export async function GET() {
  try {
    const keys = requireVerificationKeys();
    return privateJson({
      ok: true,
      enabled: true,
      algorithm: keys.algorithm,
      keyId: keys.keyId,
      publicKeyUrl: "/.well-known/clunk-verification-key",
      maxUploadBytes: MAX_VERIFICATION_UPLOAD_BYTES,
      creditCost: VERIFICATION_CREDIT_COST,
      acceptedFormats: ["glb", "gltf"],
      profileIds: PROFILE_IDS,
      bytesRetained: false,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    // Key first: a disabled server must say so before the user spends bandwidth on an upload.
    const keys = requireVerificationKeys();

    // Cheapest possible rejection. The body is the raw asset, so content-length is the file size
    // exactly and an oversized upload never gets read into memory at all.
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_VERIFICATION_UPLOAD_BYTES) {
      return privateJson(
        errorBody(
          `서버 검증은 ${formatMegabytes(MAX_VERIFICATION_UPLOAD_BYTES)} 이하 파일만 받습니다. 이 요청은 약 ${formatMegabytes(declaredLength)}입니다. 에셋을 나누거나 로컬 검사를 사용해 주세요.`,
          "verification_upload_too_large",
          { maxUploadBytes: MAX_VERIFICATION_UPLOAD_BYTES },
        ),
        { status: 413 },
      );
    }

    const inspected = await inspectUploadedAsset(request);
    if ("errorResponse" in inspected) return inspected.errorResponse;
    const { report, inspectedAt } = inspected;

    // Same rule as the local-inspection path: an unreadable file is not a billable run.
    const parseFailure = report.findings.find(
      (finding) => finding.ruleId === "FORMAT-PARSE" || finding.ruleId === "INPUT-MISSING",
    );
    if (parseFailure) {
      return privateJson(
        errorBody(
          `이 파일은 glTF 2.0으로 읽을 수 없어 서버 검증 Passport를 발급하지 않았습니다. 크레딧은 차감되지 않았습니다. (${parseFailure.message})`,
          "verification_unparseable",
        ),
        { status: 422 },
      );
    }

    const passport = await issueVerificationPassport(
      report,
      keys,
      new URL(request.url).origin,
      inspectedAt,
    );
    const passportJson = JSON.stringify(passport);
    const storedReport = {
      ...report,
      verificationMode: SERVER_VERIFIED_MODE,
      verificationDigest: report.resultDigest,
      verificationKeyId: keys.keyId,
      verifiedAt: inspectedAt,
    };
    const reportJson = JSON.stringify(storedReport);
    if (reportJson.length > 180_000 || passportJson.length > 180_000) {
      return privateJson(
        errorBody(
          "검사 리포트 용량이 저장 한도를 넘었습니다. 에셋을 더 작은 단위로 나눠 검증해 주세요. 크레딧은 차감되지 않았습니다.",
          "verification_report_too_large",
        ),
        { status: 413 },
      );
    }

    const db = getRuntimeDb();
    const assetId = scopedStorageId("asset", workspaceId, report.inputHash);
    const analysisStorageId = scopedStorageId("analysis", workspaceId, report.analysisId);
    const passportStorageId = scopedStorageId("verification", workspaceId, passport.passportId);
    const status = report.score.ready && report.score.hardBlockerCount === 0 ? "ready" : "blocked";
    // The analysis id is a pure function of the bytes and the resolved rules, so re-verifying the
    // same asset with the same profile reuses this key and cannot double-charge.
    const credit = await applyCreditOperation(
      db,
      workspaceId,
      {
        key: `verify:${report.analysisId}`,
        fingerprint: canonicalFingerprint({
          kind: "server-verify",
          analysisId: report.analysisId,
          inputHash: report.inputHash,
          profileId: report.profileId,
          ruleSetId: report.ruleSetId,
          resultDigest: report.resultDigest,
          keyId: keys.keyId,
        }),
        kind: "server-verify",
        amount: -VERIFICATION_CREDIT_COST,
      },
      (operationId) => [
        db
          .prepare(
            `INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256)
             SELECT ?, ?, ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
          )
          .bind(assetId, workspaceId, report.fileName, report.format, report.byteLength, report.inputHash, operationId, workspaceId),
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
            report.inputHash,
            report.profileId,
            report.ruleSetId,
            status,
            report.score.score,
            report.score.hardBlockerCount,
            report.findings.length,
            reportJson,
            operationId,
            workspaceId,
          ),
        // Source and output hash are the same value on purpose: server verification inspects an
        // asset, it never transforms one. `optimization_run_id` stays NULL for the same reason.
        db
          .prepare(
            `INSERT OR IGNORE INTO clunk_passports (id, workspace_id, asset_id, optimization_run_id, source_hash, output_hash, passport_json)
             SELECT ?, ?, ?, NULL, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
          )
          .bind(passportStorageId, workspaceId, assetId, report.inputHash, report.inputHash, passportJson, operationId, workspaceId),
      ],
    );

    return privateJson({
      ok: true,
      verificationMode: SERVER_VERIFIED_MODE,
      assetId,
      analysisId: report.analysisId,
      passportId: passport.passportId,
      keyId: keys.keyId,
      algorithm: keys.algorithm,
      status,
      credits: credit.balance,
      creditCost: VERIFICATION_CREDIT_COST,
      idempotent: credit.idempotent,
      bytesRetained: false,
      passport,
      report: storedReport,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Read the uploaded body and inspect it here, on the server, with Clunk's own Core.
 *
 * The asset bytes never leave this function: the only thing that escapes is the report, which
 * holds counts, rule ids, and the sha256 of what was read. `bundle` and `bytes` go out of scope
 * when this returns, and nothing above stores them.
 */
async function inspectUploadedAsset(
  request: Request,
): Promise<{ report: InspectionReport; inspectedAt: string } | { errorResponse: Response }> {
  /*
   * The body is the raw asset, not multipart.
   *
   * Not a style choice: the app router treats *any* POST with a multipart/form-data body and no
   * action id as a progressive-enhancement Server Action, and rejects it with a plain-text 413
   * at 1MB before the route handler is ever reached. A raw octet-stream body skips that path
   * entirely, and it also avoids buffering the upload twice the way form parsing does.
   */
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/octet-stream") && !contentType.includes("model/gltf")) {
    return {
      errorResponse: privateJson(
        errorBody(
          "서버 검증 요청 본문은 파일 바이트 그대로여야 하며 content-type은 application/octet-stream이어야 합니다.",
          "verification_bad_content_type",
        ),
        { status: 415 },
      ),
    };
  }
  const profileValue = (request.headers.get("x-clunk-profile-id") ?? "").trim();
  if (!PROFILE_IDS.includes(profileValue as ProfileId)) {
    return {
      errorResponse: privateJson(
        errorBody(
          "정책 프로파일은 web, mobile, pc 중 하나여야 합니다. 서버 검증은 내장 프로파일만 사용합니다.",
          "verification_unsupported_profile",
        ),
        { status: 400 },
      ),
    };
  }
  // Percent-encoded UTF-8, matching the convention the identity headers already use, so a Korean
  // file name survives a header that only carries latin-1.
  const rawHeaderName = (request.headers.get("x-clunk-file-name") ?? "").trim();
  let rawName = rawHeaderName;
  try {
    rawName = decodeURIComponent(rawHeaderName);
  } catch {
    rawName = rawHeaderName;
  }
  const fileName = rawName.split(/[\\/]/).pop() ?? "";
  if (!fileName || fileName.length > 255 || !/\.(glb|gltf)$/i.test(fileName)) {
    return {
      errorResponse: privateJson(
        errorBody(
          "x-clunk-file-name 헤더가 없거나 확장자가 .glb / .gltf가 아닙니다. 서버 검증은 자체 완결된 GLB 또는 GLTF만 받습니다.",
          "verification_unsupported_file",
        ),
        { status: 400 },
      ),
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return {
      errorResponse: privateJson(
        errorBody("업로드한 파일을 읽지 못했습니다. 다시 시도해 주세요.", "verification_body_unreadable"),
        { status: 400 },
      ),
    };
  }
  if (bytes.byteLength < 1) {
    return {
      errorResponse: privateJson(
        errorBody("업로드된 내용이 비어 있습니다.", "verification_file_missing"),
        { status: 400 },
      ),
    };
  }
  if (bytes.byteLength > MAX_VERIFICATION_UPLOAD_BYTES) {
    return {
      errorResponse: privateJson(
        errorBody(
          `서버 검증은 ${formatMegabytes(MAX_VERIFICATION_UPLOAD_BYTES)} 이하 파일만 받습니다.`,
          "verification_upload_too_large",
          { maxUploadBytes: MAX_VERIFICATION_UPLOAD_BYTES },
        ),
        { status: 413 },
      ),
    };
  }
  const inspectedAt = new Date().toISOString();
  try {
    const report = inspectAsset(createAssetBundle(fileName, bytes), {
      profileId: profileValue as ProfileId,
    });
    return { report, inspectedAt };
  } catch (error) {
    // inspectAsset already converts parse failures into findings, so reaching here means an
    // unexpected fault. The detail is operator information and stays in the server log.
    console.error("[clunk:verify] server inspection failed", error);
    throw new ClunkHttpError(
      "서버에서 이 파일을 검사하지 못했습니다. 크레딧은 차감되지 않았습니다.",
      500,
      "verification_inspection_failed",
    );
  }
}
