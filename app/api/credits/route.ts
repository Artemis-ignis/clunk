import { CAN_SELL } from "../../legal/company";
import {
  applyCreditOperation,
  errorBody,
  getCredits,
  getRuntimeDb,
  privateJson,
  jsonError,
  assertSameOrigin,
  parseJson,
  requireClunkContext,
} from "../_lib/clunk";

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
    return privateJson({
      ok: true,
      mode: "DEMO",
      credits: await getCredits(db, workspaceId),
      ledger: rows.results,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    // Free credits with no payment check. Harmless while the product is a free demo, but a
    // standing giveaway the moment it is actually sold — and because a workspace id is
    // derived from the user id, it would be repeatable per identity. CAN_SELL flips to true
    // only when the operator fills in real business details, which is exactly the point at
    // which this must stop existing.
    if (CAN_SELL) {
      return privateJson(
        errorBody(
          "데모 크레딧 지급은 무상 제공 기간에만 사용할 수 있습니다. 요금 화면에서 플랜을 선택해 주세요.",
          "demo_upgrade_disabled",
        ),
        { status: 410 },
      );
    }
    const { workspaceId } = await requireClunkContext();
    const payload = await parseJson<{ action?: string }>(request);
    if (payload.action !== "simulate-upgrade") {
      return privateJson(
        errorBody(
          "v1에서는 데모 업그레이드 동작만 사용할 수 있습니다. ‘크레딧과 플랜’ 화면의 크레딧 받기 버튼을 사용해 주세요.",
          "credit_action_unsupported",
        ),
        { status: 400 },
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
      message: "데모 크레딧 100개를 추가했습니다. 실제 결제는 이루어지지 않았습니다.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
