export type StatusPillStatus = "ready" | "conditional" | "blocked" | "demo" | "idle" | "error";

const labels: Record<StatusPillStatus, string> = {
  ready: "정책 PASS",
  conditional: "정책 조건부",
  blocked: "정책 차단",
  demo: "데모 샘플",
  idle: "대기 중",
  error: "실패",
};

export function StatusPill({ status }: { status: StatusPillStatus }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{labels[status]}</span>;
}
