"use client";

/**
 * Ported from the orbital centrepiece in custom-globe-component/components/creative.tsx
 * (the slowly rotating stack of nested `rounded-full` layers in the welcome panel).
 *
 * The template rotates empty decoration. Here each orbiting node carries a real workspace
 * number loaded from /api, the core carries the stored run count, and the whole field stops
 * moving under `prefers-reduced-motion` because the CSS animation is gated in globals.css.
 */

type Node = {
  key: string;
  value: number | null;
  label: string;
  tone: "accent" | "success" | "warning" | "muted";
};

/** radius in px, orbit duration, and starting offset for each node */
const ORBITS = [
  { radius: 84, duration: 44, delay: 0 },
  { radius: 128, duration: 62, delay: -18 },
  { radius: 84, duration: 44, delay: -22 },
  { radius: 128, duration: 62, delay: -47 },
] as const;

export function OrbitalField({
  runCount,
  readyCount,
  passportCount,
  findingCount,
  credits,
}: {
  runCount: number;
  readyCount: number;
  passportCount: number;
  findingCount: number;
  credits: number | null;
}) {
  const nodes: Node[] = [
    { key: "ready", value: readyCount, label: "준비 완료", tone: "success" },
    { key: "passport", value: passportCount, label: "Passport", tone: "accent" },
    { key: "finding", value: findingCount, label: "finding", tone: "warning" },
    { key: "credit", value: credits, label: "크레딧", tone: "muted" },
  ];

  const summary = `저장된 검사 ${runCount}건, 준비 완료 ${readyCount}건, Passport ${passportCount}건, finding ${findingCount}건`;

  return (
    <div className="orbital" role="img" aria-label={summary}>
      <div className="orbital-grid" aria-hidden="true" />
      <div className="orbital-ring orbital-ring-1" aria-hidden="true" />
      <div className="orbital-ring orbital-ring-2" aria-hidden="true" />
      <div className="orbital-ring orbital-ring-3" aria-hidden="true" />

      <div className="orbital-core" aria-hidden="true">
        <strong>{runCount}</strong>
        <span>저장된 검사</span>
      </div>

      {nodes.map((node, index) => {
        const orbit = ORBITS[index];
        const vars = {
          "--orbit-r": `${orbit.radius}px`,
          "--orbit-dur": `${orbit.duration}s`,
          "--orbit-delay": `${orbit.delay}s`,
        } as React.CSSProperties;
        return (
          <div key={node.key} className="orbital-track" aria-hidden="true" style={vars}>
            <span className={`orbital-node orbital-node-${node.tone}`}>
              <strong>{node.value === null ? "-" : node.value}</strong>
              <small>{node.label}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
