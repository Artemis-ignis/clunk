import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import { SiteShell } from "../components/SiteShell";
import { MCP_HTTP_TOOL_COUNT, MCP_SERVER } from "../components/product-facts";
import { createPageMetadata } from "../components/site-metadata";

export const metadata = createPageMetadata({
  title: "MCP 연결",
  description: "Clunk HTTP MCP endpoint의 실제 상태와 연결 경계를 확인합니다.",
  path: "/mcp",
});

export default function McpPage() {
  return (
    <SiteShell active="agents">
      <main className="mcp-page">
        <section
          className="mcp-page-hero public-hero-frame public-hero-mcp snap-section"
          data-snap-section="mcp-intro"
        >
          <div className="mcp-page-copy">
            <span className="eyebrow">CLUNK HTTP MCP · v{MCP_SERVER.version}</span>
            <h1>개발 도구가<br /><em>Clunk를 호출합니다.</em></h1>
            <p>
              실제 MCP endpoint를 연결하면 Claude Code, Codex, Cursor와 같은 클라이언트가
              Clunk의 검사 계약과 상태 경계를 사용합니다. HTTP는 로컬 경로를 읽지 않고,
              업로드한 바이트와 검증된 evidence만 받습니다.
            </p>
            <div className="mcp-page-actions">
              <Link className="button button-primary" href="/agents#connect">연결 키 발급 <Icon name="arrowUpRight" size={15} /></Link>
              <Link className="button button-quiet" href="/docs#clients">설정 문서 <Icon name="arrowRight" size={15} /></Link>
            </div>
          </div>
          <div className="mcp-page-console" aria-label="Clunk MCP endpoint 상태">
            <div className="mcp-page-console-head"><span><i /> CLUNK ENDPOINT</span><code>/api/mcp</code></div>
            <McpEndpointStatus />
          </div>
        </section>

        <section className="mcp-page-steps snap-section" data-snap-section="mcp-connection" aria-label="MCP 연결 순서">
          <article><span>01</span><strong>Workspace 키를 발급합니다</strong><p>인증된 Workspace에서 workspace 범위의 Bearer key를 한 번 표시합니다.</p></article>
          <article><span>02</span><strong>클라이언트를 등록합니다</strong><p>실제 endpoint와 인증 헤더가 채워진 설정을 복사합니다.</p></article>
          <article><span>03</span><strong>initialize → tools/list</strong><p>handshake가 응답한 도구만 연결된 capability로 표시합니다.</p></article>
        </section>

        <section className="mcp-page-boundary snap-section" data-snap-section="mcp-boundary">
          <div>
            <span className="eyebrow">BOUNDARY</span>
            <h2>연결 응답은<br /><em>게임 투입 승인이 아닙니다.</em></h2>
            <p>
              HTTP MCP는 연결과 구조 evidence를 전달합니다. player-facing 캡처와 human
              decision은 별도 lane으로 남으며 자동으로 승격하지 않습니다.
            </p>
          </div>
          <div className="mcp-page-status-grid">
            <div><span>REMOTE TOOLS</span><strong>{MCP_HTTP_TOOL_COUNT}</strong><small>HTTPS · workspace Bearer</small></div>
            <div><span>LOCAL FILES</span><strong>stdio</strong><small>로컬 바이트는 local MCP에서만 읽음</small></div>
            <div><span>VISUAL REVIEW</span><strong>SEPARATE</strong><small>runtime/player/human 독립 상태</small></div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
