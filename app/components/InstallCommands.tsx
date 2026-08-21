"use client";

import { useState } from "react";

/**
 * polyfork's "Connect to MCP" moment, Clunk-flavoured: one tab per agent tool with a
 * copy-ready snippet, plus the universal path — a single prompt you paste to ANY agent
 * (Grok, Antigravity, whatever speaks MCP) and it installs and readies Clunk itself.
 * Every snippet is real and tested against the public repo.
 */

const REPO = "https://github.com/Artemis-ignis/clunk";
const CLONE = `git clone ${REPO}.git\ncd clunk && npm install`;

const TABS: { id: string; label: string; note: string; snippet: string }[] = [
  {
    id: "agent",
    label: "에이전트에게 한 줄",
    note: "Claude Code·Codex·Cursor·그 외 무엇이든 — 이 프롬프트를 붙여넣으면 에이전트가 알아서 설치하고 준비 확인까지 합니다.",
    snippet: `${REPO} 를 클론하고 npm install 한 뒤, 그 폴더의 stdio MCP 서버(npm run mcp)를 "clunk"라는 이름으로 등록해줘. 등록되면 clunk_engine_profiles를 호출해 준비 상태를 확인하고, 내 게임 엔진에 맞는 프리셋으로 에셋 검사를 시작해.`,
  },
  {
    id: "claude",
    label: "Claude Code",
    note: "클론한 clunk 폴더 안에서 실행하세요.",
    snippet: `${CLONE}\nclaude mcp add clunk -- npm run mcp`,
  },
  {
    id: "codex",
    label: "Codex",
    note: "~/.codex/config.toml 에 추가하세요 (cwd는 클론 경로).",
    snippet: `${CLONE}\n\n# ~/.codex/config.toml\n[mcp_servers.clunk]\ncommand = "npm"\nargs = ["run", "mcp"]\ncwd = "<클론한 clunk 폴더 경로>"`,
  },
  {
    id: "cursor",
    label: "Cursor",
    note: "프로젝트의 .cursor/mcp.json 에 추가하세요.",
    snippet: `${CLONE}\n\n// .cursor/mcp.json\n{\n  "mcpServers": {\n    "clunk": { "command": "npm", "args": ["run", "mcp"], "cwd": "<클론한 clunk 폴더 경로>" }\n  }\n}`,
  },
];

export function InstallCommands() {
  const [active, setActive] = useState("agent");
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
          에이전트에 Clunk MCP를 붙이는 데 필요한 전부입니다 — 설치가 끝나면 에이전트가
          알아서 엔진을 묻고, 판정하고, 고칩니다. 소스는{" "}
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
