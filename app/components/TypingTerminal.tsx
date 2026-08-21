"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * A terminal that types its command character by character, then prints the recorded output.
 * `output` must be a real captured run — the component adds pacing and a cursor, nothing else.
 */
export function TypingTerminal({
  title,
  command,
  output,
  caption,
}: {
  title: string;
  command: string;
  output: string[];
  caption?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.35 });
  const [chars, setChars] = useState(0);
  const [rows, setRows] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const typingDone = chars >= command.length;
  const allDone = typingDone && rows >= output.length;

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let t: number;
    if (reduced) {
      t = window.setTimeout(() => {
        setChars(command.length);
        setRows(output.length);
      }, 0);
      return () => window.clearTimeout(t);
    }
    let c = 0;
    let r = 0;
    const typeChar = () => {
      if (cancelled) return;
      c += 1;
      setChars(c);
      if (c < command.length) {
        t = window.setTimeout(typeChar, 14 + Math.random() * 26);
      } else {
        t = window.setTimeout(printRow, 420);
      }
    };
    const printRow = () => {
      if (cancelled) return;
      r += 1;
      setRows(r);
      if (r < output.length) t = window.setTimeout(printRow, output[r] === "" ? 140 : 52);
    };
    t = window.setTimeout(typeChar, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [inView, reduced, command, output]);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chars, rows]);

  return (
    <div className="cli3 codeblock" ref={ref}>
      <div className="mcp3-terminal-head">
        <span className="mcp3-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mono-label">{title}</span>
      </div>
      <div className="mcp3-terminal-body cli3-body" ref={bodyRef}>
        <span className="mcp3-line cli3-cmd">
          <span className="tok-prompt">$ </span>
          {command.slice(0, chars)}
          {!typingDone && inView ? <span className="mcp3-cursor" aria-hidden="true" /> : null}
        </span>
        {output.slice(0, rows).map((line, i) => (
          <span key={i} className="mcp3-line tok-output">
            {line || " "}
          </span>
        ))}
        {typingDone && !allDone ? <span className="mcp3-cursor" aria-hidden="true" /> : null}
      </div>
      {caption ? <div className="codeblock-caption">{caption}</div> : null}
    </div>
  );
}
