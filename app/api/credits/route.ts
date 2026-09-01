import { accessFor } from "../_lib/access";
import {
  applyCreditOperation,
  getCredits,
  getRuntimeDb,
  privateJson,
  jsonError,
  assertSameOrigin,
  parseJson,
  requireClunkContext,
} from "../_lib/clunk";
import { getRuntimeEnvironment } from "../../runtime-environment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { workspaceId } = await requireClunkContext();
    const db = getRuntimeDb();
    const rows = await db
      .prepare(
        `SELECT id, amount, reason, reference_id AS referenceId, created_at AS createdAt
         FROM clunk_credit_ledger WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
      )
      .bind(workspaceId)
      .all();
    const credits = await getCredits(db, workspaceId);
    return privateJson({
      ok: true,
      mode: "DEMO",
      credits,
      // The balance alone does not tell a caller what it can do with it. This says so in
      // the same response, so an agent never has to spend one call to find out.
      access: accessFor({ authenticated: true, credits }),
      ledger: rows.results,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{ action?: string }>(request);
    if (payload.action !== "simulate-upgrade") {
      return privateJson(
        { ok: false, error: "크레딧 충전은 /api/credits/checkout 으로 진행합니다." },
        { status: 400 },
      );
    }
    // The demo self-grant became a revenue bypass the moment real packs
    // exist, so it only answers when the operator explicitly enables it for
    // local smoke runs. Production never sets this flag.
    if (getRuntimeEnvironment().CLUNK_ENABLE_DEV_CREDIT_GRANT !== "1") {
      return privateJson(
        {
          ok: false,
          error: "데모 크레딧 지급은 종료되었습니다. 크레딧 충전은 /api/credits/checkout 으로 진행합니다.",
          checkoutEndpoint: "/api/credits/checkout",
        },
        { status: 410 },
      );
    }
    const db = getRuntimeDb();
    const operation = await applyCreditOperation(
      db,
      workspaceId,
      {
        key: "demo-upgrade:v1",
        fingerprint: "builder-demo:+100:v1",
        kind: "demo-upgrade",
        amount: 100,
      },
      (operationId) => [
        db
          .prepare(
            `UPDATE clunk_subscriptions
             SET plan_id = 'builder-demo', status = 'demo', provider = 'demo'
             WHERE workspace_id = ?
               AND EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
          )
          .bind(workspaceId, operationId, workspaceId),
      ],
    );
    return privateJson({
      ok: true,
      mode: "DEMO",
      credits: operation.balance,
      idempotent: operation.idempotent,
      message: "Demo credits added. No real payment was processed.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
