import {
  applyCreditOperation,
  assertSameOrigin,
  canonicalFingerprint,
  getRuntimeAssets,
  getRuntimeDb,
  hasRuntimeAssets,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../_lib/clunk";
import { createProceduralAuthoring, type ProceduralAuthoringRequest } from "../../../packages/core/src/product-authoring";
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

type GenerationPayload = Partial<ProceduralAuthoringRequest>;

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const jobs = await db.prepare(
      `SELECT id, asset_id AS assetId, asset_kind AS assetKind, target_profile_id AS targetProfileId,
        provider, prompt, status, storage_status AS storageStatus, provenance_json AS provenanceJson,
        evidence_json AS evidenceJson, created_at AS createdAt, updated_at AS updatedAt
       FROM clunk_generation_jobs WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
    ).bind(workspaceId).all();
    return privateJson({ ok: true, jobs: jobs.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
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
    const targetProfileId = typeof payload.targetProfileId === "string" && payload.targetProfileId.trim()
      ? payload.targetProfileId.trim()
      : TARGET_BY_KIND[assetKind as AssetKind];
    const result = createProceduralAuthoring({
      assetKind: assetKind as AssetKind,
      label: payload.label,
      prompt: payload.prompt,
      targetProfileId,
      ...(payload.width !== undefined ? { width: payload.width } : {}),
      ...(payload.height !== undefined ? { height: payload.height } : {}),
      ...(payload.frames !== undefined ? { frames: payload.frames } : {}),
      ...(payload.license !== undefined ? { license: payload.license } : {}),
    });
    const entry = result.artifacts.find((artifact) => artifact.role === "entry") ?? result.artifacts[0];
    if (!entry) throw new Error("Generated result has no entry artifact.");
    const generationId = `gen-${result.plan.requestHash.slice(0, 32)}`;
    const assetId = scopedStorageId("asset", workspaceId, entry.sha256);
    const storageAvailable = hasRuntimeAssets();
    const storageStatus = storageAvailable ? "STORED" : "LOCAL_PREVIEW_ONLY";
    const artifactRows = result.artifacts.map((artifact) => {
      const objectKey = `workspaces/${workspaceId}/assets/${assetId}/${artifact.fileName}`;
      return { artifact, objectKey, id: scopedStorageId("artifact", workspaceId, `${assetId}:${artifact.fileName}`) };
    });
    if (storageAvailable) {
      const bucket = getRuntimeAssets();
      await Promise.all(artifactRows.map(async ({ artifact, objectKey }) => {
        await bucket.put(objectKey, artifact.bytes, { httpMetadata: { contentType: artifact.contentType } });
        storedKeys.push(objectKey);
      }));
    }

    const db = getRuntimeDb();
    const provenanceJson = JSON.stringify(result.provenance);
    const evidenceJson = JSON.stringify(result.evidence);
    const recipeJson = JSON.stringify(result.plan.recipe);
    const statements = [
      db.prepare(
        `INSERT OR IGNORE INTO clunk_assets (id, workspace_id, file_name, format, byte_length, sha256) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(assetId, workspaceId, entry.fileName, extensionOf(entry.fileName), entry.byteLength, entry.sha256),
      ...artifactRows.map(({ artifact, objectKey, id }) => db.prepare(
        `INSERT OR IGNORE INTO clunk_asset_artifacts (id, workspace_id, asset_id, file_name, role, content_type, byte_length, sha256, object_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, workspaceId, assetId, artifact.fileName, artifact.role, artifact.contentType, artifact.byteLength, artifact.sha256, storageAvailable ? objectKey : null)),
      db.prepare(
        `INSERT OR REPLACE INTO clunk_generation_jobs (id, workspace_id, asset_id, asset_kind, target_profile_id, provider, prompt, status, recipe_json, provenance_json, evidence_json, storage_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).bind(generationId, workspaceId, assetId, assetKind, targetProfileId, "clunk-procedural-v1", payload.prompt.trim(), recipeJson, provenanceJson, evidenceJson, storageStatus),
    ];
    let credits: number | null = null;
    let idempotent = false;
    if (storageAvailable) {
      const credit = await applyCreditOperation(
        db,
        workspaceId,
        {
          key: `generate:${generationId}`,
          fingerprint: canonicalFingerprint({ generationId, assetKind, targetProfileId, prompt: payload.prompt.trim(), recipe: result.plan.recipe, artifacts: result.artifacts.map((artifact) => ({ fileName: artifact.fileName, sha256: artifact.sha256 })) }),
          kind: "generate",
          amount: -1,
        },
        () => statements,
      );
      credits = credit.balance;
      idempotent = credit.idempotent;
    } else {
      await db.batch(statements);
    }

    const staticStatus = result.evidence.stages.structure.status === "pass" && result.evidence.stages.policy.status === "pass" ? "PASS" : "GAP";
    const runtimeStatus = result.evidence.stages.runtime.status === "pass" ? "PASS" : result.evidence.stages.runtime.status === "environmentUnavailable" ? "UNAVAILABLE" : "GAP";
    const publication = publicationReadiness({
      artifactStored: storageAvailable,
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
      status: "COMPLETED",
      provider: "clunk-procedural-v1",
      entryFileName: result.entryFileName,
      storageStatus,
      artifacts: result.artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        role: artifact.role,
        contentType: artifact.contentType,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        bytesBase64: bytesToBase64(artifact.bytes),
        previewUrl: storageAvailable && artifact.role !== "entry" ? `/api/marketplace/assets/${assetId}?file=${encodeURIComponent(artifact.fileName)}` : null,
      })),
      provenance: result.provenance,
      evidence: result.evidence,
      publication: { status: "DRAFT_ONLY", readiness: publication, publishable: false },
      credits,
      idempotent,
      limitations: [
        "PROCEDURAL_AUTHORED 결과는 실제 바이트와 hash를 갖지만 AI 생성 품질이나 사람 승인을 의미하지 않습니다.",
        "visualRuntime, playerFacing, humanDecision은 별도 증거가 없으면 승격되지 않습니다.",
        storageAvailable ? "원본과 bundle 파일은 private R2에 저장되었습니다." : "R2가 연결되지 않아 이번 결과는 로컬 미리보기와 D1 metadata만 남았습니다.",
      ],
    });
  } catch (error) {
    if (storedKeys.length && hasRuntimeAssets()) {
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
