"use client";

import { useEffect, useState } from "react";
import { CLI_SAMPLE, RULE_SET } from "./product-facts";
import { TypingTerminal } from "./TypingTerminal";
import { useInView } from "./useInView";

/**
 * "같은 Core, 네 개의 표면"을 말이 아니라 화면으로 증명하는 쇼케이스.
 * 네 탭 전부 CLI_SAMPLE의 실측 실행 한 건(같은 파일, 같은 해시, 같은 점수)을
 * 각 표면의 실제 생김새로 보여준다. 값은 재계산하지 않고 그대로 인용한다.
 */

type SurfaceId = "web" | "cli" | "mcp" | "vscode";

const SURFACE_TABS: { id: SurfaceId; label: string; sub: string }[] = [
  { id: "web", label: "웹 검사기", sub: "app/app" },
  { id: "cli", label: "CLI", sub: "scripts/clunk-cli.ts" },
  { id: "mcp", label: "MCP 서버", sub: "integrations/mcp" },
  { id: "vscode", label: "VS Code 확장", sub: "integrations/vscode" },
];

const HASH_SHORT = `${CLI_SAMPLE.inputHash.slice(0, 8)}…${CLI_SAMPLE.inputHash.slice(-6)}`;

const CLI_OUTPUT = [
  "",
  `  ruleSetId      ${RULE_SET.id} v${RULE_SET.version}`,
  `  profileId      ${CLI_SAMPLE.profileId}`,
  `  byteLength     ${CLI_SAMPLE.byteLength}`,
  `  inputHash      ${CLI_SAMPLE.inputHash.slice(0, 32)}…`,
  `  resultDigest   ${CLI_SAMPLE.resultDigest.slice(0, 32)}…`,
  `  score          ${CLI_SAMPLE.score}/100  (hard blocker ${CLI_SAMPLE.hardBlockerCount})`,
  "",
  ...CLI_SAMPLE.findings.map((finding) => `  ${finding.severity.padEnd(8)} ${finding.ruleId}`),
];

const MCP_LINES: { kind: "sent" | "recv" | "json"; text: string }[] = [
  { kind: "sent", text: '→ tools/call  "clunk_inspect"' },
  { kind: "json", text: `  { "path": "public/samples/${CLI_SAMPLE.file}", "profile": "${CLI_SAMPLE.profileId}" }` },
  { kind: "recv", text: "← result" },
  { kind: "json", text: "  {" },
  { kind: "json", text: `    "inputHash": "${CLI_SAMPLE.inputHash.slice(0, 32)}…",` },
  { kind: "json", text: `    "resultDigest": "${CLI_SAMPLE.resultDigest.slice(0, 32)}…",` },
  { kind: "json", text: `    "report": { "byteLength": ${CLI_SAMPLE.byteLength},` },
  { kind: "json", text: `                "score": { "score": ${CLI_SAMPLE.score}, "threshold": ${RULE_SET.readyScoreThreshold}, "hardBlockerCount": ${CLI_SAMPLE.hardBlockerCount} },` },
  { kind: "json", text: `                "findings": [${CLI_SAMPLE.findings.length}건 — CLI와 동일] }` },
  { kind: "json", text: "  }" },
];

export function SurfaceShowcase() {
  const [active, setActive] = useState<SurfaceId>("web");
  const [pinned, setPinned] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.35 });

  // Auto-rotate through the surfaces while nobody has clicked, so the section demos itself.
  useEffect(() => {
    if (!inView || pinned) return;
    const order: SurfaceId[] = ["web", "cli", "mcp", "vscode"];
    const timer = window.setInterval(() => {
      setActive((current) => order[(order.indexOf(current) + 1) % order.length]);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [inView, pinned]);

  const pick = (id: SurfaceId) => {
    setActive(id);
    setPinned(true);
  };

  return (
    <div className="sur3" ref={ref}>
      <div className="sur3-tabs" role="tablist" aria-label="작업 표면 선택">
        {SURFACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`sur3-tab${active === tab.id ? " sur3-tab-active" : ""}`}
            onClick={() => pick(tab.id)}
          >
            <strong>{tab.label}</strong>
            <code>{tab.sub}</code>
          </button>
        ))}
      </div>

      <div className="sur3-stage">
        {active === "web" ? <WebSurface /> : null}
        {active === "cli" ? (
          <TypingTerminal
            title="clunk-cli · 실측 출력"
            command={CLI_SAMPLE.command}
            output={CLI_OUTPUT}
          />
        ) : null}
        {active === "mcp" ? <McpSurface /> : null}
        {active === "vscode" ? <VscodeSurface /> : null}
      </div>

      <p className="sur3-proof num">
        네 표면 모두 같은 실행: {CLI_SAMPLE.file} · sha256 {HASH_SHORT} · score {CLI_SAMPLE.score}/100
      </p>
    </div>
  );
}

function WebSurface() {
  return (
    <div className="sur3-panel sur3-web">
      <div className="sur3-web-head">
        <span className="file-chip">GLB</span>
        <div className="sur3-web-file">
          <strong>{CLI_SAMPLE.file}</strong>
          <small className="num">
            {CLI_SAMPLE.byteLength.toLocaleString()} B · sha256 {HASH_SHORT}
          </small>
        </div>
        <span className="status-pill status-conditional">
          <span className="status-dot" />
          조건부 준비
        </span>
      </div>
      <div className="sur3-web-body">
        <div className="sur3-web-score">
          <span className="mono-label">Static Policy Score</span>
          <strong className="num">
            {CLI_SAMPLE.score}
            <small>/100</small>
          </strong>
          <span className="sur3-web-track" aria-hidden="true">
            <span style={{ width: `${CLI_SAMPLE.score}%` }} />
          </span>
          <small className="muted-note">threshold {RULE_SET.readyScoreThreshold} · 하드 블로커 {CLI_SAMPLE.hardBlockerCount} · visualRuntime NOT_EVALUATED</small>
        </div>
        <ul className="sur3-web-findings" aria-label="정책 finding">
          {CLI_SAMPLE.findings.map((finding) => (
            <li key={finding.ruleId} className={`sur3-finding sur3-finding-${finding.severity.toLowerCase()}`}>
              <span>{finding.severity}</span>
              <code>{finding.ruleId}</code>
            </li>
          ))}
        </ul>
      </div>
      <div className="codeblock-caption">워크스페이스 검사기가 그리는 결과 카드 그대로 — 점수·해시는 CLI 출력과 동일합니다.</div>
    </div>
  );
}

function McpSurface() {
  return (
    <div className="sur3-panel sur3-mcp">
      <div className="mcp3-terminal-head">
        <span className="mcp3-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mono-label">clunk mcp · stdio · clunk_inspect</span>
      </div>
      <div className="sur3-mcp-body">
        {MCP_LINES.map((line, index) => (
          <span
            key={index}
            className={`mcp3-line mcp3-line-${line.kind} sur3-mcp-line`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            {line.text}
          </span>
        ))}
      </div>
      <div className="codeblock-caption">에이전트가 받는 JSON-RPC 응답 — 위 두 표면과 같은 해시, 같은 점수입니다.</div>
    </div>
  );
}

function VscodeSurface() {
  return (
    <div className="sur3-panel sur3-vscode">
      <div className="sur3-vscode-title">
        <span className="mcp3-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{CLI_SAMPLE.file} — Visual Studio Code</span>
      </div>
      <div className="sur3-vscode-palette num">
        <span className="sur3-vscode-caret">&gt;</span> Clunk: Inspect Asset
      </div>
      <div className="sur3-vscode-body">
        <div className="sur3-vscode-toast">
          <strong>
            Clunk: {CLI_SAMPLE.file} — score {CLI_SAMPLE.score}/100
          </strong>
          <span className="num">
            finding {CLI_SAMPLE.findings.length}건 · inputHash {HASH_SHORT}
          </span>
          <div className="sur3-vscode-actions">
            <span>Optimize Safely</span>
            <span>Show Report</span>
          </div>
        </div>
      </div>
      <div className="codeblock-caption">
        명령 팔레트 두 개(clunk.inspect / clunk.optimize)를 등록하는 실제 확장의 알림 형태입니다.
      </div>
    </div>
  );
}
