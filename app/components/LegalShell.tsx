import Link from "./NativeLink";
import { SiteNav } from "./SiteNav";

/**
 * Shared chrome for the three statutory documents (terms, privacy, refunds).
 *
 * Truthfulness rule for this surface: Clunk is not yet a registered
 * 통신판매업자, so every field that the 전자상거래법 requires an operator to
 * publish is rendered as a visible placeholder instead of an invented value,
 * and every document carries a draft badge saying it is not yet in force.
 * Do not replace a placeholder with a plausible-looking string — only the
 * operator's real registration data may fill these in.
 */

export const LEGAL_DRAFT_DATE = "2026-08-31";

export const LEGAL_DRAFT_NOTICE =
  "이 문서는 시행 전 초안이며 사업자 정보 확정 후 발효됩니다. 아래 표의 [ ] 항목은 사업자 등록·통신판매업 신고가 완료되면 실제 값으로 채워지고, 그때 시행일을 다시 고지합니다.";

export type LegalRow = { label: string; value: string; placeholder?: boolean };

/** 전자상거래법 제10조가 요구하는 사업자 표시사항. 값은 전부 미확정 플레이스홀더. */
export const LEGAL_OPERATOR_ROWS: LegalRow[] = [
  { label: "상호", value: "[상호 — 사업자 등록 후 기재]", placeholder: true },
  { label: "대표자", value: "[대표자 성명 — 사업자 등록 후 기재]", placeholder: true },
  { label: "사업자등록번호", value: "[사업자등록번호 — 사업자 등록 후 기재]", placeholder: true },
  { label: "통신판매업 신고번호", value: "[통신판매업 신고번호 — 신고 후 기재]", placeholder: true },
  { label: "사업장 주소", value: "[사업장 주소 — 사업자 등록 후 기재]", placeholder: true },
  { label: "연락처", value: "[대표 전화번호 — 사업자 등록 후 기재]", placeholder: true },
  { label: "전자우편", value: "[고객문의 이메일 — 운영 계정 확정 후 기재]", placeholder: true },
  { label: "호스팅 제공자", value: "[호스팅 사업자 — 운영 배포처 확정 후 기재]", placeholder: true },
];

export function LegalRows({ rows }: { rows: LegalRow[] }) {
  return (
    <dl className="cv4-legal-table">
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
    <div className="cv4">
      <a className="clunk-home-skip-link" href="#legal-content">본문으로 건너뛰기</a>
      <SiteNav />

      <main className="cv4-legal" id="legal-content">
        <div className="cv4-frame">
          <header className="cv4-legal-head">
            <span className="cv4-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="cv4-legal-lede">{lede}</p>
            <p className="cv4-legal-status" role="note">
              <strong>초안 · 시행 전</strong>
              <span>{LEGAL_DRAFT_NOTICE}</span>
            </p>
            {/* 한 개의 문자열로 렌더해야 날짜 앞에 RSC 텍스트 분리 주석이 끼지 않는다. */}
            <ul className="cv4-legal-dates">
              <li>{`초안 작성일 ${effectiveDate}`}</li>
              <li>{`최종 수정일 ${updatedDate}`}</li>
              <li>시행일 미정 — 사업자 정보 확정 후 고지</li>
            </ul>
          </header>

          <div className="cv4-legal-body">{children}</div>

          <nav className="cv4-legal-crosslinks" aria-label="관련 문서">
            <Link className="cv4-link" href="/terms" prefetch={false}>이용약관</Link>
            <Link className="cv4-link" href="/privacy" prefetch={false}>개인정보처리방침</Link>
            <Link className="cv4-link" href="/refunds" prefetch={false}>취소·환불정책</Link>
            <Link className="cv4-link" href="/" prefetch={false}>홈으로</Link>
          </nav>
        </div>
      </main>

      <footer className="cv4-footer">
        <div className="cv4-frame cv4-footer-inner">
          <div className="cv4-footer-brand">
            <strong>Clunk</strong>
            <span>게임 에셋 파운드리 — 제작·판매 / 검사·수정 / 게임 제작 에이전트</span>
          </div>
          <nav aria-label="Clunk 제품 링크">
            <Link href="/marketplace" prefetch={false}>마켓</Link>
            <Link href="/pricing" prefetch={false}>크레딧 · 요금</Link>
            <Link href="/docs" prefetch={false}>Docs</Link>
            <Link href="/terms" prefetch={false}>이용약관</Link>
            <Link href="/privacy" prefetch={false}>개인정보처리방침</Link>
            <Link href="/refunds" prefetch={false}>취소·환불정책</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
