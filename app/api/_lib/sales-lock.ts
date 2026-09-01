import { getRuntimeEnvironment } from "../../runtime-environment";

/**
 * The pre-launch sales lock.
 *
 * Korean mail-order sales (통신판매업) require a filing that is still in
 * progress, so nothing on this deployment may complete a purchase. Until the
 * operator sets CLUNK_SALES_OPEN=1, every checkout rail refuses and the credit
 * catalogue publishes no purchasable pack.
 *
 * This exists because the boundary used to live only in the payment-provider
 * check: the credit rail settles from a workspace balance without touching a
 * provider, and new workspaces are granted 25 credits, so a visitor could sign
 * in with Google and complete a real purchase while three separate surfaces
 * told them sales had not started.
 */
export function areSalesOpen(): boolean {
  return getRuntimeEnvironment().CLUNK_SALES_OPEN === "1";
}

export const SALES_LOCKED_BODY = {
  ok: false as const,
  schema: "clunk.sales-lock.v1" as const,
  status: "SALES_NOT_OPEN" as const,
  // The lock used to explain itself as paperwork, which read as a broken product. It is the
  // free beta: nothing is sold yet, on purpose.
  error: "무료 베타 기간이라 결제를 받지 않습니다. 지금은 모든 기능을 결제 없이 씁니다.",
};
