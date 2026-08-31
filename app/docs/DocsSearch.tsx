"use client";

import { useMemo, useState } from "react";
import { DOCS_ROUTES } from "./docs-nav";

/**
 * Sidebar search. It used to jump to anchors on the single docs page; now that
 * every section is its own route it filters the route table and links to the
 * page. Keywords live in docs-nav.ts next to the routes they describe.
 */
export function DocsSearch() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return DOCS_ROUTES.filter((item) =>
      `${item.label} ${item.title} ${item.keywords}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <div className="dv5-search">
      <label htmlFor="docs-search-input">문서 검색</label>
      <div className="dv5-search-field">
        <span aria-hidden="true">⌕</span>
        <input
          id="docs-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: Codex, texture, frame"
          autoComplete="off"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="문서 검색 지우기">
            ×
          </button>
        ) : null}
      </div>
      {query.trim() ? (
        <nav className="dv5-search-results" aria-label="문서 검색 결과">
          {results.length ? (
            results.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
                <span aria-hidden="true">→</span>
              </a>
            ))
          ) : (
            <p>일치하는 문서가 없습니다.</p>
          )}
        </nav>
      ) : null}
    </div>
  );
}
