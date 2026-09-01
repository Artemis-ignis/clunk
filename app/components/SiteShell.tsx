import { SiteNav, type ShellSection } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

export type { ShellSection };

export function SiteShell({
  active,
  children,
}: {
  active?: ShellSection;
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell">
      {/* Scroll snap is a landing-only device (2026-08-31 master review):
          mandatory document snap on content pages traps the scroll short of
          buttons. Content pages scroll naturally. */}
      <SiteNav active={active} />
      {children}
      {/* 2026-09-01: this shell used to render its own English-labelled footer
          with no operator disclosure, so half the site had a different footer
          from the other half. Every surface now shares one. */}
      <SiteFooter />
    </div>
  );
}
