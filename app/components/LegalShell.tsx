import Link from "./NativeLink";
import { SiteNav } from "./SiteNav";
import { ForceDarkTheme } from "./ForceDarkTheme";
import { SiteFooter } from "./SiteFooter";
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
/**
 * In force from the day the free beta opened. These documents used to tie their own effect
 * to the 통신판매업 filing, which told a person already signed in that no terms and no
 * privacy policy governed their data yet. The filing gates paid sales, not the policy that
 * covers an account — 개인정보 보호법 제30조 applies to every processor, paid or not.
 */
export const LEGAL_EFFECTIVE_DATE = "2026-09-02";

export const LEGAL_DRAFT_NOTICE =
  "이 문서는 2026-09-02부터 시행 중입니다. 지금은 무료 베타라 결제가 없고, 유상 판매에 관한 조항은 유료 전환을 미리 공지한 뒤부터 적용됩니다. 통신판매업 신고번호는 유료 판매를 시작할 때 기재합니다.";

/**
 * `code: true` marks a label that is a literal string the machine stores (a cookie name).
 * The table uppercases labels; a cookie name that has been uppercased is a cookie that
 * does not exist, so those rows opt out.
 */
export type LegalRow = { label: string; value: string; placeholder?: boolean; code?: boolean };

/**
 * 전자상거래법 제10조가 요구하는 사업자 표시사항.
 * 실값 4건은 사업자등록증명 원본에서 그대로 옮겼다. 나머지는 미확정 플레이스홀더.
 */
export const LEGAL_OPERATOR_ROWS: LegalRow[] = [
  { label: "상호", value: "Artemis" },
  { label: "대표자", value: "박준성" },
  { label: "사업자등록번호", value: "361-02-03814" },
  { label: "통신판매업 신고번호", value: "[유료 판매를 시작할 때 신고 후 기재 — 무료 베타 중에는 해당 없음]", placeholder: true },
  { label: "사업장 주소", value: "인천광역시 제물포구 화도진로 16 (우편번호 22552)" },
  { label: "연락처", value: "+82 10-2761-9841" },
  { label: "전자우편", value: "junsuopar@gmail.com" },
  // Stated, not placeholder: the privacy policy already names D1 and R2, and this is where
  // the site runs.
  { label: "호스팅 제공자", value: "Cloudflare, Inc. (미국) — Workers · D1 · R2" },
];

export function LegalRows({ rows }: { rows: LegalRow[] }) {
  return (
    <dl className="cv5-legal-table">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className={row.code ? "is-code" : undefined}>{row.label}</dt>
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
  effectiveDate = LEGAL_EFFECTIVE_DATE,
  updatedDate = LEGAL_EFFECTIVE_DATE,
  children,
}: {
  /** 더 이상 그리지 않지만 호출부 호환을 위해 남겨 둔다. */
  eyebrow?: string;
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
          {/* 2026-09-03: 문서답게 — 제목, 한 줄 메타, 한 문장 고지. 눈썹 글자·리드·주황 상자는 뺐다. */}
          <header className="cv5-legal-head">
            <h1>{title}</h1>
            <p className="cv5-legal-lede">{lede}</p>
            {/* 한 개의 문자열로 렌더해야 날짜 앞에 RSC 텍스트 분리 주석이 끼지 않는다. */}
            <ul className="cv5-legal-dates" aria-label="문서 상태">
              <li><strong>시행 중 · 무료 베타</strong></li>
              <li>{`시행일 ${effectiveDate}`}</li>
              <li>{`최종 수정일 ${updatedDate}`}</li>
              <li>{`초안 작성일 ${LEGAL_DRAFT_DATE}`}</li>
            </ul>
            <p className="cv5-legal-status" role="note">{LEGAL_DRAFT_NOTICE}</p>
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

      <SiteFooter />
    </div>
  );
}
