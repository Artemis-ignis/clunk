import { SIGNUP_GRANT_CREDITS } from "./clunk";
import { areSalesOpen } from "./sales-lock";
import { WORKSPACE_IMAGES_PER_DAY, type BudgetSnapshot } from "./ai-budget";

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
  /** Today's image budget, when the caller has read it. Left out, the fixed limits are stated. */
  imageBudget?: BudgetSnapshot | null;
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
        // Stated up front, because a beta limit discovered on the ninth picture is a
        // worse experience than one read before the first.
        images_per_day: WORKSPACE_IMAGES_PER_DAY,
      },
      sales_open: salesOpen,
      ...(salesOpen ? {} : { sales_note: "결제 기능이 아직 없어 결제 없이 씁니다; 유료 전환은 미리 공지합니다." }),
    };
  }

  const credits = options.credits ?? 0;
  return {
    as: "workspace",
    credits,
    credit_price_krw: CREDIT_KRW,
    costs: { generate: 1, inspect: 1, marketplace_asset: "the listing's own price" },
    // Division, not a promise: it is how many generate calls the current balance covers,
    // and it goes stale the moment one is spent.
    generates_remaining: credits,
    // The image budget is the beta's real ceiling and it is measured, not asserted: the
    // number of images left is what the ledger says minus what has been recorded today.
    ...(options.imageBudget
      ? {
          images_today: {
            remaining: options.imageBudget.workspaceRemainingImages,
            per_day: options.imageBudget.workspaceImagesPerDay,
            beta_pool_remaining: options.imageBudget.globalRemainingImages,
            resets_at: options.imageBudget.resetsAt,
          },
        }
      : { images_per_day: WORKSPACE_IMAGES_PER_DAY }),
    can: ["author assets", "run inspections", "hold entitlements"],
    ...(salesOpen
      ? { cannot: [] }
      : {
          cannot: ["buy credits", "buy a paid listing"],
          sales_note: "결제 기능이 아직 없습니다. 실행 횟수는 가입 지급분과 월 지급분으로 쓰고, 결제는 유료 전환 때 미리 공지한 뒤 엽니다.",
        }),
  };
}
