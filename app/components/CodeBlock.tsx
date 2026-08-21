import type { ReactNode } from "react";

/**
 * Server rendered code panel. The colour vocabulary follows
 * agentic-build-and-orchestrate-ai-agents-while-you-sleep/components/devex-section.tsx
 * (comment, keyword, string, output, success) remapped to the dark palette.
 *
 * Highlighting is a deterministic pass over the source string, so there is no client side
 * highlighter to ship and nothing runs at hydration time.
 */

export function CodeBlock({
  title,
  language,
  code,
  caption,
}: {
  title: string;
  language: "json" | "bash";
  code: string;
  caption?: string;
}) {
  return (
    <figure className="codeblock">
      <figcaption className="codeblock-head">
        <span className="mono-label">{title}</span>
        <span className="mono-label codeblock-lang">{language}</span>
      </figcaption>
      <pre className="codeblock-body">
        <code>
          {code.split("\n").map((line, index) => (
            <span className="codeblock-line" key={index}>
              {language === "json" ? highlightJson(line) : highlightBash(line)}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
      {caption ? <p className="codeblock-caption">{caption}</p> : null}
    </figure>
  );
}

function highlightJson(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b|\b\d+\b)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <span key={key++} className={match[2] ? "tok-key" : "tok-string"}>
          {match[1]}
        </span>,
      );
      if (match[2]) nodes.push(match[2]);
    } else if (match[3] !== undefined) {
      nodes.push(
        <span key={key++} className="tok-number">
          {match[3]}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

function highlightBash(line: string): ReactNode[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) {
    return [
      <span key="c" className="tok-comment">
        {line}
      </span>,
    ];
  }
  if (trimmed.startsWith("$")) {
    const indent = line.slice(0, line.length - trimmed.length);
    return [
      indent,
      <span key="p" className="tok-prompt">
        {"$ "}
      </span>,
      <span key="cmd" className="tok-command">
        {trimmed.slice(1).trimStart()}
      </span>,
    ];
  }
  return [
    <span key="o" className="tok-output">
      {line}
    </span>,
  ];
}
