import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";
import styles from "./marketplace.module.css";

export const metadata = createPageMetadata({
  title: "Discover · Clunk asset market",
  description: "마스터가 제작·업로드한 실제 게임 에셋을 탐색하고, 파일 근거·라이선스·구매 상태를 확인하는 Clunk 공개 마켓입니다.",
  path: "/marketplace",
});

export default function MarketplacePage() {
  return (
    <SiteShell active="marketplace">
      <main className={`marketplace-page foundry-discover-page ${styles.page}`}>
        <header className={`marketplace-hero public-hero-frame snap-section ${styles.hero}`} data-snap-section="hero">
          <div className="marketplace-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>MASTER CURATED CATALOG</span><code>REAL FILES ONLY</code></div>
            <span className="eyebrow">CLUNK MARKET · BUYER ENTRY</span>
            <h1>마스터가 올린 에셋을<br /><em>근거와 함께 고릅니다.</em></h1>
            <p>Clunk 공개 마켓은 마스터가 제작·업로드하고 공개한 실제 에셋만 보여 줍니다. 에셋은 구매하고, Clunk 제품 기능은 크레딧으로 사용합니다.</p>
            <div className="marketplace-hero-actions">
              <Link className="button button-primary" href="#catalog">구매 가능한 에셋 보기 <Icon name="arrowRight" size={15} /></Link>
              <Link className="button button-quiet" href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={15} /></Link>
            </div>
            <div className={`marketplace-hero-proof ${styles.heroProof}`}>
              <span><b>ONLY</b> published listings</span>
              <span><b>FILE</b> backed preview</span>
              <span><b>CREDITS</b> for Clunk</span>
            </div>
          </div>
          <div className={`marketplace-hero-art ${styles.heroArt}`}>
            <Image src="/landing/tractor-hero.png" alt="Clunk 작업 흐름에서 사용하는 실제 3D 에셋 미리보기" width={720} height={520} priority />
            <div className="marketplace-art-label"><span>CLUNK WORKBENCH VISUAL</span><strong>실제 에셋 작업의 기준</strong><small>카탈로그에는 API가 반환한 공개 상품만 표시됩니다.</small></div>
          </div>
        </header>

        <section id="catalog" className={`marketplace-section marketplace-catalog-section snap-section ${styles.catalogSection}`} data-snap-section="catalog" aria-labelledby="marketplace-catalog-heading">
          <div className="marketplace-section-heading">
            <div><span className="eyebrow">DISCOVER · PUBLIC CATALOG</span><h2 id="marketplace-catalog-heading">지금 구매할 수 있는<br /><em>실제 에셋</em></h2></div>
            <p>이 목록은 <code>/api/marketplace</code>가 PUBLISHED로 반환한 listing만 렌더링합니다. 등록된 파일의 미리보기, 형식, 라이선스, 가격과 결제 연결 상태를 상품별로 확인할 수 있습니다.</p>
          </div>
          <MarketplaceCatalog />
        </section>

        <section className={`marketplace-section marketplace-buyer-section snap-section ${styles.buyerSection}`} data-snap-section="use-clunk" aria-labelledby="marketplace-buyer-heading">
          <div className="marketplace-seller-copy">
            <span className="eyebrow">BUY ASSETS · USE CLUNK</span>
            <h2 id="marketplace-buyer-heading">에셋은 구매하고,<br /><em>Clunk는 크레딧으로 씁니다.</em></h2>
            <p>구매한 파일은 결제와 entitlement가 확인된 계정에 전달됩니다. Clunk의 생성·검사·Game Ready 기능은 별도 크레딧 정책에 따라 사용합니다.</p>
            <div className={styles.buyerActions}>
              <Link className="button button-primary button-sm" href="/app">Clunk 제품 열기 <Icon name="arrowUpRight" size={14} /></Link>
              <Link className="button button-quiet button-sm" href="/pricing">크레딧 보기 <Icon name="credit" size={14} /></Link>
            </div>
          </div>
          <div className={`marketplace-seller-steps ${styles.buyerSteps}`}>
            <article><span>01</span><strong>DISCOVER</strong><small>실제 preview와 파일 형식을 확인합니다.</small></article>
            <article><span>02</span><strong>BUY</strong><small>가격·라이선스와 결제 상태를 확인합니다.</small></article>
            <article><span>03</span><strong>RECEIVE</strong><small>권한이 확인된 계정에서 파일을 받습니다.</small></article>
            <article><span>04</span><strong>USE</strong><small>Clunk 제품 기능은 크레딧으로 사용합니다.</small></article>
          </div>
        </section>

        <section className={`marketplace-boundary snap-section ${styles.boundary}`} data-snap-section="catalog-policy" aria-label="공개 마켓 상품 표시 기준">
          <div><span className="eyebrow">PUBLIC CATALOG POLICY</span><h2>목록에는<br /><em>확인 가능한 정보만</em> 남깁니다.</h2></div>
          <div className="marketplace-boundary-grid">
            <div><span>LISTING</span><strong>PUBLISHED ONLY</strong><small>공개 API 응답에 있는 상품만 표시</small></div>
            <div><span>PREVIEW</span><strong>FILE BACKED</strong><small>등록된 preview artifact만 사용</small></div>
            <div><span>LICENSE</span><strong>DECLARED</strong><small>상품이 반환한 라이선스 상태 표시</small></div>
            <div><span>CHECKOUT</span><strong>LIVE STATUS</strong><small>결제 제공자 연결 상태를 숨기지 않음</small></div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
