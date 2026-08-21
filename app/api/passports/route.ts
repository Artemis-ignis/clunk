import {
  getRuntimeDb,
  jsonError,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const rows = await db
      .prepare(
        `SELECT id AS id, asset_id AS assetId, optimization_run_id AS optimizationRunId,
          source_hash AS sourceHash, output_hash AS outputHash, passport_json AS passportJson, created_at AS createdAt
         FROM clunk_passports WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
      )
      .bind(workspaceId)
      .all();
    return privateJson({ ok: true, passports: rows.results });
  } catch (error) {
    return jsonError(error);
  }
}
