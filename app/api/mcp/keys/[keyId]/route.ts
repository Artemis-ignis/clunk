import {
  assertSameOrigin,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  privateJson,
  requireClunkContext,
  ClunkHttpError,
} from "../../../_lib/clunk";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ keyId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const { keyId } = await context.params;
    if (!isSafeRecordId(keyId, 256)) throw new ClunkHttpError("Invalid Clunk API key id.", 400);
    const result = await getRuntimeDb()
      .prepare(`UPDATE clunk_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL`)
      .bind(keyId, workspaceId)
      .run();
    const changes = Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0);
    if (!changes) return privateJson({ ok: false, error: "Clunk API key not found or already revoked." }, { status: 404 });
    return privateJson({ ok: true, keyId, revoked: true });
  } catch (error) {
    return jsonError(error);
  }
}
