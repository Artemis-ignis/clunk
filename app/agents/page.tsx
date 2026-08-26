/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "../components/NativeLink";
import { AgentsClient } from "./AgentsClient";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import {
  ASSET_KIND_COVERAGE,
  MCP_HTTP_TOOL_CATALOG,
  MCP_HTTP_TOOL_COUNT,
  MCP_SERVER,
  MCP_TOOLS,
  RULE_SET,
  TARGET_PROFILES,
} from "../components/product-facts";

export const metadata: Metadata = {
  title: "에이전트 연결 | Clunk",
  description: "Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code에서 Clunk를 연결하는 작업 가이드입니다.",
};

const setupSteps = [
  { number: "01", label: "1. 키 발급", detail: "workspace 전용 Bearer 키를 한 번 발급합니다." },
  { number: "02", label: "2. 클라이언트 선택", detail: "쓰는 도구의 명령 또는 JSON만 고릅니다." },
  { number: "03", label: "3. 설정 복사", detail: "endpoint와 인증 헤더가 채워진 블록을 복사합니다." },
  { number: "04", label: "4. 연결 확인", detail: "initialize와 tools/list까지 실제로 확인합니다." },
];

export default function AgentsPage() {
  return (
    <SiteShell active="agents">
      <main className="agents-page agents-redesign">
        <section className="agents-hero-v2">
          <div className="agents-hero-v2-copy">
            <div className="hero-status-line">
              <span className="status-dot status-dot-on" />
              <span>CLUNK HTTP MCP</span>
              <code>v{MCP_SERVER.version}</code>
            </div>
            <span className="eyebrow">CONNECT IT · MCP</span>
            <h1>
              에이전트가 만든 에셋을
              <em>검사 결과까지 연결합니다.</em>
            </h1>
            <p className="agents-hero-v2-lead">
              Clunk가 직접 운영하는 HTTP MCP를 한 번 연결하면 Claude Code, Codex, Cursor, GitHub Copilot,
              Claude Desktop, VS Code에서 같은 Core와 같은 근거를 사용합니다.
            </p>
            <div className="agents-hero-v2-actions">
              <a className="button button-primary" href="#connect">
                연결 시작
                <Icon name="chevronDown" size={15} />
              </a>
              <Link className="button button-quiet" href="/docs#quickstart">
                3분 설정 가이드
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
            <div className="agents-proof-inline" aria-label="Clunk 연결 요약">
              <span><strong>{MCP_HTTP_TOOL_COUNT}</strong> HTTP 원격 도구 {MCP_HTTP_TOOL_COUNT}개</span>
              <span><strong>{MCP_TOOLS.length}</strong> 로컬 stdio 도구</span>
              <span><strong>0</strong> 원본 덮어쓰기</span>
            </div>
          </div>

          <div className="agents-visual-card" aria-label="Clunk 검사 결과 미리보기">
            <div className="visual-card-header">
              <span><i /> real bytes</span>
              <code>tractor.compact.m1.glb</code>
            </div>
            <div className="visual-card-stage">
              <img src="/landing/tractor-hero.png" alt="Clunk가 검사 중인 3D 트랙터" width="900" height="720" />
              <div className="visual-card-callout visual-card-callout-score">
                <span>STRUCTURAL</span>
                <strong>PASS <small>100</small></strong>
                <em>hard blockers 0</em>
              </div>
              <div className="visual-card-callout visual-card-callout-review">
                <span>PLAYER-FACING</span>
                <strong>별도 검토</strong>
                <em>visualRuntime · human review</em>
              </div>
            </div>
            <div className="visual-card-footer">
              <span>inspect → validate → passport</span>
              <span className="status-text"><i /> 근거 보존</span>
            </div>
          </div>
        </section>

        <section className="agent-status-rail" aria-label="Clunk 연결 상태">
          <div><span className="mono-label">ENDPOINT</span><strong>/api/mcp</strong><small>streamable HTTP</small></div>
          <div><span className="mono-label">AUTH</span><strong>Bearer workspace key</strong><small>로그인 후 키 발급 · 1회 표시</small></div>
          <div><span className="mono-label">RESULT BOUNDARY</span><strong>구조 PASS ≠ 화면 PASS</strong><small>visualRuntime은 별도 상태</small></div>
          <McpEndpointStatus />
        </section>

        <section className="agents-setup-section" aria-labelledby="setup-heading">
          <div className="agents-section-intro">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2 id="setup-heading">복사할 것은 한 블록입니다.</h2>
            <p>아래 순서대로 진행하면 어떤 클라이언트에서도 endpoint, 인증, 실제 연결 확인까지 한 번에 끝납니다.</p>
          </div>
          <ol className="agent-journey">
            {setupSteps.map((step) => (
              <li key={step.number}>
                <span className="agent-journey-number">{step.number}</span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="agents-connect-section agents-connect-v2" id="connect" aria-labelledby="connect-heading">
          <div className="agents-section-intro agents-section-intro-wide">
            <div>
              <span className="eyebrow">CLIENT SETUP</span>
              <h2 id="connect-heading">쓰는 도구를 고르면 설정이 완성됩니다.</h2>
            </div>
            <p>탭을 누르면 해당 클라이언트가 읽는 명령 또는 파일 형식으로 바뀝니다. 로그인 전에는 죽은 버튼 대신 키 발급 경로를 보여 줍니다.</p>
          </div>
          <AgentsClient />
        </section>

        <section className="agents-tools-section agents-tools-v2" aria-labelledby="tools-heading">
          <div className="agents-section-intro agents-section-intro-wide">
            <div>
              <span className="eyebrow">TOOLS THE AGENT CAN CALL</span>
              <h2 id="tools-heading">연결 후 실제로 할 수 있는 일</h2>
            </div>
            <p>{MCP_HTTP_TOOL_COUNT}개 HTTP 도구는 증거를 읽고 기록합니다. 최적화는 별도 요청이 없으면 원본을 건드리지 않습니다.</p>
          </div>
          <div className="agents-tools-grid agents-tools-grid-v2">
            {MCP_HTTP_TOOL_CATALOG.map((tool, index) => (
              <article className="agents-tool-card" key={tool.name}>
                <span className="agents-tool-index">0{index + 1}</span>
                <code>{tool.name}</code>
                <p>{tool.summary}</p>
                <span className="tool-contract-line">입력 {tool.input} · 출력 {tool.output}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="agents-contract-section" aria-labelledby="contract-heading">
          <div className="agents-contract-copy">
            <span className="eyebrow">ENGINE-AWARE · 2D + 3D</span>
            <h2 id="contract-heading">숫자와 화면을 한 판정으로 섞지 않습니다.</h2>
            <p>
              {RULE_SET.id}의 구조·정책 결과는 실제 바이트에서 시작합니다. Godot, Unity, Unreal, Web/Three.js,
              모바일처럼 환경이 다른 경우도 실행되지 않은 런타임을 PASS로 만들지 않습니다.
            </p>
            <code className="agents-local-tools">clunk_inspect · clunk_asset_author · clunk_sprite_sheet_review</code>
            <Link className="text-link" href="/docs#contracts">계약과 상태 보기 <Icon name="arrowRight" size={14} /></Link>
          </div>
          <div className="agents-contract-grid">
            <article className="contract-state-card contract-state-static">
              <span className="mono-label">STATIC / TECHNICAL</span>
              <strong>PASS</strong>
              <p>hash, parser, policy, blocker, finding, Passport</p>
            </article>
            <article className="contract-state-card contract-state-runtime">
              <span className="mono-label">RUNTIME / VISUAL</span>
              <strong>GAP</strong>
              <p>실제 shipped frame과 renderer evidence가 필요합니다.</p>
            </article>
            <article className="contract-state-card contract-state-human">
              <span className="mono-label">HUMAN REVIEW</span>
              <strong>대기</strong>
              <p>사람의 화면 판정은 자동 점수에서 승격하지 않습니다.</p>
            </article>
          </div>
          <div className="agents-profile-strip">
            {ASSET_KIND_COVERAGE.slice(0, 4).map((item) => <span key={item.label}>{item.label} · {item.detail}</span>)}
            {TARGET_PROFILES.slice(0, 2).map((profile) => <code key={profile.id}>{profile.id}</code>)}
          </div>
        </section>

        <section className="agents-evidence-section" aria-labelledby="evidence-heading">
          <div className="agents-section-intro agents-section-intro-wide">
            <div>
              <span className="eyebrow">HF M105 · EVIDENCE HANDOFF</span>
              <h2 id="evidence-heading">자동화 결과와 사람의 검토를 이어 붙입니다.</h2>
            </div>
            <p>이 블록은 CI가 읽는 식별자와 상태 경계입니다. <strong>NOT CURRENT APPROVAL</strong>은 실패가 아니라 최신 재검토가 아직 없다는 뜻입니다.</p>
          </div>
          <div className="agents-evidence-card">
            <pre><code>{`assetEvidenceRef: clunk.asset-evidence-ref.v1
sceneReviewCli: npm.cmd exec -- tsx scripts/frame-manifest-cli.ts
environmentUnavailable: explicit, never PASS
readinessReason: PLAYER_FACING_SCENE_GAP
visualRuntime: GAP · playerFacing: NOT_EVALUATED · humanDecision: NO_GO`}</code></pre>
            <div className="agents-evidence-notes">
              <span><i /> structural PASS는 byte/hash/policy만 뜻합니다.</span>
              <span><i /> WebGPU/WebGL2 shipped frame은 별도 capture evidence입니다.</span>
              <span><i /> HF의 최종 player-facing 판정은 HF가 소유합니다.</span>
            </div>
          </div>
        </section>

        <section className="agents-final-cta" aria-label="다음 단계">
          <div>
            <span className="eyebrow">READY WHEN THE EVIDENCE IS READY</span>
            <h2>먼저 연결하고, 그다음 실제 결과를 보세요.</h2>
            <p>Clunk는 구조 결과와 화면 검토의 경계를 숨기지 않습니다.</p>
          </div>
          <div className="agents-final-actions">
            <a className="button button-primary" href="#connect">클라이언트 설정하기 <Icon name="arrowUpRight" size={15} /></a>
            <Link className="button button-quiet" href="/app">샘플 GLB 검사 <Icon name="arrowRight" size={15} /></Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
