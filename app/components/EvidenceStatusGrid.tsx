export type EvidenceStatusTone = "pass" | "gap" | "pending" | "blocked";

export type EvidenceStatusItem = {
  label: string;
  value: string;
  detail: string;
  tone: EvidenceStatusTone;
};

export function EvidenceStatusGrid({
  items,
  className = "",
  ariaLabel = "증거 상태",
}: {
  items: readonly EvidenceStatusItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`evidence-status-grid${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {items.map((item) => (
        <article className={`evidence-status-card evidence-status-card-${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </div>
  );
}
