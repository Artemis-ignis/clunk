import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";
import styles from "./marketplace.module.css";

export const metadata = createPageMetadata({
  title: "에셋 마켓",
  description: "Clunk가 직접 만들어 파는 저폴리 3D 에셋. 삼각형 수와 용량을 확인하고 3D로 돌려 본 뒤 크레딧으로 받으세요.",
  path: "/marketplace",
});

/**
 * Public marketplace — cv5 unified restyle (2026-08-31). Same catalog contract
 * as before (published API rows only, honest empty/error states), rendered in
 * the master-approved cv5 system: deep-navy ground, glass cards, gradient CTAs.
 */

const BUYER_STEPS = [
  { index: "01", label: "DISCOVER", detail: "실제 preview와 파일 형식을 확인합니다." },
  { index: "02", label: "BUY", detail: "가격·라이선스와 결제 상태를 확인합니다." },
  { index: "03", label: "RECEIVE", detail: "권한이 확인된 계정에서 파일을 받습니다." },
  { index: "04", label: "USE", detail: "Clunk 제품 기능은 크레딧으로 사용합니다." },
] as const;

const CATALOG_POLICIES = [
  { label: "LISTING", value: "PUBLISHED ONLY", detail: "공개 API 응답에 있는 상품만 표시" },
  { label: "PREVIEW", value: "FILE BACKED", detail: "등록된 preview artifact만 사용" },
  { label: "LICENSE", value: "DECLARED", detail: "상품이 반환한 라이선스 상태 표시" },
  { label: "CHECKOUT", value: "LIVE STATUS", detail: "결제 제공자 연결 상태를 숨기지 않음" },
] as const;

export default function MarketplacePage() {
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="marketplace">
        <main className={styles.page}>
          <header className={styles.hero} data-snap-section="hero">
            <div className={`cv5-frame ${styles.heroGrid}`}>
              <div>
                <span className="cv5-badge">✦ Clunk가 <b>직접 만든 에셋</b></span>
                <h1>
                  게임에 바로 넣는
                  <br />
                  <em>저폴리 3D 에셋</em>
                </h1>
                <p className={styles.heroLede}>
                  삼각형 수와 용량을 보고, 3D로 돌려 본 뒤 받으세요.
                </p>
                <div className={styles.heroActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="#catalog">
                    구매 가능한 에셋 보기 <Icon name="arrowRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/app" prefetch={false}>
                    Clunk 제품 사용하기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                </div>
                <div className="cv5-flow" aria-label="공개 마켓 원칙">
                  <span><b>GLB</b> 즉시 사용</span>
                  <span><b>3D</b> 미리보기</span>
                  <span><b>크레딧</b> 결제</span>
                </div>
              </div>

              <div aria-hidden="true">
                <div className={styles.heroPanel}>
                  <div className={styles.heroPanelHead}>
                    <span>CLUNK <b>MARKET</b></span>
                    <span>REAL FILES · GLB</span>
                  </div>
                  <div className={styles.heroPanelArt}>
                    <Image src="/landing/tractor-hero.png" alt="" width={720} height={520} priority />
                  </div>
                  <div className={styles.heroPanelFoot}>
                    <span>실게임 납품 GLB 재검사</span>
                    <b>100/100 · 블로커 0</b>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section id="catalog" className={styles.catalogSection} data-snap-section="catalog" aria-labelledby="marketplace-catalog-heading">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <span className="cv5-eyebrow">DISCOVER · PUBLIC CATALOG</span>
                <h2 id="marketplace-catalog-heading">
                  지금 구매할 수 있는 <em>실제 에셋</em>
                </h2>
                <p>
                  이 목록은 <code>/api/marketplace</code>가 PUBLISHED로 반환한 listing만
                  렌더링합니다. 파일 미리보기, 형식, 라이선스, 가격과 결제 연결 상태를
                  상품별로 확인할 수 있습니다.
                </p>
              </div>
              <MarketplaceCatalog />
            </div>
          </section>

          <section className={styles.buyerSection} data-snap-section="use-clunk" aria-labelledby="marketplace-buyer-heading">
            <div className={`cv5-frame ${styles.buyerGrid}`}>
              <div className="cv5-reveal">
                <div className={styles.sectionHead}>
                  <span className="cv5-eyebrow">BUY ASSETS · USE CLUNK</span>
                  <h2 id="marketplace-buyer-heading">
                    에셋은 구매하고,
                    <br />
                    <em>Clunk는 크레딧으로 씁니다</em>
                  </h2>
                  <p>
                    구매한 파일은 결제와 entitlement가 확인된 계정에 전달됩니다. Clunk의
                    생성·검사·Game Ready 기능은 별도 크레딧 정책에 따라 사용합니다.
                  </p>
                </div>
                <div className={styles.buyerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/app" prefetch={false}>
                    Clunk 제품 열기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/pricing" prefetch={false}>
                    크레딧 보기 <Icon name="credit" size={16} />
                  </Link>
                </div>
              </div>
              <div className={`${styles.stepGrid} cv5-reveal`} data-delay="1">
                {BUYER_STEPS.map((step) => (
                  <article className={styles.step} key={step.index}>
                    <span>{step.index}</span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.boundary} data-snap-section="catalog-policy" aria-label="공개 마켓 상품 표시 기준">
            <div className="cv5-frame">
              <div className={`${styles.sectionHead} cv5-reveal`}>
                <span className="cv5-eyebrow">PUBLIC CATALOG POLICY</span>
                <h2>
                  목록에는 <em>확인 가능한 정보만</em> 남깁니다
                </h2>
              </div>
              <div className={`${styles.policyGrid} cv5-reveal`} data-delay="1">
                {CATALOG_POLICIES.map((policy) => (
                  <div className={styles.policyCard} key={policy.label}>
                    <span>{policy.label}</span>
                    <strong>{policy.value}</strong>
                    <small>{policy.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
