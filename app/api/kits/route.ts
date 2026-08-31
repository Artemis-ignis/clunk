import {
  assertSameOrigin,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson as parseRequestJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../_lib/clunk";
import { createKitManifest, type FoundryArtifactRef } from "../../../packages/core/src/foundry-contract";

export const dynamic = "force-dynamic";

type KitMemberPayload = { assetId?: unknown; role?: unknown };

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const rows = await getRuntimeDb().prepare(
      `SELECT k.id, k.title, k.description, k.status, k.manifest_json AS manifestJson,
        k.created_at AS createdAt, k.updated_at AS updatedAt, COUNT(m.asset_id) AS memberCount
       FROM clunk_asset_kits k LEFT JOIN clunk_asset_kit_members m ON m.kit_id = k.id AND m.workspace_id = k.workspace_id
       WHERE k.workspace_id = ? GROUP BY k.id ORDER BY k.updated_at DESC, k.id DESC LIMIT 50`,
    ).bind(workspaceId).all();
    return privateJson({
      ok: true,
      schema: "clunk.kits.v1",
      kits: rows.results.map((row) => ({ ...row, manifest: parseJson(row.manifestJson) })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseRequestJson<{ title?: unknown; description?: unknown; members?: unknown; assetIds?: unknown }>(request, 64 * 1024);
    if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 120) {
      return privateJson({ ok: false, error: "Kit 이름은 1자 이상 120자 이하이어야 합니다." }, { status: 400 });
    }
    if (payload.description !== undefined && (typeof payload.description !== "string" || payload.description.length > 2_000)) {
      return privateJson({ ok: false, error: "Kit 설명은 2,000자 이하이어야 합니다." }, { status: 400 });
    }
    const members = normalizeMembers(payload.members ?? payload.assetIds);
    if (!members.length || members.length > 12) return privateJson({ ok: false, error: "Kit에는 1개 이상 12개 이하의 asset이 필요합니다." }, { status: 400 });
    const db = getRuntimeDb();
    const resolved = [] as Array<{ assetId: string; role: string; sourceHash: string; artifacts: FoundryArtifactRef[] }>;
    for (const member of members) {
      const asset = await db.prepare(
        `SELECT id, sha256 FROM clunk_assets WHERE id = ? AND workspace_id = ? LIMIT 1`,
      ).bind(member.assetId, workspaceId).first<{ id: string; sha256: string }>();
      if (!asset) return privateJson({ ok: false, error: `Workspace에 없는 asset입니다: ${member.assetId}` }, { status: 404 });
      const artifacts = await db.prepare(
        `SELECT file_name AS fileName, role, content_type AS contentType, byte_length AS byteLength, sha256
         FROM clunk_asset_artifacts WHERE asset_id = ? AND workspace_id = ? ORDER BY file_name ASC`,
      ).bind(asset.id, workspaceId).all<FoundryArtifactRef>();
      resolved.push({ assetId: asset.id, role: member.role, sourceHash: asset.sha256, artifacts: artifacts.results });
    }
    const kitId = scopedStorageId("kit", workspaceId, `${new Date().toISOString()}:${crypto.randomUUID()}`);
    const manifest = createKitManifest({
      kitId,
      title: payload.title,
      description: typeof payload.description === "string" ? payload.description : "",
      members: resolved,
    });
    await db.batch([
      db.prepare(
        `INSERT INTO clunk_asset_kits (id, workspace_id, title, description, status, manifest_json) VALUES (?, ?, ?, ?, 'DRAFT', ?)`,
      ).bind(kitId, workspaceId, manifest.title, manifest.description, JSON.stringify(manifest)),
      ...resolved.map((member, position) => db.prepare(
        `INSERT INTO clunk_asset_kit_members (kit_id, workspace_id, asset_id, role, source_hash, position) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(kitId, workspaceId, member.assetId, member.role, member.sourceHash, position)),
    ]);
    return privateJson({ ok: true, schema: "clunk.asset-kit.v1", kit: manifest, status: "DRAFT" });
  } catch (error) {
    return jsonError(error);
  }
}

function normalizeMembers(value: unknown): Array<{ assetId: string; role: string }> {
  if (!Array.isArray(value)) return [];
  const members: Array<{ assetId: string; role: string }> = [];
  for (const item of value) {
    const source = typeof item === "string" ? { assetId: item, role: "member" } : item as KitMemberPayload;
    if (!isSafeRecordId(source?.assetId, 256)) return [];
    if (members.some((member) => member.assetId === source.assetId)) return [];
    members.push({ assetId: source.assetId, role: typeof source.role === "string" && source.role.trim() ? source.role.trim().slice(0, 64) : "member" });
  }
  return members;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}
