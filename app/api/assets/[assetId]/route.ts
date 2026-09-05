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
    // 파일 이름은 사람이 붙인 이름에서 나오고, 이 제품의 기본 이름은 한국어다("새 에셋" →
    // "새-에셋.glb"). ASCII 만 허용하던 검사는 그 파일들을 통째로 404 로 만들어,
    // 미리보기도 받기도 되지 않게 했다. 이 값은 아래에서 작업공간에 속한 artifact 행과
    // 문자열 일치 비교에만 쓰이고, 실제로 여는 키(objectKey)는 DB 행에서 온다 —
    // 그래서 경로 조작에 쓰일 수 없다. 남은 위험(경로 구분자·제어 문자)만 막는다.
    if (fileName !== null && !isSafeArtifactFileName(fileName)) {
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
        return privateJson({ ok: false, error: "이 파일은 저장소에 올라가지 않아 아직 받을 수 없습니다.", storageStatus: "UNAVAILABLE" }, { status: 503 });
      }
      const object = await getRuntimeAssets().get(artifact.objectKey);
      if (!object?.body) return privateJson({ ok: false, error: "저장된 파일을 찾지 못했습니다." }, { status: 404 });
      const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
      return new Response(object.body, {
        headers: {
          "content-type": artifact.contentType,
          "cache-control": "private, no-store",
          // ASCII 로 접은 이름은 오래된 클라이언트용 자리이고, filename* 이 사람이 붙인
          // 이름(한국어 포함)을 그대로 전한다 — 받은 파일 이름이 "--.glb" 가 되지 않도록.
          "content-disposition":
            `${disposition}; filename="${safeDownloadName(artifact.fileName)}"; ` +
            `filename*=UTF-8''${encodeRFC5987(artifact.fileName)}`,
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

/**
 * `?file=` 로 넘어온 값이 하나의 파일 이름인지만 본다. 값은 이 작업공간의 artifact 행과
 * 문자열 일치 비교에만 쓰이므로(여는 키는 DB 가 준다) 글자 집합을 좁힐 이유가 없고,
 * 좁히면 한국어 이름의 파일이 통째로 사라진다. 막는 것은 경로가 될 수 있는 값뿐이다.
 */
function isSafeArtifactFileName(value: string): boolean {
  if (value.length === 0 || value.length > 256) return false;
  if (value === "." || value === "..") return false;
  // 경로 구분자·널·제어 문자.
  if (value.includes("/") || value.includes("\\")) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/** RFC 5987 (content-disposition filename*) 인코딩. */
function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
