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
  KRW_PER_CREDIT,
  type BillingProvider,
} from "../billing";
import { getRuntimeEnvironment } from "../../../runtime-environment";

import { areSalesOpen, SALES_LOCKED_BODY } from "../../_lib/sales-lock";
import { resolveListingAccess } from "../../_lib/market-gate";

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
    // 무료인가는 저장된 값이 아니라 등급이 정한다 — 문지기(market-gate.resolveListingAccess)와
    // 같은 함수다. 낱개 값을 없앤 뒤 price_cents 가 0 인 행이 49개인데 그중 A·S 등급이 섞여
    // 있어, 값만 보고 FREE_DOWNLOAD 로 끝내면 베타 기록이 안 생기고 문지기는 그 파일에
    // 403 을 돌려준다. 화면은 "받았습니다" 라고 말하는데 파일은 오지 않던 구멍이다.
    const { paid } = await resolveListingAccess(db, listing.assetId);
    if (!paid) {
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

// 2026-09-04: 크레딧으로 상품을 사는 정산 함수를 지웠다. 위의 문지기가 이미 그 길을
// 닫아 두어 부르는 곳이 없었는데, 값을 크레딧으로 환산하고 잔액에서 깎는 코드가 남아
// 있으면 언젠가 다시 연결된다. 결제대행 심사가 두 번 걸린 것이 정확히 그 구조다.

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
