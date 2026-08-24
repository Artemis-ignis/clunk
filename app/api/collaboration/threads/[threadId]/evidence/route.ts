import {
  assertSameOrigin,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  ClunkHttpError,
} from "../../../../_lib/clunk";
import {
  evidenceJson,
  mergeStoredEvidence,
  parseEvidenceOnlyPayload,
  parseStoredEvidence,
} from "../../../../_lib/collaboration";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

async function threadIdFrom(context: RouteContext): Promise<string> {
  const { threadId } = await context.params;
  if (!isSafeRecordId(threadId, 256)) throw new ClunkHttpError("Invalid collaboration thread id.", 400);
  return threadId;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { workspaceId } = await requireClunkContext();
    const threadId = await threadIdFrom(context);
    const row = await getRuntimeDb()
      .prepare(`SELECT id, evidence_json AS evidence FROM clunk_collaboration_threads WHERE id = ? AND workspace_id = ?`)
      .bind(threadId, workspaceId)
      .first<Record<string, unknown>>();
    if (!row) return privateJson({ ok: false, error: "Collaboration thread not found." }, { status: 404 });
    return privateJson({ ok: true, threadId, evidence: parseStoredEvidence(row.evidence) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Evidence-only write path for HF/browser handoffs. Status snapshots remain on the thread
 * routes; this endpoint only merges a normalized frame manifest and never promotes review.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const threadId = await threadIdFrom(context);
    const payload = parseEvidenceOnlyPayload(await parseJson<unknown>(request));
    const db = getRuntimeDb();
    const existing = await db
      .prepare(`SELECT id, evidence_json AS evidence FROM clunk_collaboration_threads WHERE id = ? AND workspace_id = ?`)
      .bind(threadId, workspaceId)
      .first<Record<string, unknown>>();
    if (!existing) return privateJson({ ok: false, error: "Collaboration thread not found." }, { status: 404 });
    const evidence = mergeStoredEvidence(parseStoredEvidence(existing.evidence), payload.evidence, payload.evidenceMode);
    await db
      .prepare(`UPDATE clunk_collaboration_threads SET evidence_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`)
      .bind(evidenceJson(evidence ?? undefined), threadId, workspaceId)
      .run();
    return privateJson({ ok: true, threadId, evidence, evidenceMode: payload.evidenceMode });
  } catch (error) {
    return jsonError(error);
  }
}
