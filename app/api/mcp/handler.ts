import {
  inspectAsset,
  inspectAssetForTarget,
  type AssetKind,
} from "../../../packages/core/src/index";
import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
} from "../../../packages/core/src/collaboration-contract";
import { normalizeSpriteSheetReview } from "../../../packages/core/src/sprite-sheet-review";
import {
  getRuntimeDb,
  jsonError,
  parseJson,
  scopedStorageId,
} from "../_lib/clunk";
import { parseAssetInspectionEvidencePayload } from "../_lib/asset-inspection-evidence";
import {
  evidenceJson,
  mergeStoredEvidence,
  parseEvidenceOnlyPayload,
  parseStoredEvidence,
} from "../_lib/collaboration";
import { ClunkHttpError } from "../_lib/http-error";
import { requireMcpApiKey } from "../_lib/mcp-auth";
import {
  MCP_HTTP_ENDPOINT_PATH,
  MCP_HTTP_TARGET_PROFILE_IDS,
  MCP_HTTP_TOOLS,
  dispatchMcpRequest,
  type McpJsonRpcResponse,
} from "../_lib/mcp-http";
import {
  ASSET_INSPECTION_REQUEST_V1,
  ASSET_INSPECTION_REQUEST_V2,
  parseAssetInspectionRequest,
  summarizeAssetBundle,
} from "../assetops/inspect/bundle-contract";
import {
  CATALOG_THEME_IDS,
  GRADE_RULE_EN,
  factsOfListing,
  findCatalogListing,
  nearbySlugs,
  searchCatalog,
} from "./catalog";

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
  const origin = new URL(request.url).origin;

  if (name === "clunk_connection_check") {
    return textResult({
      connection: "PASS",
      endpoint: `${origin}${MCP_HTTP_ENDPOINT_PATH}`,
      transport: "streamable-http",
      workspaceId,
      // 손으로 적어 둔 목록은 도구를 늘릴 때마다 tools/list와 갈라집니다. 같은 상수에서 읽습니다.
      remoteTools: MCP_HTTP_TOOLS.map((tool) => tool.name),
      targetProfileIds: MCP_HTTP_TARGET_PROFILE_IDS,
      catalogue: `${origin}/api/marketplace`,
      localAssetPaths: "UNAVAILABLE_OVER_HTTP",
      localFileTransport: "stdio",
      downloads:
        "clunk_search_assets returns a downloadUrl per asset. Grade B downloads answer with the bytes to anyone (follow the 302); grade A and S need the human's own signed-in browser session and a subscription, and answer 401 to an API key.",
      visualBoundary: "structural PASS never promotes visualRuntime/playerFacing/humanDecision",
    });
  }

  if (name === "clunk_search_assets") {
    const theme = optionalEnum(args.theme, "theme", CATALOG_THEME_IDS);
    const grade = optionalEnum(args.grade, "grade", ["S", "A", "B"]);
    const result = await searchCatalog(
      getRuntimeDb(),
      {
        ...(typeof args.query === "string" ? { query: args.query } : {}),
        ...(theme ? { theme } : {}),
        ...(grade ? { grade } : {}),
        ...(typeof args.maxPolygons === "number" ? { maxPolygons: args.maxPolygons } : {}),
        ...(typeof args.minPolygons === "number" ? { minPolygons: args.minPolygons } : {}),
        ...(args.hasAnimation === true ? { hasAnimation: true } : {}),
        ...(args.freeOnly === true ? { freeOnly: true } : {}),
        ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
      },
      origin,
    );
    return textResult({
      schema: "clunk.mcp-asset-search.v1",
      ...result,
      // 0건일 때 "없다"만 말하면 에이전트는 같은 질의를 반복합니다. 다음 수를 적어 둡니다.
      ...(result.count === 0
        ? {
            nextStep:
              "Nothing matched. The catalogue is Korean, so a free-text query in English often matches nothing — drop `query` and use `theme` plus `maxPolygons` instead. `maxPolygons` also drops any listing whose polygon count was never measured.",
          }
        : {}),
      source: "GET /api/marketplace",
    });
  }

  if (name === "clunk_asset_facts") {
    const slug = requireSlug(args.slug);
    const db = getRuntimeDb();
    const listing = await findCatalogListing(db, slug);
    if (!listing) {
      throw new ClunkHttpError(
        `No published listing has the slug '${slug}'. Call clunk_search_assets to list slugs; the closest published ones are: ${(await nearbySlugs(db, slug)).join(", ")}.`,
        404,
      );
    }
    return textResult({
      schema: "clunk.mcp-asset-facts.v1",
      asset: factsOfListing(listing, origin),
      gradeRule: GRADE_RULE_EN,
      source: "GET /api/marketplace",
    });
  }

  if (name === "clunk_asset_inspect" || name === "clunk_asset_validate") {
    assertUploadedBytes(name, args);
    assertTargetProfile(args.targetProfileId);
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
    // AssetEvidence는 게이트 상태만 싣고 측정 수치는 싣지 않습니다. 2026-09-05 실측: 에이전트가
    // "이 GLB 폴리곤 몇 개냐"를 물으면 응답 어디에도 답이 없었습니다. 모델일 때는 같은
    // 바이트를 구조 검사기에도 통과시켜 metrics와 점수를 함께 돌려줍니다.
    const structural = structuralReportFor(parsed.entryFileName, parsed.bundleFiles);
    const blocking = (structural?.findings ?? []).filter((item) => item.severity === "ERROR");
    return textResult({
      schema: "clunk.asset-inspection-response.v2",
      operation: name === "clunk_asset_validate" ? "validate" : "inspect",
      ...(name === "clunk_asset_validate"
        ? {
            // /agents가 이 도구에 대해 "valid, score, hardBlockers"를 약속하고 있었는데
            // 응답에는 그 셋 중 무엇도 없었습니다. 약속한 것을 실제로 싣습니다.
            valid: structural
              ? structural.score.hardBlockerCount === 0
              : evidence.status !== "BLOCKED" && evidence.status !== "UNSUPPORTED",
            score: structural?.score.score ?? null,
            hardBlockerCount: structural?.score.hardBlockerCount ?? null,
            blockingFindings: blocking,
            scoreBasis: structural
              ? "clunk-game-ready-v1 structural rules over the uploaded bytes"
              : "no structural score: this asset kind is not scored by the 3D rule set",
          }
        : {}),
      evidence,
      ...(structural ? { metrics: structural.metrics } : {}),
      bundle: summarizeAssetBundle(parsed),
      source: "HTTP_UPLOAD",
      visualRuntime: "GAP",
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
      reviewBoundary:
        "These three stay unevaluated on purpose: nothing here rendered the asset. A structural pass is not a statement that it looks right in a game.",
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
    if (!existing) {
      throw new ClunkHttpError(
        `No collaboration thread '${threadId}' in this workspace. Threads are created from the Clunk workspace UI or POST /api/collaboration, not by this tool; check the id, or create the thread first.`,
        404,
      );
    }
    const evidence = mergeStoredEvidence(parseStoredEvidence(existing.evidence), payload.evidence, payload.evidenceMode);
    await db
      .prepare(`UPDATE clunk_collaboration_threads SET evidence_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`)
      .bind(evidenceJson(evidence ?? undefined), threadId, workspaceId)
      .run();
    return textResult({ threadId, evidence, evidenceMode: payload.evidenceMode, statusPromotion: "NONE" });
  }

  throw new ClunkHttpError(
    `'${name}' is not a tool on this endpoint. Call tools/list for the current set: ${MCP_HTTP_TOOLS.map((tool) => tool.name).join(", ")}. Tools that read a path on your machine live on Clunk's local stdio MCP instead.`,
    400,
  );
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

/**
 * 업로드한 바이트의 구조 리포트. 모델(.glb/.gltf)이 아니면 null.
 *
 * inspectAsset은 glTF 컨테이너를 전제로 하므로, 스프라이트 시트나 Spine JSON을 넘기면
 * 실패 리포트를 만들어 냅니다. 그 실패는 에셋의 문제가 아니라 잘못된 검사기를 부른
 * 것이므로, 확장자를 보고 부를 수 있을 때만 부릅니다.
 */
function structuralReportFor(entryFileName: string, files: ReadonlyMap<string, Uint8Array>) {
  if (!/\.(?:glb|gltf)$/iu.test(entryFileName)) return null;
  try {
    return inspectAsset({ entry: entryFileName, files });
  } catch {
    return null;
  }
}

/**
 * 바이트가 실제로 왔는지 먼저 본다.
 *
 * 2026-09-05 실측: targetProfileId만 넣고 부르면 `Invalid fileName.` 한 줄이 돌아왔고,
 * 로컬 stdio 도구의 이름인 `path`를 넣어도 똑같이 `Invalid fileName.`이었습니다.
 * 에이전트가 그 문장에서 알아낼 수 있는 다음 수는 없습니다. 무엇을 어떻게 보내야 하는지
 * 적고, path를 쓴 사람에게는 왜 HTTP에서 그것이 안 되는지까지 말해 줍니다.
 */
function assertUploadedBytes(toolName: string, args: Record<string, unknown>): void {
  const hasSingle = typeof args.fileName === "string" || typeof args.bytesBase64 === "string";
  const hasBundle = args.entryFileName !== undefined || args.files !== undefined;
  if (hasSingle || hasBundle) return;
  const usedLocalPath = typeof args.path === "string" || typeof args.sourcePath === "string";
  throw new ClunkHttpError(
    `${toolName} received no asset bytes.`
    + (usedLocalPath
      ? " This is the HTTP transport: it runs on Clunk's server and cannot open a path on your machine, so `path` is ignored. Read the file yourself and send its bytes, or connect Clunk's local stdio MCP, whose clunk_asset_inspect does take `path`."
      : "")
    + " Send one file as fileName + bytesBase64 (base64 of the file's bytes), or a bundle as entryFileName + files[{fileName, bytesBase64}]."
    + " Example: {\"targetProfileId\":\"unity\",\"fileName\":\"prop.glb\",\"bytesBase64\":\"Z2xURgIA...\"}.",
    400,
  );
}

/**
 * 프로파일 이름이 틀렸을 때 고를 수 있는 것을 같이 준다.
 *
 * 예전에는 `Unknown target profile: web`으로 끝났습니다. 그런데 `web`은 로컬 stdio 도구가
 * 실제로 받는 이름이라, 두 표면을 함께 쓰는 에이전트가 가장 흔하게 넣는 값입니다.
 */
function assertTargetProfile(value: unknown): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new ClunkHttpError(
      `targetProfileId is required. Pick one of: ${MCP_HTTP_TARGET_PROFILE_IDS.join(", ")}.`,
      400,
    );
  }
  if ((MCP_HTTP_TARGET_PROFILE_IDS as readonly string[]).includes(value)) return;
  const stdioName = ["web", "mobile", "pc"].includes(value.toLowerCase());
  throw new ClunkHttpError(
    `'${value}' is not a target profile on this endpoint.`
    + (stdioName
      ? ` '${value}' is a local stdio policy profile, not an engine target. Over HTTP use an engine id instead — web-three-mobile for a mobile web build, unity or unreal for those editors.`
      : "")
    + ` Valid values: ${MCP_HTTP_TARGET_PROFILE_IDS.join(", ")}.`,
    400,
  );
}

function optionalEnum(value: unknown, field: string, allowed: readonly string[]): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ClunkHttpError(`${field} must be one of: ${allowed.join(", ")}. Received ${JSON.stringify(value)}.`, 400);
  }
  return value;
}

function requireSlug(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ClunkHttpError("slug is required. Call clunk_search_assets first; each result carries the slug to pass here.", 400);
  }
  const slug = value.trim();
  if (!/^[a-z0-9가-힣][a-z0-9가-힣-]{0,95}$/iu.test(slug)) {
    throw new ClunkHttpError(
      `'${slug}' is not a listing slug. A slug is the last part of a product URL, for example cozy-crate-closed. Call clunk_search_assets to list them.`,
      400,
    );
  }
  return slug;
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function requireSafeText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength || !/^[a-zA-Z0-9:._-]+$/.test(value)) {
    throw new ClunkHttpError(
      `Invalid ${field}. It must be 1-${maxLength} characters of letters, digits, and : . _ - only. Received ${JSON.stringify(value)}.`,
      400,
    );
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

