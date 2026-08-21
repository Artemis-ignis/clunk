"use client";

import { useState } from "react";

/**
 * polyfork's "Connect to MCP" moment, Clunk-flavoured: one tab per agent tool with a
 * copy-ready snippet, plus the universal path — a single prompt you paste to ANY agent
 * (Grok, Antigravity, whatever speaks MCP) and it installs and readies Clunk itself.
 * Every snippet is real and tested against the public repo.
 */

const REPO = "https://github.com/Artemis-ignis/clunk";
const PKG = "github:Artemis-ignis/clunk-mcp";

/**
 * One line, every tool, every platform.
 *
 * The server is a single dependency-free file published as its own package, so npx fetches
 * and runs it without a clone, an install, or a cwd. The file path variant is kept for people
 * who would rather pin a copy than resolve it each time.
 */
const TABS: { id: string; label: string; note: string; snippet: string }[] = [
  {
    id: "claude",
    label: "Claude Code",
    note: "이 한 줄이면 끝입니다.",
    snippet: `claude mcp add clunk -- npx -y ${PKG}`,
  },
  {
    id: "codex",
    label: "Codex",
    note: "~/.codex/config.toml 에 넣으세요.",
    snippet: `[mcp_servers.clunk]
command = "npx"
args = ["-y", "${PKG}"]`,
  },
  {
    id: "cursor",
    label: "Cursor",
    note: "프로젝트의 .cursor/mcp.json 에 넣으세요.",
    snippet: `{
  "mcpServers": {
    "clunk": { "command": "npx", "args": ["-y", "${PKG}"] }
  }
}`,
  },
  {
    id: "agent",
    label: "그 외 아무 에이전트",
    note: "MCP를 지원하는 도구라면 이 문장을 붙여넣으세요.",
    snippet: `stdio MCP 서버 "clunk"를 등록해줘 — command: npx, args: ["-y", "${PKG}"]. 등록되면 clunk_engine_profiles를 호출해 준비 상태를 확인하고, 내 게임 엔진에 맞는 프리셋으로 에셋 검사를 시작해.`,
  },
];

export function InstallCommands() {
  const [active, setActive] = useState("claude");
  const [copied, setCopied] = useState(false);
  const tab = TABS.find((entry) => entry.id === active) ?? TABS[0];

  const copy = () => {
    void navigator.clipboard?.writeText(tab.snippet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="inst3">
      <div className="inst3-head">
        <span className="eyebrow">지금 연결하기</span>
        <p className="inst3-lead">
          클론도, 설치도, 경로 설정도 없습니다. 붙고 나면 에이전트가 알아서 엔진을 묻고
          판정합니다. 소스는{" "}
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          에 공개돼 있습니다.
        </p>
      </div>
      <div className="inst3-tabs" role="tablist" aria-label="설치 방법 선택">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active === entry.id}
            className={`inst3-tab${active === entry.id ? " inst3-tab-active" : ""}`}
            onClick={() => setActive(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="inst3-panel">
        <div className="inst3-panel-head">
          <span className="muted-note">{tab.note}</span>
          <button type="button" className="inst3-copy" onClick={copy}>
            {copied ? "복사됨 ✓" : "복사"}
          </button>
        </div>
        <pre className="inst3-code">{tab.snippet}</pre>
      </div>
    </div>
  );
}
