/**
 * GET /api/account/export — the whole workspace as one downloadable JSON object.
 *
 * Serves the 열람 (right of access) half of the privacy policy: account row,
 * workspace, members, subscription, asset metadata, inspection history,
 * optimization history, Passports, credit ledger and credit operations.
 */
import {
  getRuntimeDb,
  jsonError,
  requireClunkContext,
} from "../../_lib/clunk";
import { buildWorkspaceExport } from "../../_lib/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const data = await buildWorkspaceExport(db, user, workspaceId);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify({ ok: true, export: data }, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="clunk-data-export-${stamp}.json"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
