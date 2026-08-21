import {
  getCredits,
  getRuntimeDb,
  privateJson,
  jsonError,
  requireClunkContext,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const workspace = await db
      .prepare(`SELECT id, name, created_at AS createdAt FROM clunk_workspaces WHERE id = ?`)
      .bind(workspaceId)
      .first();
    const subscription = await db
      .prepare(
        `SELECT s.id, s.status, s.provider, p.id AS planId, p.name AS planName, p.monthly_credits AS monthlyCredits, p.is_demo AS isDemo
         FROM clunk_subscriptions s JOIN clunk_plans p ON p.id = s.plan_id WHERE s.workspace_id = ? LIMIT 1`,
      )
      .bind(workspaceId)
      .first();
    return privateJson({
      ok: true,
      user,
      workspace,
      subscription,
      credits: await getCredits(db, workspaceId),
      mode: "DEMO",
    });
  } catch (error) {
    return jsonError(error);
  }
}
