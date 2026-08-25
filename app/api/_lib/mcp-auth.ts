import { ensureSchema, getRuntimeDb, type ClunkUserContext } from "./clunk";
import { parseBearerToken } from "./mcp-http";
import { hashMcpApiKey, isMcpApiKey } from "./mcp-api-key";
import { ClunkHttpError } from "./http-error";

export type McpApiKeyContext = {
  workspaceId: string;
  keyId: string;
  keyPrefix: string;
};

export async function requireMcpApiKey(request: Request): Promise<McpApiKeyContext> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !isMcpApiKey(token)) {
    throw new ClunkHttpError("A Clunk API key is required in Authorization: Bearer <key>.", 401);
  }
  const db = getRuntimeDb();
  await ensureSchema(db);
  const row = await db
    .prepare(
      `SELECT id AS keyId, workspace_id AS workspaceId, key_prefix AS keyPrefix
       FROM clunk_api_keys
       WHERE key_hash = ? AND revoked_at IS NULL LIMIT 1`,
    )
    .bind(hashMcpApiKey(token))
    .first<{ keyId: string; workspaceId: string; keyPrefix: string }>();
  if (!row) throw new ClunkHttpError("This Clunk API key is invalid or revoked.", 401);
  await db
    .prepare(`UPDATE clunk_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(row.keyId)
    .run();
  return row;
}

export function workspaceFromApiKey(context: McpApiKeyContext): Pick<ClunkUserContext, "workspaceId"> {
  return { workspaceId: context.workspaceId };
}
