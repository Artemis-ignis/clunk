import Link from "../../components/NativeLink";
import { CodeBlock } from "../../components/CodeBlock";
import { createPageMetadata } from "../../components/site-metadata";
import { MCP_CONFIG_SNIPPET } from "../../components/product-facts";
import { DocsPageFrame } from "../DocsPageFrame";
import { HTTP_SESSION } from "../docs-content";
import { docsRoute } from "../docs-nav";

const route = docsRoute("quickstart");

export const metadata = createPageMetadata({
  title: `${route.title} · 문서`,
  description: route.summary,
  path: route.href,
});

/** Was section 01 (#quickstart) of the single-page docs. Content unchanged. */
export default function DocsQuickstartPage() {
  return (
    <DocsPageFrame
      id="quickstart"
      lede={
        <>
          원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다.{" "}
          <Link href="/agents#connect">에이전트 연결 화면</Link>에서 키를 발급하면 클라이언트별 설정이 완성됩니다.
        </>
      }
    >
      <section className="dv5-section">
        <h2>설정 블록 복사</h2>
        <CodeBlock
          title="mcpServers"
          language="json"
          code={MCP_CONFIG_SNIPPET}
          caption="/connect에서 발급한 endpoint와 Bearer 키를 넣습니다."
        />
      </section>

      <section className="dv5-section">
        <h2>실제 연결 확인</h2>
        <details className="dv5-details">
          <summary>
            실제 handshake 예시 <span>initialize → tools/list 열기</span>
          </summary>
          <CodeBlock
            title="실제 연결 확인"
            language="bash"
            code={HTTP_SESSION}
            caption="설정 복사 뒤 실제 서버 응답을 확인합니다."
          />
        </details>
      </section>
    </DocsPageFrame>
  );
}
