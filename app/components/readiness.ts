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

/**
 * 화면에서 가장 크게 읽혀야 하는 한 줄. 점수가 아니라 이게 답이다.
 *
 * 95/100인데 게임에 넣을 수 없는 파일이 실제로 있다. hard blocker 하나는 여섯 카테고리
 * 평균에서 3점밖에 못 깎기 때문이다. 숫자를 크게 두면 사는 사람이 통과했다고 읽는다.
 */
export function readinessLabel(state: ReadinessState): string {
  if (state === "ready") return "게임에 들어갑니다";
  if (state === "conditional") return "확인이 필요합니다";
  return "들어갈 수 없습니다";
}

export function readinessNote(state: ReadinessState): string {
  if (state === "ready") return "차단 finding이 없습니다. 선언된 정책을 충족합니다.";
  if (state === "conditional") {
    return "차단 finding은 없습니다. 무손실 정리로 고칠 수 없는 경고가 남아 있어 수동 확인이 필요합니다.";
  }
  return "차단 finding이 남아 있습니다. 허용 목록 최적화 후 새 비교를 확인하세요.";
}

export function readinessHint(state: ReadinessState): string | null {
  if (state !== "conditional") return null;
  return "무손실 정리로 고칠 수 없는 경고가 남아 있습니다.";
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
