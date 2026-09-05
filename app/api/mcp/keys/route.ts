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

/**
 * 한 작업공간이 동시에 살려 둘 수 있는 연결 키의 수.
 *
 * 상한이 없었다. 키 하나로 클라이언트를 전부 연결하는 것이 이 제품의 설계이므로 사람이
 * 실제로 필요한 수는 손가락으로 셀 수 있고, 그보다 많은 키는 관리되지 않는 키다 —
 * 어디에 붙어 있는지 아무도 모르는 채 유효한 자격증명이 늘어난다. 넘으면 만들지 않고,
 * 폐기하고 다시 만들라고 말한다.
 */
const MAX_ACTIVE_KEYS_PER_WORKSPACE = 10;

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
    const active = await getRuntimeDb()
      .prepare(`SELECT COUNT(*) AS count FROM clunk_api_keys WHERE workspace_id = ? AND revoked_at IS NULL`)
      .bind(workspaceId)
      .first<{ count: number }>();
    if (Number(active?.count ?? 0) >= MAX_ACTIVE_KEYS_PER_WORKSPACE) {
      return privateJson(
        {
          ok: false,
          error: `연결 키는 작업공간당 ${MAX_ACTIVE_KEYS_PER_WORKSPACE}개까지 살려 둘 수 있습니다. 쓰지 않는 키를 폐기한 뒤 다시 만드세요.`,
          activeKeys: Number(active?.count ?? 0),
          maxActiveKeys: MAX_ACTIVE_KEYS_PER_WORKSPACE,
        },
        { status: 409 },
      );
    }
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
  if (!request) return "/api/mcp";
  return `${new URL(request.url).origin}/api/mcp`;
}
