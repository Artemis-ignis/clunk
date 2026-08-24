import {
  assertSameOrigin,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../../_lib/clunk";
import {
  evidenceJson,
  parseThreadPayload,
  parseStoredEvidence,
  resolveStoredStatus,
  statusJson,
} from "../../_lib/collaboration";

export const dynamic = "force-dynamic";

function readStatus(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { readiness: "BLOCKED", error: "Stored collaboration status is invalid." };
  }
}

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const rows = await db
      .prepare(
        `SELECT id, subject, asset_id AS assetId, input_hash AS inputHash,
          target_profile_id AS targetProfileId, rule_set_id AS ruleSetId,
          status_json AS status, created_by AS createdBy, created_at AS createdAt,
          updated_at AS updatedAt, evidence_json AS evidence
         FROM clunk_collaboration_threads
         WHERE workspace_id = ? ORDER BY updated_at DESC, id DESC LIMIT 100`,
      )
      .bind(workspaceId)
      .all();
    return privateJson({
      ok: true,
      threads: (rows.results ?? []).map((row) => ({
        ...row,
        status: readStatus(String((row as Record<string, unknown>).status ?? "{}")),
        evidence: parseStoredEvidence((row as Record<string, unknown>).evidence),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const payload = parseThreadPayload(await parseJson<unknown>(request));
    const status = resolveStoredStatus(payload);
    const db = getRuntimeDb();
    const threadId = scopedStorageId("thread", workspaceId, `${crypto.randomUUID()}`);
    await db
      .prepare(
        `INSERT INTO clunk_collaboration_threads
         (id, workspace_id, subject, asset_id, input_hash, target_profile_id, rule_set_id, status_json, evidence_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        threadId,
        workspaceId,
        payload.subject,
        payload.assetId ?? null,
        payload.inputHash,
        payload.profileId,
        payload.ruleSetId,
        statusJson(status),
        evidenceJson(payload.evidence),
        user.userId,
      )
      .run();
    return privateJson({
      ok: true,
      thread: {
        id: threadId,
        subject: payload.subject,
        assetId: payload.assetId ?? null,
        inputHash: payload.inputHash,
        targetProfileId: payload.profileId,
        ruleSetId: payload.ruleSetId,
        status,
        evidence: payload.evidence ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
