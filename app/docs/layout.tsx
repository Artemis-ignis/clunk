import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { DocsSidebar } from "./DocsSidebar";
import "./docs-v5.css";

/**
 * /docs shell — one GitBook manual, one sidebar (2026-08-31 master directive:
 * "깃북으로 해서 페이지별로 나눠서 만들지").
 *
 * Every docs route renders inside this layout, so the sticky table of contents
 * and the cv5 chrome are declared exactly once. The page is dark-committed like
 * every other cv5 surface: .cv5 supplies the token ramp, <ForceDarkTheme/> makes
 * the legacy data-theme variables agree with it, and .cv5-stars paints the same
 * ambient indigo/violet ground as the landing and the marketplace.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="docs">
        <main className="dv5-page">
          <div className="cv5-frame dv5-layout">
            <DocsSidebar />
            {children}
          </div>
        </main>
      </SiteShell>
    </div>
  );
}
