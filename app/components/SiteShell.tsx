import Link from "next/link";
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
            <Link href="/app">검사기</Link>
            <Link href="/dashboard">대시보드</Link>
            <Link href="/pricing">요금</Link>
            <Link href="/docs">문서</Link>
            <Link href="/settings">설정</Link>
            <Link href="/support">지원</Link>
            <a href="/llms.txt">llms.txt</a>
          </nav>
          <nav className="site-footer-legal" aria-label="법적 고지">
            <Link href="/legal/terms">이용약관</Link>
            <Link href="/legal/privacy">개인정보처리방침</Link>
            <Link href="/legal/refund">환불·청약철회</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
