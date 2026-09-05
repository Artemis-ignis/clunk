import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublishedListingBySlug, type PublishedListingSummary } from "../../api/_lib/reads";
import { factsFor } from "../../api/_lib/listing-facts";
import { clipsFor } from "../../api/_lib/listing-variants";
import { gradeOf, isFreeGrade } from "../../components/catalog-facts";
import { createPageMetadata, SITE_ORIGIN } from "../../components/site-metadata";
import { SiteShell } from "../../components/SiteShell";
import { MarketplaceListingDetail } from "../../components/MarketplaceCatalog";
import Link from "../../components/NativeLink";
import { Icon } from "../../components/Icon";
import styles from "../marketplace.module.css";

export const dynamic = "force-dynamic";

/** 상품 행을 못 읽었을 때만 쓰는 일반 문구. 없는 이름을 지어내느니 이쪽이 낫다. */
const FALLBACK_DESCRIPTION =
  "미리보기와 파일 구성, 라이선스, 어느 게임 엔진에서 열리는지를 확인하고 받으세요.";

/**
 * A slug that is not a published listing used to answer 200 with a
 * client-rendered "존재하지 않는 listing" card (a soft 404 that search engines
 * and link checkers read as a real page). Verify on the server instead.
 */
/**
 * The listing as this page needs it server-side: enough to decide the 404 and to emit the
 * structured data. Storage being unavailable is not proof a listing is missing, so that
 * case reports found with no row and the client surfaces the real error.
 *
 * 2026-09-05: generateMetadata 와 페이지 본문이 같은 행을 필요로 한다. react cache 로
 * 감싸 두면 한 요청 안에서 D1 질의가 한 번만 나간다 — 제목을 제대로 붙이려고 상품마다
 * 조회를 두 배로 늘릴 이유는 없다.
 */
const readListing = cache(async (slug: string): Promise<{
  found: boolean;
  listing: PublishedListingSummary | null;
}> => {
  try {
    const listing = await readPublishedListingBySlug(slug);
    return { found: Boolean(listing), listing };
  } catch {
    // 저장소가 닿지 않는 것은 상품이 없다는 뜻이 아니다. 404 를 내지 않고 화면이
    // 실제 오류를 말하게 둔다.
    return { found: true, listing: null };
  }
});

/**
 * 검색 결과와 공유 카드에 실릴 한 줄. 상품 설명 앞부분을 문장 끝에서 자른다 —
 * 검색 결과가 잘라 보여 주는 길이가 대략 155자라 그 뒤는 어차피 "…"로 사라진다.
 */
function metaDescription(listing: PublishedListingSummary): string {
  const text = listing.description?.replace(/\s+/gu, " ").trim();
  if (!text) return FALLBACK_DESCRIPTION;
  if (text.length <= 155) return text;
  const head = text.slice(0, 155);
  // 한국어 서술문은 "…다." 로 끝난다. 문장 경계가 너무 앞이면(=한 문장이 통째로 긴
  // 경우) 그냥 낱말 경계에서 자르고 말줄임을 붙인다.
  const sentenceEnd = Math.max(head.lastIndexOf("다. "), head.lastIndexOf(". "));
  if (sentenceEnd >= 60) return head.slice(0, sentenceEnd + 2).trim();
  const wordEnd = head.lastIndexOf(" ");
  return `${(wordEnd >= 60 ? head.slice(0, wordEnd) : head).trim()}…`;
}

/**
 * 2026-09-05: 팔고 있는 상품 세 개(clunk-heli-h145 · hf-tractor-compact ·
 * tex-soil-tilled-v2)의 <title> 이 전부 "에셋 상세 | Clunk" 하나였다. 탭도, 북마크도,
 * 검색 결과도, 공유한 링크도 파는 물건마다 똑같은 글자를 보여 준다는 뜻이고 — 상품
 * 이름으로는 이 페이지에 닿을 방법이 없다는 뜻이다. 제목과 설명은 본문이 이미 읽고
 * 있는 그 행에서 그대로 가져온다. 새로 만드는 자료가 아니다.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { listing } = await readListing(slug);
  const path = `/marketplace/${encodeURIComponent(slug)}`;
  if (!listing) {
    return createPageMetadata({ title: "에셋 상세", description: FALLBACK_DESCRIPTION, path });
  }
  // 영어 이름은 제목에 붙이지 않는다. 탭에 보이는 글자는 스무 자 남짓이라 그 자리는
  // 한국어 이름이 먼저 가져가야 한다. 영어 이름은 본문과 구조화 데이터의
  // alternateName 에 이미 실려 있다.
  return createPageMetadata({ title: listing.title, description: metaDescription(listing), path });
}

/**
 * Product and BreadcrumbList for the listing. Thirty-three products were on sale with no
 * structured data at all, which keeps every one of them out of the search results that
 * carry a price. Only fields read from the row are emitted: an absent preview means no
 * image key rather than a guessed path.
 */
function structuredData(listing: PublishedListingSummary) {
  const url = `${SITE_ORIGIN}/marketplace/${encodeURIComponent(listing.slug)}`;
  const free = isFreeGrade(gradeOf({
    title: listing.title,
    description: listing.description,
    entryFileName: listing.entryFileName,
    variants: null,
    clips: clipsFor(listing.slug),
    facts: factsFor(listing.slug),
  }).letter);
  const image = listing.previewFileName
    ? `${SITE_ORIGIN}/api/marketplace/assets/${encodeURIComponent(listing.assetId)}`
      + `?file=${encodeURIComponent(listing.previewFileName)}&preview=1`
    : null;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      // 같은 물건을 영어로 찾는 사람에게도 이 페이지가 걸리게 한다.
      ...(listing.titleEn ? { alternateName: listing.titleEn } : {}),
      sku: listing.slug,
      description: listing.description,
      brand: { "@type": "Brand", name: "Clunk" },
      url,
      ...(image ? { image: [image] } : {}),
      // 2026-09-04: 낱개 가격을 검색엔진에 내보내던 자리다. 그 값(price_cents)은 아무도
      // 청구하지 않으므로 내보내면 거짓 표시가 된다. 무료 등급만 값이 0 인 제안을 싣고,
      // 구독으로 열리는 등급은 제안 자체를 적지 않는다 — 낱개로 파는 물건이 아니다.
      ...(free
        ? {
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "KRW",
              url,
              availability: "https://schema.org/InStock",
            },
          }
        : {}),
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
                <h1 id="listing-not-found-heading">지금은 열 수 없는 주소입니다.</h1>
                <p>상품이 내려갔거나 아직 공개되지 않았습니다. 마켓으로 돌아가 지금 받을 수 있는 에셋을 확인해 주세요.</p>
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
                    에셋은 계정에 남고,
                    <br />
                    <em>Clunk 기능은 실행 횟수로</em>
                  </h2>
                  <p>
                    한 번 받은 파일은 계정에 남아 언제든 다시 받을 수 있습니다. 검사·최적화 같은
                    Clunk 기능은 쓴 만큼 실행 횟수로 계산합니다.
                  </p>
                </div>
                <div className={styles.detailBuyerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/marketplace">다른 에셋 둘러보기 <Icon name="arrowLeft" size={15} /></Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/app">Clunk 제품 사용하기 <Icon name="arrowUpRight" size={15} /></Link>
                  <Link className={styles.textLink} href="/pricing">실행 횟수 정책 보기 <Icon name="arrowRight" size={14} /></Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
