import type { ReactNode } from "react";
import { EvidenceStatusGrid, type EvidenceStatusItem } from "./EvidenceStatusGrid";
import { NextAction } from "./NextAction";

export function EvidenceRunCard({
  eyebrow,
  title,
  artifact,
  detail,
  visual,
  statuses,
  nextAction,
}: {
  eyebrow: string;
  title: string;
  artifact: string;
  detail: string;
  visual: ReactNode;
  statuses: readonly EvidenceStatusItem[];
  nextAction: { title: string; detail: string; href: string; label: string };
}) {
  return (
    <article className="evidence-run-card">
      <div className="evidence-run-card-visual">{visual}</div>
      <div className="evidence-run-card-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <div className="evidence-run-card-artifact"><span>ARTIFACT</span><strong>{artifact}</strong></div>
        <p>{detail}</p>
        <EvidenceStatusGrid items={statuses} ariaLabel="검사 상태" />
        <NextAction {...nextAction} />
      </div>
    </article>
  );
}
