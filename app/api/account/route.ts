/**
 * GET    /api/account  — what this workspace currently holds, plus the phrase the
 *                        deletion request has to echo back.
 * DELETE /api/account  — erase the workspace and its account row.
 *
 * Erasure is irreversible, so the caller has to prove intent by sending the exact
 * workspace name back in `confirm`. Everything the delete touches is scoped to the
 * workspace derived from the authenticated user (see app/api/_lib/account.ts).
 */
import {
  assertSameOrigin,
  errorBody,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";
import { deleteWorkspaceData, getWorkspaceSummary } from "../_lib/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const summary = await getWorkspaceSummary(db, workspaceId);
    return privateJson({
      ok: true,
      account: { id: user.userId, email: user.email, displayName: user.displayName },
      workspace: {
        id: summary.workspaceId,
        name: summary.workspaceName,
        createdAt: summary.createdAt,
      },
      credits: summary.credits,
      counts: summary.counts,
      confirmationPhrase: summary.workspaceName ?? summary.workspaceId,
      exportUrl: "/api/account/export",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const summary = await getWorkspaceSummary(db, workspaceId);
    const confirmationPhrase = summary.workspaceName ?? summary.workspaceId;

    const payload = await parseJson<{ confirm?: unknown }>(request);
    if (typeof payload.confirm !== "string" || payload.confirm.trim() !== confirmationPhrase) {
      return privateJson(
        errorBody(
          `삭제를 진행하려면 확인 문구를 정확히 입력해야 합니다. 입력해야 할 문구는 "${confirmationPhrase}"입니다.`,
          "delete_confirmation_mismatch",
          { confirmationPhrase },
        ),
        { status: 400 },
      );
    }

    const result = await deleteWorkspaceData(db, user, workspaceId);
    return privateJson({
      ok: true,
      deletedWorkspaceId: result.workspaceId,
      deleted: result.deleted,
      accountRowDeleted: result.accountRowDeleted,
      message:
        "워크스페이스와 계정 정보를 모두 삭제했습니다. 같은 계정으로 다시 로그인하면 데이터가 없는 새 워크스페이스가 만들어집니다.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
