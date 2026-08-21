"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import "../workspace.css";

/**
 * Ported from custom-globe-component/components/creative.tsx.
 * Same app shell anatomy: a fixed left rail with grouped navigation and a plan block pinned to
 * the bottom, a sticky top toolbar with a rail toggle and account cluster, and a mobile drawer
 * with a scrim. The template's non functional search input is dropped rather than shipped as a
 * dead affordance, and the animated radial gradient behind the shell is reproduced in CSS.
 */

export type WorkspaceSection = "overview" | "inspector" | "passports" | "pricing" | "docs" | "settings";

const PRIMARY_NAV: { section: WorkspaceSection; label: string; href: string; icon: IconName }[] = [
  { section: "overview", label: "개요", href: "/dashboard", icon: "layout" },
  { section: "inspector", label: "검사기", href: "/app", icon: "scan" },
  { section: "passports", label: "Passport", href: "/passport", icon: "badge" },
];

const SECONDARY_NAV: { section: WorkspaceSection; label: string; href: string; icon: IconName }[] = [
  { section: "pricing", label: "크레딧과 플랜", href: "/pricing", icon: "credit" },
  { section: "docs", label: "규칙과 문서", href: "/docs", icon: "book" },
];

export function WorkspaceShell({
  active,
  title,
  userLabel,
  status,
  children,
}: {
  active: WorkspaceSection;
  title: string;
  userLabel: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [railOpen, setRailOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Rendered twice (fixed rail + mobile drawer), so the gradient ids must differ per copy —
  // duplicate SVG ids make the second mark render as broken shards.
  const rail = (idSuffix: string) => (
    <div className="rail-body">
      <Link className="rail-brand" href="/">
        <span className="brand-mark">
          <BrandMark size={30} gradientId={`clunk-rail-${idSuffix}`} />
        </span>
        <span>
          <strong>Clunk</strong>
          <small>Asset Workspace</small>
        </span>
      </Link>

      <nav className="rail-nav" aria-label="워크스페이스 메뉴">
        <span className="rail-group">워크스페이스</span>
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-link${active === item.section ? " rail-link-active" : ""}`}
            aria-current={active === item.section ? "page" : undefined}
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        ))}
        <span className="rail-group rail-group-spaced">제품</span>
        {SECONDARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-link${active === item.section ? " rail-link-active" : ""}`}
            aria-current={active === item.section ? "page" : undefined}
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="rail-foot">
        <Link
          href="/settings"
          className={`rail-link${active === "settings" ? " rail-link-active" : ""}`}
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => setDrawerOpen(false)}
        >
          <Icon name="settings" size={16} />
          설정
        </Link>
        <div className="rail-plan">
          <span className="mono-label">얼리 액세스</span>
          <strong>크레딧으로 실행</strong>
          <small>검사 1회 = 크레딧 1개 · 지금은 요금이 청구되지 않습니다</small>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`workspace${railOpen ? " workspace-rail-open" : ""}`}>
      <div className="workspace-aurora" aria-hidden="true" />

      <aside className="workspace-rail" aria-label="워크스페이스 사이드바">
        {rail("side")}
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className="workspace-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <div className="workspace-drawer" data-open={drawerOpen ? "true" : "false"}>
        <div className="workspace-drawer-head">
          <span className="mono-label">메뉴</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setDrawerOpen(false)}
            aria-label="메뉴 닫기"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {rail("drawer")}
      </div>

      <div className="workspace-column">
        <header className="workspace-toolbar">
          <button
            type="button"
            className="icon-button workspace-drawer-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
          >
            <Icon name="menu" size={18} />
          </button>
          <button
            type="button"
            className="icon-button workspace-rail-toggle"
            onClick={() => setRailOpen((value) => !value)}
            aria-label={railOpen ? "사이드바 접기" : "사이드바 펼치기"}
          >
            <Icon name="layout" size={18} />
          </button>
          <h1 className="workspace-title">{title}</h1>
          <div className="workspace-toolbar-end">
            {status}
            <ThemeToggle />
            <span className="workspace-avatar" title={userLabel}>
              {userLabel.slice(0, 1).toUpperCase()}
              <span className="sr-only">{userLabel}</span>
            </span>
          </div>
        </header>
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
