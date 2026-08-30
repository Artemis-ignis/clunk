import {
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
} from "../billing";
import { getRuntimeEnvironment } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

type CheckoutPayload = { listingId?: unknown; idempotencyKey?: unknown; withdrawalConsent?: unknown };

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
    if (!listing) throw new ClunkHttpError("공개된 listing을 찾을 수 없습니다.", 404);
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
