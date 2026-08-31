import Link from "./NativeLink";
import Image from "next/image";
import { BrandMark } from "./BrandMark";
import { SiteNav, type ShellSection } from "./SiteNav";
import { getBillingEnvironment, getBillingStatus } from "../api/marketplace/billing";
import { getRuntimeEnvironment } from "../runtime-environment";

export type { ShellSection };

export function SiteShell({
  active,
  children,
}: {
  active?: ShellSection;
  children: React.ReactNode;
}) {
  // The demo marker is a claim about the payment boundary, so it has to track
  // the real boundary: it shows only while no payment provider is configured
  // (the same getBillingStatus the checkout route refuses on). Once billing is
  // AVAILABLE, charges are real and the banner would be a lie.
  const billingConfigured =
    getBillingStatus(getBillingEnvironment(getRuntimeEnvironment())).status === "AVAILABLE";

  return (
    <div className="site-shell">
      {/* Scroll snap is a landing-only device (2026-08-31 master review):
          mandatory document snap on content pages traps the scroll short of
          buttons. Content pages scroll naturally. */}
      <SiteNav active={active} />
      {children}
      <footer className="site-footer">
        <Image
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
              <span>AI Game Asset Foundry · 팀을 위한 2D + 3D 에셋 품질·근거 게이트</span>
            </div>
          </div>
          <nav className="site-footer-nav" aria-label="사이트 링크">
            <Link href="/marketplace">Discover</Link>
            <Link href="/studio">Create</Link>
            <Link href="/app">Game Ready</Link>
            <Link href="/connect">Developers</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/dashboard">Workspace</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/settings">설정</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/refunds">취소·환불정책</Link>
            <a href="/llms.txt">llms.txt</a>
          </nav>
          {billingConfigured ? null : (
            <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
          )}
        </div>
      </footer>
    </div>
  );
}
