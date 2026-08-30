import { createPageMetadata } from "../../components/site-metadata";
import { SiteShell } from "../../components/SiteShell";
import { MarketplaceListingDetail } from "../../components/MarketplaceCatalog";
import Link from "../../components/NativeLink";
import { Icon } from "../../components/Icon";
import styles from "../marketplace.module.css";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Discover · Asset detail",
  description: "Clunk 공개 에셋의 실제 preview, 파일 구성, 포맷, 라이선스, 가격과 구매 상태를 확인합니다.",
  path: "/marketplace",
});

export default async function MarketplaceListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <SiteShell active="marketplace">
      <main className={`marketplace-detail-page foundry-discover-page snap-section ${styles.detailPage}`} data-snap-section="listing-detail" data-listing-slug={slug}>
        <noscript>
          <section className={styles.noScriptRecovery} aria-labelledby="listing-not-found-heading">
            <span>CLUNK MARKET · LISTING LOOKUP</span>
            <h1 id="listing-not-found-heading">존재하지 않는 공개 listing입니다.</h1>
            <p>상품이 삭제되었거나 아직 공개되지 않았습니다. 마켓으로 돌아가 현재 구매 가능한 에셋을 확인해 주세요.</p>
            <Link className="button button-primary button-sm" href="/marketplace">마켓으로 돌아가기 <Icon name="arrowLeft" size={14} /></Link>
          </section>
        </noscript>
        <MarketplaceListingDetail slug={slug} />
        <section className={`marketplace-detail-buyer-guide snap-section ${styles.detailBuyerGuide}`} data-snap-section="detail-use" aria-labelledby="detail-buyer-heading">
          <div>
            <span className="eyebrow">BUY THE ASSET · USE CLUNK</span>
            <h2 id="detail-buyer-heading">파일은 구매하고,<br /><em>Clunk는 크레딧으로 사용합니다.</em></h2>
            <p>상품의 가격·라이선스·파일 상태는 위 API 결과를 기준으로 표시됩니다. 결제와 entitlement가 확인된 뒤에만 유료 artifact를 받을 수 있으며, 결제 미설정 상태는 PAYMENT_PROVIDER_NOT_CONFIGURED로 숨기지 않고 안내합니다.</p>
          </div>
          <div className={styles.detailBuyerActions}>
            <Link className="button button-primary button-sm" href="/marketplace">다른 에셋 둘러보기 <Icon name="arrowLeft" size={14} /></Link>
            <Link className="button button-quiet button-sm" href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={14} /></Link>
            <Link className="text-link" href="/pricing">크레딧 정책 보기 <Icon name="arrowRight" size={14} /></Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
