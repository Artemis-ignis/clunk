import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  ClunkHttpError,
  getRuntimeAssets,
  getRuntimeDb,
  hasRuntimeAssets,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  refundCreditOperation,
  requireClunkContext,
  scopedStorageId,
} from "../../_lib/clunk";
import {
  executeProviderRun,
  getProviderEnvironment,
  type ProviderId,
  type ProviderRunInput,
} from "../../../../packages/clunk-series/src/provider-runtime";
import type { AssetKind } from "../../../../packages/core/src/assetops-contract";
import { getRuntimeEnvironment } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<ProviderId>(["clunk-series-native-v1", "trellis2", "blender-motion"]);
const SERIES = new Set(["asset-forge", "sprite-lab", "material-lab", "motion-lab"]);
const ASSET_KINDS = new Set<AssetKind>(["3d-model", "animation-clip", "2d-image", "sprite-atlas", "spine-project"]);

type ProviderPayload = {
  provider?: unknown;
  seriesId?: unknown;
  assetKind?: unknown;
  targetProfileId?: unknown;
  label?: unknown;
  prompt?: unknown;
  width?: unknown;
  height?: unknown;
  frames?: unknown;
  license?: unknown;
  sourcePath?: unknown;
  sourceHash?: unknown;
  projectId?: unknown;
};

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  let creditOperation: { idempotent: boolean } | null = null;
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<ProviderPayload>(request, 512 * 1024);
    const input = parseProviderInput(payload);
    const db = getRuntimeDb();
    let projectId: string | null = null;
    if (payload.projectId !== undefined) {
      if (!isSafeRecordId(payload.projectId, 256)) {
        return privateJson({ ok: false, schema: "clunk.provider-run.v1", status: "INVALID_REQUEST", error: "projectId 형식이 올바르지 않습니다." }, { status: 400 });
      }
      const project = await db.prepare("SELECT id FROM clunk_projects WHERE id = ? AND workspace_id = ? LIMIT 1").bind(payload.projectId, workspaceId).first<{ id: string }>();
      if (!project) return privateJson({ ok: false, schema: "clunk.provider-run.v1", status: "PROJECT_NOT_FOUND", error: "현재 Workspace의 프로젝트만 사용할 수 있습니다." }, { status: 404 });
      projectId = project.id;
    }

    const result = await executeProviderRun(input, { environment: getProviderEnvironment(getRuntimeEnvironment()) });
    if (result.status !== "COMPLETED") {
      return privateJson({
        ok: false,
        schema: "clunk.provider-run.v1",
        status: result.status,
        provider: result.provider,
        provenance: result.provenance,
        evidence: result.evidence,
        error: result.error ?? "Provider did not produce a persistable result.",
      }, { status: result.status === "FAILED" ? 502 : 503 });
    }
    if (!hasRuntimeAssets()) {
      return privateJson({
        ok: false,
        schema: "clunk.provider-run.v1",
        status: "ENVIRONMENT_UNAVAILABLE",
        provider: result.provider,
        provenance: result.provenance,
        evidence: result.evidence,
        error: "R2 ASSETS is required before an external provider result can be persisted.",
      }, { status: 503 });
    }
    const entry = result.artifacts.find((artifact) => artifact.role === "entry") ?? result.artifacts[0];
    if (!entry) throw new Error("Provider completed without an entry artifact.");
    const assetId = scopedStorageId("asset", workspaceId, entry.sha256);
    const generationId = `provider-${result.evidence.requestHash.slice(0, 20)}-${entry.sha256.slice(0, 12)}`;
    const artifactRows = result.artifacts.map((artifact) => {
      const objectKey = `workspaces/${workspaceId}/assets/${assetId}/${artifact.fileName}`;
      return { artifact, objectKey, id: scopedStorageId("artifact", workspaceId, `${assetId}:${artifact.fileName}`) };
    });
    const bucket = getRuntimeAssets();
    await Promise.all(artifactRows.map(async ({ artifact, objectKey }) => {
      await bucket.put(objectKey, artifact.bytes, { httpMetadata: { contentType: artifact.contentType } });
      storedKeys.push(objectKey);
    }));

    const statements = [
      db.prepare("INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (?, ?, ?, ?, ?, ?)").bind(assetId, workspaceId, entry.fileName, extensionOf(entry.fileName), entry.byteLength, entry.sha256),
      ...artifactRows.map(({ artifact, objectKey, id }) => db.prepare("INSERT OR IGNORE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, workspaceId, assetId, artifact.fileName, artifact.role, artifact.contentType, artifact.byteLength, artifact.sha256, objectKey)),
      db.prepare("INSERT OR REPLACE INTO clunk_generation_jobs (id, workspace_id, project_id, asset_id, asset_kind, target_profile_id, provider, prompt, status, recipe_json, provenance_json, evidence_json, storage_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 'STORED', CURRENT_TIMESTAMP)").bind(
        generationId,
        workspaceId,
        projectId,
        assetId,
        input.assetKind,
        input.targetProfileId,
        input.provider,
        input.prompt.trim(),
        JSON.stringify({ schema: "clunk.provider-run-recipe.v1", requestHash: result.evidence.requestHash, projectId, provider: input.provider }),
        JSON.stringify(result.provenance),
        JSON.stringify(result.evidence),
      ),
    ];

    const credit = await applyCreditOperation(db, workspaceId, {
      key: `provider:${result.evidence.requestHash}`,
      fingerprint: canonicalFingerprint({ requestHash: result.evidence.requestHash, provider: input.provider, outputHash: entry.sha256 }),
      kind: `provider:${input.provider}`,
      amount: -1,
    });
    creditOperation = credit;
    try {
      await db.batch(statements);
    } catch (error) {
      if (!credit.idempotent) {
        try { await refundCreditOperation(db, workspaceId, `provider:${result.evidence.requestHash}`); } catch { /* retain the original persistence error */ }
      }
      throw error;
    }

    return privateJson({
      ok: true,
      schema: "clunk.provider-run-result.v1",
      status: "COMPLETED",
      provider: input.provider,
      generationId,
      assetId,
      ...(projectId ? { projectId } : {}),
      storageStatus: "STORED",
      artifacts: result.artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        role: artifact.role,
        contentType: artifact.contentType,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        bytesBase64: artifact.bytes.byteLength <= 512 * 1024 ? bytesToBase64(artifact.bytes) : null,
        previewUrl: `/api/marketplace/assets/${assetId}?file=${encodeURIComponent(artifact.fileName)}`,
      })),
      provenance: result.provenance,
      evidence: result.evidence,
      publication: { status: "DRAFT_ONLY", productionReady: false },
      credits: credit.balance,
      idempotent: credit.idempotent || Boolean(creditOperation?.idempotent),
      limitations: [
        "External provider output was persisted only after Clunk rehash and fresh reinspection.",
        "Runtime, player-facing, license, and human review remain separate gates.",
      ],
    }, { status: 201 });
  } catch (error) {
    if (storedKeys.length && hasRuntimeAssets()) {
      try {
        const bucket = getRuntimeAssets();
        await Promise.all(storedKeys.map((key) => bucket.delete(key)));
      } catch {
        // Keep the original failure and leave the cleanup attempt observable in logs.
      }
    }
    return jsonError(error);
  }
}

function parseProviderInput(payload: ProviderPayload): ProviderRunInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ClunkHttpError("Request payload must be an object.", 400);
  }
  if (typeof payload.provider !== "string" || !PROVIDERS.has(payload.provider as ProviderId)) {
    throw new ClunkHttpError("Unsupported provider.", 400);
  }
  if (typeof payload.assetKind !== "string" || !ASSET_KINDS.has(payload.assetKind as AssetKind)) {
    throw new ClunkHttpError("Unsupported assetKind.", 400);
  }
  const text = (value: unknown, name: string, maxLength: number): string => {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new ClunkHttpError(`Invalid ${name}.`, 400);
    return value.trim();
  };
  const provider = payload.provider as ProviderId;
  const seriesId = payload.seriesId === undefined ? undefined : text(payload.seriesId, "seriesId", 64);
  if (provider === "clunk-series-native-v1" && (!seriesId || !SERIES.has(seriesId))) {
    throw new ClunkHttpError("Native provider requires a supported seriesId.", 400);
  }
  const sourceHash = payload.sourceHash === undefined ? undefined : text(payload.sourceHash, "sourceHash", 64);
  if (sourceHash && !/^[a-f0-9]{64}$/i.test(sourceHash)) throw new ClunkHttpError("Invalid sourceHash.", 400);
  const numberField = (value: unknown, name: string): number | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new ClunkHttpError(`Invalid ${name}.`, 400);
    return value;
  };
  const width = numberField(payload.width, "width");
  const height = numberField(payload.height, "height");
  const frames = numberField(payload.frames, "frames");
  return {
    provider,
    ...(seriesId ? { seriesId: seriesId as ProviderRunInput["seriesId"] } : {}),
    assetKind: payload.assetKind as AssetKind,
    targetProfileId: text(payload.targetProfileId, "targetProfileId", 160),
    label: text(payload.label, "label", 80),
    prompt: text(payload.prompt, "prompt", 2_000),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(frames !== undefined ? { frames } : {}),
    ...(payload.license !== undefined ? { license: text(payload.license, "license", 160) } : {}),
    ...(payload.sourcePath !== undefined ? { sourcePath: text(payload.sourcePath, "sourcePath", 1_000) } : {}),
    ...(sourceHash ? { sourceHash } : {}),
  };
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "bin";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
