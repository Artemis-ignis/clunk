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
  { index: "01", label: "고르기", detail: "삼각형 수와 용량을 보고 3D로 돌려 보세요." },
  { index: "02", label: "결제하기", detail: "크레딧으로 바로 결제합니다." },
  { index: "03", label: "받기", detail: "결제 즉시 파일을 내려받습니다." },
  { index: "04", label: "넣기", detail: "받은 GLB를 그대로 게임에 넣으세요." },
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
                    에셋 보기 <Icon name="arrowRight" size={16} />
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

              {/* The window of a shop shows what the shop sells. This is the real
                  render of a listing on this page, with that listing's own price
                  and measured triangle count — not a sample from elsewhere. */}
              <div aria-hidden="true">
                <div className={styles.heroPanel}>
                  <div className={styles.heroPanelHead}>
                    <span>코지 마켓 스톨</span>
                    <span>GLB · 210 KB</span>
                  </div>
                  <div className={styles.heroPanelArt}>
                    <Image
                      src="/api/marketplace/assets/asset-w1-cozy-market-stall?file=preview-cozy-market-stall.webp&preview=1"
                      alt=""
                      width={720}
                      height={520}
                      unoptimized
                      priority
                    />
                  </div>
                  <div className={styles.heroPanelFoot}>
                    <span>2,456 삼각형 · 드로우콜 31</span>
                    <b>₩6,900</b>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section id="catalog" className={styles.catalogSection} data-snap-section="catalog" aria-labelledby="marketplace-catalog-heading">
            <div className="cv5-frame">
              <div className={styles.sectionHead}>
                <span className="cv5-eyebrow">에셋 목록</span>
                <h2 id="marketplace-catalog-heading">
                  지금 받을 수 있는 <em>에셋</em>
                </h2>
                <p>삼각형 수, 용량, 라이선스를 상품마다 확인하세요.</p>
              </div>
              <MarketplaceCatalog />
            </div>
          </section>

          <section className={styles.buyerSection} data-snap-section="use-clunk" aria-labelledby="marketplace-buyer-heading">
            <div className={`cv5-frame ${styles.buyerGrid}`}>
              <div className="cv5-reveal">
                <div className={styles.sectionHead}>
                  <span className="cv5-eyebrow">받는 방법</span>
                  <h2 id="marketplace-buyer-heading">
                    에셋도 검사도,
                    <br />
                    <em>크레딧 하나로</em>
                  </h2>
                  <p>결제하면 바로 받습니다. 1 크레딧 = ₩100.</p>
                </div>
                <div className={styles.buyerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/app" prefetch={false}>
                    내 파일 검사하기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/pricing" prefetch={false}>
                    요금 보기 <Icon name="credit" size={16} />
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

        </main>
      </SiteShell>
    </div>
  );
}
