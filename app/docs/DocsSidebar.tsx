"use client";

import { useState, useSyncExternalStore } from "react";
import { DOCS_GROUPS, DOCS_ROUTES, docsRoute } from "./docs-nav";
import { DocsSearch } from "./DocsSearch";

/** Docs links are native anchors (full loads); popstate covers back/forward. */
function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readPathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/docs";
}

/**
 * Persistent GitBook sidebar, rendered once by app/docs/layout.tsx and shared
 * by every docs route (2026-08-31 master directive: page-per-topic + a sticky
 * table of contents, not one long scroll).
 *
 * Two things are client-side on purpose:
 *  - the mobile disclosure (the rail collapses under a 목차 button below 1000px)
 *  - aria-current, resolved from the real pathname after hydration
 * The *visual* active state does not wait for hydration: docs-v5.css matches
 * the page's data-docs-page attribute with :has(), so a server-rendered load
 * already highlights the right row.
 */
export function DocsSidebar() {
  const [open, setOpen] = useState(false);
  // null on the server, the real path once hydrated — no hydration mismatch,
  // and the visual highlight is already correct from CSS before this resolves.
  const pathname = useSyncExternalStore(subscribeToLocation, readPathname, () => null);

  return (
    <aside className="dv5-sidebar" aria-label="문서 목차">
      <div className="dv5-sidebar-head">
        <span className="dv5-kicker">DOCUMENTATION</span>
        <strong>문서 목차</strong>
      </div>

      <button
        type="button"
        className="dv5-sidebar-toggle"
        aria-expanded={open}
        aria-controls="dv5-sidebar-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {open ? "목차 접기" : "목차 펼치기"} · {DOCS_ROUTES.length}개 문서
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      <div className="dv5-sidebar-body" id="dv5-sidebar-body" data-open={open ? "true" : "false"}>
        <DocsSearch />
        <nav className="dv5-nav" aria-label="문서 섹션">
          {DOCS_GROUPS.map((group) => (
            <div className="dv5-nav-group" key={group.label}>
              <span className="dv5-nav-group-label">{group.label}</span>
              {group.items.map((id) => {
                const route = docsRoute(id);
                const current = pathname === route.href;
                return (
                  <a
                    key={route.id}
                    href={route.href}
                    data-docs-nav={route.id}
                    aria-current={current ? "page" : undefined}
                    className={current ? "is-current" : undefined}
                  >
                    <span className="dv5-nav-num">{route.order ?? "—"}</span>
                    {route.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="dv5-sidebar-note">
          <strong>실제 증거를 기준으로 합니다</strong>
          <p>fixture PASS와 shipped frame PASS는 같은 뜻이 아닙니다.</p>
        </div>
      </div>
    </aside>
  );
}
