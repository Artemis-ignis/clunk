import {
  getRuntimeAssets,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  privateJson,
  requireClunkContext,
} from "../../_lib/clunk";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { workspaceId } = await requireClunkContext();
    const { assetId } = await context.params;
    if (!isSafeRecordId(assetId, 256)) return privateJson({ ok: false, error: "Asset not found." }, { status: 404 });
    const url = new URL(request.url);
    const fileName = url.searchParams.get("file");
    if (fileName && (!isSafeRecordId(fileName, 256) || fileName.includes("/"))) {
      return privateJson({ ok: false, error: "Artifact not found." }, { status: 404 });
    }
    const db = getRuntimeDb();
    const asset = await db.prepare(
      `SELECT id, file_name AS fileName, format, byte_length AS byteLength, sha256, created_at AS createdAt
       FROM clunk_assets WHERE id = ? AND workspace_id = ? LIMIT 1`,
    ).bind(assetId, workspaceId).first<{
      id: string;
      fileName: string;
      format: string;
      byteLength: number;
      sha256: string;
      createdAt: string;
    }>();
    if (!asset) return privateJson({ ok: false, error: "Asset not found." }, { status: 404 });

    const artifacts = await db.prepare(
      `SELECT file_name AS fileName, role, content_type AS contentType, byte_length AS byteLength, sha256, object_key AS objectKey
       FROM clunk_asset_artifacts WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at ASC, file_name ASC`,
    ).bind(assetId, workspaceId).all<{
      fileName: string;
      role: string;
      contentType: string;
      byteLength: number;
      sha256: string;
      objectKey: string | null;
    }>();
    const artifact = fileName
      ? artifacts.results.find((candidate) => candidate.fileName === fileName)
      : undefined;
    if (fileName && !artifact) return privateJson({ ok: false, error: "Artifact not found." }, { status: 404 });
    if (artifact) {
      if (!artifact.objectKey) {
        return privateJson({ ok: false, error: "이 artifact는 R2에 저장되지 않아 다운로드할 수 없습니다.", storageStatus: "UNAVAILABLE" }, { status: 503 });
      }
      const object = await getRuntimeAssets().get(artifact.objectKey);
      if (!object?.body) return privateJson({ ok: false, error: "저장된 artifact를 찾지 못했습니다." }, { status: 404 });
      const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
      return new Response(object.body, {
        headers: {
          "content-type": artifact.contentType,
          "cache-control": "private, no-store",
          "content-disposition": `${disposition}; filename="${safeDownloadName(artifact.fileName)}"`,
          "x-clunk-sha256": artifact.sha256,
        },
      });
    }

    const generation = await db.prepare(
      `SELECT id, project_id AS projectId, provider, status, prompt, recipe_json AS recipeJson, provenance_json AS provenanceJson,
        evidence_json AS evidenceJson, storage_status AS storageStatus, created_at AS createdAt
       FROM clunk_generation_jobs WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(assetId, workspaceId).first();
    const review = await db.prepare(
      `SELECT visual_runtime AS visualRuntime, player_facing AS playerFacing, human_decision AS humanDecision,
        note, evidence_json AS evidenceJson, created_at AS createdAt
       FROM clunk_asset_reviews WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(assetId, workspaceId).first();
    const passport = await db.prepare(
      `SELECT id, source_hash AS sourceHash, output_hash AS outputHash, created_at AS createdAt
       FROM clunk_passports WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(assetId, workspaceId).first();
    const kits = await db.prepare(
      `SELECT k.id, k.title, k.status FROM clunk_asset_kits k
       JOIN clunk_asset_kit_members m ON m.kit_id = k.id AND m.workspace_id = k.workspace_id
       WHERE m.asset_id = ? AND k.workspace_id = ? ORDER BY k.created_at DESC`,
    ).bind(assetId, workspaceId).all();
    return privateJson({
      ok: true,
      schema: "clunk.workspace-asset.v1",
      asset,
      artifacts: artifacts.results.map((candidate) => ({
        fileName: candidate.fileName,
        role: candidate.role,
        contentType: candidate.contentType,
        byteLength: candidate.byteLength,
        sha256: candidate.sha256,
      })),
      generation: generation ?? null,
      review: review ?? null,
      passport: passport ?? null,
      kits: kits.results,
      storageStatus: artifacts.results.some((candidate) => Boolean(candidate.objectKey)) ? "STORED" : "LOCAL_PREVIEW_ONLY",
    });
  } catch (error) {
    return jsonError(error);
  }
}

function safeDownloadName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
