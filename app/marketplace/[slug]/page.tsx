import { notFound } from "next/navigation";
import { getRuntimeDb, ensureSchema } from "../../api/_lib/clunk";
import { createPageMetadata, SITE_ORIGIN } from "../../components/site-metadata";
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
/**
 * The listing as this page needs it server-side: enough to decide the 404 and to emit the
 * structured data. Storage being unavailable is not proof a listing is missing, so that
 * case reports found with no row and the client surfaces the real error.
 */
async function readListing(slug: string): Promise<{
  found: boolean;
  listing: {
    slug: string;
    title: string;
    description: string;
    priceCents: number;
    currency: string;
    assetId: string;
    previewFileName: string | null;
  } | null;
}> {
  if (!/^[a-z0-9가-힣][a-z0-9가-힣-]{0,95}$/i.test(slug)) return { found: false, listing: null };
  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT l.slug, l.title, l.description, l.price_cents AS priceCents, l.currency, l.asset_id AS assetId,
          (SELECT aa.file_name FROM clunk_asset_artifacts aa
             WHERE aa.asset_id = l.asset_id AND aa.role = 'preview' LIMIT 1) AS previewFileName
         FROM clunk_marketplace_listings l
         WHERE l.slug = ? AND l.status = 'PUBLISHED' LIMIT 1`,
      )
      .bind(slug)
      .first<{
        slug: string;
        title: string;
        description: string;
        priceCents: number;
        currency: string;
        assetId: string;
        previewFileName: string | null;
      }>();
    return { found: Boolean(row), listing: row ?? null };
  } catch {
    return { found: true, listing: null };
  }
}

/**
 * Product and BreadcrumbList for the listing. Thirty-three products were on sale with no
 * structured data at all, which keeps every one of them out of the search results that
 * carry a price. Only fields read from the row are emitted: an absent preview means no
 * image key rather than a guessed path.
 */
function structuredData(listing: NonNullable<Awaited<ReturnType<typeof readListing>>["listing"]>) {
  const url = `${SITE_ORIGIN}/marketplace/${encodeURIComponent(listing.slug)}`;
  const image = listing.previewFileName
    ? `${SITE_ORIGIN}/api/marketplace/assets/${encodeURIComponent(listing.assetId)}`
      + `?file=${encodeURIComponent(listing.previewFileName)}&preview=1`
    : null;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      sku: listing.slug,
      description: listing.description,
      brand: { "@type": "Brand", name: "Clunk" },
      url,
      ...(image ? { image: [image] } : {}),
      offers: {
        "@type": "Offer",
        price: (listing.priceCents / 100).toFixed(0),
        priceCurrency: /^[A-Z]{3}$/u.test(listing.currency) ? listing.currency : "KRW",
        url,
        // Sales open when the mail-order filing completes. Until then the listing is
        // browsable and the offer says so, rather than claiming it can be bought today.
        availability: "https://schema.org/PreOrder",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "에셋 마켓", item: `${SITE_ORIGIN}/marketplace` },
        { "@type": "ListItem", position: 2, name: listing.title, item: url },
      ],
    },
  ];
}

export default async function MarketplaceListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { found, listing } = await readListing(slug);
  if (!found) notFound();
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="marketplace">
        <main className={`${styles.page} ${styles.detailPage}`} data-snap-section="listing-detail" data-listing-slug={slug}>
          {listing
            ? structuredData(listing).map((block, index) => (
                <script
                  key={index}
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
                />
              ))
            : null}
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
                {/* This paragraph used to explain our API envelope, the word
                    "entitlement", and an error constant to a person who came here
                    to buy a 3D model. Nobody outside this repo speaks that way. */}
                <div className={styles.sectionHead}>
                  <h2 id="detail-buyer-heading">
                    에셋은 한 번 사고,
                    <br />
                    <em>Clunk 기능은 크레딧으로</em>
                  </h2>
                  <p>
                    산 파일은 계정에 남아 언제든 다시 받을 수 있습니다. 검사·최적화 같은
                    Clunk 기능은 쓴 만큼 크레딧으로 계산합니다.
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
