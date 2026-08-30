import assert from "node:assert/strict";
import test from "node:test";
import {
  createStripeBillingProvider,
  getBillingStatus,
  signStripeWebhookPayload,
  type BillingEnvironment,
} from "../app/api/marketplace/billing";
import {
  canReserveCredits,
  verifyStoredArtifactPersistence,
  transitionCreditOperation,
} from "../packages/core/src/billing";

const SECRET = "sk_test_clunk_contract_secret";
const WEBHOOK_SECRET = "whsec_clunk_contract_secret";
const ENV: BillingEnvironment = {
  CLUNK_BILLING_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: SECRET,
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
};
const NOW = 1_700_000_000_000;

test("credit operations use an explicit reserve, confirm, and refund lifecycle", () => {
  assert.equal(transitionCreditOperation("pending", "reserve"), "reserved");
  assert.equal(transitionCreditOperation("reserved", "confirm"), "applied");
  assert.equal(transitionCreditOperation("reserved", "refund"), "refunded");
  assert.equal(transitionCreditOperation("applied", "refund"), "refunded");
  assert.equal(transitionCreditOperation("applied", "confirm"), "applied");
  assert.throws(() => transitionCreditOperation("refunded", "confirm"));
  assert.equal(canReserveCredits(1, 0, -1), true);
  assert.equal(canReserveCredits(1, -1, -1), false);
  assert.equal(canReserveCredits(0, 0, 1), true);
});

test("stored status requires an actual storage reader to reopen every artifact", async () => {
  const objects = new Map([
    ["asset-entry.glb", 12],
    ["asset-preview.png", 24],
  ]);
  const headCalls: string[] = [];
  const storage = {
    async head(key: string) {
      headCalls.push(key);
      const size = objects.get(key);
      return size === undefined ? null : { size };
    },
  };

  await verifyStoredArtifactPersistence(storage, [
    { fileName: "asset-entry.glb", objectKey: "asset-entry.glb", byteLength: 12 },
    { fileName: "asset-preview.png", objectKey: "asset-preview.png", byteLength: 24 },
  ]);
  assert.deepEqual(headCalls.sort(), ["asset-entry.glb", "asset-preview.png"]);

  objects.delete("asset-preview.png");
  await assert.rejects(
    () => verifyStoredArtifactPersistence(storage, [
      { fileName: "asset-entry.glb", objectKey: "asset-entry.glb", byteLength: 12 },
      { fileName: "asset-preview.png", objectKey: "asset-preview.png", byteLength: 24 },
    ]),
    /not persisted/,
  );

  await assert.rejects(
    () => verifyStoredArtifactPersistence(storage, []),
    /no artifacts/i,
  );
});

test("billing status is explicit and missing provider configuration cannot create checkout", () => {
  const status = getBillingStatus({});
  assert.equal(status.configured, false);
  assert.equal(status.status, "CONFIG_REQUIRED");
  assert.ok(status.missing.includes("CLUNK_BILLING_PROVIDER"));
  assert.equal(createStripeBillingProvider({}).provider, null);
});

test("configured Stripe checkout binds server order, amount, currency, and return URLs", async () => {
  const requests: Request[] = [];
  const provider = createStripeBillingProvider(ENV, async (input, init) => {
    requests.push(new Request(input, init));
    return Response.json({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" });
  });
  assert.equal(provider.provider, "stripe");
  const result = await provider.createCheckout({
    orderId: "order-123",
    listingId: "listing-123",
    assetId: "asset-123",
    title: "Clunk crate",
    description: "Verified crate",
    amountCents: 1200,
    currency: "KRW",
    successUrl: "https://clunk.example/marketplace?checkout=success",
    cancelUrl: "https://clunk.example/marketplace?checkout=cancel",
  });
  assert.deepEqual(result, {
    provider: "stripe",
    reference: "cs_test_123",
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.headers.get("authorization"), `Basic ${btoa(`${SECRET}:`)}`);
  const body = await requests[0]!.text();
  assert.match(body, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1200/);
  assert.match(body, /line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=krw/);
  assert.match(body, /metadata%5BorderId%5D=order-123/);
  assert.match(body, /metadata%5BassetId%5D=asset-123/);
  assert.match(body, /payment_intent_data%5Bmetadata%5D%5BorderId%5D=order-123/);
});

test("Stripe webhook verification accepts a signed paid event and rejects tampering/expiry", async () => {
  const timestamp = Math.floor(NOW / 1000);
  const payload = JSON.stringify({
    id: "evt_123",
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_123",
      client_reference_id: "order-123",
      payment_status: "paid",
      amount_total: 1200,
      currency: "krw",
      metadata: { orderId: "order-123", listingId: "listing-123" },
    } },
  });
  const signature = await signStripeWebhookPayload(payload, WEBHOOK_SECRET, timestamp);
  const provider = createStripeBillingProvider(ENV, fetch, () => NOW);
  const event = await provider.verifyWebhook(new Request("https://clunk.example/api/marketplace/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  }));
  assert.deepEqual(event, {
    provider: "stripe",
    eventId: "evt_123",
    reference: "cs_test_123",
    orderId: "order-123",
    listingId: "listing-123",
    status: "PAID",
    amountCents: 1200,
    currency: "KRW",
  });

  const tampered = new Request("https://clunk.example/api/marketplace/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload.replace("1200", "1201"),
  });
  await assert.rejects(() => provider.verifyWebhook(tampered));
  const expired = await signStripeWebhookPayload(payload, WEBHOOK_SECRET, timestamp - 601);
  await assert.rejects(() => provider.verifyWebhook(new Request("https://clunk.example/api/marketplace/webhook", {
    method: "POST",
    headers: { "stripe-signature": expired },
    body: payload,
  })));
});

test("Stripe webhook cannot grant entitlement for unpaid or amount-mismatched events", async () => {
  const payload = JSON.stringify({
    id: "evt_unpaid",
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_unpaid",
      client_reference_id: "order-123",
      payment_status: "unpaid",
      amount_total: 1200,
      currency: "krw",
      metadata: { orderId: "order-123" },
    } },
  });
  const timestamp = Math.floor(NOW / 1000);
  const signature = await signStripeWebhookPayload(payload, WEBHOOK_SECRET, timestamp);
  const provider = createStripeBillingProvider(ENV, fetch, () => NOW);
  await assert.rejects(() => provider.verifyWebhook(new Request("https://clunk.example/api/marketplace/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  })));
});
