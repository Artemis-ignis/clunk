"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Adapted from agentic-build-and-orchestrate-ai-agents-while-you-sleep/components/live-agent-feed.tsx.
 * The template streams invented user activity into a table. That would be fake data here, so the
 * same feed mechanic instead walks the five real stages of the Clunk pipeline and names the
 * artifact each stage produces. It is labelled as a walkthrough, not as live traffic.
 */

const STAGES = [
  {
    id: "01",
    name: "입력",
    detail: "GLB 또는 GLTF 바이트를 읽습니다",
    artifact: "inputHash",
  },
  {
    id: "02",
    name: "파싱과 정책",
    detail: "메트릭을 계산하고 규칙 세트와 대조합니다",
    artifact: "findings[]",
  },
  {
    id: "03",
    name: "최적화",
    detail: "허용 목록 작업만 적용해 새 파일을 씁니다",
    artifact: "operations[]",
  },
  {
    id: "04",
    name: "재검사",
    detail: "결과물을 처음부터 다시 검사합니다",
    artifact: "resultDigest",
  },
  {
    id: "05",
    name: "Passport",
    detail: "두 해시와 두 digest를 하나로 묶습니다",
    artifact: "passportId",
  },
] as const;

const STEP_MS = 1800;

export function PipelineFlow() {
  const reduced = usePrefersReducedMotion();
  const [cursor, setCursor] = useState(0);
  const active = reduced ? STAGES.length - 1 : cursor;

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setCursor((current) => (current + 1) % STAGES.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <div className="flow-panel">
      <div className="flow-head">
        <span className="mono-label">파이프라인 흐름 시연</span>
        <span className="mono-label flow-head-note">실행 기록 아님</span>
      </div>
      <ol className="flow-rows">
        {STAGES.map((stage, index) => {
          const state = index < active ? "done" : index === active ? "active" : "idle";
          return (
            <li key={stage.id} className={`flow-row flow-row-${state}`}>
              <span className="flow-index">{stage.id}</span>
              <span className="flow-copy">
                <strong>{stage.name}</strong>
                <small>{stage.detail}</small>
              </span>
              <code className="flow-artifact">{stage.artifact}</code>
              <span className="flow-track">
                <span
                  className="flow-fill"
                  style={{
                    width: state === "idle" ? "0%" : "100%",
                    transitionDuration: !reduced && state === "active" ? `${STEP_MS}ms` : "220ms",
                  }}
                />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flow-note">
        각 단계가 남기는 필드 이름은 실제 Core 계약과 같습니다. 값은 에셋을 실행할 때 채워집니다.
      </p>
    </div>
  );
}
