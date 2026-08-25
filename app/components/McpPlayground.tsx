"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYGROUND_TOOLS, type PlaygroundTool, type TranscriptLine } from "./mcp-transcript";
import { useInView } from "./useInView";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Verified MCP replay: picking a tool replays the recorded stdio session for that
 * tool line by line, at terminal pace. The transcript data is a real capture
 * (see mcp-transcript.ts) — this component only controls pacing, never content.
 */

/** Pause inserted before a line is revealed, tuned per line kind. */
function delayBefore(line: TranscriptLine | undefined): number {
  switch (line?.kind) {
    case "sent":
      return 420;
    case "recv":
      return 560;
    case "note":
      return 300;
    case "ok":
      return 380;
    default:
      return 46;
  }
}

export function McpPlayground() {
  const [toolIdx, setToolIdx] = useState(0);
  const [sectionRef, inView] = useInView<HTMLDivElement>({ threshold: 0.35 });
  const tool = PLAYGROUND_TOOLS[toolIdx];

  return (
    <div className="mcp3" ref={sectionRef}>
      <div className="mcp3-tools" role="tablist" aria-label="MCP 도구 선택">
        {PLAYGROUND_TOOLS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === toolIdx}
            className={`mcp3-tool${i === toolIdx ? " mcp3-tool-active" : ""}`}
            onClick={() => setToolIdx(i)}
          >
            <code>{t.id}</code>
            <strong>{t.action}</strong>
            <span>{t.blurb}</span>
          </button>
        ))}
      </div>

      <TranscriptPane key={tool.id} tool={tool} armed={inView} />
    </div>
  );
}

function TranscriptPane({ tool, armed }: { tool: PlaygroundTool; armed: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [runId, setRunId] = useState(0);
  const lines = tool.lines;
  const done = count >= lines.length;

  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    let t: number;
    if (reduced) {
      t = window.setTimeout(() => setCount(lines.length), 0);
      return () => window.clearTimeout(t);
    }
    let i = 0;
    const step = () => {
      if (cancelled) return;
      i += 1;
      setCount(i);
      if (i >= lines.length) return;
      t = window.setTimeout(step, delayBefore(lines[i]));
    };
    t = window.setTimeout(step, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // runId restarts the replay without remounting the pane.
  }, [armed, reduced, lines, runId]);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count]);

  return (
    <div className="mcp3-terminal codeblock" aria-live="off">
      <div className="mcp3-terminal-head">
        <span className="mcp3-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mono-label">VERIFIED RUN · stdio capture · {tool.id}</span>
        <button
          type="button"
          className="mcp3-replay"
          onClick={() => {
            setCount(0);
            setRunId((v) => v + 1);
          }}
        >
          다시 재생
        </button>
      </div>
      <div className="mcp3-terminal-body" ref={bodyRef}>
        {lines.slice(0, count).map((line, i) => (
          <span key={i} className={`mcp3-line mcp3-line-${line.kind}`}>
            {line.text || " "}
          </span>
        ))}
        {!done ? <span className="mcp3-cursor" aria-hidden="true" /> : null}
      </div>
      <div className={`mcp3-headline${done ? " mcp3-headline-on" : ""}`}>
        <span className="mono-label">{tool.headline.label}</span>
        <strong className="num">{tool.headline.value}</strong>
      </div>
      <div className="codeblock-caption">
        네 도구 모두 <code>integrations/mcp/server.ts</code>가 실제로 광고하는 이름입니다. 응답은
        번들 샘플을 검사해 기록한 실측값이며, 재생 속도만 연출입니다.
      </div>
    </div>
  );
}
