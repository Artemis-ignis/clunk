import { createPageMetadata } from "../../components/site-metadata";
import { SiteShell } from "../../components/SiteShell";
import { MarketplaceDetail } from "../../components/MarketplaceDetail";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "에셋 상품 상세",
  description: "Clunk 에셋의 파일 구성, 검수 근거, 라이선스와 구매 상태를 확인합니다.",
  path: "/marketplace",
});

export default async function MarketplaceListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <SiteShell active="marketplace">
      <main className="marketplace-detail-page">
        <MarketplaceDetail slug={slug} />
      </main>
    </SiteShell>
  );
}
