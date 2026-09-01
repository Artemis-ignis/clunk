import { ClunkSeriesCatalog } from "../components/ClunkSeriesCatalog";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { createPageMetadata } from "../components/site-metadata";
import "./series-v5.css";
import { getClunkSeriesCatalog } from "../../packages/clunk-series/src/catalog";
import { getClunkSourceManifest } from "../../packages/clunk-series/src/source-manifest";

export const metadata = createPageMetadata({
  title: "Clunk 제품군",
  description: "Clunk가 실제로 실행하는 2D와 3D 에셋 authoring, 검사, 패키징 제품군입니다.",
  path: "/series",
});

export default function SeriesPage() {
  const catalog = getClunkSeriesCatalog();
  const sources = getClunkSourceManifest();
  const nativeCount = catalog.filter((entry) => entry.availability === "native").length;

  return (
    /* cv5 chrome — the foundry warm-paper ramp this page renders against is
       remapped onto the navy palette by cv5-surface.css. */
    <div className="cv5 cv5-surface series-cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="series">
      <main className="series-page foundry-page">
        <header
          className="series-hero foundry-frame snap-section"
          data-snap-section="series-intro"
        >
          <div className="series-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>CLUNK SERIES · NATIVE BUILD</span><code>2D + 3D</code></div>
            <span className="eyebrow">Clunk 내부 시리즈</span>
            <span className="eyebrow">AUTHOR · INSPECT · PACKAGE · SHIP</span>
            <h1>Clunk가 만든<br /><em>실제 작업면.</em></h1>
            <p>
              Clunk 제품군은 파일 자체를 읽는 데서 시작해 검사, 근거,
              패키징 계약으로 연결합니다. 사용자는 공개 에셋을 구매하거나 인증된
              Workspace에서 Clunk 기능을 credit으로 사용합니다.
            </p>
            <div className="series-hero-actions">
              <a className="button button-primary" href="#series-catalog">제품군 둘러보기</a>
              <a className="button button-quiet" href="#source-ledger">소스 장부 보기</a>
            </div>
            <div className="series-hero-proof">
              <span><b>{catalog.length.toString().padStart(2, "0")}</b> product surfaces</span>
              <span><b>{nativeCount.toString().padStart(2, "0")}</b> native products</span>
              <span><b>{sources.length.toString().padStart(2, "0")}</b> source records</span>
            </div>
          </div>
          <div className="series-hero-board" aria-label="Clunk Series flow">
            <div className="series-board-topline"><span>CLUNK BUILD MAP</span><strong>ONE PRODUCT · {catalog.length} SURFACES</strong></div>
            <div className="series-board-flow">
              <span>REFERENCE</span><i>→</i><span>AUTHOR</span><i>→</i><span>INSPECT</span><i>→</i><span>PACKAGE</span>
            </div>
            <div className="series-board-output"><span className="series-board-orbit" /><strong>Clunk</strong><small>real bytes · hash · Passport</small></div>
            <div className="series-board-note"><span>RUNTIME BOUNDARY</span><b>내부 코드로 실행</b><small>외부 API 성공을 가장하지 않음</small></div>
          </div>
        </header>

        <section
          className="series-catalog-section foundry-frame snap-section"
          id="series-catalog"
          data-snap-section="series-catalog"
          aria-labelledby="series-catalog-heading"
        >
          <div className="series-section-heading">
            <div><span className="eyebrow">THE CLUNK PRODUCT FAMILY</span><h2 id="series-catalog-heading">Clunk가 만든 제품군,<br /><em>각자의 작업면</em></h2></div>
            <p>
              catalog의 각 항목은 실제 코드에 등록된 제품입니다. authoring, inspection,
              packaging, market surface가 같은 provenance, hash, evidence, license 규칙을 공유합니다.
            </p>
          </div>
          <ClunkSeriesCatalog catalog={catalog} sources={sources} />
        </section>

        <section
          className="series-source-section foundry-frame snap-section"
          id="source-ledger"
          data-snap-section="series-sources"
          aria-labelledby="source-ledger-heading"
        >
          <div className="series-section-heading series-source-heading">
            <div><span className="eyebrow">SOURCE TRANSPARENCY</span><h2 id="source-ledger-heading">깃허브 자료는<br /><em>장부와 함께 들어옵니다.</em></h2></div>
            <p>각 항목은 감사한 저장소, 고정 커밋, 라이선스 상태, Clunk에서의 사용 결정을 기록합니다. 실행 시점에는 이 장부와 Clunk 계약이 기준입니다.</p>
          </div>
          <div className="series-source-ledger">
            {sources.map((source) => (
              <article className={"series-source-row series-source-row-" + source.integration} key={source.id}>
                <div className="series-source-id"><span>{source.id}</span><strong>{source.integration === "excluded-license" ? "사용 제외 · EXCLUDED LICENSE" : source.integration === "research-only" ? "연구 전용 · RESEARCH ONLY" : "Clunk 내부 채택"}</strong></div>
                <a href={source.repository} target="_blank" rel="noreferrer" className="series-source-repository">{source.repository}<span>{source.commit.slice(0, 12)}</span></a>
                <div className="series-source-license"><span>LICENSE</span><strong>{source.license}</strong></div>
                <p>{source.notes}</p>
              </article>
            ))}
          </div>
          <div className="series-source-callout"><span className="mono-label">CLUNK RULE · clunk-series-native-v1</span><strong>라이선스가 확인되지 않은 자료는 제품 코드와 에셋에 포함하지 않습니다.</strong><span>공개 저장소를 가져온 사실과 Clunk가 실제로 실행하는 코드는 분리해 기록합니다.</span></div>
        </section>
      </main>
      </SiteShell>
    </div>
  );
}
