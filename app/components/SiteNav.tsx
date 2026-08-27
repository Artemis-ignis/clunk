"use client";

import { useEffect, useState } from "react";
import Link from "./NativeLink";
import { BrandLockup } from "./BrandMark";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Public navigation for the Foundry product shell. The primary row follows the
 * Asset → Create → Game Ready → Discover path; workspace and documentation
 * remain utility destinations rather than competing with the creation CTA.
 */

export type ShellSection = "home" | "studio" | "app" | "dashboard" | "pricing" | "docs" | "agents" | "marketplace";

const NAV_LINKS: { label: string; href: string; section: ShellSection }[] = [
  { label: "Discover", href: "/marketplace", section: "marketplace" },
  { label: "Create", href: "/studio", section: "studio" },
  { label: "Game Ready", href: "/app", section: "app" },
  { label: "Developers", href: "/connect", section: "agents" },
  { label: "Pricing", href: "/pricing", section: "pricing" },
];

const UTILITY_NAV_LINKS: { label: string; href: string; section: ShellSection }[] = [
  { label: "Docs", href: "/docs", section: "docs" },
  { label: "Workspace", href: "/dashboard", section: "dashboard" },
];

export function SiteNav({ active }: { active?: ShellSection }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
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
            <Link className="button button-quiet button-sm sitenav-login" href="/login" prefetch={false}>
              로그인
            </Link>
            <Link className="button button-quiet button-sm sitenav-signup" href="/signup" prefetch={false}>
              회원가입
            </Link>
            <Link className="button button-primary button-sm sitenav-cta" href="/studio" prefetch={false}>
              Create asset
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
              <Link className="button button-quiet button-sm" href="/login" prefetch={false} onClick={() => setOpen(false)}>
                로그인
              </Link>
              <Link className="button button-quiet button-sm" href="/signup" prefetch={false} onClick={() => setOpen(false)}>
                회원가입
              </Link>
              <Link className="button button-primary button-sm" href="/studio" prefetch={false} onClick={() => setOpen(false)}>
                Create asset
                <Icon name="arrowUpRight" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
