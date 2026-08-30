/**
 * Provider-neutral marketplace billing boundary.
 *
 * The database routes own listing/order/entitlement state. This module only
 * talks to a configured payment provider and returns verified, normalized
 * events. No provider configuration means no remote call and no order claim.
 */

export type BillingEnvironment = Record<string, string | undefined>;

export type BillingStatus = {
  provider: "stripe" | null;
  status: "AVAILABLE" | "CONFIG_REQUIRED";
  configured: boolean;
  missing: string[];
};

export type CheckoutInput = {
  orderId: string;
  listingId: string;
  assetId: string;
  title: string;
  description: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutReference = {
  provider: "stripe";
  reference: string;
  checkoutUrl: string;
};

export type BillingEvent = {
  provider: "stripe";
  eventId: string;
  reference: string;
  orderId: string;
  listingId?: string;
  status: "PAID" | "CANCELED" | "REFUNDED";
  amountCents: number;
  currency: string;
};

export interface BillingProvider {
  provider: "stripe";
  createCheckout(input: CheckoutInput): Promise<CheckoutReference>;
  verifyWebhook(request: Request): Promise<BillingEvent>;
}

interface UnconfiguredBillingProvider {
  provider: null;
  createCheckout(input: CheckoutInput): Promise<never>;
  verifyWebhook(request: Request): Promise<never>;
}

export class BillingConfigurationError extends Error {
  readonly code = "CONFIG_REQUIRED";

  constructor(message: string) {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

export class BillingVerificationError extends Error {
  readonly code = "WEBHOOK_REJECTED";

  constructor(message: string) {
    super(message);
    this.name = "BillingVerificationError";
  }
}

export function getBillingEnvironment(overrides: Record<string, unknown> = {}): BillingEnvironment {
  const environment: BillingEnvironment = {};
  if (typeof process !== "undefined" && process.env) {
    for (const [name, value] of Object.entries(process.env)) {
      if (typeof value === "string") environment[name] = value;
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (typeof value === "string") environment[name] = value;
  }
  return environment;
}

export function getBillingStatus(
  environment: BillingEnvironment = getBillingEnvironment(),
): BillingStatus {
  const missing: string[] = [];
  if (environment.CLUNK_BILLING_PROVIDER?.trim().toLowerCase() !== "stripe") missing.push("CLUNK_BILLING_PROVIDER");
  if (!environment.STRIPE_SECRET_KEY?.trim()) missing.push("STRIPE_SECRET_KEY");
  if (!environment.STRIPE_WEBHOOK_SECRET?.trim()) missing.push("STRIPE_WEBHOOK_SECRET");
  return missing.length
    ? { provider: null, status: "CONFIG_REQUIRED", configured: false, missing }
    : { provider: "stripe", status: "AVAILABLE", configured: true, missing: [] };
}

export function createStripeBillingProvider(
  environment: BillingEnvironment = getBillingEnvironment(),
  fetchImpl: typeof fetch = fetch,
  now: () => number = () => Date.now(),
): BillingProvider | UnconfiguredBillingProvider {
  const status = getBillingStatus(environment);
  if (status.status !== "AVAILABLE") {
    const error = () => Promise.reject<never>(new BillingConfigurationError(`Payment provider configuration is incomplete: ${status.missing.join(", ")}.`));
    return { provider: null, createCheckout: error, verifyWebhook: error };
  }

  const secretKey = environment.STRIPE_SECRET_KEY!.trim();
  const webhookSecret = environment.STRIPE_WEBHOOK_SECRET!.trim();
  return {
    provider: "stripe",
    async createCheckout(input) {
      validateCheckoutInput(input);
      const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${base64Encode(new TextEncoder().encode(`${secretKey}:`))}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "payment",
          client_reference_id: input.orderId,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": input.currency.toLowerCase(),
          "line_items[0][price_data][unit_amount]": String(input.amountCents),
          "line_items[0][price_data][product_data][name]": input.title,
          "line_items[0][price_data][product_data][description]": input.description,
          "metadata[orderId]": input.orderId,
          "metadata[listingId]": input.listingId,
          "metadata[assetId]": input.assetId,
          "payment_intent_data[metadata][orderId]": input.orderId,
          "payment_intent_data[metadata][listingId]": input.listingId,
          "payment_intent_data[metadata][assetId]": input.assetId,
        }),
      });
      const payload = await jsonPayload(response);
      if (!response.ok || !isRecord(payload) || typeof payload.id !== "string" || typeof payload.url !== "string" || !/^https:\/\//i.test(payload.url)) {
        throw new Error("Payment provider did not return a checkout session.");
      }
      return { provider: "stripe", reference: payload.id, checkoutUrl: payload.url };
    },
    async verifyWebhook(request) {
      const rawBody = await request.text();
      const signature = request.headers.get("stripe-signature");
      if (!await verifyStripeSignature(rawBody, signature, webhookSecret, now())) {
        throw new BillingVerificationError("Payment webhook signature is invalid or expired.");
      }
      return parseStripeEvent(rawBody);
    },
  };
}

export async function signStripeWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const signature = await hmacSha256(secret, `${timestamp}.${payload}`);
  return `t=${Math.floor(timestamp)},v1=${bytesToHex(signature)}`;
}

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  now: number,
): Promise<boolean> {
  if (!header) return false;
  const values = new Map<string, string[]>();
  for (const item of header.split(",")) {
    const [name, value] = item.split("=", 2);
    if (!name || !value) continue;
    const entries = values.get(name) ?? [];
    entries.push(value);
    values.set(name, entries);
  }
  const timestamp = Number(values.get("t")?.[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > 5 * 60) return false;
  const expected = await hmacSha256(secret, `${timestamp}.${payload}`);
  for (const candidate of values.get("v1") ?? []) {
    const actual = hexToBytes(candidate);
    if (actual && constantTimeEqual(actual, expected)) return true;
  }
  return false;
}

function parseStripeEvent(rawBody: string): BillingEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new BillingVerificationError("Payment webhook body is not valid JSON.");
  }
  if (!isRecord(parsed) || typeof parsed.id !== "string" || !isRecord(parsed.data) || !isRecord(parsed.data.object)) {
    throw new BillingVerificationError("Payment webhook contract is incomplete.");
  }
  const object = parsed.data.object;
  const metadata = isRecord(object.metadata) ? object.metadata : {};
  const orderId = stringValue(metadata.orderId) ?? stringValue(object.client_reference_id);
  const reference = stringValue(object.id);
  if (!orderId || !reference) throw new BillingVerificationError("Payment webhook has no order reference.");
  const amountCents = integerValue(object.amount_total) ?? integerValue(object.amount);
  const currency = stringValue(object.currency)?.toUpperCase();
  if (amountCents === undefined || amountCents < 1 || !currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new BillingVerificationError("Payment webhook amount or currency is invalid.");
  }
  const eventType = stringValue(parsed.type);
  let status: BillingEvent["status"];
  if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
    if (object.payment_status !== "paid") throw new BillingVerificationError("Payment webhook is not a verified paid session.");
    status = "PAID";
  } else if (eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired") {
    status = "CANCELED";
  } else if (eventType === "charge.refunded") {
    status = "REFUNDED";
  } else {
    throw new BillingVerificationError("Payment webhook event type is not supported.");
  }
  const listingId = stringValue(metadata.listingId);
  return {
    provider: "stripe",
    eventId: parsed.id,
    reference,
    orderId,
    ...(listingId ? { listingId } : {}),
    status,
    amountCents,
    currency,
  };
}

function validateCheckoutInput(input: CheckoutInput): void {
  if (!input.orderId || !input.listingId || !input.assetId || !input.title || !input.description) throw new Error("Payment checkout metadata is incomplete.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) throw new Error("Paid checkout requires a positive integer amount.");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Checkout currency must be an uppercase ISO-4217 code.");
  for (const returnUrl of [input.successUrl, input.cancelUrl]) {
    const url = new URL(returnUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("Checkout return URLs must use HTTPS.");
  }
}

async function jsonPayload(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

async function hmacSha256(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function integerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}
