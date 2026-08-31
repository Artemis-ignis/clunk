import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import { DocsPageFrame } from "../DocsPageFrame";
import { WEBMCP_EXAMPLE } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("webmcp");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 07 (#webmcp) of the single-page docs. Boundaries unchanged. */
export default function DocsWebMcpPage() {
  return (
    <DocsPageFrame id="webmcp">
      <section className="dv5-section">
        <h2>브라우저 WebMCP 경계</h2>
        <div className="dv5-cards dv5-cards-3">
          <article className="dv5-card">
            <span>HTTP MCP</span>
            <strong>/api/mcp</strong>
            <p>키 발급 후 initialize → tools/list를 실제 호출</p>
          </article>
          <article className="dv5-card">
            <span>WEBMCP</span>
            <strong>REGISTERED / UNAVAILABLE</strong>
            <p>브라우저 API 노출 여부를 라이브 상태로 표시</p>
          </article>
          <article className="dv5-card">
            <span>SAFETY BOUNDARY</span>
            <strong>READ-ONLY</strong>
            <p>structural PASS와 visualRuntime/GAP은 독립</p>
          </article>
        </div>
        <details className="dv5-details">
          <summary>
            document.modelContext 예시 <span>브라우저 도구 보기</span>
          </summary>
          <CodeBlock
            title="document.modelContext"
            language="bash"
            code={WEBMCP_EXAMPLE}
            caption="document.modelContext를 우선 확인하고 구형 호환 브라우저에서는 navigator.modelContext를 확인합니다."
          />
        </details>
      </section>
    </DocsPageFrame>
  );
}
