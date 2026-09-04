import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { signUpPath } from "../auth";
import { BETA_MONTHLY_GRANT_CREDITS } from "../api/_lib/clunk";
import { GRADE_RULE } from "../components/catalog-facts";
import { WORKSPACE_IMAGES_PER_DAY } from "../api/_lib/ai-budget";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "./pricing.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "요금",
  description:
    "Clunk 요금. 무료 등급 에셋은 로그인만 하면 받고, 구독하면 전체 카탈로그를 횟수 제한 없이 받습니다. 구독을 끊어도 받은 파일은 그대로 남습니다.",
  path: "/pricing",
});

/**
 * /pricing — one grid of plan cards, one usage table, one comparison table, an FAQ,
 * a closing door. No glow headline, no status chips.
 *
 * 이 화면이 파는 것은 구독 하나다. 낱개 판매와 크레딧 충전은 결제대행 심사에서
 * 환금성으로 걸려 없앴다(2026-09-04). 무료 등급은 로그인만 하면 받고, 구독은
 * 기간 동안 전체 카탈로그를 연다.
 *
 * TRUTH RULES FOR THIS PAGE
 * 1. Every number a visitor reads comes from one of two places and nowhere else:
 *    - the constants the product actually enforces (imported below), or
 *    - the PLANS table in this file.
 *    Nothing is typed inline in JSX. When the operator changes a price, they change
 *    PLANS and the whole page follows.
 * 2. `priceKrw: null` is the honest slot for a number that does not exist yet — it
 *    renders "가격 미정" and the card's button is disabled. Dropping a real number in
 *    later needs no layout work.
 * 3. There is no payment rail on this deployment (app/api/_lib/sales-lock.ts). Every
 *    paid button therefore says 결제 준비 중 and is disabled. We never render a button
 *    that cannot do what it says.
 */

/** 성공한 실행 한 번에 세는 수. Source of truth: `amount: -1` in
 *  app/api/runs/route.ts, app/api/generation/route.ts, app/api/optimizations/route.ts,
 *  app/api/providers/run/route.ts, and app/api/series/route.ts — plus the published
 *  contract in app/api/_lib/access.ts (`costs: { generate: 1, inspect: 1 }`). */
const RUNS_PER_SUCCESSFUL_JOB = 1;

type Plan = {
  id: string;
  name: string;
  /** ₩/월. null = 아직 정해지지 않음 → "가격 미정" + 비활성 버튼. */
  priceKrw: number | null;
  /** ₩/년. null = 연 결제 없음 또는 미정. */
  annualKrw: number | null;
  summary: string;
  /** 매달 쓸 수 있는 실행 횟수. */
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
 *
 * 파는 것은 기간 접근권입니다. 무료 등급 에셋은 로그인만 하면 받고, 구독하면
 * 구독이 살아 있는 동안 전체 카탈로그를 제한 없이 받습니다. 낱개로 사는 길은
 * 없습니다.
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
      "B등급 에셋 전부 — 폴리곤 1,500개 미만이고 움직이는 동작이 없는 것",
      "3D 뷰어·색 팔레트·파일 검사",
      "AI 도구 연결(MCP)과 API",
      "받은 에셋은 상업적으로 써도 됩니다",
      `만들기·검사는 매달 ${BETA_MONTHLY_GRANT_CREDITS}회, 이미지는 하루 ${WORKSPACE_IMAGES_PER_DAY}장까지`,
    ],
  },
  {
    id: "pro",
    name: "구독",
    priceKrw: 9_900,
    annualKrw: 99_000,
    summary: "마켓 전체를 여는 자리. 하나씩 사는 길은 없습니다.",
    credits: 300,
    images: 30,
    seats: 1,
    featured: true,
    features: [
      "A·S 등급까지 전체 카탈로그 — 내려받기 제한 없음",
      "앞으로 올라오는 에셋도 그대로 포함",
      "구독을 끊어도 받은 파일은 계정에 그대로 남습니다",
      "무료에 있는 것 전부",
      "만들기·검사 매달 300회, 이미지 하루 30장",
    ],
  },
];

/** 요금제 비교표. 각 행의 값은 PLANS 와 상수에서 계산합니다. */
const COMPARISON: { label: string; value: (plan: Plan) => string }[] = [
  { label: "월 요금", value: (p) => (p.priceKrw === null ? "가격 미정" : p.priceKrw === 0 ? "₩0" : `₩${p.priceKrw.toLocaleString("ko-KR")}`) },
  { label: "연 결제", value: (p) => (p.annualKrw === null ? "가격 미정" : p.annualKrw === 0 ? "없음" : `₩${p.annualKrw.toLocaleString("ko-KR")}`) },
  { label: "받을 수 있는 에셋", value: (p) => (p.id === "free" ? "B등급" : "전체 (B·A·S)") },
  { label: "내려받기 횟수", value: () => "제한 없음" },
  { label: "받은 파일", value: () => "계정에 영구 보관" },
  { label: "상업적 이용", value: () => "허용" },
  { label: "AI 도구 연결(MCP)·API", value: () => "포함" },
  { label: "만들기·검사 / 달", value: (p) => `${p.credits.toLocaleString("ko-KR")}회` },
  { label: "이미지 생성 / 하루", value: (p) => `${p.images}장` },
];

const FAQ = [
  {
    q: "결제 정보가 필요한가요?",
    a: "아니요. 카드 번호도 계좌도 묻지 않습니다. Google이나 GitHub 계정으로 한 번 들어오면 그걸로 끝입니다.",
  },
  {
    q: "무료와 구독은 무엇이 다른가요?",
    a: "받을 수 있는 에셋이 다릅니다. B등급은 로그인만 하면 받고, A·S 등급은 구독으로 열립니다. 등급은 폴리곤 수와 움직이는 동작이 있는지로 정해지고, 그 기준은 상품 카드에 그대로 적혀 있습니다.",
    href: "/marketplace",
    hrefLabel: "마켓에서 등급 보기",
  },
  {
    q: "에셋을 하나만 살 수는 없나요?",
    a: `없습니다. 파는 것은 기간 구독 하나이고, 에셋마다 값이 붙어 있지 않습니다. 만들기와 검사는 무료가 매달 ${BETA_MONTHLY_GRANT_CREDITS}회, 구독이 300회이며 실패한 작업은 세지 않습니다.`,
  },
  {
    q: "지금 마켓에서 무엇을 받을 수 있나요?",
    a: "로그인하면 전부 받습니다. 등급 제한은 지금 걸리지 않습니다. 위에 적힌 값은 구독이 시작되면 적용될 값입니다.",
  },
  {
    q: "구독은 언제 시작하나요?",
    a: "날짜는 아직 정해지지 않았습니다. 시작 최소 30일 전에 이 페이지와 이메일로 먼저 알려 드립니다. 그때까지 받은 파일은 그대로 두셔도 됩니다.",
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
                  ? "무료와 구독 둘뿐입니다. 에셋을 하나씩 사는 길은 없습니다."
                  : "지금은 로그인만 하면 마켓의 모든 에셋이 열립니다. 아래는 구독이 시작되면 적용될 값입니다."}
              </p>
              {/* 무료의 기준을 숫자로 적는다. 카드에 붙은 등급과 같은 규칙이라 방문자가
                  마켓에서 바로 확인할 수 있다 — 규칙을 숨긴 무료는 미끼로 읽힌다. */}
              <p className={styles.headRule}>{GRADE_RULE}</p>
            </div>
          </header>

          {/* ------------------------------------------------------------- 월정액 구독 */}
          <section className={styles.section} data-snap-section="pricing-plans" aria-labelledby="plans-title">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <h2 id="plans-title">무료로 시작하고, 필요하면 구독합니다</h2>
                <p>구독은 마켓 전체를 여는 한 장이고, 받은 파일은 구독을 끊어도 계정에 남습니다.</p>
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

                      {/* 결제가 열리면 유료 플랜의 이 버튼이 결제 화면으로 이어집니다. 그전까지는
                          어느 플랜을 눌러도 할 수 있는 일이 같으므로(로그인하면 전부 받는다) 같은
                          문을 엽니다. 눌리지 않는 버튼은 방문자에게 고장으로 읽힙니다. */}
                      <Link className={`${styles.planBtn} ${isFree ? styles.planBtnPrimary : ""}`} href={startHref}>
                        가입하고 시작하기 <Icon name="arrowUpRight" size={15} />
                      </Link>

                      <ul className={styles.planList}>
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
                    지금은 로그인만 하면 마켓의 모든 에셋이 열립니다. 결제 정보는 묻지 않습니다.
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
