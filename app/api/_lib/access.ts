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
      cannot: ["author assets", "run an inspection", "download a subscriber-only listing"],
      // 실행 횟수는 값을 매겨 파는 물건이 아니다. 값을 적어 두면 그 값이 곧 가격이 되고,
      // 우리가 파는 것은 기간제 구독 하나뿐이다. 몇 번 쓸 수 있는지만 말한다.
      a_signed_in_workspace_adds: {
        how: "Sign in at /login. A workspace is created on first sign-in.",
        runs_on_signup: SIGNUP_GRANT_CREDITS,
        generate_cost_runs: 1,
        // Stated up front, because a beta limit discovered on the ninth picture is a
        // worse experience than one read before the first.
        images_per_day: WORKSPACE_IMAGES_PER_DAY,
      },
      sales_open: salesOpen,
      ...(salesOpen ? {} : { sales_note: "베타 기간에는 로그인만 하면 모든 에셋과 기능이 열립니다." }),
    };
  }

  const credits = options.credits ?? 0;
  return {
    as: "workspace",
    // 남은 실행 횟수. 값이 아니라 횟수다 — 에셋은 낱개로 팔지 않고, 무료 등급은 로그인만
    // 하면 받으며 그 위는 구독으로 열린다.
    runs_remaining: credits,
    costs: { generate: 1, inspect: 1, marketplace_asset: "구독으로 열립니다" },
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
          cannot: ["start a subscription"],
          sales_note: "지금은 구독 없이 모든 에셋과 기능이 열립니다. 구독을 시작할 때 미리 공지합니다.",
        }),
  };
}
