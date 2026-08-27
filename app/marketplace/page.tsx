import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";

export const metadata = createPageMetadata({
  title: "에셋 마켓",
  description: "검수 근거와 라이선스를 함께 확인하고 Clunk 에셋을 배포하는 공개 카탈로그입니다.",
  path: "/marketplace",
});

export default function MarketplacePage() {
  return (
    <SiteShell active="marketplace">
      <main className="marketplace-page">
        <header className="marketplace-hero public-hero-frame">
          <div className="marketplace-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>VERIFIED ASSET MARKET</span><code>2D + 3D</code></div>
            <span className="eyebrow">MAKE · REVIEW · DISTRIBUTE</span>
            <h1>에셋만 보지 말고,<br /><em>근거까지 함께 보세요.</em></h1>
            <p>Clunk 마켓은 파일, 버전, 라이선스, 검수 상태를 한 상품 페이지에 묶습니다. 구조 점수만으로 판매 승인이라고 부르지 않습니다.</p>
            <div className="marketplace-hero-actions">
              <Link className="button button-primary" href="/studio">에셋 만들기 <Icon name="arrowUpRight" size={15} /></Link>
              <Link className="button button-quiet" href="/app">내 파일 검사 <Icon name="arrowRight" size={15} /></Link>
            </div>
            <div className="marketplace-hero-proof"><span><b>5</b> asset families</span><span><b>4</b> evidence lanes</span><span><b>0</b> auto approvals</span></div>
          </div>
          <div className="marketplace-hero-art">
            <Image src="/landing/tractor-hero.png" alt="Clunk가 검사하는 3D 트랙터 에셋" width={720} height={520} priority />
            <div className="marketplace-art-label"><span>CLUNK CORE SAMPLE</span><strong>실제 GLB 바이트</strong><small>CONTRACT_FIXTURE · 판매 불가</small></div>
          </div>
        </header>

        <section className="marketplace-section marketplace-catalog-section" aria-labelledby="marketplace-catalog-heading">
          <div className="marketplace-section-heading">
            <div><span className="eyebrow">PUBLIC CATALOGUE</span><h2 id="marketplace-catalog-heading">파일과 판정이<br /><em>한 카드에 남습니다.</em></h2></div>
            <p>실제 판매 상품은 모든 publication gate를 통과한 뒤에만 이곳에 노출됩니다. 아직 연결된 결제 제공자가 없으면 구매 버튼 대신 상태를 보여 줍니다.</p>
          </div>
          <MarketplaceCatalog />
        </section>

        <section className="marketplace-section marketplace-seller-section" aria-labelledby="marketplace-seller-heading">
          <div className="marketplace-seller-copy"><span className="eyebrow">FOR CREATORS</span><h2 id="marketplace-seller-heading">만든 결과를<br /><em>상품으로 닫는 순서</em></h2><p>Studio에서 결과를 만들고, 실제 bytes를 저장하고, 검사와 런타임 캡처를 연결한 다음 사람의 승인을 기록합니다. 그 전에는 Draft입니다.</p><Link className="text-link" href="/docs#asset-studio">판매 전 체크리스트 보기 <Icon name="arrowRight" size={14} /></Link></div>
          <div className="marketplace-seller-steps"><article><span>01</span><strong>CREATE</strong><small>실제 artifact와 prompt provenance</small></article><article><span>02</span><strong>PROVE</strong><small>static · runtime · player · human</small></article><article><span>03</span><strong>LIST</strong><small>license와 가격을 명시한 Draft</small></article><article><span>04</span><strong>SELL</strong><small>결제 제공자 연결 후 활성화</small></article></div>
        </section>

        <section className="marketplace-boundary" aria-label="마켓 판매 경계"><div><span className="eyebrow">NO SHORTCUTS</span><h2>점수 하나로<br /><em>상품을 승인하지 않습니다.</em></h2></div><div className="marketplace-boundary-grid"><div><span>STATIC</span><strong>PASS</strong><small>실제 바이트와 정책</small></div><div><span>RUNTIME</span><strong>GAP</strong><small>실제 renderer 증거 필요</small></div><div><span>HUMAN</span><strong>PENDING</strong><small>사람 결정 필요</small></div><div><span>CHECKOUT</span><strong>CONFIGURE</strong><small>결제 제공자 연결 필요</small></div></div></section>
      </main>
    </SiteShell>
  );
}
