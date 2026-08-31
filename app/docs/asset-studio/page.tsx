import Link from "../../components/NativeLink";
import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import { DocsPageFrame } from "../DocsPageFrame";
import { CLUNK_SERIES_COMMANDS, STUDIO_COMMANDS } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("asset-studio");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 04 (#asset-studio) of the single-page docs. Facts unchanged. */
const STUDIO_FACTS = [
  {
    kicker: "2D",
    title: "Sprite · Atlas · Spine JSON",
    detail: "PNG page, region bounds, bones, slots, attachments, animation 이름과 atlas 관계를 검사합니다.",
  },
  {
    kicker: "3D",
    title: "Model · Mesh · Motion",
    detail: "GLB/GLTF 구조, 재질, bounds, animation sampler와 target node를 검사합니다.",
  },
  {
    kicker: "ENGINE",
    title: "Web · Godot · Unity · Unreal · Mobile",
    detail: "실제 runner가 없으면 import/runtime은 ENVIRONMENT_UNAVAILABLE로 남깁니다.",
  },
] as const;

export default function DocsAssetStudioPage() {
  return (
    <DocsPageFrame id="asset-studio">
      <section className="dv5-section">
        <h2>Clunk Series · Native</h2>
        <div className="dv5-cards dv5-cards-1">
          <article className="dv5-card">
            <span>CLUNK SERIES · NATIVE</span>
            <strong>Forge · Sprite · Material · Motion · Game Ready</strong>
            <p>
              GitHub 자료는 감사된 source material로만 기록하고, 실제 실행은 Clunk 내부 코드와 Core 계약으로
              수행합니다. <Link href="/series">여섯 시리즈와 소스 장부 보기</Link>
            </p>
          </article>
        </div>
        <details className="dv5-details">
          <summary>
            Game Ready mesh pass <span>별도 GLB · fresh evidence</span>
          </summary>
          <CodeBlock
            title="Clunk Series CLI"
            language="bash"
            code={CLUNK_SERIES_COMMANDS}
            caption="외부 생성 API를 호출하지 않으며, output과 evidence sidecar를 별도로 작성합니다."
          />
        </details>
      </section>

      <section className="dv5-section">
        <h2>검사 범위</h2>
        <div className="dv5-cards dv5-cards-3">
          {STUDIO_FACTS.map((item) => (
            <article className="dv5-card" key={item.kicker}>
              <span>{item.kicker}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
        <details className="dv5-details">
          <summary>
            Asset Studio 실행 명령 <span>Sprite · Spine · GLB · motion</span>
          </summary>
          <CodeBlock
            title="Asset Studio CLI"
            language="bash"
            code={STUDIO_COMMANDS}
            caption="별도 output을 작성하고 fresh reopen 후 AssetEvidence를 반환합니다."
          />
        </details>
        <div className="dv5-note">
          <strong>사용 제한</strong>
          <span>
            로컬 stdio의 clunk_asset_author와 CLI만 출력 파일을 작성합니다. 원격 HTTPS MCP는 로컬 경로를 읽거나 쓰지
            않고 업로드된 bundle만 검사합니다. .skel binary parser와 실제 엔진 playback은 아직 adapter/runner가
            필요하며, CONTRACT_FIXTURE나 structural PASS만으로 player-facing 승인을 만들지 않습니다.
          </span>
        </div>
      </section>
    </DocsPageFrame>
  );
}
