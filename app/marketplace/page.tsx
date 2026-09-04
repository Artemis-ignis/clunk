import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "./marketplace.module.css";

// The sales lock is read from the runtime environment at request time, as on /pricing.
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "에셋 마켓",
  // 2026-09-03: 공개 카탈로그는 3D GLB 15개와 2D PNG 텍스처 8개(그리고 각 모델의 스프라이트
  // 시트 파생본)입니다. "3D 에셋"만 적으면 목록의 3분의 1이 문구에서 사라집니다.
  description: "Clunk가 직접 만든 가벼운 3D 모델과 이어붙는 2D 텍스처. 얼마나 무거운지 잰 값을 보고, 직접 돌리거나 이어 붙여 본 뒤 받으세요. 로그인만 하면 무료입니다.",
  path: "/marketplace",
});

/**
 * Public marketplace — cv5 unified restyle (2026-08-31). Same catalog contract
 * as before (published API rows only, honest empty/error states), rendered in
 * the master-approved cv5 system: deep-navy ground, glass cards, gradient CTAs.
 */

const BUYER_STEPS = (salesOpen: boolean) =>
  [
    { index: "01", label: "고르기", detail: "폴리곤 수와 파일 크기를 보고, 모델은 돌려 보고 텍스처는 이어 붙여 보세요." },
    { index: "02", label: "로그인하기", detail: salesOpen ? "무료 등급은 로그인만 하면 되고, 그 밖은 구독으로 열립니다." : "로그인만 하면 됩니다. 카드는 묻지 않습니다." },
    { index: "03", label: "받기", detail: "바로 파일을 내려받습니다." },
    { index: "04", label: "넣기", detail: "받은 파일(GLB 모델·PNG 텍스처)을 그대로 게임에 넣으세요." },
  ] as const;

export default function MarketplacePage() {
  const salesOpen = areSalesOpen();
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
                  <em>3D 모델과 2D 텍스처</em>
                </h1>
                <p className={styles.heroLede}>
                  얼마나 무거운지 잰 값과 용량을 보고, 모델은 돌려 보고 텍스처는 이어 붙여 본 뒤 받으세요.
                  {salesOpen ? "" : " 로그인만 하면 무료입니다."}
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
                  <span>{salesOpen ? <><b>구독</b> 전체 열림</> : <><b>로그인</b> 무료</>}</span>
                </div>
              </div>

              {/* The window of a shop shows what the shop sells. This is the real
                  render of a listing on this page, with that listing's own price
                  and measured triangle count — not a sample from elsewhere. */}
              <div aria-hidden="true">
                <div className={styles.heroPanel}>
                  <div className={styles.heroPanelHead}>
                    <span>시장 노점</span>
                    <span>GLB · 215 KB</span>
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
                    {/* cozy-market-stall, as app/data/listing-facts.json measured it. The draw
                        call this line used to state is an engine word a shopper cannot act on;
                        the material count replaced it on every buyer-facing surface. */}
                    <span>폴리곤 2,456개 · 재질 11개 · 실제 크기 2.44 m</span>
                    <b>무료</b>
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
                <p>얼마나 무거운지, 파일 크기는 얼마인지, 라이선스(어디까지 써도 되는지)를 상품마다 적어 두었습니다.</p>
              </div>
              <MarketplaceCatalog salesOpen={salesOpen} />
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
                    <em>계정 하나로</em>
                  </h2>
                  <p>{salesOpen ? "무료 등급은 로그인만 하면 받고, 그 밖은 구독으로 열립니다." : "로그인만 하면 마켓의 모든 에셋을 바로 받습니다."}</p>
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
                {BUYER_STEPS(salesOpen).map((step) => (
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
