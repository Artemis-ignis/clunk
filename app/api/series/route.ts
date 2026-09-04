import {
  assertSameOrigin,
  canonicalFingerprint,
  confirmCreditOperation,
  getRuntimeAssets,
  getRuntimeDb,
  hasRuntimeAssets,
  jsonError,
  parseJson,
  privateJson,
  readIdempotencyKey,
  refundCreditOperation,
  requireClunkContext,
  reserveCreditOperation,
  scopedStorageId,
  isSafeRecordId,
} from "../_lib/clunk";
import {
  createClunkSeriesJob,
  type ClunkSeriesCreationRequest,
} from "../../../packages/clunk-series/src/native-authoring";
import { getTemplateStore, hasTemplateStore, loadTemplateLibrary } from "../_lib/templates";
import {
  createTemplateAssemblyJob,
  type TemplateAssemblyJob,
} from "../../../packages/clunk-series/src/template-assembly";
import {
  TEMPLATE_HONESTY_KO,
  resolveTemplateSelection,
  templateChoiceList,
  templateObjectKey,
  type TemplateKind,
} from "../../../packages/clunk-series/src/template-library";
import { createSeriesBundle } from "../../../packages/clunk-series/src/bundle";
import { getClunkSeries, getClunkSeriesCatalog } from "../../../packages/clunk-series/src/catalog";
import { verifyStoredArtifactPersistence as verifyStorageEvidence } from "../../../packages/core/src/billing";
import { publicationReadiness, readinessLabel } from "../../../packages/core/src/product-contract";
import { createRemixRequest } from "../../../packages/core/src/foundry-contract";
import type { AssetKind } from "../../../packages/core/src/assetops-contract";

export const dynamic = "force-dynamic";

const CREATION_SERIES = new Set<ClunkSeriesCreationRequest["seriesId"]>([
  "asset-forge",
  "sprite-lab",
  "material-lab",
  "motion-lab",
]);
const ASSET_KINDS = new Set<AssetKind>([
  "2d-image",
  "sprite-atlas",
  "spine-project",
  "animation-clip",
  "3d-model",
]);

/**
 * The three kinds that are served from the template library instead of from the procedural
 * recipe. Everything the recipe used to write for these was a placeholder — an eight-vertex
 * box for a 3D model, a drawn grid for a sheet — so there is no fallback to it here: a request
 * this route cannot match to a real template is answered with the catalogue and a 400.
 */
const TEMPLATE_KINDS = new Set<AssetKind>(["3d-model", "sprite-atlas", "animation-clip"]);
/** A single template artifact must stay small enough to edit and return inside a Worker. */
const MAX_TEMPLATE_BYTES = 3 * 1024 * 1024;

type SeriesPayload = Partial<ClunkSeriesCreationRequest> & {
  operation?: unknown;
  sourceAssetId?: unknown;
  projectId?: unknown;
  idempotencyKey?: unknown;
  templateId?: unknown;
  paletteId?: unknown;
  sizeId?: unknown;
  scale?: unknown;
};

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const jobs = await db.prepare(
      `SELECT g.id, g.project_id AS projectId, g.asset_id AS assetId, a.file_name AS fileName,
        g.asset_kind AS assetKind, g.target_profile_id AS targetProfileId, g.provider, g.prompt, g.status,
        g.storage_status AS storageStatus, g.recipe_json AS recipeJson, g.provenance_json AS provenanceJson,
        g.evidence_json AS evidenceJson, g.created_at AS createdAt, g.updated_at AS updatedAt
       FROM clunk_generation_jobs g LEFT JOIN clunk_assets a ON a.id = g.asset_id AND a.workspace_id = g.workspace_id
       WHERE g.workspace_id = ? AND g.provider = 'clunk-series-native-v1'
       ORDER BY g.created_at DESC, g.id DESC LIMIT 50`,
    ).bind(workspaceId).all();
    return privateJson({ ok: true, series: getClunkSeriesCatalog(), jobs: jobs.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  let creditOperationId: string | null = null;
  let workspaceIdForRefund: string | null = null;
  let ownsStorageWrite = false;
  let storageVerified = false;
  let persistenceCommitted = false;
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    workspaceIdForRefund = workspaceId;
    const payload = await parseJson<SeriesPayload>(request, 512 * 1024);
    const seriesId = payload.seriesId;
    const assetKind = payload.assetKind;
    const operation = payload.operation === undefined ? "create" : payload.operation;
    if (operation !== "create" && operation !== "remix") {
      return privateJson({ ok: false, error: "지원하지 않는 Clunk 작업입니다." }, { status: 400 });
    }
    if (typeof seriesId !== "string" || !CREATION_SERIES.has(seriesId as ClunkSeriesCreationRequest["seriesId"])) {
      return privateJson({ ok: false, error: "지원하지 않는 Clunk Series입니다." }, { status: 400 });
    }
    if (typeof assetKind !== "string" || !ASSET_KINDS.has(assetKind as AssetKind)) {
      return privateJson({ ok: false, error: "지원하지 않는 에셋 종류입니다." }, { status: 400 });
    }
    if (typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 80) {
      return privateJson({ ok: false, error: "이름은 1자 이상 80자 이하이어야 합니다." }, { status: 400 });
    }
    if (typeof payload.prompt !== "string" || !payload.prompt.trim() || payload.prompt.length > 2_000) {
      return privateJson({ ok: false, error: "프롬프트는 1자 이상 2,000자 이하이어야 합니다." }, { status: 400 });
    }
    if (payload.sourceHash !== undefined && (typeof payload.sourceHash !== "string" || !/^[a-f0-9]{64}$/i.test(payload.sourceHash))) {
      return privateJson({ ok: false, error: "sourceHash 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const targetProfileId = typeof payload.targetProfileId === "string" && payload.targetProfileId.trim()
      ? payload.targetProfileId.trim()
      : defaultTargetFor(assetKind as AssetKind);
    const db = getRuntimeDb();
    let sourceAssetId: string | undefined;
    let sourcePath: string | undefined;
    let sourceHash: string | undefined;
    if (operation === "remix") {
      if (!isSafeRecordId(payload.sourceAssetId, 256)) {
        return privateJson({ ok: false, error: "리믹스에는 원본 sourceAssetId가 필요합니다." }, { status: 400 });
      }
      const source = await db.prepare(
        `SELECT id, sha256 FROM clunk_assets WHERE id = ? AND workspace_id = ? LIMIT 1`,
      ).bind(payload.sourceAssetId, workspaceId).first<{ id: string; sha256: string }>();
      if (!source) {
        return privateJson({ ok: false, error: "현재 Workspace에 속한 원본 에셋만 리믹스할 수 있습니다." }, { status: 404 });
      }
      try {
        createRemixRequest({
          sourceAssetId: source.id,
          sourceHash: source.sha256,
          prompt: payload.prompt,
          targetProfileId,
        });
      } catch (error) {
        return privateJson({ ok: false, error: error instanceof Error ? error.message : "리믹스 요청이 올바르지 않습니다." }, { status: 400 });
      }
      sourceAssetId = source.id;
      sourcePath = `clunk://workspace/${workspaceId}/assets/${source.id}`;
      sourceHash = source.sha256;
    }
    let projectId: string | undefined;
    if (payload.projectId !== undefined) {
      if (!isSafeRecordId(payload.projectId, 256)) {
        return privateJson({ ok: false, error: "projectId 형식이 올바르지 않습니다." }, { status: 400 });
      }
      const project = await db.prepare(
        `SELECT id FROM clunk_projects WHERE id = ? AND workspace_id = ? LIMIT 1`,
      ).bind(payload.projectId, workspaceId).first<{ id: string }>();
      if (!project) return privateJson({ ok: false, error: "현재 Workspace의 프로젝트만 사용할 수 있습니다." }, { status: 404 });
      projectId = project.id;
    }
    const templateKind = TEMPLATE_KINDS.has(assetKind as AssetKind);
    let assembly: TemplateAssemblyJob["assembly"] | null = null;
    let job: ReturnType<typeof createClunkSeriesJob> | TemplateAssemblyJob;

    if (templateKind) {
      if (!hasTemplateStore()) {
        return privateJson({
          ok: false,
          schema: "clunk.series-result.v1",
          status: "TEMPLATE_LIBRARY_UNAVAILABLE",
          error: "템플릿 보관소(R2 ASSETS)가 연결되어 있지 않습니다. 실행 횟수는 차감되지 않았습니다.",
          templates: [],
        }, { status: 503 });
      }
      const store = getTemplateStore();
      const library = await loadTemplateLibrary(store);
      if (!library) {
        return privateJson({
          ok: false,
          schema: "clunk.series-result.v1",
          status: "TEMPLATE_LIBRARY_UNAVAILABLE",
          error: "템플릿 라이브러리가 아직 업로드되지 않았습니다. 실행 횟수는 차감되지 않았습니다.",
          templates: [],
        }, { status: 503 });
      }
      const resolved = resolveTemplateSelection({
        library,
        assetKind: assetKind as TemplateKind,
        templateId: payload.templateId,
        paletteId: payload.paletteId,
        sizeId: payload.sizeId,
        scale: payload.scale,
        prompt: payload.prompt,
      });
      if (!resolved.ok) {
        // No placeholder is ever written instead. The caller gets the list it needed.
        return privateJson({
          ok: false,
          schema: "clunk.series-result.v1",
          status: resolved.code,
          honesty: TEMPLATE_HONESTY_KO,
          error: resolved.error,
          templates: templateChoiceList(resolved.templates),
        }, { status: 400 });
      }
      const { selection } = resolved;
      const wanted = assetKind === "sprite-atlas"
        ? [selection.palette.sheet!.png, selection.palette.sheet!.json]
        : [selection.palette.glb];
      const loaded: Uint8Array[] = [];
      for (const fileName of wanted) {
        const bytes = await store.get(templateObjectKey(selection.template.id, fileName));
        if (!bytes) {
          return privateJson({
            ok: false,
            schema: "clunk.series-result.v1",
            status: "TEMPLATE_FILE_MISSING",
            error: `보관소에 ${selection.template.name}/${fileName} 파일이 없습니다. 실행 횟수는 차감되지 않았습니다.`,
          }, { status: 503 });
        }
        if (bytes.byteLength > MAX_TEMPLATE_BYTES) {
          return privateJson({
            ok: false,
            schema: "clunk.series-result.v1",
            status: "TEMPLATE_FILE_TOO_LARGE",
            error: `${fileName} 파일이 3 MB 한도를 넘습니다.`,
          }, { status: 503 });
        }
        loaded.push(bytes);
      }
      const assembled = createTemplateAssemblyJob({
        seriesId: seriesId as ClunkSeriesCreationRequest["seriesId"],
        assetKind: assetKind as TemplateKind,
        label: payload.label,
        prompt: payload.prompt,
        targetProfileId,
        ...(payload.license !== undefined ? { license: payload.license } : {}),
        selection,
        ...(assetKind === "sprite-atlas"
          ? { sheet: { png: loaded[0]!, manifest: loaded[1]! } }
          : { glb: loaded[0]! }),
      });
      assembly = assembled.assembly;
      job = assembled;
    } else {
      job = createClunkSeriesJob({
        seriesId: seriesId as ClunkSeriesCreationRequest["seriesId"],
        assetKind: assetKind as AssetKind,
        label: payload.label,
        prompt: payload.prompt,
        targetProfileId,
        ...(payload.width !== undefined ? { width: payload.width } : {}),
        ...(payload.height !== undefined ? { height: payload.height } : {}),
        ...(payload.frames !== undefined ? { frames: payload.frames } : {}),
        ...(payload.license !== undefined ? { license: payload.license } : {}),
        ...(sourcePath ? { sourcePath } : payload.sourcePath !== undefined ? { sourcePath: payload.sourcePath } : {}),
        ...(sourceHash ? { sourceHash } : payload.sourceHash !== undefined ? { sourceHash: payload.sourceHash } : {}),
      });
    }
    if (job.status === "BLOCKED") {
      const generationId = job.jobId;
      const blockedRecipeJson = JSON.stringify({
        schema: "clunk.series-plan.v1",
        operation,
        ...(sourceAssetId ? { sourceAssetId } : {}),
        ...(projectId ? { projectId } : {}),
        seriesId: job.seriesId,
        requestHash: job.requestHash,
        ...(assembly ? { assembly } : {}),
        blocked: true,
      });
      await db.prepare(
        `INSERT OR REPLACE INTO clunk_generation_jobs
         (id, workspace_id, project_id, asset_id, asset_kind, target_profile_id, provider, prompt, status, recipe_json, provenance_json, evidence_json, storage_status, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'BLOCKED', ?, ?, ?, 'BLOCKED', CURRENT_TIMESTAMP)`,
      ).bind(
        generationId,
        workspaceId,
        projectId ?? null,
        job.assetKind,
        job.targetProfileId,
        "clunk-series-native-v1",
        job.provenance.prompt ?? "",
        blockedRecipeJson,
        JSON.stringify(job.provenance),
        JSON.stringify(job.evidence ?? null),
      ).run();
      return privateJson({
        ok: false,
        schema: "clunk.series-result.v1",
        series: getClunkSeries(job.seriesId),
        seriesId: job.seriesId,
        generationId,
        operation,
        ...(sourceAssetId ? { sourceAssetId, sourceHash } : {}),
        ...(projectId ? { projectId } : {}),
        status: "BLOCKED",
        provider: "clunk-series-native-v1",
        ...(assembly ? { assembly, honesty: TEMPLATE_HONESTY_KO } : {}),
        entryFileName: job.entryFileName,
        artifacts: [],
        provenance: job.provenance,
        evidence: job.evidence ?? null,
        publication: { status: "DRAFT_ONLY", readiness: readinessLabel({ staticStatus: "NO_GO", visualRuntime: "UNAVAILABLE", playerFacing: "NOT_EVALUATED", humanDecision: "NOT_EVALUATED" }), publishable: false },
        error: "정적 검수 blocker가 있어 산출물을 저장하지 않았습니다. 수정 후 다시 실행하십시오.",
        limitations: job.limitations,
      }, { status: 422 });
    }
    if (!hasRuntimeAssets()) {
      const generationId = job.jobId;
      return privateJson({
        ok: false,
        schema: "clunk.series-result.v1",
        series: getClunkSeries(job.seriesId),
        seriesId: job.seriesId,
        generationId,
        operation,
        ...(sourceAssetId ? { sourceAssetId, sourceHash } : {}),
        ...(projectId ? { projectId } : {}),
        status: "STORAGE_NOT_CONFIGURED",
        provider: "clunk-series-native-v1",
        entryFileName: job.entryFileName,
        storageStatus: "UNAVAILABLE",
        artifacts: [],
        provenance: job.provenance,
        evidence: job.evidence ?? null,
        publication: { status: "DRAFT_ONLY", readiness: readinessLabel({ staticStatus: "NO_GO", visualRuntime: "UNAVAILABLE", playerFacing: "NOT_EVALUATED", humanDecision: "NOT_EVALUATED" }), publishable: false },
        credits: null,
        idempotent: false,
        error: "실제 생성 결과를 보관하려면 R2 ASSETS 연결이 필요합니다. 실행 횟수는 차감되지 않았습니다.",
        limitations: job.limitations,
      }, { status: 503 });
    }
    const bundle = createSeriesBundle(job);
    const entry = bundle.files.find((artifact) => artifact.fileName === job.entryFileName) ?? bundle.files[0];
    if (!entry) throw new Error("Clunk Series job produced no artifact.");
    const generationId = job.jobId;
    const assetId = scopedStorageId("asset", workspaceId, entry.sha256);
    const artifactRows = bundle.files.map((artifact) => {
      const objectKey = `workspaces/${workspaceId}/assets/${assetId}/${artifact.fileName}`;
      return { artifact, objectKey, id: scopedStorageId("artifact", workspaceId, `${assetId}:${artifact.fileName}`) };
    });
    const storageRows = artifactRows.map(({ artifact, objectKey }) => ({
      fileName: artifact.fileName,
      objectKey,
      byteLength: artifact.byteLength,
    }));
    const provenanceJson = JSON.stringify(job.provenance);
    const evidenceJson = JSON.stringify(job.evidence ?? null);
    const recipeJson = JSON.stringify({
      schema: "clunk.series-plan.v1",
      operation,
      ...(sourceAssetId ? { sourceAssetId } : {}),
      ...(projectId ? { projectId } : {}),
      seriesId: job.seriesId,
      requestHash: job.requestHash,
      ...(assembly ? { assembly } : {}),
      bundleManifest: bundle.manifest,
    });
    const idempotencyKey = readIdempotencyKey(request, payload.idempotencyKey, job.requestHash);
    const fingerprint = canonicalFingerprint({
      operation,
      generationId,
      idempotencyKey,
      projectId: projectId ?? null,
      sourceAssetId: sourceAssetId ?? null,
      sourceHash: sourceHash ?? null,
      seriesId: job.seriesId,
      assetKind: job.assetKind,
      targetProfileId: job.targetProfileId,
      label: payload.label.trim(),
      prompt: payload.prompt.trim(),
      requestHash: job.requestHash,
      artifacts: bundle.files.map((artifact) => ({ fileName: artifact.fileName, sha256: artifact.sha256 })),
    });
    const reservation = await reserveCreditOperation(db, workspaceId, {
      key: `series:${idempotencyKey}`,
      fingerprint,
      kind: "series",
      amount: -1,
    });
    creditOperationId = reservation.status === "applied" ? null : reservation.operationId;
    let storageStatus: "STORED" | "INCOMPLETE" = "INCOMPLETE";
    const persistenceStatements = () => [
      db.prepare(
        `INSERT OR IGNORE INTO clunk_assets
         (id, workspace_id, file_name, format, byte_length, sha256)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM clunk_credit_operations
           WHERE id = ? AND workspace_id = ? AND status = 'applied'
         )`,
      ).bind(assetId, workspaceId, entry.fileName, extensionOf(entry.fileName), entry.byteLength, entry.sha256, reservation.operationId, workspaceId),
      ...artifactRows.map(({ artifact, objectKey, id }) => db.prepare(
        `INSERT OR IGNORE INTO clunk_asset_artifacts
         (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM clunk_credit_operations
           WHERE id = ? AND workspace_id = ? AND status = 'applied'
         )`,
      ).bind(id, workspaceId, assetId, artifact.fileName, artifact.role, artifact.contentType, artifact.byteLength, artifact.sha256, objectKey, reservation.operationId, workspaceId)),
      db.prepare(
        `INSERT OR IGNORE INTO clunk_generation_jobs
         (id, workspace_id, project_id, asset_id, asset_kind, target_profile_id, provider, prompt, status, recipe_json, provenance_json, evidence_json, storage_status, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, CURRENT_TIMESTAMP
         WHERE EXISTS (
           SELECT 1 FROM clunk_credit_operations
           WHERE id = ? AND workspace_id = ? AND status = 'applied'
         )`,
      ).bind(generationId, workspaceId, projectId ?? null, assetId, job.assetKind, job.targetProfileId, "clunk-series-native-v1", job.provenance.prompt ?? "", recipeJson, provenanceJson, evidenceJson, storageStatus, reservation.operationId, workspaceId),
    ];
    let credits = reservation.balance;
    let idempotent = reservation.idempotent;
    if (reservation.status !== "applied") {
      ownsStorageWrite = true;
      const bucket = getRuntimeAssets();
      const writes = await Promise.allSettled(artifactRows.map(async ({ artifact, objectKey }) => {
        storedKeys.push(objectKey);
        await bucket.put(objectKey, artifact.bytes, { httpMetadata: { contentType: artifact.contentType } });
      }));
      const failedWrite = writes.find((write): write is PromiseRejectedResult => write.status === "rejected");
      if (failedWrite) throw failedWrite.reason;
      storageStatus = await verifyStorageEvidence(bucket, storageRows);
      storageVerified = true;
      const confirmation = await confirmCreditOperation(db, workspaceId, reservation.operationId, persistenceStatements);
      credits = confirmation.balance;
      idempotent = reservation.idempotent || confirmation.idempotent;
      creditOperationId = null;
      persistenceCommitted = true;
    } else {
      // A retried request must reopen every R2 object before claiming STORED;
      // request metadata and an already-applied credit row are not storage proof.
      storageStatus = await verifyStorageEvidence(getRuntimeAssets(), storageRows);
      storageVerified = true;
      persistenceCommitted = true;
    }
    const staticStatus = job.evidence && job.evidence.stages.structure.status === "pass" && job.evidence.stages.policy.status === "pass" ? "PASS" : "GAP";
    const runtimeStatus = job.evidence?.stages.runtime.status === "pass" ? "PASS" : job.evidence?.stages.runtime.status === "environmentUnavailable" ? "UNAVAILABLE" : "GAP";
    const publication = publicationReadiness({
      artifactStored: storageVerified,
      provenanceComplete: true,
      licenseStatus: job.provenance.licenseStatus === "creator-owned" || job.provenance.licenseStatus === "cleared" ? "cleared" : "review-required",
      staticStatus,
      visualRuntime: runtimeStatus,
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
    });
    return privateJson({
      ok: true,
      schema: "clunk.series-result.v1",
      series: getClunkSeries(job.seriesId),
      seriesId: job.seriesId,
      generationId,
      assetId,
      operation,
      ...(sourceAssetId ? { sourceAssetId, sourceHash } : {}),
      ...(projectId ? { projectId } : {}),
      status: job.status,
      provider: "clunk-series-native-v1",
      ...(assembly ? { assembly, honesty: TEMPLATE_HONESTY_KO } : {}),
      entryFileName: job.entryFileName,
      storageStatus,
      artifacts: bundle.files.map((artifact) => ({
        fileName: artifact.fileName,
        role: artifact.role,
        contentType: artifact.contentType,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        bytesBase64: artifact.bytes.byteLength <= 512 * 1024 ? bytesToBase64(artifact.bytes) : null,
        previewUrl: storageVerified ? `/api/marketplace/assets/${assetId}?file=${encodeURIComponent(artifact.fileName)}` : null,
      })),
      manifest: bundle.manifest,
      provenance: job.provenance,
      evidence: job.evidence,
      publication: { status: "DRAFT_ONLY", readiness: publication, publishable: false },
      credits,
      idempotent,
      limitations: [
        ...job.limitations,
        "Clunk Series bundle의 모든 artifact가 private R2에 저장되고 head/바이트 검증을 통과했습니다.",
      ],
    });
  } catch (error) {
    if (creditOperationId) {
      const operationToRefund = creditOperationId;
      creditOperationId = null;
      try {
        if (!workspaceIdForRefund) throw new Error("Workspace context is unavailable for credit refund.");
        await refundCreditOperation(getRuntimeDb(), workspaceIdForRefund, operationToRefund);
      } catch {
        // Keep the original request failure; the operation remains auditable.
      }
    }
    if (storedKeys.length && ownsStorageWrite && !persistenceCommitted && hasRuntimeAssets()) {
      try {
        const bucket = getRuntimeAssets();
        await Promise.all(storedKeys.map((key) => bucket.delete(key)));
      } catch {
        // Keep the original request failure if cleanup itself fails.
      }
    }
    return jsonError(error);
  }
}

function defaultTargetFor(assetKind: AssetKind): string {
  return assetKind === "animation-clip" || assetKind === "3d-model" ? "web-three-mobile" : "yeongheo-pixi-2d";
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
