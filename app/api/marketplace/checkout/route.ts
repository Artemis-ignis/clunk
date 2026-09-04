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
  creditPriceForListing,
  getBillingEnvironment,
  getBillingStatus,
  KRW_PER_CREDIT,
  type BillingProvider,
} from "../billing";
import { getRuntimeEnvironment } from "../../../runtime-environment";

import { areSalesOpen, SALES_LOCKED_BODY } from "../../_lib/sales-lock";

export const dynamic = "force-dynamic";

type CheckoutPayload = { listingId?: unknown; idempotencyKey?: unknown; withdrawalConsent?: unknown; paymentMethod?: unknown };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const payload = await parseJson<CheckoutPayload>(request, 32 * 1024);
    if (!isSafeRecordId(payload.listingId, 256)) {
      throw new ClunkHttpError("유효한 listingId가 필요합니다.", 400);
    }
    const idempotencyKey = readIdempotencyKey(request, payload.idempotencyKey);
    const db = getRuntimeDb();
    await ensureSchema(db);
    const listing = await db.prepare(
      `SELECT l.id, l.asset_id AS assetId, l.title, l.description,
          l.price_cents AS priceCents, l.currency, l.status,
          w.owner_user_id AS sellerUserId
       FROM clunk_marketplace_listings l
       JOIN clunk_workspaces w ON w.id = l.workspace_id
       WHERE l.id = ? AND l.status = 'PUBLISHED' LIMIT 1`,
    ).bind(payload.listingId).first<{
      id: string;
      assetId: string;
      title: string;
      description: string;
      priceCents: number;
      currency: string;
      status: string;
      sellerUserId: string;
    }>();
    if (!listing) throw new ClunkHttpError("공개된 상품을 찾을 수 없습니다.", 404);
    if (listing.priceCents === 0) {
      return privateJson({
        ok: true,
        schema: "clunk.marketplace-checkout.v1",
        status: "FREE_DOWNLOAD",
        provider: null,
        listingId: listing.id,
        assetId: listing.assetId,
        downloadUrl: `/api/marketplace/assets/${listing.assetId}`,
      });
    }
    if (listing.sellerUserId === user.id) {
      throw new ClunkHttpError("자신이 판매 중인 listing은 구매할 수 없습니다.", 409);
    }

    // Free beta: nothing is sold, so a signed-in request for any listing is granted, not
    // charged. This sits before the withdrawal-consent check on purpose — 청약철회 consent
    // is a condition of a paid digital sale, and there is no sale. The order row records
    // the grant at ₩0 under its own provider so a later paid order for the same asset is
    // never mistaken for it, and so the entitlement has the order it is required to have.
    if (!areSalesOpen()) {
      const orderId = scopedStorageId("order", workspaceId, `${user.id}:${listing.id}:beta`);
      const reference = `beta:${user.id}:${listing.id}`;
      const entitlementId = scopedStorageId("entitlement", user.id, orderId);
      await db.batch([
        db.prepare(
          `INSERT OR IGNORE INTO clunk_marketplace_orders
           (id, listing_id, buyer_user_id, status, payment_provider, payment_reference, checkout_url, amount_cents, currency)
           VALUES (?, ?, ?, 'BETA_GRANTED', 'beta', ?, NULL, 0, ?)`,
        ).bind(orderId, listing.id, user.id, reference, listing.currency),
        db.prepare(
          `INSERT OR IGNORE INTO clunk_marketplace_entitlements
           (id, order_id, listing_id, asset_id, buyer_user_id, status, provider_reference)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        ).bind(entitlementId, orderId, listing.id, listing.assetId, user.id, reference),
      ]);
      return privateJson({
        ok: true,
        schema: "clunk.marketplace-checkout.v1",
        status: "BETA_GRANTED",
        provider: "beta",
        listingId: listing.id,
        assetId: listing.assetId,
        entitlementId,
        downloadUrl: `/api/marketplace/assets/${listing.assetId}`,
      });
    }
    // 전자상거래법 제17조 2항 5호: 제공이 개시된 디지털 콘텐츠의 청약철회 제한은
    // 결제 전 고지·동의가 있어야 성립한다. 동의 없는 요청에는 주문도 세션도 만들지
    // 않는다 — 주문 기록 자체가 동의 시점의 기록을 겸하게 하기 위해서다.
    if (payload.withdrawalConsent !== true) {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-checkout.v1",
        status: "WITHDRAWAL_CONSENT_REQUIRED",
        policyPath: "/refunds",
        error: "디지털 콘텐츠는 다운로드 권한이 부여되는 즉시 청약철회가 제한됩니다. 이에 동의해야 결제를 시작할 수 있습니다.",
      }, { status: 400 });
    }

    const activeEntitlement = await db.prepare(
      `SELECT id FROM clunk_marketplace_entitlements
       WHERE buyer_user_id = ? AND asset_id = ? AND status = 'ACTIVE' LIMIT 1`,
    ).bind(user.id, listing.assetId).first<{ id: string }>();
    if (activeEntitlement) {
      return privateJson({
        ok: true,
        schema: "clunk.marketplace-checkout.v1",
        status: "ALREADY_OWNED",
        provider: null,
        listingId: listing.id,
        assetId: listing.assetId,
        entitlementId: activeEntitlement.id,
      });
    }

    // The credit rail is closed.
    //
    // 페이에이드(결제대행) 심사에서 이 구조가 두 번 걸렸다. 현금을 크레딧이라는
    // 재화로 바꾼 뒤 그 재화로 상품을 사는 흐름은 선불충전과 같은 환금성 코드로
    // 분류되어 가맹점 승인이 나지 않는다. 정기결제로 크레딧을 지급하는 형태도
    // 같은 판정을 받는다. 크레딧으로 상품을 살 수 있는 길이 남아 있는 한 심사를
    // 다시 받아도 결과가 같으므로, 레일 자체를 닫고 카드 결제만 남긴다.
    //
    // 크레딧은 앞으로 상품 대금이 아니라 생성·검사 사용 횟수로만 남는다.
    if (payload.paymentMethod === "credits") {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-checkout.v1",
        status: "CREDIT_RAIL_CLOSED",
        ownershipGranted: false,
        creditsCharged: false,
        error: "크레딧으로는 에셋을 살 수 없습니다. 카드 결제만 지원합니다.",
      }, { status: 400 });
    }

    const billingEnvironment = getBillingEnvironment(getRuntimeEnvironment());
    const billingStatus = getBillingStatus(billingEnvironment);
    if (billingStatus.status !== "AVAILABLE") {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-checkout.v1",
        status: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        provider: null,
        missing: billingStatus.missing,
        ownershipGranted: false,
        creditsCharged: false,
        error: "결제를 시작하려면 운영 환경에 Stripe 결제 설정이 필요합니다.",
      }, { status: 503 });
    }

    const orderId = scopedStorageId("order", workspaceId, `${user.id}:${listing.id}:${idempotencyKey}`);
    const existing = await db.prepare(
      `SELECT id, status, payment_reference AS paymentReference, checkout_url AS checkoutUrl,
          amount_cents AS amountCents, currency, listing_id AS listingId, buyer_user_id AS buyerUserId
       FROM clunk_marketplace_orders WHERE id = ? LIMIT 1`,
    ).bind(orderId).first<{
      id: string;
      status: string;
      paymentReference: string | null;
      checkoutUrl: string | null;
      amountCents: number;
      currency: string;
      listingId: string;
      buyerUserId: string;
    }>();
    if (existing && (existing.listingId !== listing.id || existing.buyerUserId !== user.id || existing.amountCents !== listing.priceCents || existing.currency !== listing.currency)) {
      throw new ClunkHttpError("동일한 idempotency key가 다른 주문에 사용되었습니다.", 409);
    }

    let ownsCreation = false;
    if (existing?.status === "PAID") {
      return privateJson({ ok: true, schema: "clunk.marketplace-checkout.v1", status: "ALREADY_PAID", provider: "stripe", orderId, idempotent: true });
    }
    if (existing?.status === "PENDING" && existing.paymentReference && existing.checkoutUrl) {
      return privateJson({ ok: true, schema: "clunk.marketplace-checkout.v1", status: "CHECKOUT_READY", provider: "stripe", orderId, checkoutUrl: existing.checkoutUrl, paymentReference: existing.paymentReference, idempotent: true });
    }
    if (existing?.status === "CREATING") {
      throw new ClunkHttpError("동일한 결제 요청이 처리 중입니다. 잠시 후 다시 시도하세요.", 409);
    }
    if (existing?.status === "CANCELED" || existing?.status === "REFUNDED") {
      throw new ClunkHttpError("종료된 주문입니다. 새 idempotency key로 다시 시도하세요.", 409);
    }
    if (existing?.status === "FAILED") {
      const retry = await db.prepare(
        `UPDATE clunk_marketplace_orders
         SET status = 'CREATING', payment_reference = NULL, checkout_url = NULL
         WHERE id = ? AND status = 'FAILED'`,
      ).bind(orderId).run();
      ownsCreation = Number((retry as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1;
    } else if (!existing) {
      const created = await db.prepare(
        `INSERT OR IGNORE INTO clunk_marketplace_orders
         (id, listing_id, buyer_user_id, status, payment_provider, payment_reference, checkout_url, amount_cents, currency)
         VALUES (?, ?, ?, 'CREATING', 'stripe', NULL, NULL, ?, ?)`,
      ).bind(orderId, listing.id, user.id, listing.priceCents, listing.currency).run();
      ownsCreation = Number((created as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1;
    }

    if (!ownsCreation) {
      const concurrent = await readOrder(db, orderId);
      if (!concurrent) throw new ClunkHttpError("주문 상태를 확인할 수 없습니다.", 409);
      if (concurrent.status === "PAID") {
        return privateJson({ ok: true, schema: "clunk.marketplace-checkout.v1", status: "ALREADY_PAID", provider: "stripe", orderId, idempotent: true });
      }
      if (concurrent.status === "PENDING" && concurrent.paymentReference && concurrent.checkoutUrl) {
        return privateJson({ ok: true, schema: "clunk.marketplace-checkout.v1", status: "CHECKOUT_READY", provider: "stripe", orderId, checkoutUrl: concurrent.checkoutUrl, paymentReference: concurrent.paymentReference, idempotent: true });
      }
      throw new ClunkHttpError("동일한 결제 요청이 처리 중이거나 종료되었습니다. 잠시 후 다시 시도하세요.", 409);
    }

    const provider = createStripeBillingProvider(billingEnvironment);
    if (provider.provider !== "stripe") throw new ClunkHttpError("결제 제공자 설정이 없습니다.", 503);
    let reference: { paymentReference: string; checkoutUrl: string };
    try {
      reference = await createCheckout(provider, request, {
        orderId,
        listingId: listing.id,
        assetId: listing.assetId,
        title: listing.title,
        description: listing.description,
        amountCents: listing.priceCents,
        currency: listing.currency,
      });
    } catch (error) {
      await db.prepare("UPDATE clunk_marketplace_orders SET status = 'FAILED' WHERE id = ? AND status = 'CREATING'").bind(orderId).run();
      throw error;
    }
    const completed = await db.prepare(
      `UPDATE clunk_marketplace_orders
       SET status = 'PENDING', payment_reference = ?, checkout_url = ?
       WHERE id = ? AND status = 'CREATING'`,
    ).bind(reference.paymentReference, reference.checkoutUrl, orderId).run();
    if (Number((completed as { meta?: { changes?: number } }).meta?.changes ?? 0) !== 1) {
      throw new ClunkHttpError("주문 상태를 저장하지 못했습니다.", 500);
    }
    return privateJson({
      ok: true,
      schema: "clunk.marketplace-checkout.v1",
      status: "CHECKOUT_READY",
      provider: "stripe",
      orderId,
      paymentReference: reference.paymentReference,
      checkoutUrl: reference.checkoutUrl,
      idempotent: false,
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

type CreditSettlementInput = {
  listing: { id: string; assetId: string; title: string; priceCents: number; currency: string };
  buyerUserId: string;
  workspaceId: string;
  idempotencyKey: string;
};

/**
 * Pays a published listing from the buyer's credit balance. The debit is the
 * idempotent primitive (same machine as generation debits); the order-PAID
 * update and the entitlement INSERT ride on its applied guard, so a retried
 * request can never double-charge or double-grant.
 */
async function settleWithCredits(db: D1Database, input: CreditSettlementInput): Promise<Response> {
  const { listing, buyerUserId, workspaceId, idempotencyKey } = input;
  const creditPrice = creditPriceForListing(listing.priceCents, listing.currency);
  if (creditPrice === null) {
    return privateJson({
      ok: false,
      schema: "clunk.marketplace-checkout.v1",
      status: "LISTING_NOT_CREDIT_PRICED",
      error: `이 listing은 크레딧 결제 단위(1크레딧 = ₩${KRW_PER_CREDIT})로 나누어떨어지지 않아 크레딧으로 구매할 수 없습니다.`,
    }, { status: 409 });
  }

  const orderId = scopedStorageId("order", workspaceId, `${buyerUserId}:${listing.id}:${idempotencyKey}`);
  const existing = await db.prepare(
    `SELECT id, status, amount_cents AS amountCents, currency, listing_id AS listingId, buyer_user_id AS buyerUserId
     FROM clunk_marketplace_orders WHERE id = ? LIMIT 1`,
  ).bind(orderId).first<{ id: string; status: string; amountCents: number; currency: string; listingId: string; buyerUserId: string }>();
  if (existing && (existing.listingId !== listing.id || existing.buyerUserId !== buyerUserId || existing.amountCents !== listing.priceCents || existing.currency !== listing.currency)) {
    throw new ClunkHttpError("동일한 idempotency key가 다른 주문에 사용되었습니다.", 409);
  }
  if (existing?.status === "CANCELED" || existing?.status === "REFUNDED") {
    throw new ClunkHttpError("종료된 주문입니다. 새 idempotency key로 다시 시도하세요.", 409);
  }
  if (!existing) {
    await db.prepare(
      `INSERT OR IGNORE INTO clunk_marketplace_orders
       (id, listing_id, buyer_user_id, status, payment_provider, payment_reference, checkout_url, amount_cents, currency)
       VALUES (?, ?, ?, 'CREATING', 'credits', NULL, NULL, ?, ?)`,
    ).bind(orderId, listing.id, buyerUserId, listing.priceCents, listing.currency).run();
  }

  const entitlementId = scopedStorageId("entitlement", buyerUserId, orderId);
  try {
    const debit = await applyCreditOperation(
      db,
      workspaceId,
      {
        key: `market-order:${orderId}`,
        fingerprint: `listing:${listing.id}:${creditPrice}`,
        kind: "marketplace-purchase",
        amount: -creditPrice,
      },
      (operationId) => [
        db.prepare(
          `UPDATE clunk_marketplace_orders SET status = 'PAID', payment_reference = ?
           WHERE id = ? AND status IN ('PENDING', 'CREATING')
             AND EXISTS (SELECT 1 FROM clunk_credit_operations WHERE id = ? AND workspace_id = ? AND status = 'applied')`,
        ).bind(`credits:${operationId}`, orderId, operationId, workspaceId),
        db.prepare(
          `INSERT OR IGNORE INTO clunk_marketplace_entitlements
           (id, order_id, listing_id, asset_id, buyer_user_id, status, provider_reference)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        ).bind(entitlementId, orderId, listing.id, listing.assetId, buyerUserId, `credits:${operationId}`),
      ],
    );
    return privateJson({
      ok: true,
      schema: "clunk.marketplace-checkout.v1",
      status: "PAID_WITH_CREDITS",
      provider: "credits",
      orderId,
      listingId: listing.id,
      assetId: listing.assetId,
      entitlementId,
      creditsCharged: creditPrice,
      balance: debit.balance,
      idempotent: debit.idempotent,
      downloadUrl: `/api/marketplace/assets/${listing.assetId}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ClunkHttpError && error.status === 402) {
      return privateJson({
        ok: false,
        schema: "clunk.marketplace-checkout.v1",
        status: "INSUFFICIENT_CREDITS",
        creditsRequired: creditPrice,
        error: `크레딧이 부족합니다. 이 상품은 ${creditPrice.toLocaleString("ko-KR")} 크레딧이 필요합니다.`,
      }, { status: 402 });
    }
    throw error;
  }
}

async function createCheckout(
  provider: BillingProvider,
  request: Request,
  input: Omit<Parameters<BillingProvider["createCheckout"]>[0], "successUrl" | "cancelUrl">,
): Promise<{ paymentReference: string; checkoutUrl: string }> {
  const origin = new URL(request.url).origin;
  const result = await provider.createCheckout({
    ...input,
    successUrl: new URL("/marketplace?checkout=success", `${origin}/`).toString(),
    cancelUrl: new URL("/marketplace?checkout=canceled", `${origin}/`).toString(),
  });
  return { paymentReference: result.reference, checkoutUrl: result.checkoutUrl };
}

type StoredOrder = {
  id: string;
  status: string;
  paymentReference: string | null;
  checkoutUrl: string | null;
  amountCents: number;
  currency: string;
  listingId: string;
  buyerUserId: string;
};

async function readOrder(db: D1Database, orderId: string): Promise<StoredOrder | null> {
  return db.prepare(
    `SELECT id, status, payment_reference AS paymentReference, checkout_url AS checkoutUrl,
        amount_cents AS amountCents, currency, listing_id AS listingId, buyer_user_id AS buyerUserId
     FROM clunk_marketplace_orders WHERE id = ? LIMIT 1`,
  ).bind(orderId).first<StoredOrder>();
}
