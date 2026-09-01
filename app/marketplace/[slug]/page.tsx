import { notFound } from "next/navigation";
import { getRuntimeDb, ensureSchema } from "../../api/_lib/clunk";
import { createPageMetadata } from "../../components/site-metadata";
import { SiteShell } from "../../components/SiteShell";
import { ForceDarkTheme } from "../../components/ForceDarkTheme";
import { MarketplaceListingDetail } from "../../components/MarketplaceCatalog";
import Link from "../../components/NativeLink";
import { Icon } from "../../components/Icon";
import styles from "../marketplace.module.css";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "에셋 상세",
  description: "Clunk 공개 에셋의 실제 preview, 파일 구성, 포맷, 라이선스, 가격과 구매 상태를 확인합니다.",
  path: "/marketplace",
});

/**
 * A slug that is not a published listing used to answer 200 with a
 * client-rendered "존재하지 않는 listing" card (a soft 404 that search engines
 * and link checkers read as a real page). Verify on the server instead.
 */
async function isPublishedSlug(slug: string): Promise<boolean> {
  if (!/^[a-z0-9가-힣][a-z0-9가-힣-]{0,95}$/i.test(slug)) return false;
  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    const row = await db
      .prepare("SELECT 1 AS ok FROM clunk_marketplace_listings WHERE slug = ? AND status = 'PUBLISHED' LIMIT 1")
      .bind(slug)
      .first<{ ok: number }>();
    return Boolean(row?.ok);
  } catch {
    // Storage unavailable is not proof the listing is missing; let the client
    // surface the real error instead of claiming a 404.
    return true;
  }
}

export default async function MarketplaceListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await isPublishedSlug(slug))) notFound();
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="marketplace">
        <main className={`${styles.page} ${styles.detailPage}`} data-snap-section="listing-detail" data-listing-slug={slug}>
          <div className="cv5-frame">
            <noscript>
              <section className={styles.noScriptRecovery} aria-labelledby="listing-not-found-heading">
                <span>CLUNK MARKET</span>
                <h1 id="listing-not-found-heading">판매 중이 아닌 주소입니다.</h1>
                <p>상품이 삭제되었거나 아직 공개되지 않았습니다. 마켓으로 돌아가 현재 구매 가능한 에셋을 확인해 주세요.</p>
                <Link className="cv5-btn cv5-btn-ghost" href="/marketplace">마켓으로 돌아가기 <Icon name="arrowLeft" size={15} /></Link>
              </section>
            </noscript>
            <MarketplaceListingDetail slug={slug} />
          </div>
          <section className={styles.detailBuyerGuide} data-snap-section="detail-use" aria-labelledby="detail-buyer-heading">
            <div className="cv5-frame">
              <div className={styles.buyerGrid}>
                <div className={styles.sectionHead}>
                  <span className="cv5-eyebrow">구매 후</span>
                  <h2 id="detail-buyer-heading">
                    파일은 구매하고,
                    <br />
                    <em>Clunk는 크레딧으로 사용합니다</em>
                  </h2>
                  <p>
                    상품의 가격·라이선스·파일 상태는 위 API 결과를 기준으로 표시됩니다. 결제와
                    entitlement가 확인된 뒤에만 유료 artifact를 받을 수 있으며, 결제 미설정
                    상태는 PAYMENT_PROVIDER_NOT_CONFIGURED로 숨기지 않고 안내합니다.
                  </p>
                </div>
                <div className={styles.detailBuyerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/marketplace">다른 에셋 둘러보기 <Icon name="arrowLeft" size={15} /></Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={15} /></Link>
                  <Link className={styles.textLink} href="/pricing">크레딧 정책 보기 <Icon name="arrowRight" size={14} /></Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
