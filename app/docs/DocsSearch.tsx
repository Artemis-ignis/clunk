"use client";

import { useMemo, useState } from "react";

const DOC_LINKS = [
  { label: "빠른 시작", href: "#quickstart", keywords: "mcp endpoint 연결 키" },
  { label: "클라이언트별 설정", href: "#clients", keywords: "claude code codex cursor copilot vscode" },
  { label: "CLI와 CI", href: "#cli", keywords: "inspect validate passport texture readability" },
  { label: "계약과 상태", href: "#contracts", keywords: "static visualRuntime playerFacing human review" },
  { label: "Harvest Frontier", href: "#harvest-frontier", keywords: "hf scene gap frame manifest" },
  { label: "지원 범위", href: "#scope", keywords: "godot unity unreal mobile" },
];

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return DOC_LINKS;
    return DOC_LINKS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <div className="docs-search">
      <label htmlFor="docs-search-input">문서 검색</label>
      <div className="docs-search-field">
        <span aria-hidden="true">⌕</span>
        <input
          id="docs-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: Codex, texture, frame"
          autoComplete="off"
        />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="문서 검색 지우기">×</button> : null}
      </div>
      <nav className="docs-search-results" aria-label="문서 검색 결과">
        {results.length ? results.map((item) => <a key={item.href} href={item.href}>{item.label}<span>→</span></a>) : <p>일치하는 섹션이 없습니다.</p>}
      </nav>
    </div>
  );
}
