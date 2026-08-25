/* eslint-disable @next/next/no-img-element */
import Link from "./NativeLink";
import { BrandMark } from "./BrandMark";
import { SiteNav, type ShellSection } from "./SiteNav";

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
      <SiteNav active={active} />
      {children}
      <footer className="site-footer">
        <img
          className="site-footer-art"
          src="/template-assets/agentic-footer.png"
          alt=""
          aria-hidden="true"
          width={1400}
          height={580}
        />
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span className="brand-mark">
              <BrandMark size={34} gradientId="clunk-footer" />
            </span>
            <div>
              <strong>Clunk</strong>
              <span>팀을 위한 실시간 3D 에셋 품질 게이트</span>
            </div>
          </div>
          <nav className="site-footer-nav" aria-label="사이트 링크">
            <Link href="/studio">에셋 스튜디오</Link>
            <Link href="/app">검사기</Link>
            <Link href="/dashboard">대시보드</Link>
            <Link href="/pricing">요금</Link>
            <Link href="/docs">문서</Link>
            <Link href="/settings">설정</Link>
            <a href="/llms.txt">llms.txt</a>
          </nav>
          <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
        </div>
      </footer>
    </div>
  );
}
