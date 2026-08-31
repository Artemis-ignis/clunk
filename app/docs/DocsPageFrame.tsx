import type { ReactNode } from "react";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { docsRoute, docsSiblings, type DocsRouteId } from "./docs-nav";

/**
 * Shared frame for every docs topic page: breadcrumb → heading → body →
 * prev/next pager. Keeping it in one component is what makes the split pages
 * read like one manual instead of eight unrelated pages.
 *
 * data-docs-page is also the sidebar's server-rendered active state: docs-v5.css
 * matches it with :has() so the highlighted row is correct before any JS runs.
 */
export function DocsPageFrame({
  id,
  lede,
  children,
}: {
  id: DocsRouteId;
  /** Overrides the plain-text summary when the lede contains links. */
  lede?: ReactNode;
  children: ReactNode;
}) {
  const route = docsRoute(id);
  const { prev, next } = docsSiblings(id);

  return (
    <article className="dv5-content" data-docs-page={id}>
      <nav className="dv5-crumb" aria-label="현재 위치">
        <Link href="/docs">문서</Link>
        <span aria-hidden="true">/</span>
        <span>{route.label}</span>
      </nav>

      <header className="dv5-page-head">
        <span className="dv5-kicker">
          {route.order ? <b>{route.order}</b> : null}
          {route.eyebrow}
        </span>
        <h1>{route.title}</h1>
        <p className="dv5-lede">{lede ?? route.summary}</p>
      </header>

      {children}

      <nav className="dv5-pager" aria-label="이전·다음 문서">
        {prev ? (
          <Link className="dv5-pager-link" href={prev.href} rel="prev">
            <span>
              <Icon name="arrowLeft" size={13} /> 이전
            </span>
            <strong>{prev.label}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="dv5-pager-link dv5-pager-next" href={next.href} rel="next">
            <span>
              다음 <Icon name="arrowRight" size={13} />
            </span>
            <strong>{next.label}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
