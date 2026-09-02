import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "../api/_lib/clunk";
import { WORKSPACE_IMAGES_PER_DAY } from "../api/_lib/ai-budget";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "./pricing.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "요금 · 무료 베타",
  description: "지금은 무료 베타 — 가입하면 크레딧이 지급되고 결제는 없습니다. 유료 전환 후의 플랜과 크레딧 가격을 미리 공개합니다.",
  path: "/pricing",
});

/**
 * Pricing during the free beta.
 *
 * The previous page showed three credit packs with no price and no button, a note that
 * "the payment provider is not configured", and a ledger card that said RULE SET 1.0.0 and
 * "idempotent". To a visitor that read as a shop that had crashed. What is actually true
 * is simpler and better: everything is free right now, the credits come from signup and a
 * monthly grant, and the prices that will apply later are already decided.
 *
 * Every number on this page is a constant the product runs on, imported from where it is
 * enforced, so the page cannot promise a grant the ledger does not make.
 */

/** Planned prices — recorded in docs/free-beta-plan.ko.md with the reference prices they were set against. */
const PLANS = [
  {
    id: "free",
    name: "무료",
    monthly: 0,
    annual: 0,
    credits: BETA_MONTHLY_GRANT_CREDITS,
    images: WORKSPACE_IMAGES_PER_DAY,
    lines: ["마켓 에셋 미리보기·3D 뷰어·색 팔레트", "파일 검사와 스프라이트 시트 검사", "AI 도구 연결(MCP)과 API — 추가 요금 없음", "상업적으로 써도 됩니다"],
    note: "지금 모든 계정이 이 조건 이상으로 무료입니다.",
  },
  {
    id: "maker",
    name: "메이커",
    monthly: 9_900,
    annual: 99_000,
    credits: 300,
    images: 30,
    lines: ["무료 요금제에 있는 것 전부", "마켓 에셋 내려받기 제한 없음", "작업 순서 우선 처리", "1인 상업 라이선스 명시"],
    featured: true,
  },
  {
    id: "studio",
    name: "스튜디오",
    monthly: 29_000,
    annual: 290_000,
    credits: 1_200,
    images: 100,
    lines: ["메이커에 있는 것 전부", "팀 자리 3개", "팀이 함께 쓰는 크레딧", "상업 라이선스 서면 발급"],
  },
] as const;

const PACKS = [
  { credits: 500, priceKrw: 45_000 },
  { credits: 2_000, priceKrw: 160_000 },
  { credits: 6_000, priceKrw: 420_000 },
] as const;

const OPERATIONS = [
  { label: "에셋 검사", detail: "올린 GLB·PNG 파일을 열어 폴리곤 수, 그리기 횟수, 규격을 확인합니다." },
  { label: "안전 최적화", detail: "원본은 그대로 두고 정리한 새 파일을 만들어 다시 검사합니다." },
  { label: "에셋 만들기", detail: "문장으로 2D 이미지를, 코드로 3D 모델과 스프라이트 시트를 만듭니다." },
  { label: "외부 결과 재검사", detail: "다른 도구로 만든 파일도 같은 기준으로 다시 검사합니다." },
] as const;

const RULES = [
  { label: "성공한 작업", value: "1 크레딧", detail: "네 가지 작업 모두 성공했을 때만 1크레딧입니다." },
  { label: "실패·거부", value: "0 크레딧", detail: "입력 오류, 모델 거부, 저장 실패는 끝나지 않은 작업이라 차감하지 않습니다." },
  { label: "같은 요청 두 번", value: "한 번만", detail: "같은 요청을 다시 보내도 한 번만 처리하고 한 번만 셉니다." },
  { label: "하루 이미지 한도", value: `${WORKSPACE_IMAGES_PER_DAY}장`, detail: "베타 기간의 공정 사용 한도입니다. 닿으면 한국 시간으로 언제 다시 열리는지 알려 드립니다." },
] as const;

const won = (value: number) => `₩${value.toLocaleString("ko-KR")}`;

export default function PricingPage() {
  const salesOpen = areSalesOpen();

  return (
    <div className="cv5">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="pricing">
        <main className={styles.page}>
          <section className={styles.hero} data-snap-section="pricing-intro" aria-labelledby="pricing-title">
            <div className={`cv5-frame ${styles.heroGrid}`}>
              <div>
                <span className="cv5-badge">✦ {salesOpen ? "1 크레딧 = 100원" : "무료 베타 진행 중"}</span>
                <h1 id="pricing-title">
                  요금은 단순합니다.
                  <br />
                  <em>쓴 만큼, 크레딧으로.</em>
                </h1>
                <p className={styles.heroLede}>
                  {salesOpen
                    ? `크레딧 하나가 100원입니다. 검사·생성은 성공한 작업당 1크레딧이고, 실패한 작업은 세지 않습니다.`
                    : `무료 베타 기간에는 가입만 하면 ${SIGNUP_GRANT_CREDITS}크레딧을 드리고, 매달 ${BETA_MONTHLY_GRANT_CREDITS}크레딧을 더 드립니다. 검사·생성은 성공한 작업당 1크레딧, 마켓 에셋은 로그인만 하면 받습니다. 결제 정보는 받지 않습니다.`}
                </p>
                <div className={styles.actions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/signup">
                    가입하고 {SIGNUP_GRANT_CREDITS}크레딧 받기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/marketplace">
                    에셋 보기 <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
                <p className={styles.aiPreNotice}>
                  <i>✦</i>
                  <span>
                    2D 이미지 생성은 생성형 AI로 만듭니다. 그렇게 만든 에셋에는 상품 정보에 그 사실이
                    표시됩니다. 3D 모델과 스프라이트 시트는 코드로 만들어 검사까지 같은 파일로 이어집니다.
                  </span>
                </p>
              </div>

              {/* What a new account actually holds, from the constants the ledger enforces. */}
              <div className={styles.ledger} aria-label="베타 지급 내역">
                <div className={styles.ledgerTopline}>
                  <span>베타 계정에 들어오는 것</span>
                  <span>결제 0원</span>
                </div>
                <div className={styles.ledgerAmount}>
                  <strong>{SIGNUP_GRANT_CREDITS}</strong>
                  <span>크레딧<br />가입 즉시</span>
                </div>
                <div className={styles.ledgerFacts}>
                  <div>
                    <span>매월</span>
                    <strong>+{BETA_MONTHLY_GRANT_CREDITS}</strong>
                  </div>
                  <div>
                    <span>이미지 / 하루</span>
                    <strong>{WORKSPACE_IMAGES_PER_DAY}장</strong>
                  </div>
                  <div>
                    <span>마켓 에셋</span>
                    <strong>무료</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section} data-snap-section="pricing-plans" aria-labelledby="plans-title">
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">유료 전환 후 플랜 · 예정 가격</span>
                <h2 id="plans-title">
                  미리 <em>공개합니다</em>
                </h2>
                <p>
                  베타가 끝나면 이 표대로 받습니다. 바뀌면 최소 30일 전에 이 페이지와 이메일로 알립니다.
                </p>
              </div>
              <div className={`${styles.betaAnswer} cv5-reveal`}>
                <strong>베타가 끝나면 지금 계정은 어떻게 되나요?</strong>
                <p>
                  그대로 남습니다. 지금 만든 계정은 유료 전환 뒤에도 무료 요금제 조건을 그대로 씁니다.
                  받은 크레딧과 내려받은 파일은 그대로 두고, 갑자기 결제를 요구하지 않습니다.
                  유료 전환은 최소 30일 전에 이 페이지와 이메일로 미리 알립니다.
                </p>
              </div>
              <div className={`${styles.planGrid} cv5-reveal`} data-delay="1">
                {PLANS.map((plan) => (
                  <article className={`${styles.plan}${"featured" in plan && plan.featured ? ` ${styles.planFeatured}` : ""}`} key={plan.id}>
                    <header>
                      <span className={styles.planName}>{plan.name}</span>
                      <strong className={styles.planPrice}>
                        {plan.monthly === 0 ? "₩0" : `${won(plan.monthly)}`}
                        <small>{plan.monthly === 0 ? "영구" : "/ 월"}</small>
                      </strong>
                      {plan.annual > 0 ? (
                        <span className={styles.planAnnual}>연 {won(plan.annual)} · 열 달 값으로 열두 달</span>
                      ) : (
                        <span className={styles.planAnnual}>카드 없이 시작</span>
                      )}
                    </header>
                    <ul className={styles.planList}>
                      <li><b>매월 {plan.credits.toLocaleString("ko-KR")}크레딧</b></li>
                      <li>이미지 하루 {plan.images}장</li>
                      {plan.lines.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                    {"note" in plan && plan.note ? <p className={styles.planNote}>{plan.note}</p> : null}
                    {salesOpen ? null : (
                      <span className={styles.planState}>{plan.monthly === 0 ? "지금 이 조건으로 이용 중" : "유료 전환 후 시작"}</span>
                    )}
                  </article>
                ))}
              </div>
              <div className={styles.packsNote}>
                <span><b>크레딧 팩 (예정)</b> · {PACKS.map((pack) => `${pack.credits.toLocaleString("ko-KR")} = ${won(pack.priceKrw)}`).join(" · ")}</span>
                <span>만료 없음 · 구독보다 크레딧당 조금 비싸게 두어, 꾸준히 쓰면 구독이 유리하도록 잡았습니다</span>
              </div>
            </div>
          </section>

          <section className={styles.section} data-snap-section="pricing-operations" aria-labelledby="operations-title">
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">크레딧이 드는 작업</span>
                <h2 id="operations-title">
                  네 가지, <em>각 1크레딧</em>
                </h2>
                <p>에셋을 받는 데는 크레딧이 들지 않습니다. 만들고 검사하는 데만 듭니다.</p>
              </div>
              <div className={`${styles.opGrid} cv5-reveal`} data-delay="1">
                {OPERATIONS.map((operation, index) => (
                  <article className={styles.op} key={operation.label}>
                    <span className={styles.opIndex}>0{index + 1}</span>
                    <div>
                      <h3>{operation.label}</h3>
                      <p>{operation.detail}</p>
                    </div>
                    <strong className={styles.opCost}>1 크레딧</strong>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section} data-snap-section="pricing-rules" aria-labelledby="rules-title">
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">차감 규칙</span>
                <h2 id="rules-title">
                  <em>실패하면</em> 돌려받습니다
                </h2>
                <p>끝난 작업만 셉니다. 같은 요청을 두 번 보내도 한 번만.</p>
              </div>
              <div className={styles.ruleList}>
                {RULES.map((rule) => (
                  <div className={styles.rule} key={rule.label}>
                    <div>
                      <span>{rule.label}</span>
                      <strong>{rule.value}</strong>
                    </div>
                    <p>{rule.detail}</p>
                  </div>
                ))}
              </div>
              <div className={styles.inlineActions}>
                <Link className="cv5-btn cv5-btn-ghost" href="/refunds">
                  취소·환불정책 <Icon name="arrowRight" size={15} />
                </Link>
              </div>
            </div>
          </section>

          <section className={styles.routeSection} data-snap-section="pricing-next" aria-labelledby="next-title">
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">다음 단계</span>
                <h2 id="next-title">어디로 <em>가면 되나요</em></h2>
              </div>
              <div className={`${styles.routeGrid} cv5-reveal`} data-delay="1">
                <Link className={styles.route} href="/marketplace">
                  <span>
                    <small>받기</small>
                    <strong>공개 에셋 카탈로그</strong>
                    <em>완성된 에셋을 골라 로그인만 하면 받습니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">→</span>
                </Link>
                <Link className={styles.route} href="/login?return_to=%2Fdashboard">
                  <span>
                    <small>쓰기</small>
                    <strong>내 작업실</strong>
                    <em>내 파일을 올려 검사하고, 만들고, 고칩니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">→</span>
                </Link>
                <Link className={styles.route} href="/agents">
                  <span>
                    <small>연결</small>
                    <strong>에이전트 연결</strong>
                    <em>쓰던 AI 도구와 터미널에서 같은 기능을 부릅니다.</em>
                  </span>
                  <span className={styles.routeArrow} aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
