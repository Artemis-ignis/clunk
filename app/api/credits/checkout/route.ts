import {
  applyCreditOperation,
  assertSameOrigin,
  ClunkHttpError,
  ensureSchema,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  readIdempotencyKey,
  requireClunkContext,
  scopedStorageId,
} from "../../_lib/clunk";
import {
  createStripeBillingProvider,
  getBillingEnvironment,
  getBillingStatus,
  type BillingProvider,
} from "../../marketplace/billing";
import { getRuntimeEnvironment } from "../../../runtime-environment";
import { areSalesOpen, SALES_LOCKED_BODY } from "../../_lib/sales-lock";

export const dynamic = "force-dynamic";

type CheckoutPayload = { packId?: unknown; idempotencyKey?: unknown; withdrawalConsent?: unknown };

/**
 * Credit-pack checkout. Mirrors the marketplace order state machine: the
 * amount is always re-read from the ACTIVE pack row, the order id is
 * deterministic per (user, pack, idempotency key), and CREATING ownership
 * serialises concurrent requests. DRAFT packs (price undecided) fail closed.
 */
export async function POST(request: Request) {
  try {
    // Nothing may complete a purchase before the mail-order filing lands, and
    // that has to be the first check — the demo-checkout branch below grants
    // credits with no provider at all.
    if (!areSalesOpen()) return Response.json(SALES_LOCKED_BODY, { status: 503 });
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const payload = await parseJson<CheckoutPayload>(request, 32 * 1024);
    if (!isSafeRecordId(payload.packId, 128)) {
      throw new ClunkHttpError("유효한 packId가 필요합니다.", 400);
    }
    const idempotencyKey = readIdempotencyKey(request, payload.idempotencyKey);
    const db = getRuntimeDb();
    await ensureSchema(db);
    const pack = await db.prepare(
      `SELECT id, name, credits, price_cents AS priceCents, currency, status
       FROM clunk_credit_packs WHERE id = ? LIMIT 1`,
    ).bind(payload.packId).first<{ id: string; name: string; credits: number; priceCents: number; currency: string; status: string }>();
    if (!pack) throw new ClunkHttpError("크레딧 팩을 찾을 수 없습니다.", 404);
    if (pack.status !== "ACTIVE" || Number(pack.priceCents) <= 0) {
      return privateJson({
        ok: false,
        schema: "clunk.credit-checkout.v1",
        status: "PACK_NOT_PURCHASABLE",
        packId: pack.id,
        error: "이 크레딧 팩은 아직 판매 가격이 확정되지 않았습니다.",
      }, { status: 409 });
    }

    // 크레딧도 제공 개시 즉시 사용 가능한 디지털 서비스다: 청약철회 제한 동의가
    // 없으면 주문·세션을 만들지 않는다 (전자상거래법 제17조 2항 5호 고지·동의 구조).
    if (payload.withdrawalConsent !== true) {
      return privateJson({
        ok: false,
        schema: "clunk.credit-checkout.v1",
        status: "WITHDRAWAL_CONSENT_REQUIRED",
        policyPath: "/refunds",
        error: "크레딧은 결제 확인 즉시 제공이 개시되어 청약철회가 제한됩니다. 이에 동의해야 결제를 시작할 수 있습니다.",
      }, { status: 400 });
    }

    const runtimeEnvironment = getRuntimeEnvironment();
    const billingEnvironment = getBillingEnvironment(runtimeEnvironment);
    const billingStatus = getBillingStatus(billingEnvironment);
    if (billingStatus.status !== "AVAILABLE") {
      // Pre-launch QA rail: with no payment provider configured AND the demo
      // flag explicitly on, grant the pack through the same idempotent order +
      // credit-operation machine the webhook uses, with provider "demo" and no
      // money involved. The moment Stripe is configured this branch is
      // unreachable, so a real deployment cannot hand out demo credits.
      if (runtimeEnvironment.CLUNK_DEMO_CHECKOUT === "1") {
        return await grantDemoCreditOrder(db, workspaceId, user.id, pack, idempotencyKey);
      }
      return privateJson({
        ok: false,
        schema: "clunk.credit-checkout.v1",
        status: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        provider: null,
        missing: billingStatus.missing,
        creditsGranted: false,
        error: "결제를 시작하려면 운영 환경에 Stripe 결제 설정이 필요합니다.",
      }, { status: 503 });
    }

    const orderId = scopedStorageId("credit-order", workspaceId, `${user.id}:${pack.id}:${idempotencyKey}`);
    const existing = await readOrder(db, orderId);
    if (existing && (existing.packId !== pack.id || existing.buyerUserId !== user.id || existing.amountCents !== pack.priceCents || existing.currency !== pack.currency)) {
      throw new ClunkHttpError("동일한 idempotency key가 다른 주문에 사용되었습니다.", 409);
    }

    let ownsCreation = false;
    if (existing?.status === "PAID") {
      return privateJson({ ok: true, schema: "clunk.credit-checkout.v1", status: "ALREADY_PAID", provider: "stripe", orderId, idempotent: true });
    }
    if (existing?.status === "PENDING" && existing.paymentReference && existing.checkoutUrl) {
      return privateJson({ ok: true, schema: "clunk.credit-checkout.v1", status: "CHECKOUT_READY", provider: "stripe", orderId, checkoutUrl: existing.checkoutUrl, paymentReference: existing.paymentReference, idempotent: true });
    }
    if (existing?.status === "CREATING") {
      throw new ClunkHttpError("동일한 결제 요청이 처리 중입니다. 잠시 후 다시 시도하세요.", 409);
    }
    if (existing?.status === "CANCELED" || existing?.status === "REFUNDED") {
      throw new ClunkHttpError("종료된 주문입니다. 새 idempotency key로 다시 시도하세요.", 409);
    }
    if (existing?.status === "FAILED") {
      const retry = await db.prepare(
        `UPDATE clunk_credit_orders SET status = 'CREATING', payment_reference = NULL, checkout_url = NULL WHERE id = ? AND status = 'FAILED'`,
      ).bind(orderId).run();
      ownsCreation = Number((retry as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1;
    } else if (!existing) {
      const created = await db.prepare(
        `INSERT OR IGNORE INTO clunk_credit_orders
         (id, pack_id, workspace_id, buyer_user_id, status, payment_provider, payment_reference, checkout_url, amount_cents, currency, credits)
         VALUES (?, ?, ?, ?, 'CREATING', 'stripe', NULL, NULL, ?, ?, ?)`,
      ).bind(orderId, pack.id, workspaceId, user.id, pack.priceCents, pack.currency, pack.credits).run();
      ownsCreation = Number((created as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1;
    }

    if (!ownsCreation) {
      const concurrent = await readOrder(db, orderId);
      if (!concurrent) throw new ClunkHttpError("주문 상태를 확인할 수 없습니다.", 409);
      if (concurrent.status === "PAID") {
        return privateJson({ ok: true, schema: "clunk.credit-checkout.v1", status: "ALREADY_PAID", provider: "stripe", orderId, idempotent: true });
      }
      if (concurrent.status === "PENDING" && concurrent.paymentReference && concurrent.checkoutUrl) {
        return privateJson({ ok: true, schema: "clunk.credit-checkout.v1", status: "CHECKOUT_READY", provider: "stripe", orderId, checkoutUrl: concurrent.checkoutUrl, paymentReference: concurrent.paymentReference, idempotent: true });
      }
      throw new ClunkHttpError("동일한 결제 요청이 처리 중이거나 종료되었습니다. 잠시 후 다시 시도하세요.", 409);
    }

    const provider = createStripeBillingProvider(billingEnvironment);
    if (provider.provider !== "stripe") throw new ClunkHttpError("결제 제공자 설정이 없습니다.", 503);
    let reference: { paymentReference: string; checkoutUrl: string };
    try {
      reference = await createCheckout(provider, request, orderId, pack);
    } catch (error) {
      await db.prepare("UPDATE clunk_credit_orders SET status = 'FAILED' WHERE id = ? AND status = 'CREATING'").bind(orderId).run();
      throw error;
    }
    const completed = await db.prepare(
      `UPDATE clunk_credit_orders SET status = 'PENDING', payment_reference = ?, checkout_url = ? WHERE id = ? AND status = 'CREATING'`,
    ).bind(reference.paymentReference, reference.checkoutUrl, orderId).run();
    if (Number((completed as { meta?: { changes?: number } }).meta?.changes ?? 0) !== 1) {
      throw new ClunkHttpError("주문 상태를 저장하지 못했습니다.", 500);
    }
    return privateJson({
      ok: true,
      schema: "clunk.credit-checkout.v1",
      status: "CHECKOUT_READY",
      provider: "stripe",
      orderId,
      packId: pack.id,
      credits: pack.credits,
      paymentReference: reference.paymentReference,
      checkoutUrl: reference.checkoutUrl,
      idempotent: false,
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

async function createCheckout(
  provider: BillingProvider,
  request: Request,
  orderId: string,
  pack: { id: string; name: string; credits: number; priceCents: number; currency: string },
): Promise<{ paymentReference: string; checkoutUrl: string }> {
  const origin = new URL(request.url).origin;
  const result = await provider.createCheckout({
    orderId,
    listingId: `credit-pack:${pack.id}`,
    assetId: `credits:${pack.credits}`,
    title: `Clunk 크레딧 ${pack.credits.toLocaleString("ko-KR")}개 (${pack.name})`,
    description: `Clunk 워크스페이스 크레딧 ${pack.credits.toLocaleString("ko-KR")}개 충전`,
    amountCents: pack.priceCents,
    currency: pack.currency,
    successUrl: new URL("/pricing?credits=success", `${origin}/`).toString(),
    cancelUrl: new URL("/pricing?credits=canceled", `${origin}/`).toString(),
  });
  return { paymentReference: result.reference, checkoutUrl: result.checkoutUrl };
}

/**
 * Demo grant path (QA only, see the caller for the double gate). Reuses the
 * deterministic order id and the webhook's grant fingerprint so that a later
 * real payment replay for the same idempotency key can never double-grant.
 */
async function grantDemoCreditOrder(
  db: D1Database,
  workspaceId: string,
  buyerUserId: string,
  pack: { id: string; name: string; credits: number; priceCents: number; currency: string },
  idempotencyKey: string,
): Promise<Response> {
  const orderId = scopedStorageId("credit-order", workspaceId, `${buyerUserId}:${pack.id}:${idempotencyKey}`);
  const existing = await readOrder(db, orderId);
  if (existing && (existing.packId !== pack.id || existing.buyerUserId !== buyerUserId || existing.amountCents !== pack.priceCents || existing.currency !== pack.currency)) {
    throw new ClunkHttpError("동일한 idempotency key가 다른 주문에 사용되었습니다.", 409);
  }
  if (existing?.status === "CANCELED" || existing?.status === "REFUNDED") {
    throw new ClunkHttpError("종료된 주문입니다. 새 idempotency key로 다시 시도하세요.", 409);
  }
  if (!existing) {
    await db.prepare(
      `INSERT OR IGNORE INTO clunk_credit_orders
       (id, pack_id, workspace_id, buyer_user_id, status, payment_provider, payment_reference, checkout_url, amount_cents, currency, credits)
       VALUES (?, ?, ?, ?, 'CREATING', 'demo', NULL, NULL, ?, ?, ?)`,
    ).bind(orderId, pack.id, workspaceId, buyerUserId, pack.priceCents, pack.currency, pack.credits).run();
  }
  const grant = await applyCreditOperation(
    db,
    workspaceId,
    {
      key: `credit-order:${orderId}`,
      fingerprint: `pack:${pack.id}:${pack.credits}`,
      kind: "pack-purchase",
      amount: pack.credits,
    },
    (operationId) => [
      db.prepare(
        `UPDATE clunk_credit_orders SET status = 'PAID', payment_reference = ?
         WHERE id = ? AND status IN ('PENDING', 'CREATING')
           AND EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
      ).bind(`demo:${orderId}`, orderId, operationId, workspaceId),
    ],
  );
  return privateJson({
    ok: true,
    schema: "clunk.credit-checkout.v1",
    status: "DEMO_GRANTED",
    provider: "demo",
    demo: true,
    orderId,
    packId: pack.id,
    creditsGranted: pack.credits,
    balance: grant.balance,
    idempotent: grant.idempotent,
    note: "결제 provider가 없는 QA 환경의 데모 지급입니다. 실제 결제가 발생하지 않았습니다.",
  }, { status: 201 });
}

type StoredOrder = {
  id: string;
  packId: string;
  status: string;
  paymentReference: string | null;
  checkoutUrl: string | null;
  amountCents: number;
  currency: string;
  buyerUserId: string;
};

async function readOrder(db: D1Database, orderId: string): Promise<StoredOrder | null> {
  return db.prepare(
    `SELECT id, pack_id AS packId, status, payment_reference AS paymentReference, checkout_url AS checkoutUrl,
        amount_cents AS amountCents, currency, buyer_user_id AS buyerUserId
     FROM clunk_credit_orders WHERE id = ? LIMIT 1`,
  ).bind(orderId).first<StoredOrder>();
}
