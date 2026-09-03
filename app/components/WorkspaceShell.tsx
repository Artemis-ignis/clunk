"use client";

import { useState } from "react";
import Link from "./NativeLink";
import { BrandMark } from "./BrandMark";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { SnapRoot } from "./SnapRoot";
import { ForceDarkTheme } from "./ForceDarkTheme";
import "../workspace.css";
import "./workspace-v5.css";

/**
 * Ported from custom-globe-component/components/creative.tsx.
 * Same app shell anatomy: a fixed left rail with grouped navigation and a plan block pinned to
 * the bottom, a sticky top toolbar with a rail toggle and account cluster, and a mobile drawer
 * with a scrim. The template's non functional search input is dropped rather than shipped as a
 * dead affordance, and the animated radial gradient behind the shell is reproduced in CSS.
 */

export type WorkspaceSection = "overview" | "assets" | "studio" | "inspector" | "passports" | "kits" | "pricing" | "docs" | "settings";

/* 2026-09-02: "모음집"(/kits)은 해시 목록으로 파일을 묶는 내부 작업면이라, 처음
   들어온 사람에게는 눌러도 할 일이 없는 칸이었습니다. 사이드바에서 뺐습니다.
   경로와 `kits` 섹션 값은 그대로 살아 있어 /kits 를 직접 열면 여전히 동작합니다. */
const PRIMARY_NAV: { section: WorkspaceSection; label: string; href: string; icon: IconName }[] = [
  { section: "overview", label: "홈", href: "/dashboard", icon: "layout" },
  { section: "assets", label: "내 파일", href: "/assets", icon: "folder" },
  { section: "studio", label: "만들기", href: "/studio", icon: "boxes" },
  { section: "inspector", label: "검사", href: "/app", icon: "scan" },
  { section: "passports", label: "검사 증명서", href: "/passport", icon: "badge" },
];

const SECONDARY_NAV: { section: WorkspaceSection; label: string; href: string; icon: IconName }[] = [
  { section: "pricing", label: "크레딧·요금제", href: "/pricing", icon: "credit" },
  { section: "docs", label: "도움말", href: "/docs", icon: "book" },
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
      <Link className="rail-brand" href="/" prefetch={false}>
        <span className="brand-mark">
          <BrandMark size={30} gradientId={`clunk-rail-${idSuffix}`} />
        </span>
        <span>
          <strong>Clunk</strong>
          <small>내 작업공간</small>
        </span>
      </Link>

      <nav className="rail-nav" aria-label="작업공간 메뉴">
        <span className="rail-group">작업공간</span>
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
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
            prefetch={false}
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
          prefetch={false}
          className={`rail-link${active === "settings" ? " rail-link-active" : ""}`}
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => setDrawerOpen(false)}
        >
          <Icon name="settings" size={16} />
          설정
        </Link>
        <div className="rail-plan">
          <span className="mono-label">지금 요금</span>
          <strong>무료</strong>
          <small>결제 기능이 아직 없습니다</small>
        </div>
      </div>
    </div>
  );

  return (
    /* cv5 chrome (2026-08-31 unified-site pass): every authenticated workspace
       route — /dashboard /assets /studio /kits?view=workspace /app /passport
       /settings — renders through this shell, so opting the shell in is what
       moves all of them onto the cv5 navy ground in one place. `cv5-surface`
       swings the legacy globals/foundry token ramps; ForceDarkTheme pins
       data-theme=dark so those ramps never resolve to the light palette. */
    <div className={`workspace foundry-workspace-page cv5 cv5-surface workspace-cv5${railOpen ? " workspace-rail-open" : ""}`}>
      <ForceDarkTheme />
      <SnapRoot mode="workspace" />
      <div className="cv5-stars" aria-hidden="true" />
      <div className="workspace-aurora" aria-hidden="true" />

      <aside className="workspace-rail" aria-label="작업공간 사이드바">
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
          <Link className="workspace-quick-action" href="/app" prefetch={false}>
            <Icon name="scan" size={14} />
            <span>내 파일 검사</span>
          </Link>
          <div className="workspace-toolbar-end">
            {status}
            <ThemeToggle />
            <Link className="workspace-avatar" href="/settings" prefetch={false} title={`${userLabel} · 설정`}>
              {userLabel.slice(0, 1).toUpperCase()}
              <span className="sr-only">{userLabel} · 설정</span>
            </Link>
            <a className="workspace-signout" href="/signout-with-chatgpt?return_to=%2F">로그아웃</a>
          </div>
        </header>
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
