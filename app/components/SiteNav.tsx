"use client";

import { useEffect, useRef, useState } from "react";
import Link from "./NativeLink";
import { BrandLockup } from "./BrandMark";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Public navigation for the Clunk product shell. The primary row follows the
 * buyer/user split: browse the master's assets, use Clunk with credits, then
 * inspect the handoff. Workspace and documentation remain utility destinations.
 */

export type ShellSection = "home" | "series" | "studio" | "app" | "dashboard" | "pricing" | "docs" | "agents" | "marketplace" | "review";

const NAV_LINKS: { label: string; href: string; section: ShellSection }[] = [
  { label: "에셋 제작", href: "/studio", section: "studio" },
  { label: "에셋 마켓", href: "/marketplace", section: "marketplace" },
  { label: "에셋 검사", href: "/app", section: "app" },
  { label: "제작 에이전트", href: "/agents", section: "agents" },
  { label: "요금", href: "/pricing", section: "pricing" },
];

const UTILITY_NAV_LINKS: { label: string; href: string; section: ShellSection }[] = [
  // /review had zero inbound links until 2026-08-31 — the direct-review viewer
  // the master asked for was reachable only by typing the URL.
  { label: "검수 뷰어", href: "/review", section: "review" },
  // Docs live on GitBook since 2026-09-01; /docs redirects there too.
  { label: "문서", href: "https://clunk.gitbook.io/docs", section: "docs" },
  { label: "내 작업공간", href: "/dashboard", section: "dashboard" },
];

export function SiteNav({ active }: { active?: ShellSection }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollSentinelRef = useRef<HTMLSpanElement>(null);
  // Signed-in visitors used to still see 로그인/회원가입 on every public page
  // (2026-08-31 review). The nav asks the same /api/me the workspace uses and
  // stays anonymous when it answers 401 — never guessing a session.
  const [session, setSession] = useState<{ displayName: string } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { authenticated?: boolean; displayName?: string };
        const displayName = body.displayName?.trim();
        if (active && body.authenticated && displayName) setSession({ displayName });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={scrollSentinelRef} className="sitenav-scroll-sentinel" aria-hidden="true" />
      <div className="sitenav-dock" data-scrolled={scrolled ? "true" : "false"}>
      <div className="sitenav-inner">
        <nav className={`sitenav${scrolled ? " sitenav-scrolled" : ""}`} aria-label="주요 메뉴">
          <Link className="brand" href="/" prefetch={false} aria-label="Clunk 홈">
            <BrandLockup gradientId="clunk-nav" />
          </Link>

          <ul className="sitenav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  className={`sitenav-link${active === link.section ? " sitenav-link-active" : ""}`}
                  href={link.href}
                  prefetch={false}
                  aria-current={active === link.section ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="sitenav-utility" aria-label="보조 메뉴">
            {UTILITY_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                className={`sitenav-utility-link${active === link.section ? " sitenav-utility-link-active" : ""}`}
                href={link.href}
                prefetch={false}
                aria-current={active === link.section ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="sitenav-actions">
            <ThemeToggle />
            {session ? (
              <Link className="button button-quiet button-sm sitenav-login" href="/dashboard" prefetch={false}>
                {session.displayName}
              </Link>
            ) : (
              <>
                <Link className="button button-quiet button-sm sitenav-login" href="/login" prefetch={false}>
                  로그인
                </Link>
                <Link className="button button-quiet button-sm sitenav-signup" href="/signup" prefetch={false}>
                  회원가입
                </Link>
              </>
            )}
            <Link className="button button-primary button-sm sitenav-cta" href={session ? "/app" : "/studio"} prefetch={false}>
              {session ? "작업면 열기" : "Clunk 사용하기"}
              <Icon name="arrowUpRight" size={14} />
            </Link>
            <button
              type="button"
              className="sitenav-burger"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="sitenav-drawer"
              aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            >
              <Icon name={open ? "close" : "menu"} size={18} />
            </button>
          </div>
        </nav>

        <div
          id="sitenav-drawer"
          className="sitenav-drawer"
          data-open={open ? "true" : "false"}
          inert={!open}
        >
          <div className="sitenav-drawer-card">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className="sitenav-drawer-link"
                onClick={() => setOpen(false)}
              >
                {link.label}
                <Icon name="arrowRight" size={15} />
              </Link>
            ))}
            <div className="sitenav-drawer-utility" aria-label="보조 메뉴">
              {UTILITY_NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} prefetch={false} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="sitenav-drawer-actions">
              {session ? (
                <Link className="button button-quiet button-sm" href="/dashboard" prefetch={false} onClick={() => setOpen(false)}>
                  {session.displayName}
                </Link>
              ) : (
                <>
                  <Link className="button button-quiet button-sm" href="/login" prefetch={false} onClick={() => setOpen(false)}>
                    로그인
                  </Link>
                  <Link className="button button-quiet button-sm" href="/signup" prefetch={false} onClick={() => setOpen(false)}>
                    회원가입
                  </Link>
                </>
              )}
              <Link className="button button-primary button-sm" href={session ? "/app" : "/studio"} prefetch={false} onClick={() => setOpen(false)}>
                {session ? "작업면 열기" : "Clunk 사용하기"}
                <Icon name="arrowUpRight" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
