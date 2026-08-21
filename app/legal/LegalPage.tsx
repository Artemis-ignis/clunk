import Link from "next/link";
import { SiteShell } from "../components/SiteShell";
import { COMPANY, LEGAL_REVISION } from "./company";

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "이용약관" },
  { href: "/legal/privacy", label: "개인정보처리방침" },
  { href: "/legal/refund", label: "환불·청약철회" },
];

/**
 * Shared frame for the three legal documents: same table of contents, same operator
 * disclosure block, same revision date, so a reader never has to wonder whether one page
 * is older than another.
 */
export function LegalPage({
  title,
  summary,
  current,
  children,
}: {
  title: string;
  summary: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <SiteShell>
      <main className="legal-main">
        <div className="legal-inner">
          <header className="legal-head">
            <span className="eyebrow">법적 고지</span>
            <h1>{title}</h1>
            <p>{summary}</p>
            <p className="legal-revision">시행일 · 최종 개정 {LEGAL_REVISION}</p>
          </header>

          <nav className="legal-tabs" aria-label="법적 고지 문서">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={link.href === current ? "legal-tab is-current" : "legal-tab"}
                aria-current={link.href === current ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <article className="legal-body">{children}</article>

          <section className="legal-operator" aria-labelledby="operator-heading">
            <h2 id="operator-heading">사업자 정보</h2>
            <p className="legal-operator-note">
              Clunk는 현재 <strong>사업자 등록 전이며 유료 판매를 하지 않습니다.</strong> 모든
              요금·크레딧 화면은 <code>DEMO MODE</code>로 표시되며 실제 결제가 발생하지 않습니다.
              유료 전환 시점에 아래 항목을 사실대로 기재합니다.
            </p>
            <dl className="legal-operator-grid">
              <Row label="상호" value={COMPANY.legalName} />
              <Row label="대표자" value={COMPANY.representative} />
              <Row label="사업자등록번호" value={COMPANY.businessNumber} />
              <Row label="통신판매업 신고번호" value={COMPANY.mailOrderNumber} />
              <Row label="사업장 주소" value={COMPANY.address} />
              <Row label="고객 문의 전화" value={COMPANY.phone} />
              <Row label="고객 문의 이메일" value={COMPANY.email} />
            </dl>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="legal-operator-row">
      <dt>{label}</dt>
      <dd className={value ? undefined : "is-pending"}>
        {value ?? "사업자 등록 후 기재"}
      </dd>
    </div>
  );
}
