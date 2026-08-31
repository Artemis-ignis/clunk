import {
  applyCreditOperation,
  ensureSchema,
  getRuntimeDb,
  jsonError,
  privateJson,
  scopedStorageId,
} from "../../_lib/clunk";
import {
  BillingConfigurationError,
  BillingVerificationError,
  createStripeBillingProvider,
  getBillingEnvironment,
  getBillingStatus,
  type BillingEvent,
} from "../billing";
import { getRuntimeEnvironment } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  listingId: string;
  buyerUserId: string;
  status: string;
  paymentProvider: string;
  paymentReference: string | null;
  amountCents: number;
  currency: string;
  assetId: string;
  listingPriceCents: number;
  listingCurrency: string;
};

/**
 * Provider callback boundary. Authentication is the provider signature, not a
 * browser session or Origin header. Every state change is checked against the
 * server-side order/listing price before an entitlement can be granted.
 */
export async function POST(request: Request) {
  try {
    const billingEnvironment = getBillingEnvironment(getRuntimeEnvironment());
    const billingStatus = getBillingStatus(billingEnvironment);
    if (billingStatus.status !== "AVAILABLE") {
      throw new BillingConfigurationError("Payment provider configuration is incomplete.");
    }
    const provider = createStripeBillingProvider(billingEnvironment);
    if (provider.provider !== "stripe") {
      throw new BillingConfigurationError("Payment provider configuration is incomplete.");
    }
    const event = await provider.verifyWebhook(request);
    const db = getRuntimeDb();
    await ensureSchema(db);
    const order = await db.prepare(
      `SELECT o.id, o.listing_id AS listingId, o.buyer_user_id AS buyerUserId,
          o.status, o.payment_provider AS paymentProvider,
          o.payment_reference AS paymentReference,
          o.amount_cents AS amountCents, o.currency,
          l.asset_id AS assetId, l.price_cents AS listingPriceCents,
          l.currency AS listingCurrency
       FROM clunk_marketplace_orders o
       JOIN clunk_marketplace_listings l ON l.id = o.listing_id
       WHERE o.id = ? AND o.payment_provider = 'stripe' LIMIT 1`,
    ).bind(event.orderId).first<OrderRow>();

    // Credit-pack orders arrive on the same provider endpoint. When the id is
    // not a marketplace order, try the credit order book before ignoring.
    if (!order) {
      const creditOrder = await readCreditOrder(db, event.orderId);
      if (creditOrder) {
        validateEventAgainstCreditOrder(event, creditOrder);
        const creditResult = await applyCreditEvent(db, event, creditOrder);
        return privateJson({
          ok: true,
          schema: "clunk.marketplace-webhook.v1",
          kind: "credits",
          status: creditResult.status,
          eventId: event.eventId,
          orderId: creditOrder.id,
          ...(creditResult.creditsGranted !== undefined ? { creditsGranted: creditResult.creditsGranted } : {}),
          ...(creditResult.note ? { note: creditResult.note } : {}),
          idempotent: creditResult.idempotent,
        });
      }
      // A valid provider event for an order that no longer exists is harmless. A
      // 2xx prevents an endless provider retry while keeping the event observable.
      return privateJson({
        ok: true,
        schema: "clunk.marketplace-webhook.v1",
        status: "UNMATCHED_ORDER",
        eventId: event.eventId,
        orderId: event.orderId,
        ignored: true,
      }, { status: 202 });
    }

    validateEventAgainstOrder(event, order);
    const result = await applyEvent(db, event, order);
    return privateJson({
      ok: true,
      schema: "clunk.marketplace-webhook.v1",
      status: result.status,
      eventId: event.eventId,
      orderId: order.id,
      ...(result.entitlementId ? { entitlementId: result.entitlementId } : {}),
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-webhook.v1",
        status: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        provider: null,
        error: "결제 webhook을 처리하려면 Stripe 설정이 필요합니다.",
      }, { status: 503 });
    }
    if (error instanceof BillingVerificationError) {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-webhook.v1",
        status: "WEBHOOK_REJECTED",
        error: error.message,
      }, { status: 400 });
    }
    return jsonError(error);
  }
}

function validateEventAgainstOrder(event: BillingEvent, order: OrderRow): void {
  if (event.orderId !== order.id || event.amountCents !== order.amountCents || event.currency !== order.currency) {
    throw new BillingVerificationError("Payment webhook does not match the saved order amount or currency.");
  }
  if (order.listingPriceCents !== order.amountCents || order.listingCurrency !== order.currency) {
    throw new BillingVerificationError("Saved order no longer matches the listing price.");
  }
  if (event.listingId && event.listingId !== order.listingId) {
    throw new BillingVerificationError("Payment webhook listing metadata does not match the order.");
  }
  // Checkout session events must carry the exact session reference we stored.
  // A refund may be emitted for a charge instead of the checkout session, so its
  // signed order/listing metadata is accepted when the provider reference differs.
  if (event.status !== "REFUNDED" && event.reference !== order.paymentReference) {
    throw new BillingVerificationError("Payment webhook reference does not match the order.");
  }
  if (event.status === "REFUNDED" && event.reference !== order.paymentReference && !event.listingId) {
    throw new BillingVerificationError("Refund webhook is missing the listing metadata needed for correlation.");
  }
}

async function applyEvent(
  db: D1Database,
  event: BillingEvent,
  order: OrderRow,
): Promise<{ status: string; idempotent: boolean; entitlementId?: string }> {
  if (event.status === "PAID") {
    if (order.status === "REFUNDED") return { status: "ORDER_ALREADY_REFUNDED", idempotent: true };
    const entitlementId = scopedStorageId("entitlement", order.buyerUserId, order.id);
    if (order.status === "PAID") {
      return { status: "PAID", idempotent: true, entitlementId };
    }
    await db.batch([
      db.prepare("UPDATE clunk_marketplace_orders SET status = 'PAID' WHERE id = ? AND status IN ('PENDING', 'CREATING')").bind(order.id),
      db.prepare(
        `INSERT OR IGNORE INTO clunk_marketplace_entitlements
         (id, order_id, listing_id, asset_id, buyer_user_id, status, provider_reference)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      ).bind(entitlementId, order.id, order.listingId, order.assetId, order.buyerUserId, event.reference),
    ]);
    return { status: "PAID", idempotent: false, entitlementId };
  }

  if (event.status === "CANCELED") {
    if (order.status === "PAID" || order.status === "REFUNDED" || order.status === "CANCELED") {
      return { status: order.status === "CANCELED" ? "CANCELED" : "ORDER_FINAL", idempotent: true };
    }
    await db.prepare("UPDATE clunk_marketplace_orders SET status = 'CANCELED' WHERE id = ? AND status IN ('PENDING', 'CREATING')").bind(order.id).run();
    return { status: "CANCELED", idempotent: false };
  }

  if (order.status === "REFUNDED") return { status: "REFUNDED", idempotent: true };
  await db.batch([
    db.prepare("UPDATE clunk_marketplace_orders SET status = 'REFUNDED' WHERE id = ? AND status IN ('PAID', 'PENDING', 'CREATING')").bind(order.id),
    db.prepare("UPDATE clunk_marketplace_entitlements SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'ACTIVE'").bind(order.id),
  ]);
  return { status: "REFUNDED", idempotent: false };
}

type CreditOrderRow = {
  id: string;
  packId: string;
  workspaceId: string;
  buyerUserId: string;
  status: string;
  paymentReference: string | null;
  amountCents: number;
  currency: string;
  credits: number;
};

async function readCreditOrder(db: D1Database, orderId: string): Promise<CreditOrderRow | null> {
  return db.prepare(
    `SELECT id, pack_id AS packId, workspace_id AS workspaceId, buyer_user_id AS buyerUserId,
        status, payment_reference AS paymentReference, amount_cents AS amountCents, currency, credits
     FROM clunk_credit_orders WHERE id = ? AND payment_provider = 'stripe' LIMIT 1`,
  ).bind(orderId).first<CreditOrderRow>();
}

function validateEventAgainstCreditOrder(event: BillingEvent, order: CreditOrderRow): void {
  if (event.orderId !== order.id || event.amountCents !== order.amountCents || event.currency !== order.currency) {
    throw new BillingVerificationError("Payment webhook does not match the saved credit order amount or currency.");
  }
  if (event.listingId && event.listingId !== `credit-pack:${order.packId}`) {
    throw new BillingVerificationError("Payment webhook pack metadata does not match the credit order.");
  }
  if (event.status !== "REFUNDED" && event.reference !== order.paymentReference) {
    throw new BillingVerificationError("Payment webhook reference does not match the credit order.");
  }
}

async function applyCreditEvent(
  db: D1Database,
  event: BillingEvent,
  order: CreditOrderRow,
): Promise<{ status: string; idempotent: boolean; creditsGranted?: number; note?: string }> {
  if (event.status === "PAID") {
    if (order.status === "REFUNDED") return { status: "ORDER_ALREADY_REFUNDED", idempotent: true };
    // The grant is the idempotent primitive; the order-status update rides on
    // the same applied-operation guard. Re-delivered events heal a partial
    // failure instead of double-granting.
    const grant = await applyCreditOperation(
      db,
      order.workspaceId,
      {
        key: `credit-order:${order.id}`,
        fingerprint: `pack:${order.packId}:${order.credits}`,
        kind: "pack-purchase",
        amount: order.credits,
      },
      (operationId) => [
        db.prepare(
          `UPDATE clunk_credit_orders SET status = 'PAID'
           WHERE id = ? AND status IN ('PENDING', 'CREATING')
             AND EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
        ).bind(order.id, operationId, order.workspaceId),
      ],
    );
    return { status: "PAID", idempotent: grant.idempotent, creditsGranted: order.credits };
  }

  if (event.status === "CANCELED") {
    if (order.status === "PAID" || order.status === "REFUNDED" || order.status === "CANCELED") {
      return { status: order.status === "CANCELED" ? "CANCELED" : "ORDER_FINAL", idempotent: true };
    }
    await db.prepare("UPDATE clunk_credit_orders SET status = 'CANCELED' WHERE id = ? AND status IN ('PENDING', 'CREATING')").bind(order.id).run();
    return { status: "CANCELED", idempotent: false };
  }

  if (order.status === "REFUNDED") return { status: "REFUNDED", idempotent: true };
  // Money moved back, but the credits may already be spent. Automatic clawback
  // could push a workspace negative, so the refund is recorded and left to a
  // human reconciliation decision instead of inventing a balance state.
  await db.prepare("UPDATE clunk_credit_orders SET status = 'REFUNDED' WHERE id = ? AND status IN ('PAID', 'PENDING', 'CREATING')").bind(order.id).run();
  return {
    status: "REFUNDED",
    idempotent: false,
    note: "CREDIT_CLAWBACK_MANUAL_REVIEW",
  };
}
