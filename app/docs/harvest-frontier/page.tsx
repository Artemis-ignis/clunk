import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import {
  COLLABORATION_CONTRACT,
  HF_HANDOFF_VERIFIER_STATUS,
  HF_M105_TRACTOR_INSPECTION,
} from "../../components/product-facts";
import { DocsPageFrame } from "../DocsPageFrame";
import { HF_EVIDENCE_RULES } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("harvest-frontier");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 06 (#harvest-frontier). Every received number is unchanged. */
export default function DocsHarvestFrontierPage() {
  return (
    <DocsPageFrame id="harvest-frontier">
      <section className="dv5-section">
        <h2>수신된 스냅샷</h2>
        <div className="dv5-states dv5-states-3">
          <div data-tone="pass">
            <span>STATIC INSPECTION</span>
            <strong>score 100 · hard blockers 0</strong>
            <small>tractor.compact.m1.glb · read-only</small>
          </div>
          <div>
            <span>OBSERVATIONS</span>
            <strong>88 draws · texture 0</strong>
            <small>missing normals 7 · UV 88 · non-unit scale 181</small>
          </div>
          <div data-tone="gap">
            <span>PLAYER REVIEW</span>
            <strong>NO_GO · GAP</strong>
            <small>정적 PASS는 화면 승인이 아님</small>
          </div>
        </div>
      </section>

      <section className="dv5-section">
        <h2>외부 handoff evidence</h2>
        <details className="dv5-details">
          <summary>
            HF tractor reinspection <span>외부 handoff 예시 보기</span>
          </summary>
          <CodeBlock
            title="canonical reinspection · received evidence"
            language="json"
            code={HF_M105_TRACTOR_INSPECTION}
            caption="HF 값은 외부 handoff이며 Clunk checkout에서 재검증하지 않았습니다."
          />
        </details>
        <details className="dv5-details">
          <summary>
            stale evidence와 fresh run <span>현재 승인과 구분하기</span>
          </summary>
          <CodeBlock
            title="freshness · stale vs error"
            language="json"
            code={HF_HANDOFF_VERIFIER_STATUS}
            caption="stale coverage는 current-artifact approval이 아닙니다."
          />
        </details>
        <details className="dv5-details">
          <summary>
            player-facing scene review <span>comparison과 human lane 보기</span>
          </summary>
          <CodeBlock
            title="player-facing scene review output"
            language="bash"
            code={HF_EVIDENCE_RULES}
            caption="comparison pair·asset provenance·human review를 합치지 않습니다."
          />
        </details>
        <p>
          협업 API는 {COLLABORATION_CONTRACT.evidenceWriteMode}, {COLLABORATION_CONTRACT.evidenceDefaults},{" "}
          {COLLABORATION_CONTRACT.evidenceOnlyApi}를 사용합니다.
        </p>
      </section>
    </DocsPageFrame>
  );
}
