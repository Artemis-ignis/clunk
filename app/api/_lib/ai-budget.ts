/**
 * The daily ceiling on Workers AI spend, enforced before every model call.
 *
 * The free beta runs on Cloudflare's free allowance, and the standing instruction is that
 * the account never crosses a free limit. Workers AI is the one place that can happen by
 * accident: one image costs about 130 neurons, the allowance is 10,000 a day, and fifty
 * people generating five pictures each would spend three days' worth before lunch. It
 * already happened once on this account, in a single afternoon of parameter probing.
 *
 * So the budget is a ledger, not a hope. Every call is recorded with its measured cost,
 * the day's total is checked against a ceiling that sits below the allowance, and a call
 * that would cross it is refused with the time the budget comes back — before any credit
 * is charged and before the model is asked.
 *
 * Two ceilings: a global one, which is the money, and a per-workspace one, which is
 * fairness — a beta where one person can drain the day for everyone is not a beta.
 */

/** Measured on this account 2026-09-01: flux-1-schnell, one 1024² image. */
export const NEURONS_PER_IMAGE = 129.6;

/** Cloudflare's published free allowance for Workers AI, per UTC day. */
export const FREE_NEURONS_PER_DAY = 10_000;

/**
 * Our own line, drawn below the allowance. The gap absorbs two things a ledger cannot see:
 * a model call that costs a little more than the measured figure, and two requests that
 * pass the check at the same instant. ~65 images a day.
 */
export const DAILY_NEURON_CEILING = 8_500;

/** Images one workspace may generate per UTC day during the beta. */
export const WORKSPACE_IMAGES_PER_DAY = 8;

export type BudgetDecision =
  | { status: "OK"; reservationId: string; globalRemainingImages: number; workspaceRemainingImages: number; resetsAt: string }
  | { status: "GLOBAL_EXHAUSTED"; resetsAt: string }
  | { status: "WORKSPACE_EXHAUSTED"; resetsAt: string };

export type BudgetSnapshot = {
  day: string;
  resetsAt: string;
  globalUsedNeurons: number;
  globalRemainingImages: number;
  workspaceUsedImages: number | null;
  workspaceRemainingImages: number | null;
  perImageNeurons: number;
  dailyCeilingNeurons: number;
  workspaceImagesPerDay: number;
};

/** The allowance resets on Cloudflare's clock, which is UTC. */
function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

/**
 * Take a seat for one image, or explain why not.
 *
 * The row is written first and the total read second, on purpose. Two requests arriving
 * together each insert, each count a total that includes both, and if that total is over
 * the line each removes its own row and refuses. The day's recorded spend can therefore
 * end up under the ceiling but never over it, which is the direction the mistake has to
 * fall in when the ceiling is somebody's money.
 */
export async function reserveImageBudget(
  db: D1Database,
  workspaceId: string,
  options: { model: string; neurons?: number } = { model: "unknown" },
): Promise<BudgetDecision> {
  const now = new Date();
  const day = utcDay(now);
  const resetsAt = nextUtcMidnight(now);
  const neurons = options.neurons ?? NEURONS_PER_IMAGE;
  const reservationId = `ai-${day}-${workspaceId}-${crypto.randomUUID()}`;

  await db
    .prepare(
      `INSERT INTO clunk_ai_usage (id, workspace_id, day, model, neurons) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(reservationId, workspaceId, day, options.model, neurons)
    .run();

  const [global, mine] = await Promise.all([
    db
      .prepare(`SELECT COALESCE(SUM(neurons), 0) AS neurons FROM clunk_ai_usage WHERE day = ?`)
      .bind(day)
      .first<{ neurons: number | string }>(),
    db
      .prepare(`SELECT COUNT(*) AS images FROM clunk_ai_usage WHERE day = ? AND workspace_id = ?`)
      .bind(day, workspaceId)
      .first<{ images: number | string }>(),
  ]);
  const globalUsed = Number(global?.neurons ?? 0);
  const workspaceUsed = Number(mine?.images ?? 0);

  if (globalUsed > DAILY_NEURON_CEILING) {
    await releaseImageBudget(db, reservationId);
    return { status: "GLOBAL_EXHAUSTED", resetsAt };
  }
  if (workspaceUsed > WORKSPACE_IMAGES_PER_DAY) {
    await releaseImageBudget(db, reservationId);
    return { status: "WORKSPACE_EXHAUSTED", resetsAt };
  }
  return {
    status: "OK",
    reservationId,
    globalRemainingImages: Math.max(0, Math.floor((DAILY_NEURON_CEILING - globalUsed) / neurons)),
    workspaceRemainingImages: Math.max(0, WORKSPACE_IMAGES_PER_DAY - workspaceUsed),
    resetsAt,
  };
}

/**
 * Give the seat back. Only for a call that never reached the model — the binding was
 * absent, say. A call that was made and failed still spent the neurons, and the ledger has
 * to say so.
 */
export async function releaseImageBudget(db: D1Database, reservationId: string): Promise<void> {
  await db.prepare(`DELETE FROM clunk_ai_usage WHERE id = ?`).bind(reservationId).run();
}

/** What is left today, for the access block and the studio's own display. */
export async function imageBudgetSnapshot(db: D1Database, workspaceId?: string): Promise<BudgetSnapshot> {
  const now = new Date();
  const day = utcDay(now);
  const global = await db
    .prepare(`SELECT COALESCE(SUM(neurons), 0) AS neurons FROM clunk_ai_usage WHERE day = ?`)
    .bind(day)
    .first<{ neurons: number | string }>();
  const globalUsed = Number(global?.neurons ?? 0);
  let workspaceUsed: number | null = null;
  if (workspaceId) {
    const mine = await db
      .prepare(`SELECT COUNT(*) AS images FROM clunk_ai_usage WHERE day = ? AND workspace_id = ?`)
      .bind(day, workspaceId)
      .first<{ images: number | string }>();
    workspaceUsed = Number(mine?.images ?? 0);
  }
  return {
    day,
    resetsAt: nextUtcMidnight(now),
    globalUsedNeurons: globalUsed,
    globalRemainingImages: Math.max(0, Math.floor((DAILY_NEURON_CEILING - globalUsed) / NEURONS_PER_IMAGE)),
    workspaceUsedImages: workspaceUsed,
    workspaceRemainingImages: workspaceUsed === null ? null : Math.max(0, WORKSPACE_IMAGES_PER_DAY - workspaceUsed),
    perImageNeurons: NEURONS_PER_IMAGE,
    dailyCeilingNeurons: DAILY_NEURON_CEILING,
    workspaceImagesPerDay: WORKSPACE_IMAGES_PER_DAY,
  };
}

/** The body a refused request returns. Named status, the reset time, and plain words. */
export function budgetRefusal(decision: Exclude<BudgetDecision, { status: "OK" }>) {
  const resetKst = new Date(decision.resetsAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  return {
    ok: false as const,
    schema: "clunk.ai-budget.v1" as const,
    status: decision.status,
    resetsAt: decision.resetsAt,
    credits: null,
    idempotent: false,
    error:
      decision.status === "GLOBAL_EXHAUSTED"
        ? `오늘 베타 전체의 이미지 생성 한도를 다 썼습니다. 한국 시간 ${resetKst}에 다시 열립니다. 크레딧은 차감되지 않았습니다.`
        : `오늘 이 작업공간의 이미지 생성 한도(${WORKSPACE_IMAGES_PER_DAY}장)를 다 썼습니다. 한국 시간 ${resetKst}에 다시 열립니다. 크레딧은 차감되지 않았습니다.`,
  };
}
