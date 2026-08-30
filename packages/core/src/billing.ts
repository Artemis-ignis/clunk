/**
 * Provider-neutral billing contract shared by Clunk's product layer.
 * The live adapter currently lives at app/api/marketplace/billing.ts so the
 * Core package remains portable across Sites, Workers, and local execution.
 *
 * Credit operations deliberately use the existing D1 operation row as a small
 * state machine. A debit is held in `reserved`, written to the ledger only
 * when it reaches `applied`, and released or reversed through `refunded`.
 * Keeping the transition rules here lets API routes share one contract without
 * coupling Core to D1, Cloudflare, or a payment provider.
 */
export interface CheckoutReference {
  provider: string;
  checkoutId: string;
  redirectUrl?: string;
}

export interface PaymentResult {
  provider: string;
  paymentId: string;
  status: "paid" | "failed" | "cancelled";
}

export interface BillingProvider {
  createCheckout(): Promise<CheckoutReference>;
  verifyPayment(): Promise<PaymentResult>;
  cancelSubscription(): Promise<void>;
}

export type StoredArtifactReference = {
  fileName: string;
  objectKey: string;
  byteLength: number;
};

export interface ArtifactStorageReader {
  head(objectKey: string): Promise<{ size: number } | null>;
}

/**
 * Reopen every object through the configured storage binding before reporting
 * an artifact as stored. A request flag or a D1 metadata row is not evidence
 * that the object actually exists.
 */
export async function verifyStoredArtifactPersistence(
  storage: ArtifactStorageReader,
  artifacts: readonly StoredArtifactReference[],
): Promise<"STORED"> {
  if (artifacts.length === 0) {
    throw new Error("Cannot report STORED when no artifacts were provided.");
  }
  await Promise.all(artifacts.map(async (artifact) => {
    const stored = await storage.head(artifact.objectKey);
    if (!stored) {
      throw new Error(`Generated artifact was not persisted in R2: ${artifact.fileName}.`);
    }
    if (stored.size !== artifact.byteLength) {
      throw new Error(`Generated artifact size does not match the persisted R2 object: ${artifact.fileName}.`);
    }
  }));
  return "STORED";
}

export type CreditOperationStatus =
  | "pending"
  | "reserved"
  | "applied"
  | "refunded"
  | "rejected";

export type CreditOperationAction = "reserve" | "confirm" | "refund";

/**
 * Return the next state for a credit operation or throw for an invalid state
 * transition. Repeating a successful confirm/refund is intentionally safe so
 * a retried request cannot charge or refund twice.
 */
export function transitionCreditOperation(
  status: CreditOperationStatus,
  action: CreditOperationAction,
): CreditOperationStatus {
  if (status === "pending" && action === "reserve") return "reserved";
  if (status === "reserved" && action === "confirm") return "applied";
  if (status === "reserved" && action === "refund") return "refunded";
  if (status === "applied" && action === "confirm") return "applied";
  if (status === "applied" && action === "refund") return "refunded";
  if (status === "refunded" && action === "refund") return "refunded";
  throw new Error(`Invalid credit operation transition: ${status} -> ${action}.`);
}

/**
 * Check the balance after placing one more reservation. `heldBalance` is the
 * sum of negative amounts in other active reservations, so it is normally
 * zero or negative. Positive amounts are grants and are always reservable.
 */
export function canReserveCredits(
  ledgerBalance: number,
  heldBalance: number,
  amount: number,
): boolean {
  if (
    !Number.isSafeInteger(ledgerBalance) ||
    !Number.isSafeInteger(heldBalance) ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    heldBalance > 0
  ) {
    return false;
  }
  return amount > 0 || ledgerBalance + heldBalance + amount >= 0;
}
