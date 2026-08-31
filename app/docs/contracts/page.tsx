import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import {
  ASSET_INSPECTION_EVIDENCE_V2_CONTRACT,
  FRAME_REVIEW_CONTRACT,
} from "../../components/product-facts";
import { DocsPageFrame } from "../DocsPageFrame";
import { EVIDENCE_EXAMPLE, FRAME_EXAMPLE } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("contracts");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 05 (#contracts) of the single-page docs. States are unchanged. */
export default function DocsContractsPage() {
  return (
    <DocsPageFrame id="contracts">
      <section className="dv5-section">
        <h2>네 개의 상태</h2>
        <div className="dv5-states" aria-label="계약과 상태">
          <div data-tone="pass">
            <span>STATIC</span>
            <strong>PASS</strong>
            <small>bytes · hash · policy</small>
          </div>
          <div data-tone="gap">
            <span>RUNTIME</span>
            <strong>GAP</strong>
            <small>shipped frame 필요</small>
          </div>
          <div data-tone="pending">
            <span>PLAYER</span>
            <strong>NOT_EVALUATED</strong>
            <small>실제 화면 전</small>
          </div>
          <div data-tone="pending">
            <span>HUMAN</span>
            <strong>PENDING</strong>
            <small>사람 판정 대기</small>
          </div>
        </div>
      </section>

      <section className="dv5-section">
        <h2>계약 JSON</h2>
        <details className="dv5-details">
          <summary>
            asset inspection evidence JSON <span>계약 예시 보기</span>
          </summary>
          <CodeBlock
            title="clunk.asset-inspection-evidence.v2"
            language="json"
            code={EVIDENCE_EXAMPLE}
            caption={`${ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.evidenceKind}; finding ownership을 보존합니다.`}
          />
        </details>
        <details className="dv5-details">
          <summary>
            shipped frame manifest JSON <span>runtime 입력 보기</span>
          </summary>
          <CodeBlock
            title="frame-manifest.v1"
            language="json"
            code={FRAME_EXAMPLE}
            caption={`${FRAME_REVIEW_CONTRACT.defaultBoundary}; renderer pair는 별도 제출합니다.`}
          />
        </details>
        <div className="dv5-note">
          <strong>기본 경계</strong>
          <span>reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED</span>
        </div>
      </section>
    </DocsPageFrame>
  );
}
