import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import { SampleRunWorkbench } from "../components/SampleRunWorkbench";
import { SiteShell } from "../components/SiteShell";
import { AgentsClient } from "../agents/AgentsClient";
import { createPageMetadata } from "../components/site-metadata";
import { MCP_HTTP_TOOL_COUNT, MCP_SERVER } from "../components/product-facts";

export const metadata = createPageMetadata({
  title: "Clunk 연결",
  description: "공개 샘플을 먼저 확인하고, workspace 키와 MCP handshake를 실제로 연결하는 Clunk 진입점입니다.",
  path: "/connect",
});

export default function ConnectPage() {
  return (
    <SiteShell active="agents">
      <main className="connect-page">
        <header className="connect-hero public-hero-frame public-hero-connect">
          <div className="connect-hero-copy">
            <div className="hero-status-line"><span className="status-dot status-dot-on" /><span>OFFICIAL CONNECTION SURFACE</span><code>v{MCP_SERVER.version}</code></div>
            <span className="eyebrow">SAMPLE FIRST · CONNECT SECOND</span>
            <h1>결과를 먼저 보고,<br /><em>에이전트를 연결하세요.</em></h1>
            <p>공개 샘플은 바로 확인하고, 내 파일·workspace 이력은 로그인 뒤 이어집니다. HTTP는 로컬 경로를 읽지 않고 업로드된 bytes와 manifest만 받습니다.</p>
            <div className="connect-hero-actions">
              <a className="button button-primary" href="#connect">연결 설정 시작 <Icon name="chevronDown" size={15} /></a>
              <Link className="button button-quiet" href="/agents#connect">전체 에이전트 가이드 <Icon name="arrowRight" size={15} /></Link>
            </div>
            <div className="connect-proof"><span><b>{MCP_HTTP_TOOL_COUNT}</b> HTTP tools</span><span><b>initialize</b> → tools/list</span><span><b>0</b> local path reads</span></div>
          </div>
          <div className="connect-hero-console">
            <div className="connect-console-head"><span><i /> CLUNK ENDPOINT</span><code>/api/mcp</code></div>
            <McpEndpointStatus />
          </div>
        </header>

        <section className="connect-sample-section" aria-labelledby="connect-sample-heading">
          <div className="connect-section-heading">
            <div><span className="eyebrow">01 · SEE THE PRODUCT</span><h2 id="connect-sample-heading">파일 하나가<br /><em>근거 있는 결과가 되는 과정</em></h2></div>
            <p>이 결과는 <code>CONTRACT_FIXTURE</code>입니다. STATIC PASS가 runtime·player-facing·human PASS로 자동 승격되지 않는 경계를 직접 눌러 보세요.</p>
          </div>
          <SampleRunWorkbench compact />
        </section>

        <section className="connect-section" id="connect" aria-labelledby="connect-setup-heading">
          <div className="connect-section-heading">
            <div><span className="eyebrow">02 · CONNECT THE CLIENT</span><h2 id="connect-setup-heading">선택하고, 발급하고,<br /><em>실제 응답을 확인합니다.</em></h2></div>
            <p>클라이언트를 고른 뒤 키를 발급하고 설정을 복사합니다. 마지막 단계에서 <code>initialize</code>와 <code>tools/list</code>를 실제 호출해 성공·실패를 화면에 남깁니다.</p>
          </div>
          <AgentsClient />
        </section>

        <section className="connect-boundary" aria-label="연결과 검토의 경계">
          <div><span className="eyebrow">03 · KEEP THE REVIEW SEPARATE</span><h2>연결 PASS는<br /><em>게임 투입 승인이 아닙니다.</em></h2><p>연결은 서버가 응답했다는 증거입니다. 에셋의 구조·정책, shipped runtime, player-facing 화면, 사람의 결정은 각각 별도 상태로 유지합니다.</p></div>
          <div className="connect-boundary-grid"><div><span>STATIC</span><strong>PASS</strong><small>bytes · hash · policy</small></div><div><span>RUNTIME</span><strong>GAP</strong><small>shipped frame 필요</small></div><div><span>PLAYER</span><strong>NOT_EVALUATED</strong><small>실제 게임 화면 전</small></div><div><span>HUMAN</span><strong>PENDING</strong><small>사람 검토 대기</small></div></div>
        </section>
      </main>
    </SiteShell>
  );
}
