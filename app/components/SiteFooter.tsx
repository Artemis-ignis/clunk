import Link from "./NativeLink";

/**
 * Shared cv5 footer. It carries the statutory operator disclosure and the
 * legal links, so every public surface must render it — /login, /signup and
 * /review were missing it entirely until the 2026-08-31 audit.
 */
export function SiteFooter() {
  return (
    <footer className="cv5-footer">
      <div className="cv5-frame cv5-footer-inner">
        <div className="cv5-footer-brand">
          <strong>CLUNK</strong>
          <p>게임 에셋 파운드리 — 만들고, 증명하고, 판매합니다. 모든 결과는 실제 바이트와 검사 근거로 남습니다.</p>
        </div>
        <nav className="cv5-footer-col" aria-label="제품">
          <header>PRODUCT</header>
          <Link href="/marketplace" prefetch={false}>에셋 판매</Link>
          <Link href="/studio" prefetch={false}>에셋 제작</Link>
          <Link href="/app" prefetch={false}>에셋 검사</Link>
          <Link href="/connect" prefetch={false}>제작 에이전트</Link>
          <Link href="/pricing" prefetch={false}>요금 · 크레딧</Link>
        </nav>
        <nav className="cv5-footer-col" aria-label="리소스">
          <header>RESOURCES</header>
          <Link href="/docs" prefetch={false}>Docs</Link>
          <Link href="/review" prefetch={false}>검수 뷰어</Link>
          <Link href="/connect" prefetch={false}>MCP 연결</Link>
          <Link href="/dashboard" prefetch={false}>내 작업공간</Link>
        </nav>
        <nav className="cv5-footer-col" aria-label="법적 고지">
          <header>LEGAL</header>
          <Link href="/terms" prefetch={false}>이용약관</Link>
          <Link href="/privacy" prefetch={false}>개인정보처리방침</Link>
          <Link href="/refunds" prefetch={false}>취소·환불정책</Link>
        </nav>
      </div>
      <div className="cv5-frame cv5-footer-legal">
        <span>아르테미스(Artemis) · 대표 박준성 · 사업자등록번호 361-02-03814 · 인천광역시 제물포구 화도진로 16, 109동 1604호</span>
        <span>통신판매업 신고 완료 전 — 유료 결제 미개시</span>
      </div>
    </footer>
  );
}
