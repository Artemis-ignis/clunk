import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { signUpPath } from "../auth";
import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "../api/_lib/clunk";
import { WORKSPACE_IMAGES_PER_DAY } from "../api/_lib/ai-budget";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "./pricing.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "요금",
  description:
    "Clunk 요금. 지금은 결제 없이 모든 기능을 쓸 수 있습니다. 월정액 구독과 크레딧 충전은 결제 기능이 붙는 날 시작합니다.",
  path: "/pricing",
});

/**
 * /pricing — one grid of plan cards, one grid of credit packs, one usage table, one
 * comparison table, an FAQ, a closing door. No glow headline, no status chips.
 *
 * TRUTH RULES FOR THIS PAGE
 * 1. Every number a visitor reads comes from one of two places and nowhere else:
 *    - the constants the product actually enforces (imported below), or
 *    - the PLANS / PACKS tables in this file.
 *    Nothing is typed inline in JSX. When the operator changes a price, they change
 *    PLANS or PACKS and the whole page follows.
 * 2. `priceKrw: null` is the honest slot for a number that does not exist yet — it
 *    renders "가격 미정" and the card's button is disabled. Dropping a real number in
 *    later needs no layout work.
 * 3. There is no payment rail on this deployment (app/api/_lib/sales-lock.ts). Every
 *    paid button therefore says 결제 준비 중 and is disabled. We never render a button
 *    that cannot do what it says.
 */

/** Credits charged per successful job. Source of truth: `amount: -1` in
 *  app/api/runs/route.ts, app/api/generation/route.ts, app/api/optimizations/route.ts,
 *  app/api/providers/run/route.ts, and app/api/series/route.ts — plus the published
 *  contract in app/api/_lib/access.ts (`costs: { generate: 1, inspect: 1 }`). */
const CREDITS_PER_SUCCESSFUL_JOB = 1;

type Plan = {
  id: string;
  name: string;
  /** ₩/월. null = 아직 정해지지 않음 → "가격 미정" + 비활성 버튼. */
  priceKrw: number | null;
  /** ₩/년. null = 연 결제 없음 또는 미정. */
  annualKrw: number | null;
  summary: string;
  /** 매달 들어오는 크레딧. */
  credits: number;
  /** 하루 이미지 생성 장수. */
  images: number;
  /** 작업공간 자리 수. */
  seats: number;
  features: string[];
  featured?: boolean;
};

/**
 * 월정액 구독. 무료 요금제의 세 숫자는 원장이 실제로 집행하는 상수를 그대로 씁니다.
 * 메이커·스튜디오의 숫자는 docs/free-beta-plan.ko.md 의 플랜 정의입니다.
 */
const PLANS: Plan[] = [
  {
    id: "free",
    name: "무료",
    priceKrw: 0,
    annualKrw: 0,
    summary: "가입하면 바로 씁니다. 카드도 비밀번호도 묻지 않습니다.",
    credits: BETA_MONTHLY_GRANT_CREDITS,
    images: WORKSPACE_IMAGES_PER_DAY,
    seats: 1,
    features: [
      `가입 즉시 ${SIGNUP_GRANT_CREDITS}크레딧`,
      "마켓 에셋 내려받기 — 로그인만 하면 무료",
      "3D 뷰어·색 팔레트·파일 검사",
      "AI 도구 연결(MCP)과 API",
      "만든 에셋은 상업적으로 써도 됩니다",
    ],
  },
  {
    id: "maker",
    name: "메이커",
    priceKrw: 9_900,
    annualKrw: 99_000,
    summary: "혼자 꾸준히 만드는 사람을 위한 자리.",
    credits: 300,
    images: 30,
    seats: 1,
    featured: true,
    features: [
      "무료 요금제에 있는 것 전부",
      "마켓 에셋 내려받기 제한 없음",
      "작업 순서 우선 처리",
      "1인 상업 라이선스 명시",
    ],
  },
  {
    id: "studio",
    name: "스튜디오",
    priceKrw: 29_000,
    annualKrw: 290_000,
    summary: "여럿이 같은 크레딧을 나눠 쓰는 팀을 위한 자리.",
    credits: 1_200,
    images: 100,
    seats: 3,
    features: [
      "메이커에 있는 것 전부",
      "팀이 함께 쓰는 크레딧",
      "상업 라이선스 서면 발급",
      "요청 시 결제·세금계산서 처리",
    ],
  },
];

/** 크레딧이 오가는 모든 경우. 숫자는 위 상수와 원장 코드에서만 옵니다. */
const USAGE = [
  { action: "가입", amount: `+${SIGNUP_GRANT_CREDITS}`, positive: true, detail: "계정을 만든 그 자리에서 한 번 들어옵니다." },
  { action: "매달 지급", amount: `+${BETA_MONTHLY_GRANT_CREDITS}`, positive: true, detail: "달이 바뀐 뒤 처음 접속할 때 자동으로 들어옵니다." },
  { action: "에셋 검사", amount: `−${CREDITS_PER_SUCCESSFUL_JOB}`, positive: false, detail: "올린 GLB·glTF 파일을 열어 폴리곤 수, 재질 수, 크기, 규격을 확인합니다." },
  { action: "안전 최적화", amount: `−${CREDITS_PER_SUCCESSFUL_JOB}`, positive: false, detail: "원본은 그대로 두고 정리한 새 파일을 만들어 다시 검사합니다." },
  { action: "2D 이미지 만들기", amount: `−${CREDITS_PER_SUCCESSFUL_JOB}`, positive: false, detail: "문장으로 PNG 한 장을 만듭니다." },
  { action: "3D·시트·클립 만들기", amount: `−${CREDITS_PER_SUCCESSFUL_JOB}`, positive: false, detail: "고른 템플릿으로 GLB, 스프라이트 시트, 애니메이션 클립을 만듭니다." },
  { action: "마켓 에셋 받기", amount: "0", positive: true, detail: "로그인만 하면 결제도 크레딧도 없이 받습니다." },
  { action: "실패·거부된 작업", amount: "0", positive: true, detail: "입력 오류, 모델 거부, 저장 실패는 끝나지 않은 작업이라 차감하지 않습니다." },
  { action: "같은 요청 두 번", amount: `합계 −${CREDITS_PER_SUCCESSFUL_JOB}`, positive: false, detail: "같은 요청을 다시 보내도 한 번만 처리하고 한 번만 셉니다." },
] as const;

/** 요금제 비교표. 각 행의 값은 PLANS 와 상수에서 계산합니다. */
const COMPARISON: { label: string; value: (plan: Plan) => string }[] = [
  { label: "월 요금", value: (p) => (p.priceKrw === null ? "가격 미정" : p.priceKrw === 0 ? "₩0" : `₩${p.priceKrw.toLocaleString("ko-KR")}`) },
  { label: "연 결제", value: (p) => (p.annualKrw === null ? "가격 미정" : p.annualKrw === 0 ? "없음" : `₩${p.annualKrw.toLocaleString("ko-KR")}`) },
  { label: "가입 크레딧", value: () => `${SIGNUP_GRANT_CREDITS}크레딧` },
  { label: "매달 크레딧", value: (p) => `${p.credits.toLocaleString("ko-KR")}크레딧` },
  { label: "이미지 생성 / 하루", value: (p) => `${p.images}장` },
  { label: "작업공간 자리", value: (p) => `${p.seats}자리` },
  { label: "성공한 실행 1건", value: () => `${CREDITS_PER_SUCCESSFUL_JOB}크레딧` },
  { label: "실패한 실행", value: () => "0크레딧" },
  { label: "마켓 에셋 내려받기", value: (p) => (p.id === "free" ? "로그인하면 무료" : "제한 없음") },
  { label: "AI 도구 연결(MCP)·API", value: () => "포함" },
  { label: "작업 순서 우선 처리", value: (p) => (p.id === "free" ? "—" : "포함") },
  { label: "상업 라이선스", value: (p) => (p.id === "studio" ? "서면 발급" : p.id === "maker" ? "1인 명시" : "허용") },
];

const FAQ = [
  {
    q: "결제 정보가 필요한가요?",
    a: "아니요. 지금은 결제 기능 자체가 없어서 카드 번호도, 계좌도 묻지 않습니다. Google이나 GitHub 계정으로 한 번 들어오면 그걸로 끝입니다.",
  },
  {
    q: "크레딧이 다 떨어지면 어떻게 되나요?",
    a: `달이 바뀐 뒤 처음 접속할 때 ${BETA_MONTHLY_GRANT_CREDITS}크레딧이 자동으로 다시 들어옵니다. 그 사이에도 마켓 에셋 내려받기, 3D 미리보기, 색 팔레트 보기는 크레딧 없이 그대로 쓸 수 있습니다.`,
  },
  {
    q: "마켓 에셋은 왜 무료인가요?",
    a: "결제 기능이 아직 붙지 않았기 때문입니다. 로그인하면 결제 없이 받습니다. 상품에 적힌 값은 결제를 시작한 뒤에 받을 값이고, 그전까지는 취소선으로만 보입니다.",
  },
  {
    q: "구독은 언제 시작하나요?",
    a: "결제 기능이 붙는 날 시작합니다. 날짜는 아직 정해지지 않았고, 시작 최소 30일 전에 이 페이지와 이메일로 먼저 알립니다.",
    href: "/terms",
    hrefLabel: "이용약관에서 이 약속 보기",
  },
  {
    q: "환불은 어떻게 되나요?",
    a: "유상 거래가 없으므로 지금 환불할 대상이 없습니다. 결제를 시작하면 디지털 콘텐츠 청약철회 기준이 그대로 적용됩니다.",
    href: "/refunds",
    hrefLabel: "취소·환불정책",
  },
] as const;

const won = (value: number) => `₩${value.toLocaleString("ko-KR")}`;

function PriceSlot({ priceKrw, period }: { priceKrw: number | null; period: string }) {
  if (priceKrw === null) return <strong className={styles.priceTbd}>가격 미정</strong>;
  return (
    <strong className={styles.price}>
      <span className={styles.priceNumber}>{won(priceKrw)}</span>
      <span className={styles.pricePeriod}>{period}</span>
    </strong>
  );
}

export default function PricingPage() {
  const salesOpen = areSalesOpen();
  const startHref = signUpPath("/studio?intent=create");

  return (
    <div className="cv5">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="pricing">
        <main className={styles.page}>
          {/* ---------------------------------------------------------------- header */}
          <header className={styles.head} data-snap-section="pricing-intro">
            <div className="cv5-frame">
              <h1 id="pricing-title">요금</h1>
              <p className={styles.lede}>
                {salesOpen
                  ? "크레딧 하나가 100원입니다. 검사와 만들기는 성공한 실행에만 1크레딧이 들고, 실패한 실행은 세지 않습니다."
                  : "지금은 결제 없이 모든 기능을 쓸 수 있습니다. 아래 구독과 크레딧 충전은 결제 기능이 붙는 날 시작합니다."}
              </p>
              <ul className={styles.headFacts}>
                <li>
                  <strong>{SIGNUP_GRANT_CREDITS}크레딧</strong>
                  <span>가입 즉시</span>
                </li>
                <li>
                  <strong>+{BETA_MONTHLY_GRANT_CREDITS}</strong>
                  <span>매달</span>
                </li>
                <li>
                  <strong>{WORKSPACE_IMAGES_PER_DAY}장</strong>
                  <span>이미지 / 하루</span>
                </li>
                <li>
                  <strong>{CREDITS_PER_SUCCESSFUL_JOB}크레딧</strong>
                  <span>성공한 실행 1건</span>
                </li>
              </ul>
            </div>
          </header>

          {/* ------------------------------------------------------------- 월정액 구독 */}
          <section className={styles.section} data-snap-section="pricing-plans" aria-labelledby="plans-title">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <h2 id="plans-title">월정액 구독</h2>
                <p>매달 크레딧이 들어오고, 남은 크레딧은 다음 달로 넘어가지 않습니다.</p>
              </div>
              <div className={styles.planGrid}>
                {PLANS.map((plan) => {
                  const isFree = plan.priceKrw === 0;
                  return (
                    <article
                      className={`${styles.plan}${plan.featured ? ` ${styles.planFeatured}` : ""}`}
                      key={plan.id}
                      aria-labelledby={`plan-${plan.id}`}
                    >
                      <div className={styles.planTop}>
                        <div className={styles.planNameRow}>
                          <h3 id={`plan-${plan.id}`} className={styles.planName}>{plan.name}</h3>
                          {plan.featured ? <span className={styles.planTag}>가장 많이 고릅니다</span> : null}
                        </div>
                        <PriceSlot priceKrw={plan.priceKrw} period={isFree ? "영구 무료" : "/ 월"} />
                        <p className={styles.planAnnual}>
                          {plan.annualKrw === null
                            ? "연 결제 가격 미정"
                            : plan.annualKrw === 0
                              ? "카드 없이 시작"
                              : `연 결제 ${won(plan.annualKrw)} · 열 달 값으로 열두 달`}
                        </p>
                        <p className={styles.planSummary}>{plan.summary}</p>
                      </div>

                      {/* 결제가 붙으면 이 버튼이 결제 화면으로 이어질 자리입니다. */}
                      {isFree ? (
                        <Link className={`${styles.planBtn} ${styles.planBtnPrimary}`} href={startHref}>
                          가입하고 시작하기 <Icon name="arrowUpRight" size={15} />
                        </Link>
                      ) : (
                        <button type="button" className={styles.planBtn} disabled aria-disabled="true">
                          결제 준비 중
                        </button>
                      )}

                      <ul className={styles.planList}>
                        <li className={styles.planListLead}>
                          매달 <b>{plan.credits.toLocaleString("ko-KR")}크레딧</b> · 이미지 하루 <b>{plan.images}장</b>
                        </li>
                        {plan.features.map((feature) => (
                          <li key={feature}>
                            <Icon name="check" size={14} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- 크레딧은 이렇게 씁니다 */}
          <section className={styles.section} data-snap-section="pricing-usage" aria-labelledby="usage-title">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <h2 id="usage-title">크레딧은 이렇게 씁니다</h2>
                <p>에셋을 받는 데는 크레딧이 들지 않습니다. 만들고 검사하는 데만 듭니다.</p>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.usageTable}>
                  <caption className={styles.srOnly}>작업별 크레딧 증감</caption>
                  <thead>
                    <tr>
                      <th scope="col">작업</th>
                      <th scope="col" className={styles.numCol}>크레딧</th>
                      <th scope="col">언제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {USAGE.map((row) => (
                      <tr key={row.action}>
                        <th scope="row">{row.action}</th>
                        <td className={styles.numCol}>
                          <span className={row.positive ? styles.amountUp : styles.amountDown}>{row.amount}</span>
                        </td>
                        <td>{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.tableFoot}>
                이미지 생성은 하루 {WORKSPACE_IMAGES_PER_DAY}장까지입니다. 한도에 닿으면 한국 시간으로 언제
                다시 열리는지 알려 드리고, 크레딧은 차감하지 않습니다.
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------------- 비교표 */}
          <section className={styles.section} data-snap-section="pricing-compare" aria-labelledby="compare-title">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <h2 id="compare-title">요금제 비교</h2>
                <p>같은 항목을 나란히 놓고 봅니다.</p>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.compareTable}>
                  <caption className={styles.srOnly}>요금제별 항목 비교</caption>
                  <thead>
                    <tr>
                      <th scope="col">항목</th>
                      {PLANS.map((plan) => (
                        <th scope="col" key={plan.id} className={plan.featured ? styles.compareFeatured : undefined}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {PLANS.map((plan) => (
                          <td key={plan.id} className={plan.featured ? styles.compareFeatured : undefined}>
                            {row.value(plan)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- FAQ */}
          <section className={styles.section} data-snap-section="pricing-faq" aria-labelledby="faq-title">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <h2 id="faq-title">자주 묻는 것</h2>
              </div>
              <dl className={styles.faq}>
                {FAQ.map((item) => (
                  <div className={styles.faqItem} key={item.q}>
                    <dt>{item.q}</dt>
                    <dd>
                      {item.a}
                      {"href" in item && item.href ? (
                        <>
                          {" "}
                          <Link className={styles.faqLink} href={item.href} prefetch={false}>
                            {item.hrefLabel} <Icon name="arrowRight" size={13} />
                          </Link>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ----------------------------------------------------------------- CTA */}
          <section className={styles.closer} data-snap-section="pricing-next" aria-labelledby="closer-title">
            <div className="cv5-frame">
              <div className={styles.closerBox}>
                <div>
                  <h2 id="closer-title">먼저 써 보고 정하세요</h2>
                  <p>
                    가입하면 {SIGNUP_GRANT_CREDITS}크레딧이 바로 들어오고, 매달 {BETA_MONTHLY_GRANT_CREDITS}크레딧이
                    더 들어옵니다. 결제 정보는 묻지 않습니다.
                  </p>
                </div>
                <div className={styles.closerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href={startHref}>
                    가입하고 시작하기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/marketplace">
                    에셋 먼저 보기 <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
