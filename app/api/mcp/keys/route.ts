import {
  assertSameOrigin,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../../_lib/clunk";
import { createMcpApiKeyMaterial } from "../../_lib/mcp-api-key";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireClunkContext();
    const rows = await getRuntimeDb()
      .prepare(
        `SELECT id, label, key_prefix AS prefix, created_at AS createdAt,
          last_used_at AS lastUsedAt, revoked_at AS revokedAt
         FROM clunk_api_keys WHERE workspace_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .bind(workspaceId)
      .all();
    return privateJson({ ok: true, endpoint: endpointForRequest(request), keys: rows.results ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{ label?: unknown }>(request, 16 * 1024);
    const label = typeof payload?.label === "string" && payload.label.trim() ? payload.label.trim() : "Clunk MCP 연결";
    if (label.length > 80) return privateJson({ ok: false, error: "Label is too long." }, { status: 400 });
    const material = createMcpApiKeyMaterial();
    const id = scopedStorageId("mcpkey", workspaceId, crypto.randomUUID());
    await getRuntimeDb()
      .prepare(
        `INSERT INTO clunk_api_keys (id, workspace_id, label, key_prefix, key_hash)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, workspaceId, label, material.prefix, material.hash)
      .run();
    return privateJson(
      {
        ok: true,
        endpoint: endpointForRequest(request),
        key: {
          id,
          label,
          prefix: material.prefix,
          secret: material.secret,
          displayOnce: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}

function endpointForRequest(request?: Request): string {
  if (!request) return "/mcp";
  return `${new URL(request.url).origin}/mcp`;
}
