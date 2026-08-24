import {
  assertSameOrigin,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
  isSafeRecordId,
  ClunkHttpError,
} from "../../../../_lib/clunk";
import {
  parseMessagePayload,
  parseStoredStatus,
  resolveStoredStatus,
  statusJson,
} from "../../../../_lib/collaboration";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

async function getThreadId(context: RouteContext): Promise<string> {
  const { threadId } = await context.params;
  if (!isSafeRecordId(threadId, 256)) throw new ClunkHttpError("Invalid collaboration thread id.", 400);
  return threadId;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { workspaceId } = await requireClunkContext();
    const threadId = await getThreadId(context);
    const db = getRuntimeDb();
    const messages = await db
      .prepare(
        `SELECT id, author_user_id AS authorUserId, body, asset_id AS assetId,
          input_hash AS inputHash, target_profile_id AS targetProfileId,
          status_json AS status, created_at AS createdAt
         FROM clunk_collaboration_messages
         WHERE thread_id = ? AND workspace_id = ? ORDER BY created_at ASC, id ASC`,
      )
      .bind(threadId, workspaceId)
      .all();
    return privateJson({
      ok: true,
      messages: (messages.results ?? []).map((message) => {
        const row = message as Record<string, unknown>;
        return { ...row, status: parseStoredStatus(JSON.parse(String(row.status ?? "{}"))) };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const threadId = await getThreadId(context);
    const db = getRuntimeDb();
    const thread = await db
      .prepare(
        `SELECT id, asset_id AS assetId, input_hash AS inputHash,
          target_profile_id AS targetProfileId, rule_set_id AS ruleSetId,
          status_json AS status
         FROM clunk_collaboration_threads WHERE id = ? AND workspace_id = ?`,
      )
      .bind(threadId, workspaceId)
      .first<Record<string, unknown>>();
    if (!thread) return privateJson({ ok: false, error: "Collaboration thread not found." }, { status: 404 });

    const payload = parseMessagePayload(await parseJson<unknown>(request));
    const status = payload.status
      ? resolveStoredStatus(payload.status)
      : parseStoredStatus(JSON.parse(String(thread.status ?? "{}")));
    const messageId = scopedStorageId("message", workspaceId, `${threadId}:${crypto.randomUUID()}`);
    await db
      .prepare(
        `INSERT INTO clunk_collaboration_messages
         (id, thread_id, workspace_id, author_user_id, body, asset_id, input_hash, target_profile_id, status_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        messageId,
        threadId,
        workspaceId,
        user.userId,
        payload.body,
        payload.assetId ?? thread.assetId ?? null,
        payload.inputHash,
        payload.targetProfileId,
        statusJson(status),
      )
      .run();
    await db
      .prepare(`UPDATE clunk_collaboration_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`)
      .bind(threadId, workspaceId)
      .run();
    return privateJson({ ok: true, messageId, status }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
