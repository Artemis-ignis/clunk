import {
  assertSameOrigin,
  canonicalFingerprint,
  confirmCreditOperation,
  getRuntimeAssets,
  getRuntimeDb,
  hasRuntimeAssets,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  readIdempotencyKey,
  refundCreditOperation,
  requireClunkContext,
  reserveCreditOperation,
  scopedStorageId,
} from "../_lib/clunk";
import { verifyStoredArtifactPersistence as verifyStorageEvidence } from "../../../packages/core/src/billing";
import { createProceduralAuthoring, type ProceduralAuthoringRequest } from "../../../packages/core/src/product-authoring";
import { generateImage } from "../_lib/image-generation";
import { IMAGE_MODEL } from "../_lib/image-generation";
import { budgetRefusal, releaseImageBudget, reserveImageBudget } from "../_lib/ai-budget";
import { publicationReadiness } from "../../../packages/core/src/product-contract";
import type { AssetKind } from "../../../packages/core/src/assetops-contract";

export const dynamic = "force-dynamic";

const ASSET_KINDS = new Set<AssetKind>([
  "2d-image",
  "sprite-atlas",
  "spine-project",
  "animation-clip",
  "3d-model",
]);

const TARGET_BY_KIND: Readonly<Record<AssetKind, string>> = {
  "2d-image": "yeongheo-pixi-2d",
  "sprite-atlas": "yeongheo-pixi-2d",
  "spine-project": "yeongheo-pixi-2d",
  "animation-clip": "web-three-mobile",
  "3d-model": "web-three-mobile",
};

type GenerationPayload = Partial<ProceduralAuthoringRequest> & { projectId?: unknown; idempotencyKey?: unknown };

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const jobs = await db.prepare(
      `SELECT g.id, g.project_id AS projectId, g.asset_id AS assetId, a.file_name AS fileName,
        g.asset_kind AS assetKind, g.target_profile_id AS targetProfileId, g.provider, g.prompt, g.status,
        g.recipe_json AS recipeJson, g.storage_status AS storageStatus, g.provenance_json AS provenanceJson,
        g.evidence_json AS evidenceJson, g.created_at AS createdAt, g.updated_at AS updatedAt
       FROM clunk_generation_jobs g LEFT JOIN clunk_assets a ON a.id = g.asset_id AND a.workspace_id = g.workspace_id
       WHERE g.workspace_id = ? ORDER BY g.created_at DESC, g.id DESC LIMIT 50`,
    ).bind(workspaceId).all();
    return privateJson({ ok: true, jobs: jobs.results });
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
    const payload = await parseJson<GenerationPayload>(request, 512 * 1024);
    const assetKind = payload.assetKind;
    if (typeof assetKind !== "string" || !ASSET_KINDS.has(assetKind as AssetKind)) {
      return privateJson({ ok: false, error: "Unsupported assetKind." }, { status: 400 });
    }
    if (typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 80) {
      return privateJson({ ok: false, error: "A label between 1 and 80 characters is required." }, { status: 400 });
    }
    if (typeof payload.prompt !== "string" || !payload.prompt.trim() || payload.prompt.length > 2_000) {
      return privateJson({ ok: false, error: "A prompt between 1 and 2,000 characters is required." }, { status: 400 });
    }
    const prompt = payload.prompt.trim();
    const db = getRuntimeDb();
    let projectId: string | null = null;
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
    if (!hasRuntimeAssets()) {
      return privateJson({
        ok: false,
        schema: "clunk.asset-generation-result.v1",
        status: "STORAGE_NOT_CONFIGURED",
        storageStatus: "UNAVAILABLE",
        credits: null,
        idempotent: false,
        error: "실제 생성 결과를 보관하려면 R2 ASSETS 연결이 필요합니다. 크레딧은 차감되지 않았습니다.",
      }, { status: 503 });
    }
    const targetProfileId = typeof payload.targetProfileId === "string" && payload.targetProfileId.trim()
      ? payload.targetProfileId.trim()
      : TARGET_BY_KIND[assetKind as AssetKind];
    // The recipe draws a placeholder whose picture the prompt did not choose. For a
    // single 2D image, ask the image model first and hand its bytes to the recipe as the
    // entry artifact: the plan, evidence and inspection below then describe the file that
    // actually ships, rather than describing a drawing nobody receives.
    //
    // A refusal or an outage is returned to the caller instead of being papered over with
    // the placeholder, because a credit is about to be charged and the person paying it
    // should not get a circle when they asked for a farmer.
    let generatedEntry: { bytes: Uint8Array; fileName: string; contentType: string } | undefined;
    let imageProvider: string | null = null;
    if (assetKind === "2d-image") {
      // The free allowance is checked before the model is asked and before a credit is
      // charged. A refusal here costs the caller nothing and tells them when to come back.
      const budget = await reserveImageBudget(db, workspaceId, { model: IMAGE_MODEL });
      if (budget.status !== "OK") {
        return privateJson(budgetRefusal(budget), { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((Date.parse(budget.resetsAt) - Date.now()) / 1000))) } });
      }
      const generated = await generateImage({ prompt });
      // No binding means no call was made, so the seat goes back. Every other outcome —
      // including a rejection or a failure — was a real call and stays on the ledger.
      if (generated.status === "BINDING_UNAVAILABLE") await releaseImageBudget(db, budget.reservationId);
      if (generated.status === "GENERATED") {
        generatedEntry = {
          bytes: generated.bytes,
          fileName: `${payload.label.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clunk-asset"}.jpg`,
          contentType: generated.contentType,
        };
        imageProvider = generated.model;
      } else if (generated.status === "REJECTED") {
        return privateJson({ ok: false, status: "PROMPT_REJECTED", error: generated.reason }, { status: 422 });
      } else if (generated.status === "FAILED") {
        return privateJson({ ok: false, status: "IMAGE_MODEL_UNAVAILABLE", error: generated.reason }, { status: 503 });
      }
      // BINDING_UNAVAILABLE falls through to the recipe; the response names the provider.
    }

    const result = createProceduralAuthoring({
      assetKind: assetKind as AssetKind,
      label: payload.label,
      prompt,
      targetProfileId,
      ...(payload.width !== undefined ? { width: payload.width } : {}),
      ...(payload.height !== undefined ? { height: payload.height } : {}),
      ...(payload.frames !== undefined ? { frames: payload.frames } : {}),
      ...(generatedEntry ? { entry: generatedEntry } : {}),
      ...(payload.license !== undefined ? { license: payload.license } : {}),
    });
    const entry = result.artifacts.find((artifact) => artifact.role === "entry") ?? result.artifacts[0];
    if (!entry) throw new Error("Generated result has no entry artifact.");

    const generationId = `gen-${result.plan.requestHash.slice(0, 32)}`;
    const assetId = scopedStorageId("asset", workspaceId, entry.sha256);
    const idempotencyKey = readIdempotencyKey(request, payload.idempotencyKey, result.plan.requestHash);
    const artifactRows = result.artifacts.map((artifact) => {
      const objectKey = `workspaces/${workspaceId}/assets/${assetId}/${artifact.fileName}`;
      return { artifact, objectKey, id: scopedStorageId("artifact", workspaceId, `${assetId}:${artifact.fileName}`) };
    });
    const storageRows = artifactRows.map(({ artifact, objectKey }) => ({
      fileName: artifact.fileName,
      objectKey,
      byteLength: artifact.byteLength,
    }));
    const provenanceJson = JSON.stringify(result.provenance);
    const evidenceJson = JSON.stringify(result.evidence);
    const recipeJson = JSON.stringify(projectId ? { ...result.plan.recipe, projectId } : result.plan.recipe);
    const fingerprint = canonicalFingerprint({
      operation: "generate",
      generationId,
      idempotencyKey,
      projectId,
      assetKind,
      targetProfileId,
      label: payload.label.trim(),
      prompt,
      recipe: result.plan.recipe,
      artifacts: result.artifacts.map((artifact) => ({ fileName: artifact.fileName, sha256: artifact.sha256 })),
    });
    const reservation = await reserveCreditOperation(db, workspaceId, {
      key: `generate:${idempotencyKey}`,
      fingerprint,
      kind: "generate",
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
      ).bind(generationId, workspaceId, projectId, assetId, assetKind, targetProfileId, "clunk-procedural-v1", prompt, recipeJson, provenanceJson, evidenceJson, storageStatus, reservation.operationId, workspaceId),
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
      // A retried request must not infer storage from an already-applied credit
      // row. Reopen every object before claiming STORED or returning download
      // links; a bytesBase64 response alone is never a persistence guarantee.
      storageStatus = await verifyStorageEvidence(getRuntimeAssets(), storageRows);
      storageVerified = true;
      persistenceCommitted = true;
    }

    const staticStatus = result.evidence.stages.structure.status === "pass" && result.evidence.stages.policy.status === "pass" ? "PASS" : "GAP";
    const runtimeStatus = result.evidence.stages.runtime.status === "pass" ? "PASS" : result.evidence.stages.runtime.status === "environmentUnavailable" ? "UNAVAILABLE" : "GAP";
    const publication = publicationReadiness({
      artifactStored: storageVerified,
      provenanceComplete: true,
      licenseStatus: result.provenance.license === "creator-owned" ? "cleared" : "review-required",
      staticStatus,
      visualRuntime: runtimeStatus,
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
    });
    return privateJson({
      ok: true,
      schema: "clunk.asset-generation-result.v1",
      generationId,
      assetId,
      ...(projectId ? { projectId } : {}),
      status: "COMPLETED",
      // Which one drew this. A caller that asked for a farmer and received the recipe
      // placeholder has to be able to tell without opening the file.
      provider: result.provenance.provider,
      ...(assetKind === "2d-image" && !imageProvider
        ? { promptApplied: false, promptNote: "이미지 모델이 연결되지 않아 레시피가 규격에 맞는 파일을 그렸습니다. 프롬프트는 제작 기록에만 남았습니다." }
        : {}),
      ...(imageProvider ? { promptApplied: true, imageModel: imageProvider } : {}),
      entryFileName: result.entryFileName,
      storageStatus,
      artifacts: result.artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        role: artifact.role,
        contentType: artifact.contentType,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        bytesBase64: bytesToBase64(artifact.bytes),
        previewUrl: artifact.role !== "entry" ? `/api/marketplace/assets/${assetId}?file=${encodeURIComponent(artifact.fileName)}` : null,
      })),
      provenance: result.provenance,
      evidence: result.evidence,
      publication: { status: "DRAFT_ONLY", readiness: publication, publishable: false },
      credits,
      idempotent,
      creditOperation: { operationId: reservation.operationId, status: "APPLIED" },
      limitations: [
        "PROCEDURAL_AUTHORED 결과는 실제 바이트와 hash를 갖지만 AI 생성 품질이나 사람 승인을 의미하지 않습니다.",
        "visualRuntime, playerFacing, humanDecision은 별도 증거가 없으면 승격되지 않습니다.",
        "원본과 bundle 파일은 private R2에 저장되었습니다.",
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
        // The request error remains primary; the operation stays auditable for reconciliation.
      }
    }
    if (storedKeys.length && ownsStorageWrite && !persistenceCommitted && hasRuntimeAssets()) {
      try {
        const bucket = getRuntimeAssets();
        await Promise.all(storedKeys.map((key) => bucket.delete(key)));
      } catch {
        // Do not replace the original request error with cleanup diagnostics.
      }
    }
    return jsonError(error);
  }
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
