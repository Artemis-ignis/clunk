import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";

export const metadata = createPageMetadata({
  title: "Discover · Game Assets",
  description: "실제 에셋 preview, 검수 근거, 라이선스와 다운로드 상태를 함께 확인하는 Clunk 공개 카탈로그입니다.",
  path: "/marketplace",
});

export default function MarketplacePage() {
  return (
    <SiteShell active="marketplace">
      <main className="marketplace-page foundry-discover-page">
        <header className="marketplace-hero public-hero-frame">
          <div className="marketplace-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>VERIFIED ASSET MARKET</span><code>2D + 3D</code></div>
            <span className="eyebrow">DISCOVER · REVIEW · DISTRIBUTE</span>
            <h1>실제 에셋을 먼저 보고,<br /><em>근거와 함께 선택하세요.</em></h1>
            <p>Clunk Discover는 파일 preview, 버전, 라이선스, 검수 상태를 한 상품 페이지에 묶습니다. 구조 점수만으로 판매 승인이라고 부르지 않습니다.</p>
            <div className="marketplace-hero-actions">
              <Link className="button button-primary" href="/studio">Create an asset <Icon name="arrowUpRight" size={15} /></Link>
              <Link className="button button-quiet" href="/app">Game Ready 열기 <Icon name="arrowRight" size={15} /></Link>
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
            <div><span className="eyebrow">DISCOVER / PUBLIC CATALOGUE</span><h2 id="marketplace-catalog-heading">파일과 판정이<br /><em>한 카드에 남습니다.</em></h2></div>
            <p>실제 판매 상품은 모든 publication gate를 통과한 뒤에만 이곳에 노출됩니다. 아직 연결된 결제 제공자가 없으면 구매 버튼 대신 상태를 보여 줍니다.</p>
          </div>
          <MarketplaceCatalog />
        </section>

        <section className="marketplace-section marketplace-seller-section" aria-labelledby="marketplace-seller-heading">
          <div className="marketplace-seller-copy"><span className="eyebrow">FOR CREATORS · SHIP WITH PROOF</span><h2 id="marketplace-seller-heading">만든 결과를<br /><em>상품으로 닫는 순서</em></h2><p>Studio에서 결과를 만들고, 실제 bytes를 저장하고, 검사와 런타임 캡처를 연결한 다음 사람의 승인을 기록합니다. 그 전에는 Draft입니다.</p><Link className="text-link" href="/docs#asset-studio">판매 전 체크리스트 보기 <Icon name="arrowRight" size={14} /></Link></div>
          <div className="marketplace-seller-steps"><article><span>01</span><strong>CREATE</strong><small>실제 artifact와 prompt provenance</small></article><article><span>02</span><strong>PROVE</strong><small>static · runtime · player · human</small></article><article><span>03</span><strong>LIST</strong><small>license와 가격을 명시한 Draft</small></article><article><span>04</span><strong>SELL</strong><small>결제 제공자 연결 후 활성화</small></article></div>
        </section>

        <section className="marketplace-boundary" aria-label="마켓 판매 경계"><div><span className="eyebrow">NO SHORTCUTS</span><h2>점수 하나로<br /><em>상품을 승인하지 않습니다.</em></h2></div><div className="marketplace-boundary-grid"><div><span>STATIC</span><strong>PASS</strong><small>실제 바이트와 정책</small></div><div><span>RUNTIME</span><strong>GAP</strong><small>실제 renderer 증거 필요</small></div><div><span>HUMAN</span><strong>PENDING</strong><small>사람 결정 필요</small></div><div><span>CHECKOUT</span><strong>CONFIGURE</strong><small>결제 제공자 연결 필요</small></div></div></section>
      </main>
    </SiteShell>
  );
}
