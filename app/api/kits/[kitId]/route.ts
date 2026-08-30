import {
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  privateJson,
  requireClunkContext,
} from "../../_lib/clunk";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ kitId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { workspaceId } = await requireClunkContext();
    const { kitId } = await context.params;
    if (!isSafeRecordId(kitId, 256)) return privateJson({ ok: false, error: "Kit not found." }, { status: 404 });
    const db = getRuntimeDb();
    const kit = await db.prepare(
      `SELECT id, title, description, status, manifest_json AS manifestJson, created_at AS createdAt, updated_at AS updatedAt
       FROM clunk_asset_kits WHERE id = ? AND workspace_id = ? LIMIT 1`,
    ).bind(kitId, workspaceId).first<{ id: string; title: string; description: string; status: string; manifestJson: string; createdAt: string; updatedAt: string }>();
    if (!kit) return privateJson({ ok: false, error: "Kit not found." }, { status: 404 });
    const members = await db.prepare(
      `SELECT m.asset_id AS assetId, m.role, m.source_hash AS sourceHash, m.position,
        a.file_name AS fileName, a.format, a.byte_length AS byteLength
       FROM clunk_asset_kit_members m JOIN clunk_assets a ON a.id = m.asset_id AND a.workspace_id = m.workspace_id
       WHERE m.kit_id = ? AND m.workspace_id = ? ORDER BY m.position ASC`,
    ).bind(kitId, workspaceId).all();
    const manifest = parseJson(kit.manifestJson);
    const payload = { ok: true, schema: "clunk.asset-kit-detail.v1", kit: { ...kit, manifest, members: members.results } };
    if (new URL(request.url).searchParams.get("download") === "manifest") {
      return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "private, no-store",
          "content-disposition": `attachment; filename="${safeName(kit.title)}.clunk.json"`,
        },
      });
    }
    return privateJson(payload);
  } catch (error) {
    return jsonError(error);
  }
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function safeName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80) || "clunk-kit";
}
