"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "./NativeLink";
import { BrandLockup } from "./BrandMark";
import { Icon } from "./Icon";

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
  // 2026-09-03: 로그인/회원가입이 지금 보던 화면을 잃어버리고 있었습니다. 두 링크는
  // 이 페이지의 경로를 return_to 로 들고 갑니다. /login 과 /signup 자신에서 누르면
  // 제자리로 돌아오는 고리가 되므로, 그때는 작업공간으로 보냅니다.
  const pathname = usePathname();
  const returnTo = encodeURIComponent(
    !pathname || pathname === "/login" || pathname === "/signup" ? "/dashboard" : pathname,
  );
  const loginHref = `/login?return_to=${returnTo}`;
  const signupHref = `/signup?return_to=${returnTo}`;
  // 처음 오는 사람의 "Clunk 사용하기"는 만들기 화면으로 가는 가입 문입니다.
  const startHref = "/signup?return_to=%2Fstudio%3Fintent%3Dcreate";
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

          {/* 2026-09-05: 오른쪽이 두 덩어리로 따로 놀고 있었습니다. 운영자가 짚은 그대로
              "검수 뷰어 | 문서 | 내 작업공간"만 세로 막대로 갈라져 있었고(foundry.css 의
              .sitenav-utility-link 이 링크마다 border-left 를 긋습니다), 글꼴도 그 셋만
              Space Grotesk 대문자 13.1px 이라 옆의 로그인·회원가입(Pretendard 14.1px)과
              다른 물건처럼 읽혔습니다. 잰 간격도 어긋나 있었습니다 — 주 메뉴와 이 셋
              사이 121px, 이 셋과 계정 버튼 사이 10px. 즉 보조 메뉴가 계정 쪽에 붙어
              있었습니다.
              이제 오른쪽 끝을 한 상자(.sitenav-end)로 묶고, 그 안을 "가는 곳(보조 메뉴)"
              과 "내 계정(이름·로그아웃·시작 버튼)" 두 묶음으로만 나눕니다. 막대는 없애고
              글꼴은 주 메뉴와 같게, 무게만 한 칸 낮춥니다. */}
          <div className="sitenav-end">
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

            {/* 2026-09-05: 여기 있던 라이트/다크 토글을 뺐다. 눌러도 페이지 요소
                435개 중 19개(4.4%)만 색이 바뀌고, 그 19개인 드로어 링크는 대비가
                1.62:1 까지 떨어져 오히려 안 보이게 되던 버튼이다. 자세한 이유는
                app/layout.tsx 의 data-theme 주석에 적어 뒀다. */}
            <div className="sitenav-actions">
              {/* 로그인/이름은 글자 링크, 회원가입/로그아웃은 실선 버튼, 마지막이 채운
                  버튼. 로그인 상태와 로그아웃 상태가 같은 세 계단을 갖습니다 — 예전에는
                  실선 버튼 둘에 채운 버튼 하나라 셋이 서로 다투고 있었습니다. */}
              {session ? (
                <>
                  <Link className="button button-quiet button-sm sitenav-login" href="/dashboard" prefetch={false}>
                    {session.displayName}
                  </Link>
                  <a className="button button-quiet button-sm sitenav-signout" href="/signout-with-chatgpt?return_to=%2F">로그아웃</a>
                </>
              ) : (
                <>
                  <Link className="button button-quiet button-sm sitenav-login" href={loginHref} prefetch={false}>
                    로그인
                  </Link>
                  <Link className="button button-quiet button-sm sitenav-signup" href={signupHref} prefetch={false}>
                    회원가입
                  </Link>
                </>
              )}
              <Link className="button button-primary button-sm sitenav-cta" href={session ? "/app" : startHref} prefetch={false}>
                {session ? "에셋 검사 열기" : "Clunk 사용하기"}
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
                <>
                  <Link className="button button-quiet button-sm" href="/dashboard" prefetch={false} onClick={() => setOpen(false)}>
                    {session.displayName}
                  </Link>
                  <a className="button button-quiet button-sm" href="/signout-with-chatgpt?return_to=%2F">로그아웃</a>
                </>
              ) : (
                <>
                  <Link className="button button-quiet button-sm" href={loginHref} prefetch={false} onClick={() => setOpen(false)}>
                    로그인
                  </Link>
                  <Link className="button button-quiet button-sm" href={signupHref} prefetch={false} onClick={() => setOpen(false)}>
                    회원가입
                  </Link>
                </>
              )}
              <Link className="button button-primary button-sm" href={session ? "/app" : startHref} prefetch={false} onClick={() => setOpen(false)}>
                {session ? "에셋 검사 열기" : "Clunk 사용하기"}
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
