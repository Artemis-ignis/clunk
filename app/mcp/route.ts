import {
  inspectAssetForTarget,
  type AssetKind,
} from "../../packages/core/src/index";
import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
} from "../../packages/core/src/collaboration-contract";
import { normalizeSpriteSheetReview } from "../../packages/core/src/sprite-sheet-review";
import {
  getRuntimeDb,
  jsonError,
  parseJson,
  scopedStorageId,
} from "../api/_lib/clunk";
import { parseAssetInspectionEvidencePayload } from "../api/_lib/asset-inspection-evidence";
import {
  evidenceJson,
  mergeStoredEvidence,
  parseEvidenceOnlyPayload,
  parseStoredEvidence,
} from "../api/_lib/collaboration";
import { ClunkHttpError } from "../api/_lib/http-error";
import { requireMcpApiKey } from "../api/_lib/mcp-auth";
import {
  MCP_HTTP_ENDPOINT_PATH,
  dispatchMcpRequest,
  type McpJsonRpcResponse,
} from "../api/_lib/mcp-http";
import {
  ASSET_INSPECTION_REQUEST_V1,
  ASSET_INSPECTION_REQUEST_V2,
  parseAssetInspectionRequest,
  summarizeAssetBundle,
} from "../api/assetops/inspect/bundle-contract";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "cache-control": "no-store",
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  return Response.json(
    {
      ok: true,
      schema: "clunk.mcp-http.v1",
      endpoint: `${new URL(request.url).origin}${MCP_HTTP_ENDPOINT_PATH}`,
      transport: "streamable-http",
      authentication: "Authorization: Bearer <Clunk API key>",
      localAssetPaths: "UNAVAILABLE_OVER_HTTP",
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireMcpApiKey(request);
    const dispatch = dispatchMcpRequest(await parseJson<unknown>(request, 70 * 1024 * 1024));
    if (dispatch.kind === "notification") return new Response(null, { status: 202, headers: CORS_HEADERS });
    if (dispatch.kind === "response") return mcpJson(dispatch.response);

    try {
      const result = await runTool(dispatch.name, dispatch.arguments, auth.workspaceId, request);
      return mcpJson({ jsonrpc: "2.0", id: dispatch.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clunk MCP tool call failed.";
      return mcpJson({
        jsonrpc: "2.0",
        id: dispatch.id,
        result: { isError: true, content: [{ type: "text", text: message }] },
      });
    }
  } catch (error) {
    return withCors(jsonError(error));
  }
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  workspaceId: string,
  request: Request,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (name === "clunk_connection_check") {
    return textResult({
      connection: "PASS",
      endpoint: `${new URL(request.url).origin}${MCP_HTTP_ENDPOINT_PATH}`,
      transport: "streamable-http",
      workspaceId,
      remoteTools: [
        "clunk_connection_check",
        "clunk_asset_inspect",
        "clunk_asset_validate",
        "clunk_asset_inspection_evidence",
        "clunk_collaboration_append",
        "clunk_scene_review",
        "clunk_sprite_sheet_review",
      ],
      localAssetPaths: "UNAVAILABLE_OVER_HTTP",
      localFileTransport: "stdio",
      visualBoundary: "structural PASS never promotes visualRuntime/playerFacing/humanDecision",
    });
  }

  if (name === "clunk_asset_inspect" || name === "clunk_asset_validate") {
    const parsed = parseAssetInspectionRequest({
      schema: args.schema ?? (args.files === undefined ? ASSET_INSPECTION_REQUEST_V1 : ASSET_INSPECTION_REQUEST_V2),
      fileName: args.fileName,
      bytesBase64: args.bytesBase64,
      entryFileName: args.entryFileName,
      files: args.files,
      targetProfileId: args.targetProfileId,
      assetKind: args.assetKind as AssetKind | undefined,
      runId: args.runId,
    });
    const evidence = inspectAssetForTarget({
      ...(parsed.runId ? { runId: parsed.runId } : {}),
      sourcePath: `http-upload:${parsed.entryFileName}`,
      fileName: parsed.entryFileName,
      bytes: parsed.entryBytes,
      targetProfileId: parsed.targetProfileId,
      ...(parsed.assetKind ? { assetKind: parsed.assetKind } : {}),
      bundleFiles: parsed.bundleFiles,
    });
    return textResult({
      schema: name === "clunk_asset_validate" ? "clunk.asset-inspection-response.v2" : "clunk.asset-inspection-response.v2",
      operation: name === "clunk_asset_validate" ? "validate" : "inspect",
      evidence,
      bundle: summarizeAssetBundle(parsed),
      source: "HTTP_UPLOAD",
      visualRuntime: "GAP",
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
      rawBytesPersisted: false,
    });
  }

  if (name === "clunk_asset_inspection_evidence") {
    const evidence = parseAssetInspectionEvidencePayload(args.evidence);
    const stored = await persistInspectionEvidence(workspaceId, evidence);
    return textResult({ schema: evidence.schema, evidence, persistence: stored });
  }

  if (name === "clunk_scene_review") {
    const manifest = normalizeFrameManifest(args.manifest);
    const review = evaluatePlayerFacingSceneReview(manifest);
    return textResult({
      schema: "clunk.player-facing-scene-review.v1",
      verificationMode: "DECLARED_METADATA_ONLY",
      review,
      localCaptureRehash: "UNAVAILABLE_OVER_HTTP",
      humanReviewInferred: false,
    });
  }

  if (name === "clunk_sprite_sheet_review") {
    const report = normalizeSpriteSheetReview(args.manifest);
    return textResult({
      schema: "clunk.sprite-sheet-review.v1",
      verificationMode: "DECLARED_METADATA_ONLY",
      report,
      localSheetRehash: "UNAVAILABLE_OVER_HTTP",
      localCliCommand: "npm.cmd run asset:sprite-audit -- validate --input <manifest.json> --format json --required",
      humanReviewInferred: false,
    });
  }

  if (name === "clunk_collaboration_append") {
    const threadId = requireSafeText(args.threadId, "threadId", 256);
    const payload = parseEvidenceOnlyPayload({ evidence: args.evidence, evidenceMode: args.evidenceMode });
    const db = getRuntimeDb();
    const existing = await db
      .prepare(`SELECT id, evidence_json AS evidence FROM clunk_collaboration_threads WHERE id = ? AND workspace_id = ?`)
      .bind(threadId, workspaceId)
      .first<Record<string, unknown>>();
    if (!existing) throw new ClunkHttpError("Collaboration thread not found.", 404);
    const evidence = mergeStoredEvidence(parseStoredEvidence(existing.evidence), payload.evidence, payload.evidenceMode);
    await db
      .prepare(`UPDATE clunk_collaboration_threads SET evidence_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`)
      .bind(evidenceJson(evidence ?? undefined), threadId, workspaceId)
      .run();
    return textResult({ threadId, evidence, evidenceMode: payload.evidenceMode, statusPromotion: "NONE" });
  }

  throw new ClunkHttpError("Unknown Clunk HTTP MCP tool.", 400);
}

async function persistInspectionEvidence(workspaceId: string, evidence: ReturnType<typeof parseAssetInspectionEvidencePayload>) {
  const db = getRuntimeDb();
  const assetId = scopedStorageId("asset", workspaceId, evidence.identity.inputHash);
  const analysisId = scopedStorageId("analysis", workspaceId, `${evidence.identity.inspectionRunId}:${evidence.identity.resultDigest}`);
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(assetId, workspaceId, evidence.source.fileName, evidence.report.format, evidence.identity.byteLength, evidence.identity.inputHash),
    db
      .prepare(
        `INSERT OR REPLACE INTO clunk_analysis_runs
         (id, workspace_id, asset_id, input_hash, profile_id, rule_set_id, status, score, hard_blocker_count, finding_count, report_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        analysisId,
        workspaceId,
        assetId,
        evidence.identity.inputHash,
        evidence.identity.profileId,
        evidence.identity.ruleSetId,
        evidence.validation.valid ? "PASS" : "FAIL",
        evidence.report.score.score,
        evidence.report.score.hardBlockerCount,
        evidence.findings.length,
        JSON.stringify(evidence),
      ),
  ]);
  return { stored: true, assetId, analysisId, rawBytesPersisted: false };
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function requireSafeText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength || !/^[a-zA-Z0-9:._-]+$/.test(value)) {
    throw new ClunkHttpError(`Invalid ${field}.`, 400);
  }
  return value;
}

function mcpJson(response: McpJsonRpcResponse): Response {
  return Response.json(response, { headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
