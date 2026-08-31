import {
  assertSameOrigin,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const rows = await getRuntimeDb().prepare(
      `SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt
       FROM clunk_projects WHERE workspace_id = ? ORDER BY updated_at DESC, id DESC LIMIT 50`,
    ).bind(workspaceId).all();
    return privateJson({ ok: true, schema: "clunk.projects.v1", projects: rows.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{ name?: unknown; description?: unknown }>(request, 32 * 1024);
    if (typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 120) {
      return privateJson({ ok: false, error: "프로젝트 이름은 1자 이상 120자 이하이어야 합니다." }, { status: 400 });
    }
    if (payload.description !== undefined && (typeof payload.description !== "string" || payload.description.length > 2_000)) {
      return privateJson({ ok: false, error: "프로젝트 설명은 2,000자 이하이어야 합니다." }, { status: 400 });
    }
    const projectId = scopedStorageId("project", workspaceId, `${new Date().toISOString()}:${crypto.randomUUID()}`);
    if (!isSafeRecordId(projectId, 256)) return privateJson({ ok: false, error: "프로젝트 id를 만들지 못했습니다." }, { status: 500 });
    const db = getRuntimeDb();
    await db.prepare(
      `INSERT INTO clunk_projects (id, workspace_id, name, description) VALUES (?, ?, ?, ?)`,
    ).bind(projectId, workspaceId, payload.name.trim(), typeof payload.description === "string" ? payload.description.trim() : "").run();
    return privateJson({ ok: true, schema: "clunk.project.v1", project: { id: projectId, name: payload.name.trim(), description: typeof payload.description === "string" ? payload.description.trim() : "" } });
  } catch (error) {
    return jsonError(error);
  }
}
