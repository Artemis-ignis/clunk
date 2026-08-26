import type { Metadata } from "next";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { AssetFamilyVisual } from "../components/AssetFamilyVisual";

export const metadata: Metadata = {
  title: "요금 안내",
  description: "월정액 플랜과 선불 크레딧 팩을 함께 쓰는 Clunk 요금 구조입니다. 지금은 데모 원장으로 동작합니다.",
};

/**
 * Pricing = subscription for the seat, credits for the runs.
 * 한국 결제 연동 전이므로 결제는 붙어 있지 않고, 유료 금액은 전부 "예정가(안)"으로 표기한다.
 * 크레딧 규칙(1 검사 = 1 크레딧, 성공 시에만 차감, 실패 복구)은 D1 데모 원장이 실제로
 * 수행하는 동작이다 — reasons: demo-grant / inspect / optimize / refund.
 */
const MONTHLY_PLANS = [
  {
    name: "Pilot",
    price: "무료",
    cycle: "지금 사용 가능 · 데모",
    included: "25",
    includedNote: "가입 시 데모 크레딧",
    detail: "혼자서 첫 에셋 파이프라인을 검증할 때",
    features: [
      "브라우저 로컬 GLB·GLTF 검사와 일괄 검사 큐",
      "버전이 있는 정책과 Game-Ready Score",
      "안전 최적화와 새 재검사, Passport 발급",
      "워크스페이스 이력과 크레딧 원장",
    ],
    cta: { label: "파일럿 시작", href: "/app", primary: true },
    active: true,
  },
  {
    name: "Team",
    price: "49,000원",
    cycle: "월 · 예정가(안)",
    included: "600",
    includedNote: "매월 포함 크레딧",
    detail: "반복 검사를 돌리는 소규모 팀",
    features: [
      "Pilot의 모든 기능",
      "팀 공유 이력과 커스텀 정책 프로파일",
      "CLI·MCP·VS Code 어댑터 경로",
      "크레딧 팩 추가 구매 할인",
    ],
    cta: { label: "출시 알림 받기", href: "/docs", primary: false },
    active: false,
  },
  {
    name: "Studio",
    price: "190,000원",
    cycle: "월 · 예정가(안)",
    included: "3,000",
    includedNote: "매월 포함 크레딧",
    detail: "CI에 게이트를 거는 스튜디오",
    features: [
      "Team의 모든 기능",
      "CI 파이프라인과 엔진별 정책",
      "서버 재검사 R2 경로와 감사 통제",
      "우선 지원과 온보딩",
    ],
    cta: { label: "출시 알림 받기", href: "/docs", primary: false },
    active: false,
  },
] as const;

const CREDIT_PACKS = [
  { amount: "+100", price: "15,000원", note: "스팟 검수. 구독 없이 선불로 시작" },
  { amount: "+500", price: "65,000원", note: "마일스톤 검수 몰아치기용" },
  { amount: "+2,000", price: "220,000원", note: "대규모 에셋 드롭 정리용" },
] as const;

export default function PricingPage() {
  return (
    <SiteShell active="pricing">
      <main className="page">
        <div className="pricing-hero-grid">
          <header className="page-head">
            <span className="eyebrow">요금 구조</span>
            <h1>
              자리는 월정액,
              <br />
              <em>실행은 크레딧.</em>
            </h1>
            <p className="lead">
              구독은 팀 자리와 정책, 이력을 담당하고, 검사와 최적화 실행은 크레딧으로 셉니다. 검사
              1회 = 크레딧 1개, 성공한 실행에만 차감되고 실패하면 자동 복구됩니다.
            </p>
          </header>
          <section className="pricing-execution-board" aria-label="크레딧 실행 흐름 미리보기">
            <div className="pricing-board-topline"><span><i /> RUN LEDGER</span><strong>DEMO / NO CHARGE</strong></div>
            <div className="pricing-board-visual"><AssetFamilyVisual kind="model" compact /><span className="pricing-board-stamp">UI PREVIEW · 실제 원장은 로그인 후</span></div>
            <div className="pricing-board-steps">
              <div className="is-complete"><span>01</span><strong>검사 시작</strong><small>차감 전 고지</small></div>
              <div className="is-complete"><span>02</span><strong>성공한 실행</strong><small>1 run = 1 credit</small></div>
              <div><span>03</span><strong>실패 복구</strong><small>0 credit · ledger 기록</small></div>
            </div>
          </section>
        </div>

        <div className="price-demo-strip">
          <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
          <p>
            한국 결제 연동 전이라 유료 금액은 전부 <strong>예정가(안)</strong>입니다. 지금 워크스페이스에서
            움직이는 크레딧은 실제로 동작하는 데모 원장이며 카드는 청구되지 않습니다.
          </p>
        </div>

        <section className="pricing-block" aria-label="월정액 플랜">
          <div className="pricing-block-head">
            <h2>월정액 플랜</h2>
            <p>매월 포함 크레딧이 함께 들어 있습니다. 파일럿은 지금 바로 무료로 쓸 수 있습니다.</p>
          </div>
          <div className="plan-grid">
            {MONTHLY_PLANS.map((plan) => (
              <article key={plan.name} className={`plan-card${plan.active ? " plan-card-active" : ""}`}>
                {plan.active ? <span className="plan-flag">지금 사용 가능</span> : null}
                <span className="mono-label">{plan.name}</span>
                <p className="plan-price">
                  {plan.price}
                  <small className="plan-cycle">{plan.cycle}</small>
                </p>
                <div className="plan-included">
                  <strong className="num">{plan.included}</strong>
                  <span>{plan.includedNote}</span>
                </div>
                <p className="plan-detail">{plan.detail}</p>
                <ul className="plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="check" size={14} strokeWidth={2.2} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.cta.href}
                  className={`button button-block ${plan.cta.primary ? "button-primary" : "button-quiet"}`}
                >
                  {plan.cta.label}
                  <Icon name="arrowUpRight" size={14} />
                </Link>
                {!plan.active ? <span className="plan-tier-note">국내 결제 연동 후 오픈 · 예정가(안)</span> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-block" aria-label="크레딧 팩">
          <div className="pricing-block-head">
            <h2>크레딧 팩</h2>
            <p>구독과 별개로 선불 충전합니다. 포함 크레딧을 다 쓴 달이나, 구독 없이 스팟으로 쓸 때.</p>
          </div>
          <div className="pack-grid">
            {CREDIT_PACKS.map((pack) => (
              <article key={pack.amount} className="pack-card">
                <p className="pack-amount">
                  {pack.amount}
                  <small>크레딧</small>
                </p>
                <p className="pack-price">{pack.price} · 예정가(안)</p>
                <p className="pack-note">{pack.note}</p>
                <Link href="/app" className="button button-quiet button-sm">
                  데모 원장에서 흐름 보기
                  <Icon name="arrowRight" size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-block" aria-label="크레딧 규칙">
          <div className="pricing-block-head">
            <h2>크레딧이 세는 것</h2>
            <p>모든 규칙은 지금 D1 데모 원장이 실제로 수행하는 동작입니다.</p>
          </div>
          <div className="pack-grid">
            <article className="pack-card">
              <p className="pack-amount">
                1<small>크레딧 / 검사</small>
              </p>
              <p className="pack-note">일괄 검사 큐도 같은 규칙입니다. 파일당 1개, 시작 전에 미리 고지합니다.</p>
            </article>
            <article className="pack-card">
              <p className="pack-amount">
                0<small>실패 시 차감</small>
              </p>
              <p className="pack-note">성공한 실행에만 차감합니다. 실패하면 원장에 복구 기록이 남습니다.</p>
            </article>
            <article className="pack-card">
              <p className="pack-amount">
                0<small>샘플 비용</small>
              </p>
              <p className="pack-note">데모 샘플 실행은 크레딧과 워크스페이스 이력에서 제외됩니다.</p>
            </article>
          </div>
        </section>

        <aside className="callout callout-warning">
          <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
          <p>
            결제 제공자는 연결하지 않았습니다. 로그인한 워크스페이스에서 업그레이드를 누르면 데모 크레딧만 늘어나고
            카드는 청구되지 않습니다. 실제 사업 단계에서는 분리해 둔 BillingProvider에 국내 결제 제공자를 붙입니다.
          </p>
        </aside>
      </main>
    </SiteShell>
  );
}
