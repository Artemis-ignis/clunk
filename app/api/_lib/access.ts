import { SIGNUP_GRANT_CREDITS } from "./clunk";
import { areSalesOpen } from "./sales-lock";

/**
 * What this caller can do right now, and what the next step would add.
 *
 * An agent working against a metered product otherwise learns its limits by hitting them:
 * it spends a user's credits, gets a refusal, and has to guess whether the problem was
 * the balance, the plan or the endpoint. Attaching this to every response means the
 * budget is readable before the call that would exceed it, and the upgrade is described
 * in the same breath rather than living on a pricing page nobody fetched.
 *
 * Everything here is either measured from the caller's own row or a fixed fact about the
 * product. Nothing is a projection.
 */

/** billing.ts: internal units are won x 100, and one credit is 100 KRW. */
const CREDIT_KRW = 100;

export type AccessBlock = Record<string, unknown>;

export function accessFor(options: {
  authenticated: boolean;
  credits?: number | null;
}): AccessBlock {
  const salesOpen = areSalesOpen();

  if (!options.authenticated) {
    return {
      as: "anonymous",
      can: [
        "browse the published catalogue",
        "read each listing's measured spec and evidence",
        "download the artifacts of a free listing",
      ],
      cannot: ["author assets", "run an inspection", "spend or hold credits"],
      // Naming the cost of the thing they cannot do yet is more useful than naming the
      // thing itself: an agent can tell its user what a session would actually cost.
      a_signed_in_workspace_adds: {
        how: "Sign in at /login. A workspace is created on first sign-in.",
        credits_on_signup: SIGNUP_GRANT_CREDITS,
        credit_price_krw: CREDIT_KRW,
        generate_cost_credits: 1,
      },
      sales_open: salesOpen,
      ...(salesOpen ? {} : { sales_note: "통신판매업 신고 전이라 결제는 아직 열지 않았습니다." }),
    };
  }

  const credits = options.credits ?? 0;
  return {
    as: "workspace",
    credits,
    credit_price_krw: CREDIT_KRW,
    costs: { generate: 1, inspect: 0, marketplace_asset: "the listing's own price" },
    // Division, not a promise: it is how many generate calls the current balance covers,
    // and it goes stale the moment one is spent.
    generates_remaining: credits,
    can: ["author assets", "run inspections", "hold entitlements"],
    ...(salesOpen
      ? { cannot: [] }
      : {
          cannot: ["buy credits", "buy a paid listing"],
          sales_note: "통신판매업 신고 절차가 끝나면 결제를 엽니다. 그때까지 남은 크레딧으로는 정상 사용됩니다.",
        }),
  };
}
