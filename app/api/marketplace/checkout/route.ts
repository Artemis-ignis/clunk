import { assertSameOrigin, ClunkHttpError, privateJson } from "../../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * Checkout is deliberately an explicit integration boundary. Until a real payment
 * provider is configured, Clunk must not create an order or imply that a purchase
 * succeeded.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    throw new ClunkHttpError(
      "결제를 시작할 수 없습니다. Clunk 운영 환경에 결제 제공자를 연결한 뒤 다시 시도하세요.",
      503,
    );
  } catch (error) {
    const status = error instanceof ClunkHttpError ? error.status : 500;
    const message = error instanceof ClunkHttpError ? error.message : "Unexpected checkout error.";
    return privateJson({
      ok: false,
      schema: "clunk.marketplace-checkout.v1",
      status: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      provider: null,
      error: message,
    }, { status });
  }
}
