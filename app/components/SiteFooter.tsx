import Link from "./NativeLink";
import { getBillingEnvironment, getBillingStatus } from "../api/marketplace/billing";
import { getRuntimeEnvironment } from "../runtime-environment";

/**
 * Shared cv5 footer. It carries the statutory operator disclosure and the
 * legal links, so every public surface must render it — /login, /signup and
 * /review were missing it entirely until the 2026-08-31 audit.
 */
export function SiteFooter() {
  // The "no paid checkout yet" line is a claim about the payment boundary, so it
  // tracks the real boundary: it shows only while no payment provider is
  // configured. Once billing is AVAILABLE the sentence would be a lie.
  const billingConfigured =
    getBillingStatus(getBillingEnvironment(getRuntimeEnvironment())).status === "AVAILABLE";

  return (
    <footer className="cv5-footer">
      <div className="cv5-frame cv5-footer-inner">
        <div className="cv5-footer-brand">
          <strong>CLUNK</strong>
          <p>게임에 넣을 3D 모델과 2D 이미지를 만들고, 게임에 넣어도 되는지 검사하고, 마켓에서 골라 쓰는 곳입니다.</p>
        </div>
        <nav className="cv5-footer-col" aria-label="제품">
          <header>제품</header>
          <Link href="/marketplace" prefetch={false}>에셋 마켓</Link>
          <Link href="/studio" prefetch={false}>에셋 제작</Link>
          <Link href="/app" prefetch={false}>에셋 검사</Link>
          <Link href="/agents" prefetch={false}>제작 에이전트</Link>
          <Link href="/pricing" prefetch={false}>요금 · 크레딧</Link>
        </nav>
        <nav className="cv5-footer-col" aria-label="리소스">
          <header>자료</header>
          <Link href="https://clunk.gitbook.io/docs" prefetch={false}>문서</Link>
          <Link href="/review" prefetch={false}>검수 뷰어</Link>
          <Link href="/agents" prefetch={false}>AI 도구 연결</Link>
          <Link href="/dashboard" prefetch={false}>내 작업공간</Link>
        </nav>
        <nav className="cv5-footer-col" aria-label="법적 고지">
          <header>약관</header>
          <Link href="/terms" prefetch={false}>이용약관</Link>
          <Link href="/privacy" prefetch={false}>개인정보처리방침</Link>
          <Link href="/refunds" prefetch={false}>취소·환불정책</Link>
        </nav>
      </div>
      {/* 전자상거래법 제10조 표시사항 — 사업자등록증명 값 그대로. 한 블록, 한 줄. */}
      <div className="cv5-frame cv5-footer-legal">
        <div className="cv5-footer-biz">
          <strong>주식회사 아르테미스</strong>
          <span>대표: 박준성</span>
          <span>사업자등록번호: 361-02-03814</span>
          <span>사업장 주소: 인천광역시 제물포구 화도진로 16</span>
          <span>우편번호: 22552</span>
          <span className="cv5-footer-biz-mail">이메일: junsuopar@gmail.com</span>
        </div>
        <div className="cv5-footer-bottom">
          <span>© 2026 Artemis. All rights reserved.{billingConfigured ? "" : " · 지금은 무료 베타 기간입니다. 모든 기능을 결제 없이 쓸 수 있습니다."}</span>
          <nav aria-label="약관 바로가기">
            <Link href="/privacy" prefetch={false}>개인정보처리방침</Link>
            <Link href="/terms" prefetch={false}>이용약관</Link>
            <Link href="/refunds" prefetch={false}>취소·환불정책</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
