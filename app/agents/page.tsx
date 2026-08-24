import type { Metadata } from "next";
import { SiteShell } from "../components/SiteShell";
import { AgentsClient } from "./AgentsClient";
import { MCP_SERVER, MCP_TOOLS, RULE_SET, SURFACES } from "../components/product-facts";

export const metadata: Metadata = {
  title: "에이전트 연결",
  description: "Claude Code, Codex, Cursor, Claude Desktop, VS Code와 Clunk를 연결하는 실제 MCP 설정입니다.",
};

export default function AgentsPage() {
  return (
    <SiteShell active="agents">
      <main className="agents-page">
        <section className="agents-hero">
          <div className="agents-hero-copy">
            <span className="eyebrow">CONNECT IT · MCP</span>
            <h1>
              에이전트가 만든 GLB를
              <em>Clunk의 판정으로 넘기세요.</em>
            </h1>
            <p className="lead">
              Clunk는 현재 Windows stdio MCP 서버로 동작합니다. 클라이언트별 설정은 달라도 호출하는
              Core와 남는 근거는 같습니다.
            </p>
            <div className="agents-hero-actions">
              <a className="button button-primary" href="#connect">
                연결 설정 보기
                <span aria-hidden="true">↘</span>
              </a>
              <a className="button button-quiet" href="/docs">
                전체 문서 보기
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
          <div className="agents-hero-card" aria-label="Clunk MCP 서버 요약">
            <div className="agents-card-topline">
              <span className="status-dot status-dot-on" />
              <span>stdio · local process</span>
              <code>clunk v{MCP_SERVER.version}</code>
            </div>
            <div className="agents-terminal-line">
              <span className="tok-prompt">$</span>
              <span>npm.cmd run mcp</span>
            </div>
            <div className="agents-hero-metrics">
              <div>
                <strong>{MCP_TOOLS.length}</strong>
                <span>MCP tools</span>
              </div>
              <div>
                <strong>{RULE_SET.id}</strong>
                <span>rule set</span>
              </div>
              <div>
                <strong>0</strong>
                <span>원본 덮어쓰기</span>
              </div>
            </div>
            <p>실제 바이트 → 검사 → 허용 작업 → 새 파일 재검사 → Passport</p>
          </div>
        </section>

        <section className="agents-proof-row" aria-label="Clunk MCP 계약">
          <div>
            <span className="mono-label">ONE ENDPOINT</span>
            <strong>로컬 stdio 프로세스 하나</strong>
            <p>클라이언트 설정에는 cmd.exe와 npm.cmd만 들어갑니다.</p>
          </div>
          <div>
            <span className="mono-label">SAME CORE</span>
            <strong>{SURFACES.length}개 표면, 같은 결과</strong>
            <p>웹 검사기, CLI, MCP, VS Code가 같은 계약을 호출합니다.</p>
          </div>
          <div>
            <span className="mono-label">NO FAKE READY</span>
            <strong>점수보다 근거를 저장</strong>
            <p>hash, finding, fresh reinspection과 Passport를 구분합니다.</p>
          </div>
        </section>

        <section className="agents-connect-section" id="connect">
          <div className="agents-section-head">
            <span className="eyebrow">CLIENT SETUP</span>
            <h2>쓰는 클라이언트에 맞춰 한 블록만 복사하세요.</h2>
            <p>
              Polyfork처럼 클라이언트별 연결 표면을 한곳에 모았습니다. 아래 예시는 현재 저장소의
              실제 MCP 설정과 Windows 실행 경계를 기준으로 합니다.
            </p>
          </div>
          <AgentsClient />
        </section>

        <section className="agents-tools-section">
          <div className="agents-section-head agents-section-head-tight">
            <span className="eyebrow">TOOLS THE AGENT CAN CALL</span>
            <h2>에이전트가 실제로 부르는 네 가지 도구</h2>
          </div>
          <div className="agents-tools-grid">
            {MCP_TOOLS.map((tool, index) => (
              <article className="agents-tool-card" key={tool.name}>
                <span className="agents-tool-index">0{index + 1}</span>
                <code>{tool.name}</code>
                <p>{tool.summary}</p>
                <dl>
                  <div>
                    <dt>입력</dt>
                    <dd>{tool.input}</dd>
                  </div>
                  <div>
                    <dt>출력</dt>
                    <dd>{tool.output}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="agents-loop-section">
          <div className="agents-loop-copy">
            <span className="eyebrow">THE HANDOFF</span>
            <h2>Harvest Frontier처럼 실제 게임 프로젝트에 연결하는 흐름</h2>
            <p>
              생성 에이전트가 GLB를 만든 뒤 Clunk를 호출하고, 게임 프로젝트는 원본과 검사 결과를
              분리해 받습니다. Clunk는 아직 게임 엔진을 대신 실행하지 않지만, 어느 파일을 어떤
              규칙으로 넘겼는지 재현 가능한 증거를 남깁니다.
            </p>
            <a className="text-link" href="/app">
              샘플 GLB 검사해 보기 <span aria-hidden="true">→</span>
            </a>
          </div>
          <ol className="agents-loop">
            <li>
              <span>01</span>
              <div>
                <strong>생성 또는 export</strong>
                <p>에이전트와 DCC가 만든 원본 GLB를 작업 폴더에 둡니다.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>clunk_inspect</strong>
                <p>실제 바이트, 구조 메트릭, finding, hash, 점수를 받습니다.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>clunk_optimize · clunk_passport</strong>
                <p>허용 목록만 새 파일에 적용하고 결과를 다시 열어 전후를 묶습니다.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="agents-boundary">
          <div>
            <span className="eyebrow">PUBLIC API STATUS</span>
            <h2>HTTP URL을 문서에 먼저 쓰지 않은 이유</h2>
            <p>
              공개 HTTP MCP는 아직 제공하지 않습니다. Clunk 웹의 <code>/api/me</code>, <code>/api/runs</code>,
              <code>/api/passports</code>는 인증된 워크스페이스 내부 경계입니다. 외부 API를 열 때는
              workspace 권한, rate limit, signed artifact 만료, 원본 보존 정책까지 함께 출시해야
              합니다.
            </p>
          </div>
          <div className="agents-boundary-stamp">
            <span className="status-pill status-conditional">NOT SHIPPED</span>
            <strong>HTTP MCP</strong>
            <code>stdio is the current contract</code>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
