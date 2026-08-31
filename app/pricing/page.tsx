import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { CreditPacksPanel } from "../components/CreditPacksPanel";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { RULE_SET } from "../components/product-facts";
import { createPageMetadata } from "../components/site-metadata";
import { getBillingEnvironment, getBillingStatus } from "../api/marketplace/billing";
import { getRuntimeEnvironment } from "../runtime-environment";
import styles from "./pricing.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "요금 · 크레딧",
  description: "Clunk 기능 실행에 사용하는 크레딧 규칙과 현재 결제 설정 상태를 확인합니다.",
  path: "/pricing",
});

/**
 * Pricing — cv5 unified restyle (2026-08-31). The contract is unchanged:
 * only real credit rules and the live pack/billing state are rendered.
 * 1 크레딧 = ₩100 (billing.ts와 동일 환산), 판매 개시는 통신판매업 신고 완료 후.
 */

const CREDIT_OPERATIONS = [
  {
    label: "에셋 검사",
    endpoint: "Workspace inspect",
    detail: "업로드한 실제 파일을 검사하고 실행 기록을 남깁니다.",
  },
  {
    label: "안전 최적화",
    endpoint: "Workspace optimize",
    detail: "원본을 보존한 별도 산출물을 만들고 다시 검사합니다.",
  },
  {
    label: "Clunk 생성",
    endpoint: "Workspace generate",
    detail: "저장 가능한 생성 결과를 만들고 Workspace에 연결합니다.",
  },
  {
    label: "Provider 실행",
    endpoint: "Provider run",
    detail: "외부 provider 실행 결과를 받아 Clunk 규칙으로 재검사합니다.",
  },
] as const;

const CREDIT_RULES = [
  {
    label: "성공한 실행",
    value: "1 credit",
    detail: "현재 API에서 과금 대상으로 정의된 각 성공 실행은 1 credit을 사용합니다.",
  },
  {
    label: "실패 또는 거부",
    value: "0 credit",
    detail: "입력 검증, 인증, provider, 저장 실패는 실행이 완료되지 않으므로 차감하지 않습니다.",
  },
  {
    label: "중복 요청",
    value: "1회 처리",
    detail: "idempotency key가 같은 요청은 한 번만 ledger에 기록됩니다.",
  },
] as const;

function BillingState() {
  const billing = getBillingStatus(getBillingEnvironment(getRuntimeEnvironment()));
  const isAvailable = billing.status === "AVAILABLE";

  return (
    <div className={styles.billingNote} role="status">
      <div className={styles.billingHead}>
        <span className={styles.statusDot + (isAvailable ? " " + styles.statusDotReady : "")} aria-hidden="true" />
        <strong>{isAvailable ? "결제 provider 설정됨" : "결제 provider 설정 필요"}</strong>
      </div>
      <p>
        유료 월정액 플랜 금액은 아직 확정된 것이 없고, credit pack 가격은 아래 패널이
        보여 주는 서버 상태가 전부입니다.{" "}
        {isAvailable
          ? "공개 listing의 결제 요청은 설정된 provider를 통해 처리됩니다."
          : "결제 provider가 설정되지 않아 결제 요청이나 주문을 만들지 않습니다."}
      </p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="pricing">
        <main className={styles.page}>
          <section
            className={styles.hero}
            data-snap-section="pricing-intro"
            aria-labelledby="pricing-title"
          >
            <div className={`cv5-frame ${styles.heroGrid}`}>
              <div>
                <span className="cv5-badge">✦ CLUNK USAGE · <b>1 크레딧 = ₩100</b></span>
                <h1 id="pricing-title">
                  Clunk 기능은
                  <br />
                  <em>크레딧으로 실행합니다</em>
                </h1>
                <p className={styles.heroLede}>
                  Clunk가 공개한 에셋을 구매하는 카탈로그와 Clunk 기능을 사용하는 Workspace는
                  다릅니다. 이 페이지는 후자의 실행 크레딧만 설명합니다.
                </p>
                <div className={styles.actions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/login?return_to=%2Fdashboard">
                    Workspace 열기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/marketplace">
                    공개 에셋 보기 <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
                <p className={styles.aiPreNotice}>
                  <i>✦</i>
                  <span>
                    Clunk의 에셋 생성·검사·수정, 에이전트 기능 일부는 생성형 인공지능을
                    기반으로 운용됩니다. 생성형 AI로 제작된 에셋에는 그 사실이 상품
                    정보와 구매 전 안내에 표시됩니다.
                  </span>
                </p>
              </div>

              <div className={styles.ledger} aria-label="Clunk credit usage ledger">
                <div className={styles.ledgerTopline}>
                  <span>USAGE LEDGER</span>
                  <span>{RULE_SET.id}</span>
                </div>
                <div className={styles.ledgerAmount}>
                  <strong>1</strong>
                  <span>credit<br />per successful run</span>
                </div>
                <div className={styles.ledgerFacts}>
                  <div>
                    <span>RULE SET</span>
                    <strong>{RULE_SET.version}</strong>
                  </div>
                  <div>
                    <span>BLOCKED</span>
                    <strong>0 credit</strong>
                  </div>
                  <div>
                    <span>DUPLICATE</span>
                    <strong>idempotent</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={styles.section}
            data-snap-section="pricing-operations"
            aria-labelledby="operations-title"
          >
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">WHAT USES CREDIT</span>
                <h2 id="operations-title">
                  만드는 사람과 <em>사용하는 사람의 경계</em>를 분명히 합니다
                </h2>
                <p>
                  마스터가 만든 에셋은 공개 카탈로그에 올라가고 사용자는 그것을 구매합니다.
                  사용자가 credit을 쓰는 곳은 에셋 상품 제작이 아니라 Clunk의 검사, 처리, 생성 기능입니다.
                </p>
              </div>
              <div className={`${styles.opGrid} cv5-reveal`} data-delay="1">
                {CREDIT_OPERATIONS.map((operation, index) => (
                  <article className={styles.op} key={operation.endpoint}>
                    <span className={styles.opIndex}>0{index + 1}</span>
                    <div>
                      <span className={styles.opEndpoint}>{operation.endpoint}</span>
                      <h3>{operation.label}</h3>
                      <p>{operation.detail}</p>
                    </div>
                    <strong className={styles.opCost}>1 CREDIT</strong>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            className={styles.section}
            data-snap-section="pricing-rules"
            aria-labelledby="rules-title"
          >
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">TRANSACTION RULES</span>
                <h2 id="rules-title">
                  <em>실행 결과</em>가 기준입니다
                </h2>
                <p>
                  표시용 숫자나 예정 가격을 만들지 않습니다. 실제 API가 기록하는 ledger 동작과
                  현재 결제 provider 설정만 공개합니다.
                </p>
              </div>
              <div className={styles.ruleList}>
                {CREDIT_RULES.map((rule) => (
                  <div className={styles.rule} key={rule.label}>
                    <div>
                      <span>{rule.label}</span>
                      <strong>{rule.value}</strong>
                    </div>
                    <p>{rule.detail}</p>
                  </div>
                ))}
              </div>
              <BillingState />
              <div className={styles.inlineActions}>
                <Link className="cv5-btn cv5-btn-ghost" href="/refunds">
                  취소·환불정책 <Icon name="arrowRight" size={15} />
                </Link>
              </div>
            </div>
          </section>

          <section
            className={styles.section}
            data-snap-section="pricing-packs"
            aria-labelledby="packs-title"
          >
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">CREDIT PACKS</span>
                <h2 id="packs-title">
                  크레딧 팩은 <em>실제 상태만</em> 보여 줍니다
                </h2>
                <p>
                  팩 구성과 판매 상태는 서버 API가 반환한 값 그대로입니다. 가격이 확정되지 않은
                  팩은 숫자를 지어내는 대신 &ldquo;확정 전&rdquo;으로 표시하고 구매를 열지 않습니다.
                </p>
              </div>
              <div className={styles.packsNote}>
                <span><b>1 크레딧 = ₩100</b> · 결제 금액은 원화 기준으로 환산됩니다</span>
                <span>판매 개시는 <b>통신판매업 신고 완료 후</b> — 그 전에는 구매가 열리지 않습니다</span>
              </div>
              <CreditPacksPanel />
            </div>
          </section>

          <section
            className={styles.routeSection}
            data-snap-section="pricing-next"
            aria-labelledby="next-title"
          >
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">NEXT SURFACE</span>
                <h2 id="next-title">지금 하려는 일로 <em>이동합니다</em></h2>
              </div>
              <div className={`${styles.routeGrid} cv5-reveal`} data-delay="1">
                <Link className={styles.route} href="/marketplace">
                  <span>
                    <small>BUY</small>
                    <strong>공개 에셋 카탈로그</strong>
                    <em>실제 공개 listing이 있을 때 구매합니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">↗</span>
                </Link>
                <Link className={styles.route} href="/login?return_to=%2Fapp">
                  <span>
                    <small>USE</small>
                    <strong>Clunk Game Ready</strong>
                    <em>인증 후 Workspace에서 credit을 사용합니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">↗</span>
                </Link>
                <Link className={styles.route} href="/docs">
                  <span>
                    <small>CONNECT</small>
                    <strong>개발자 문서</strong>
                    <em>CLI와 MCP로 실제 Clunk 기능을 연결합니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
