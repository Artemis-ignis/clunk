import {
  assertSameOrigin,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  isSafeRecordId,
  ClunkHttpError,
} from "../../../_lib/clunk";
import {
  evidenceJson,
  mergeStoredEvidence,
  parseThreadPayload,
  parseStoredEvidence,
  resolveStoredStatus,
  statusJson,
} from "../../../_lib/collaboration";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

function readStatus(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { readiness: "BLOCKED", error: "Stored collaboration status is invalid." };
  }
}

async function getThreadId(context: RouteContext): Promise<string> {
  const { threadId } = await context.params;
  if (!isSafeRecordId(threadId, 256)) throw new ClunkHttpError("Invalid collaboration thread id.", 400);
  return threadId;
}

async function findThread(db: D1Database, workspaceId: string, threadId: string) {
  return db
    .prepare(
      `SELECT id, subject, asset_id AS assetId, input_hash AS inputHash,
        target_profile_id AS targetProfileId, rule_set_id AS ruleSetId,
        status_json AS status, created_by AS createdBy, created_at AS createdAt,
        updated_at AS updatedAt, evidence_json AS evidence
       FROM clunk_collaboration_threads WHERE id = ? AND workspace_id = ?`,
    )
    .bind(threadId, workspaceId)
    .first<Record<string, unknown>>();
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { workspaceId } = await requireClunkContext();
    const threadId = await getThreadId(context);
    const db = getRuntimeDb();
    const row = await findThread(db, workspaceId, threadId);
    if (!row) return privateJson({ ok: false, error: "Collaboration thread not found." }, { status: 404 });
    const messages = await db
      .prepare(
        `SELECT id, author_user_id AS authorUserId, body, asset_id AS assetId,
          input_hash AS inputHash, target_profile_id AS targetProfileId,
          status_json AS status, created_at AS createdAt, evidence_json AS evidence
         FROM clunk_collaboration_messages
         WHERE thread_id = ? AND workspace_id = ? ORDER BY created_at ASC, id ASC`,
      )
      .bind(threadId, workspaceId)
      .all();
    return privateJson({
      ok: true,
      thread: {
        ...row,
        status: readStatus(String(row.status ?? "{}")),
        messages: (messages.results ?? []).map((message) => ({
          ...message,
          status: readStatus(String((message as Record<string, unknown>).status ?? "{}")),
          evidence: parseStoredEvidence((message as Record<string, unknown>).evidence),
        })),
        evidence: parseStoredEvidence(row.evidence),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const threadId = await getThreadId(context);
    const payload = parseThreadPayload(await parseJson<unknown>(request));
    const status = resolveStoredStatus(payload);
    const db = getRuntimeDb();
    const existing = await findThread(db, workspaceId, threadId);
    if (!existing) return privateJson({ ok: false, error: "Collaboration thread not found." }, { status: 404 });
    const evidence = mergeStoredEvidence(
      parseStoredEvidence(existing.evidence),
      payload.evidence,
      payload.evidenceMode,
    );
    await db
      .prepare(
        `UPDATE clunk_collaboration_threads
         SET subject = ?, asset_id = ?, input_hash = ?, target_profile_id = ?,
           rule_set_id = ?, status_json = ?, updated_at = CURRENT_TIMESTAMP
           , evidence_json = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .bind(
        payload.subject,
        payload.assetId ?? null,
        payload.inputHash,
        payload.profileId,
        payload.ruleSetId,
        statusJson(status),
        evidenceJson(evidence ?? undefined),
        threadId,
        workspaceId,
      )
      .run();
    return privateJson({ ok: true, threadId, status, evidence: evidence ?? null, evidenceMode: payload.evidenceMode });
  } catch (error) {
    return jsonError(error);
  }
}
