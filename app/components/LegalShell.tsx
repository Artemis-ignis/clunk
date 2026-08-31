import Link from "./NativeLink";
import { SiteNav } from "./SiteNav";
import { ForceDarkTheme } from "./ForceDarkTheme";
import "./legal-v5.css";

/**
 * Shared chrome for the three statutory documents (terms, privacy, refunds),
 * rendered in the unified cv5 system (tokens in app/site-v5.css, legal-specific
 * classes in ./legal-v5.css).
 *
 * Truthfulness rule for this surface: the values below come straight from the
 * operator's 사업자등록증명 (아르테미스, 등록 2026-08-21 · 개업 2026-08-24,
 * 인천세무서 발급 2026-08-31) supplied by the operator. The 통신판매업 신고 is
 * still pending, so that row stays a visible placeholder and paid trade stays
 * closed until the registration number exists. Never fill a remaining [ ]
 * field with a plausible-looking string — only real registration data.
 */

export const LEGAL_DRAFT_DATE = "2026-08-31";

export const LEGAL_DRAFT_NOTICE =
  "사업자 등록은 완료되었습니다(아르테미스, 개업 2026-08-24). 다만 통신판매업 신고가 완료되기 전까지 유상 판매를 개시하지 않으며, 이 문서도 시행 전 초안입니다. 남은 [ ] 항목은 확정되는 대로 채워지고, 그때 시행일을 고지합니다.";

export type LegalRow = { label: string; value: string; placeholder?: boolean };

/**
 * 전자상거래법 제10조가 요구하는 사업자 표시사항.
 * 실값 4건은 사업자등록증명 원본에서 그대로 옮겼다. 나머지는 미확정 플레이스홀더.
 */
export const LEGAL_OPERATOR_ROWS: LegalRow[] = [
  { label: "상호", value: "아르테미스(Artemis)" },
  { label: "대표자", value: "박준성" },
  { label: "사업자등록번호", value: "361-02-03814" },
  { label: "통신판매업 신고번호", value: "[통신판매업 신고번호 — 신고 준비 중 · 완료 전까지 유상 판매 미개시]", placeholder: true },
  { label: "사업장 주소", value: "인천광역시 제물포구 화도진로 16, 109동 1604호(송림동, 동인천역 파크푸르지오)" },
  { label: "연락처", value: "[대표 전화번호 — 확정 후 기재]", placeholder: true },
  { label: "전자우편", value: "[고객문의 이메일 — 운영 계정 확정 후 기재]", placeholder: true },
  { label: "호스팅 제공자", value: "[호스팅 사업자 — 운영 배포처 확정 후 기재]", placeholder: true },
];

export function LegalRows({ rows }: { rows: LegalRow[] }) {
  return (
    <dl className="cv5-legal-table">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd className={row.placeholder ? "is-placeholder" : undefined}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LegalShell({
  eyebrow,
  title,
  lede,
  effectiveDate = LEGAL_DRAFT_DATE,
  updatedDate = LEGAL_DRAFT_DATE,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  effectiveDate?: string;
  updatedDate?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#legal-content">본문으로 건너뛰기</a>
      <SiteNav />

      <main className="cv5-legal" id="legal-content">
        <div className="cv5-frame">
          <header className="cv5-legal-head">
            <span className="cv5-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="cv5-legal-lede">{lede}</p>
            <p className="cv5-legal-status" role="note">
              <strong>초안 · 시행 전</strong>
              <span>{LEGAL_DRAFT_NOTICE}</span>
            </p>
            {/* 한 개의 문자열로 렌더해야 날짜 앞에 RSC 텍스트 분리 주석이 끼지 않는다. */}
            <ul className="cv5-legal-dates">
              <li>{`초안 작성일 ${effectiveDate}`}</li>
              <li>{`최종 수정일 ${updatedDate}`}</li>
              <li>시행일 미정 — 사업자 정보 확정 후 고지</li>
            </ul>
          </header>

          <div className="cv5-legal-body">{children}</div>

          <nav className="cv5-legal-crosslinks" aria-label="관련 문서">
            <Link href="/terms" prefetch={false}>이용약관</Link>
            <Link href="/privacy" prefetch={false}>개인정보처리방침</Link>
            <Link href="/refunds" prefetch={false}>취소·환불정책</Link>
            <Link href="/" prefetch={false}>홈으로</Link>
          </nav>
        </div>
      </main>

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
    </div>
  );
}
