import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { createPageMetadata } from "../components/site-metadata";
import "./series-v5.css";
import { getClunkSeriesCatalog } from "../../packages/clunk-series/src/catalog";
import { getClunkSourceManifest } from "../../packages/clunk-series/src/source-manifest";

export const metadata = createPageMetadata({
  title: "Clunk 제품군",
  description: "Clunk가 갖춘 도구 여섯 가지 — 3D 모델·스프라이트 시트·2D 이미지·애니메이션 클립 만들기, 게임에 넣어도 되는지 검사, 그리고 에셋 마켓입니다.",
  path: "/series",
});

/**
 * 2026-09-02: the six cards printed the English product blurbs straight out of
 * packages/clunk-series/src/catalog.ts, a licence-audit chip per card, and one
 * link that said "작업면 열기" for four different jobs. A customer reading this
 * page needs to know what each one makes and where it opens. The audit trail is
 * still on the page - it is the ledger below, where it belongs.
 *
 * Every href here is a screen that exists: /studio reads ?make= and opens on
 * that job, /app is the inspector, /marketplace is the catalogue.
 */
const SERIES_CARDS: ReadonlyArray<{ id: string; title: string; description: string; href: string; action: string }> = [
  {
    id: "asset-forge",
    title: "3D 모델 만들기",
    // /studio는 GET /api/series/templates 가 준 템플릿 중에서 고르게 하고, POST /api/series 는
    // 템플릿을 지정하지 않은 요청을 거절합니다. 코드 파일을 올리는 화면은 없습니다.
    description: "만들 모양을 템플릿에서 고르면 GLB 파일이 나옵니다. 모양은 템플릿이 정하고, 어디서 왔는지와 파일 지문이 함께 기록됩니다.",
    href: "/studio?make=3d-model",
    action: "에셋 제작 열기",
  },
  {
    id: "sprite-lab",
    title: "스프라이트 시트 만들기",
    description: "3D 모델을 여러 방향에서 찍어 한 장으로 굽습니다. 칸 좌표와 프레임 정보가 함께 나오고, 규격이 맞는지 그 자리에서 검사합니다.",
    href: "/studio?make=sprite-atlas",
    action: "에셋 제작 열기",
  },
  {
    id: "material-lab",
    title: "2D 이미지 만들기",
    description: "원하는 그림을 문장으로 적으면 PNG 한 장이 나옵니다. 표면에 쓰는 이미지(색·거칠기·금속감·요철)도 같은 방식으로 만듭니다.",
    href: "/studio?make=2d-image",
    action: "에셋 제작 열기",
  },
  {
    id: "motion-lab",
    title: "애니메이션 클립 만들기",
    description: "이름 붙인 관절을 각도만큼 돌려 움직임을 만듭니다. 내 컴퓨터에 필요한 프로그램이 없으면 없다고 알려 드립니다.",
    href: "/studio?make=animation-clip",
    action: "에셋 제작 열기",
  },
  {
    id: "game-ready",
    title: "게임에 넣어도 되는지 검사",
    description: "파일 하나를 열어 파일 크기, 폴리곤 수, 재질 수, 크기, 규칙 위반을 한 번에 측정합니다. 결과는 숫자와 기준을 함께 보여 줍니다.",
    href: "/app",
    action: "에셋 검사 열기",
  },
  {
    id: "market",
    title: "에셋 마켓",
    description: "공개된 에셋을 둘러보고 받습니다. 라이선스와 지금 받을 수 있는지는 상품마다 표시합니다.",
    href: "/marketplace",
    action: "에셋 마켓 열기",
  },
];

/** 여섯 장 중 만들기 화면으로 가는 장의 수. 화면이 세는 것을 화면이 직접 셉니다. */
const makeCardCount = SERIES_CARDS.filter((card) => card.href.startsWith("/studio")).length;

export default function SeriesPage() {
  const catalog = getClunkSeriesCatalog();
  const sources = getClunkSourceManifest();

  return (
    /* cv5 chrome — the foundry warm-paper ramp this page renders against is
       remapped onto the navy palette by cv5-surface.css. */
    <div className="cv5 cv5-surface series-cv5">
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="series">
      <main className="series-page foundry-page">
        <header
          className="series-hero foundry-frame snap-section"
          data-snap-section="series-intro"
        >
          <div className="series-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>Clunk 제품군</span><code>2D + 3D</code></div>
            <span className="eyebrow">Clunk 내부 시리즈 · 만들기 · 검사 · 마켓</span>
            <h1>Clunk를 이루는<br /><em>여섯 가지 도구.</em></h1>
            <p>
              여섯 가지 도구가 모두 같은 규칙을 씁니다. 파일을 직접 열어 읽는 데서 시작해,
              검사 기록과 파일 지문을 남기는 데까지 이어집니다. 마켓에 올라온 에셋을 받아
              쓰거나, 로그인한 뒤 남은 실행 횟수 안에서 직접 만들 수 있습니다.
            </p>
            <div className="series-hero-actions">
              <a className="button button-primary" href="#series-catalog">제품군 둘러보기</a>
              <a className="button button-quiet" href="#source-ledger">가져다 쓴 공개 자료 보기</a>
            </div>
            <div className="series-hero-proof">
              <span>도구 <b>{catalog.length}</b>가지</span>
              <span>직접 만들 수 있는 갈래 <b>{makeCardCount}</b>가지</span>
              <span>공개 저장소 기록 <b>{sources.length}</b>건</span>
            </div>
          </div>
          <div className="series-hero-board" aria-label="Clunk 작업 흐름">
            <div className="series-board-topline"><span>작업 흐름</span><strong>한 제품 · 도구 {catalog.length}가지</strong></div>
            <div className="series-board-flow">
              <span>참고 자료</span><i>→</i><span>만들기</span><i>→</i><span>검사</span><i>→</i><span>마켓</span>
            </div>
            <div className="series-board-output"><span className="series-board-orbit" /><strong>Clunk</strong><small>진짜 파일 · 파일 지문 · 검사 증명서</small></div>
            <div className="series-board-note"><span>실행 방식</span><b>Clunk 안에서 직접 실행</b><small>2D 이미지 한 장을 그릴 때만 이미지 모델을 부릅니다</small></div>
          </div>
        </header>

        <section
          className="series-catalog-section foundry-frame snap-section"
          id="series-catalog"
          data-snap-section="series-catalog"
          aria-labelledby="series-catalog-heading"
        >
          <div className="series-section-heading">
            <div><span className="eyebrow">무엇을 할 수 있나요</span><h2 id="series-catalog-heading">여섯 도구가<br /><em>같은 규칙을 씁니다</em></h2></div>
            <p>
              만들기, 검사하기, 마켓에서 골라 받기 — 하는 일은 달라도
              출처 기록과 파일 지문, 검사 근거, 라이선스를 다루는 규칙은 모두 같습니다.
            </p>
          </div>
          <div className="series-grid" data-testid="clunk-series-catalog">
            {SERIES_CARDS.map((card) => (
              <article className={`series-card series-card-${card.id}`} key={card.id}>
                <div className="series-card-copy">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <div className="series-card-footer">
                  <Link className="text-link" href={card.href}>
                    {card.action}
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="series-source-section foundry-frame snap-section"
          id="source-ledger"
          data-snap-section="series-sources"
          aria-labelledby="source-ledger-heading"
        >
          <div className="series-section-heading series-source-heading">
            <div><span className="eyebrow">가져다 쓴 공개 자료</span><h2 id="source-ledger-heading">공개 자료는<br /><em>출처와 함께 적어 둡니다.</em></h2></div>
            <p>어떤 저장소를 어느 시점 기준으로 살펴봤는지, 라이선스가 무엇인지, Clunk가 실제로 쓰기로 했는지 아닌지를 그대로 적습니다.</p>
          </div>
          <div className="series-source-ledger">
            {sources.map((source) => (
              <article className={"series-source-row series-source-row-" + source.integration} key={source.id}>
                <div className="series-source-id"><span>{source.id}</span><strong>{source.integration === "excluded-license" ? "라이선스 문제로 사용 제외" : source.integration === "research-only" ? "살펴보기만 함 · 제품에는 미사용" : "Clunk가 실제로 채택"}</strong></div>
                <a href={source.repository} target="_blank" rel="noreferrer" className="series-source-repository">{source.repository}<span>{source.commit.slice(0, 12)}</span></a>
                <div className="series-source-license"><span>라이선스</span><strong>{source.license}</strong></div>
                <p>{source.notes}</p>
              </article>
            ))}
          </div>
          <div className="series-source-callout"><span className="mono-label">Clunk 규칙</span><strong>라이선스가 확인되지 않은 자료는 제품 코드와 에셋에 포함하지 않습니다.</strong><span>공개 저장소를 가져온 사실과 Clunk가 실제로 실행하는 코드는 분리해 기록합니다.</span></div>
        </section>
      </main>
      </SiteShell>
    </div>
  );
}
