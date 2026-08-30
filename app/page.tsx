import Image from "next/image";
import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import { createPageMetadata } from "./components/site-metadata";
import { ASSET_KIND_COVERAGE, MARKETPLACE_CONTRACT } from "./components/product-facts";

export const metadata = createPageMetadata({
  title: "실제 에셋 마켓과 Clunk",
  description: "마스터가 올린 실제 게임 에셋은 마켓에서 구매하고, Clunk의 생성·검수·패키징 기능은 크레딧으로 사용합니다.",
  path: "/",
});

const WORKFLOW = [
  {
    number: "01",
    label: "PLAN",
    title: "프로젝트와 목표를 정합니다",
    detail: "프로젝트와 target profile을 정하고, 어떤 결과가 필요한지 작업면에 남깁니다.",
    surface: "Workspace",
  },
  {
    number: "02",
    label: "2D / 3D CREATE",
    title: "필요한 형식으로 설계합니다",
    detail: "2D 이미지와 3D GLB·glTF를 현재 authoring 표면에서 선택하고 실제 파일로 남깁니다.",
    surface: "Studio · authoring",
  },
  {
    number: "03",
    label: "SPRITE / RIG INSPECT",
    title: "스프라이트와 리깅을 연결합니다",
    detail: "Sprite Atlas와 Spine Rig의 page, region, bone, slot, attachment, animation 관계를 bundle로 관리합니다.",
    surface: "Sprite Lab · bundle",
  },
  {
    number: "04",
    label: "MOTION / UI",
    title: "모션과 UI를 확인합니다",
    detail: "glTF animation clip과 portrait UI readability를 실제 산출물과 렌더링 조건으로 검사합니다.",
    surface: "Motion Lab · UI contract",
  },
  {
    number: "05",
    label: "ENGINE / PLAY",
    title: "엔진과 플레이 결과를 확인합니다",
    detail: "연결된 엔진 타깃의 shipped frame, player-facing 상태, 사람의 결정을 따로 확인하고 미판정 상태는 승격하지 않습니다.",
    surface: "CONNECT · Game Ready",
  },
] as const;

const EVIDENCE_LANES = [
  {
    label: "REAL FILES",
    title: "실제 bytes와 provenance",
    detail: "생성·업로드 결과, 입력 hash, 파일 관계, 라이선스 출처를 분리해 남깁니다.",
  },
  {
    label: "QUALITY",
    title: "구조 검수와 재검사",
    detail: "Clunk Core 정책 결과와 fresh reinspection을 사용해 결과를 읽습니다.",
  },
  {
    label: "RUNTIME",
    title: "엔진·플레이어 화면",
    detail: "구조 결과가 플레이 가능한 결과를 대신하지 않도록 runtime과 player-facing 상태를 따로 둡니다.",
  },
  {
    label: "DELIVERY",
    title: "구매·다운로드 권한",
    detail: "마켓은 게시된 listing과 실제 결제·다운로드 계약이 확인된 범위만 열어 둡니다.",
  },
] as const;

export default function Home() {
  return (
    <div className="site-shell clunk-home">
      <SnapRoot />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav active="home" />

      <main id="main-content">
        <section className="clunk-home-section clunk-home-hero public-hero-frame" data-snap-section="hero" aria-labelledby="home-heading">
          <div className="clunk-home-frame">
            <div className="clunk-home-hero-topline">
              <span className="clunk-home-eyebrow">CLUNK / ASSET MARKET + CREDIT WORKSPACE</span>
              <span className="clunk-home-topline-note">2D + 3D · REAL FILES · HUMAN DECISION</span>
            </div>

            <div className="clunk-home-hero-layout">
              <div className="clunk-home-hero-copy">
                <h1 id="home-heading">필요한 에셋은 사고,<br /><em>Clunk는 크레딧으로.</em></h1>
                <p className="clunk-home-hero-lede">마스터가 직접 만든 실제 게임 에셋은 마켓에서 고르고 구매하세요. 직접 작업할 때는 크레딧으로 Clunk의 생성·검수·패키징 기능을 사용합니다.</p>

                <div className="clunk-home-entry-grid" aria-label="Clunk 시작 경로">
                  <Link className="clunk-home-entry-card clunk-home-entry-market" href="/marketplace" prefetch={false}>
                    <span className="clunk-home-entry-index">01 / ASSET MARKET</span>
                    <strong>마켓 둘러보기</strong>
                    <p>마스터가 올린 게시 상품을 실제 preview, 형식, 라이선스, 다운로드 상태와 함께 확인합니다.</p>
                    <span className="clunk-home-entry-footer">구매 가능한 listing 보기 <Icon name="arrowUpRight" size={15} /></span>
                  </Link>
                  <Link className="clunk-home-entry-card clunk-home-entry-use" href="/studio" prefetch={false}>
                    <span className="clunk-home-entry-index">02 / CREDIT WORKSPACE</span>
                    <strong>Clunk 사용하기</strong>
                    <p>로그인한 작업공간에서 크레딧으로 생성하고, 실제 artifact와 검수 근거를 이어갑니다.</p>
                    <span className="clunk-home-entry-footer">작업공간 열기 <Icon name="arrowUpRight" size={15} /></span>
                  </Link>
                </div>

                <p className="clunk-home-truth-note"><span aria-hidden="true" /> 마켓 상품은 실제 API의 게시 상태를 따릅니다. 상품이 없거나 결제가 연결되지 않은 상태를 임의로 채우지 않습니다.</p>
              </div>

              <figure className="clunk-home-asset-wall">
                <div className="clunk-home-asset-wall-head">
                  <span>PRODUCT FILE PREVIEWS</span>
                  <span>02 / 02</span>
                </div>
                <div className="clunk-home-asset-wall-grid">
                  <div className="clunk-home-asset-image clunk-home-asset-image-model">
                    <Image src="/landing/tractor-hero.png" alt="Clunk가 다루는 3D GLB 에셋 파일 미리보기" width={900} height={610} priority />
                    <span>3D / GLB</span>
                  </div>
                  <div className="clunk-home-asset-image clunk-home-asset-image-sprite">
                    <Image src="/samples/product-sprite/clunk-sprite-sample.png" alt="Clunk가 다루는 2D Sprite 파일 미리보기" width={512} height={512} />
                    <span>2D / SPRITE</span>
                  </div>
                </div>
                <figcaption>실제 제품 파일의 미리보기입니다. 판매 여부와 가격은 마켓의 게시 listing만 결정합니다.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="clunk-home-section clunk-home-catalogue" id="catalogue" data-snap-section="catalogue" aria-labelledby="catalogue-heading">
          <div className="clunk-home-frame">
            <header className="clunk-home-section-heading">
              <div>
                <span className="clunk-home-eyebrow">TWO WAYS INTO CLUNK</span>
                <h2 id="catalogue-heading">마스터의 상품과<br /><em>Clunk 작업이 분리되어 있습니다.</em></h2>
              </div>
              <p>구매하는 에셋과 크레딧으로 사용하는 제품 기능은 서로 다른 흐름입니다. 각각의 권한과 상태를 실제 서비스 계약에 맞춰 보여 줍니다.</p>
            </header>

            <div className="clunk-home-route-grid">
              <article className="clunk-home-route-card clunk-home-route-market">
                <div className="clunk-home-route-topline"><span>01</span><span>BUY / MASTER ASSETS</span></div>
                <div className="clunk-home-route-copy">
                  <h3>마켓에서 실제 에셋을 선택합니다</h3>
                  <p>마스터가 업로드한 파일 중 게시 조건을 충족한 listing만 공개됩니다. preview와 파일 형식, 라이선스, 다운로드 권한을 상품 단위로 확인합니다.</p>
                </div>
                <dl className="clunk-home-contract-list">
                  <div><dt>CATALOGUE</dt><dd>PUBLISHED listing only</dd></div>
                  <div><dt>DELIVERY</dt><dd>asset bytes + download permission</dd></div>
                  <div><dt>CONTRACT</dt><dd>{MARKETPLACE_CONTRACT.catalog}</dd></div>
                </dl>
                <Link className="clunk-home-text-link" href="/marketplace" prefetch={false}>마켓으로 이동 <Icon name="arrowRight" size={15} /></Link>
              </article>

              <article className="clunk-home-route-card clunk-home-route-workspace">
                <div className="clunk-home-route-topline"><span>02</span><span>USE / CLUNK CREDITS</span></div>
                <div className="clunk-home-route-copy">
                  <h3>크레딧으로 Clunk 제품을 사용합니다</h3>
                  <p>기획한 작업을 Studio에 넣고, 생성·변환·검수 결과를 실제 파일과 Passport로 이어갑니다. 성공한 실행만 비용으로 취급합니다.</p>
                </div>
                <ul className="clunk-home-bullet-list">
                  <li><span>CREATE</span> 프롬프트에서 별도 artifact bundle 생성</li>
                  <li><span>CHECK</span> bytes, hash, policy, target profile 검사</li>
                  <li><span>HANDOFF</span> Passport, MCP, CLI와 엔진 타깃 연결</li>
                </ul>
                <div className="clunk-home-route-actions">
                  <Link className="clunk-home-text-link" href="/studio" prefetch={false}>Clunk 사용 시작 <Icon name="arrowRight" size={15} /></Link>
                  <Link className="clunk-home-secondary-link" href="/pricing" prefetch={false}>크레딧 정책 보기</Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="clunk-home-section clunk-home-workflow" id="workflow" data-snap-section="workflow" aria-labelledby="workflow-heading">
          <div className="clunk-home-frame">
            <header className="clunk-home-section-heading">
              <div>
                <span className="clunk-home-eyebrow">FROM BRIEF TO PLAYABLE HANDOFF</span>
                <h2 id="workflow-heading">작업의 각 단계가<br /><em>다음 상태를 만듭니다.</em></h2>
              </div>
              <p>Clunk가 현재 제공하는 표면만 순서에 넣었습니다. 실행 화면과 사람의 결정은 구조 검사 결과와 섞지 않습니다.</p>
            </header>

            <ol className="clunk-home-workflow-list">
              {WORKFLOW.map((step) => (
                <li className="clunk-home-workflow-item" key={step.number}>
                  <div className="clunk-home-workflow-index"><span>{step.number}</span><i aria-hidden="true" /></div>
                  <div className="clunk-home-workflow-copy">
                    <span>{step.label}</span>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </div>
                  <code>{step.surface}</code>
                </li>
              ))}
            </ol>

            <div className="clunk-home-workflow-note">
              <Icon name="shield" size={17} />
              <p><strong>Game Ready는 하나의 숫자가 아닙니다.</strong> 실제 bytes·구조·runtime·player-facing·human review를 각각 확인한 뒤에야 다음 제품 상태로 넘어갑니다.</p>
            </div>
          </div>
        </section>

        <section className="clunk-home-section clunk-home-families" id="formats" data-snap-section="formats" aria-labelledby="formats-heading">
          <div className="clunk-home-frame">
            <header className="clunk-home-section-heading">
              <div>
                <span className="clunk-home-eyebrow">SUPPORTED ASSET FAMILIES</span>
                <h2 id="formats-heading">필요한 형식을 고르고,<br /><em>작업은 실제 파일로 남깁니다.</em></h2>
              </div>
              <p>현재 저장소의 authoring·inspection 계약이 정의한 형식입니다. 판매 상품 목록이 아니라 Clunk 작업 범위를 설명합니다.</p>
            </header>

            <div className="clunk-home-family-grid">
              {ASSET_KIND_COVERAGE.map((family, index) => (
                <article className="clunk-home-family-card" key={family.label}>
                  <div className="clunk-home-family-card-head"><span>0{index + 1}</span><Icon name={index === 0 ? "box" : index === 1 ? "image" : index === 2 ? "boxes" : index === 3 ? "binary" : "activity"} size={18} /></div>
                  <div className="clunk-home-family-mark" aria-hidden="true">{family.label.slice(0, 1)}</div>
                  <h3>{family.label === "Sprite" ? "Sprite / Atlas" : family.label}</h3>
                  <p>{family.detail}</p>
                  <span className="clunk-home-family-state">AUTHORING + INSPECTION CONTRACT</span>
                </article>
              ))}
            </div>

            <div className="clunk-home-family-footer">
              <p>마켓에서 상품을 찾는 중이라면 게시 listing을 확인하고, 직접 작업하려면 Studio에서 원하는 형식을 선택하세요.</p>
              <div>
                <Link className="clunk-home-text-link" href="/marketplace" prefetch={false}>상품 찾기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="clunk-home-secondary-link" href="/studio" prefetch={false}>Studio 열기</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="clunk-home-section clunk-home-evidence" id="evidence" data-snap-section="evidence" aria-labelledby="evidence-heading">
          <div className="clunk-home-frame">
            <header className="clunk-home-section-heading">
              <div>
                <span className="clunk-home-eyebrow">STATUS YOU CAN TRUST</span>
                <h2 id="evidence-heading">결과에 필요한 상태를<br /><em>숨기지 않습니다.</em></h2>
              </div>
              <p>기술적 결과를 사용자 승인처럼 꾸미지 않습니다. 실제 데이터가 아직 없는 곳은 비어 있거나 확인 필요 상태로 남습니다.</p>
            </header>

            <div className="clunk-home-evidence-grid">
              {EVIDENCE_LANES.map((lane, index) => (
                <article className="clunk-home-evidence-card" key={lane.label}>
                  <div className="clunk-home-evidence-card-top"><span>0{index + 1}</span><span>{lane.label}</span></div>
                  <h3>{lane.title}</h3>
                  <p>{lane.detail}</p>
                </article>
              ))}
            </div>

            <div className="clunk-home-evidence-footer">
              <span className="clunk-home-eyebrow">NO INVENTED STATE</span>
              <p>상품·결제·다운로드·크레딧 잔액은 각 계정과 API가 반환한 값으로만 표시합니다.</p>
              <Link className="clunk-home-text-link" href="/docs#contracts" prefetch={false}>계약 문서 읽기 <Icon name="arrowUpRight" size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="clunk-home-section clunk-home-final" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="clunk-home-frame clunk-home-final-frame">
            <div>
              <span className="clunk-home-eyebrow">CHOOSE YOUR PATH</span>
              <h2 id="start-heading">마켓에서 고르거나,<br /><em>크레딧으로 시작하세요.</em></h2>
              <p>마스터의 에셋을 구매하는 흐름과 Clunk 제품을 사용하는 흐름을 지금 바로 선택할 수 있습니다.</p>
            </div>
            <div className="clunk-home-final-actions">
              <Link className="clunk-home-final-button clunk-home-final-button-primary" href="/marketplace" prefetch={false}>마켓 둘러보기 <Icon name="arrowUpRight" size={16} /></Link>
              <Link className="clunk-home-final-button clunk-home-final-button-quiet" href="/studio" prefetch={false}>Clunk 사용하기 <Icon name="arrowUpRight" size={16} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="clunk-home-footer">
        <div className="clunk-home-frame clunk-home-footer-inner">
          <div><strong>Clunk</strong><span>실제 게임 에셋 마켓 · 크레딧 기반 AssetOps</span></div>
          <nav aria-label="Clunk 제품 링크">
            <Link href="/marketplace" prefetch={false}>마켓</Link>
            <Link href="/studio" prefetch={false}>Clunk 사용</Link>
            <Link href="/app" prefetch={false}>Game Ready</Link>
            <Link href="/connect" prefetch={false}>Developers</Link>
            <Link href="/pricing" prefetch={false}>크레딧</Link>
            <Link href="/docs" prefetch={false}>Docs</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
