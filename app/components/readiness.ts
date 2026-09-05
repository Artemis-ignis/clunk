import type { ScoreReport } from "../../packages/core/src/index";

/**
 * Presentation-only readiness states.
 *
 * Core semantics are untouched: `score.ready` still requires every finding to be INFO,
 * and the stored `status` column still holds only `ready` / `blocked`. This helper only
 * splits the not-ready case into "hard blocker present" and "warnings only" so the UI can
 * stop showing a blocking badge next to a clean score.
 */
export type ReadinessState = "ready" | "conditional" | "blocked";

type ScoreLike = Pick<ScoreReport, "ready" | "hardBlockerCount">;

export function resolveReadiness(score: ScoreLike): ReadinessState {
  if (score.ready) return "ready";
  return score.hardBlockerCount > 0 ? "blocked" : "conditional";
}

/**
 * Derives the same three states from a stored analysis row. The row keeps the original
 * `status` value ('ready' | 'blocked'); the warning-only distinction comes from
 * `hardBlockerCount`, falling back to the stored report findings when that column is
 * unavailable. When neither source can be read the row stays on the blocking label.
 */
export function resolveStoredReadiness(run: {
  status: string;
  hardBlockerCount?: number | null;
  reportJson?: string | null;
}): ReadinessState {
  if (run.status === "ready") return "ready";
  const hardBlockerCount = typeof run.hardBlockerCount === "number" && Number.isFinite(run.hardBlockerCount)
    ? run.hardBlockerCount
    : countStoredHardBlockers(run.reportJson);
  if (hardBlockerCount === null) return "blocked";
  return hardBlockerCount > 0 ? "blocked" : "conditional";
}

export function readinessNote(state: ReadinessState): string {
  if (state === "ready") return "게임에 넣는 것을 막는 문제가 없습니다. 고른 기준을 모두 지켰습니다.";
  if (state === "conditional") {
    return "막는 문제는 없고, 기준을 아슬아슬하게 지난 경고가 남아 있습니다. 무엇이 걸렸는지는 아래에 그대로 적혀 있습니다.";
  }
  return "게임에 넣는 것을 막는 문제가 남아 있습니다. 아래 \"안전하게 최적화\"를 실행하면 정리한 새 파일로 다시 검사합니다.";
}

export function readinessHint(state: ReadinessState): string | null {
  if (state !== "conditional") return null;
  return "원본을 그대로 두는 안전한 정리로는 고칠 수 없는 경고입니다.";
}

function countStoredHardBlockers(reportJson?: string | null): number | null {
  if (typeof reportJson !== "string" || !reportJson) return null;
  try {
    const parsed = JSON.parse(reportJson) as { findings?: unknown };
    if (!Array.isArray(parsed.findings)) return null;
    return parsed.findings.filter((finding) => {
      if (!finding || typeof finding !== "object") return false;
      const severity = (finding as { severity?: unknown }).severity;
      return severity === "ERROR" || severity === "CRITICAL";
    }).length;
  } catch {
    return null;
  }
}
