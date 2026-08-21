/**
 * Provider boundary for a future Korean payment integration.
 * v1 intentionally ships only the D1 demo ledger; no provider is wired here.
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
