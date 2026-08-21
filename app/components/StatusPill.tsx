export type StatusPillStatus = "ready" | "conditional" | "blocked" | "demo" | "idle" | "error";

const labels: Record<StatusPillStatus, string> = {
  ready: "준비 완료",
  conditional: "조건부 준비",
  blocked: "차단됨",
  demo: "데모 샘플",
  idle: "대기 중",
  error: "실패",
};

export function StatusPill({ status }: { status: StatusPillStatus }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{labels[status]}</span>;
}
