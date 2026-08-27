import Link from "../components/NativeLink";
import { AgentsClient } from "./AgentsClient";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import { AssetFamilyVisual, type AssetFamilyVisualKind } from "../components/AssetFamilyVisual";
import { SampleRunWorkbench } from "../components/SampleRunWorkbench";
import { LiveEvidenceShowcase } from "../components/LiveEvidenceShowcase";
import { createPageMetadata } from "../components/site-metadata";
import { MCP_HTTP_TOOL_CATALOG, MCP_HTTP_TOOL_COUNT, MCP_SERVER, MCP_TOOLS, RULE_SET, TARGET_PROFILES } from "../components/product-facts";

export const metadata = createPageMetadata({ title: "에이전트 연결", description: "Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code에서 Clunk를 연결하는 작업 가이드입니다.", path: "/agents" });

const setupSteps = [
  ["01", "1. 키 발급", "workspace 전용 Bearer 키"],
  ["02", "2. 클라이언트 선택", "쓰는 도구의 설정 형식"],
  ["03", "3. 설정 복사", "endpoint + 인증 헤더"],
  ["04", "4. 연결 확인", "initialize → tools/list"],
] as const;

const AGENT_ASSETS: Array<{ kind: AssetFamilyVisualKind; label: string }> = [
  { kind: "sprite", label: "Sprite" },
  { kind: "atlas", label: "Atlas" },
  { kind: "spine", label: "Spine" },
  { kind: "motion", label: "Motion" },
  { kind: "model", label: "GLB / GLTF" },
];

export default function AgentsPage() {
  return (
    <SiteShell active="agents">
      <main className="agents-page agents-v4-page">
        <section className="agents-v4-hero public-hero-frame public-hero-agents"><div className="agents-v4-copy"><div className="hero-status-line"><span className="status-dot status-dot-on" /><span>CLUNK HTTP MCP</span><code>v{MCP_SERVER.version}</code></div><span className="eyebrow">CONNECT THE AGENT</span><h1>생성 직후,<br /><em>에이전트가 검사합니다.</em></h1><p>Clunk가 직접 운영하는 HTTP MCP를 연결하면 Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code에서 같은 Core와 같은 근거를 사용합니다.</p><div className="agents-v4-actions"><a className="button button-primary" href="#connect">연결 시작 <Icon name="chevronDown" size={15} /></a><Link className="button button-quiet" href="/docs#quickstart">설정 가이드 <Icon name="arrowRight" size={15} /></Link></div><div className="agents-v4-proof"><span><b>{MCP_HTTP_TOOL_COUNT}</b> HTTP tools</span><span><b>{MCP_TOOLS.length}</b> local tools</span><span><b>0</b> overwrite</span></div></div><LiveEvidenceShowcase variant="agents" compact /></section>

        <section className="agents-v4-rail" aria-label="MCP 연결 상태"><div><span>ENDPOINT</span><strong>/api/mcp</strong><small>streamable HTTP</small></div><div><span>AUTH</span><strong>Bearer workspace key</strong><small>로그인 후 키 발급</small></div><div><span>TOOLS</span><strong>HTTP 원격 도구 {MCP_HTTP_TOOL_COUNT}개</strong><small>로컬 stdio 도구 {MCP_TOOLS.length}개 · initialize와 tools/list에 동일하게 표시</small></div><McpEndpointStatus /></section>

        <section className="agent-asset-strip" aria-label="에이전트가 검사할 수 있는 에셋 종류"><div className="agent-asset-strip-copy"><span className="eyebrow">ONE CONNECTION · FIVE ASSET FAMILIES</span><strong>에이전트가 호출하면<br />이 흐름으로 들어옵니다.</strong><small>실제 파일은 local CLI 또는 업로드 bundle에서 시작합니다.</small></div><div className="agent-asset-strip-items">{AGENT_ASSETS.map((item) => <div key={item.kind}><AssetFamilyVisual kind={item.kind} compact /><span>{item.label}</span></div>)}</div></section>

        <section className="agents-v4-section agents-v4-product-loop" aria-labelledby="agent-product-loop-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">SEE THE RESULT BEFORE CONNECTING</span><h2 id="agent-product-loop-heading">에이전트 호출은<br /><em>이 결과로 돌아옵니다.</em></h2></div><p>아래 샘플은 실제 Clunk Core 결과를 사용한 계약 fixture입니다. runtime과 사람 검토는 별도 증거로 남습니다.</p></div><SampleRunWorkbench compact /></section>

        <section className="agents-v4-section agents-v4-setup"><div className="agents-v4-heading"><span className="eyebrow">FOUR SMALL STEPS</span><h2>연결은 짧고,<br /><em>결과는 실제여야 합니다.</em></h2><p>페이지를 읽고 추측하지 마세요. 키를 발급하고, 설정을 복사하고, 서버 handshake를 확인합니다.</p></div><ol className="agents-v4-steps agent-journey">{setupSteps.map(([number, title, detail]) => <li key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></li>)}</ol></section>

        <section className="agents-v4-section agents-v4-connect" id="connect"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">CLIENT SETUP</span><h2>쓰는 도구를 고르면<br /><em>설정이 완성됩니다.</em></h2></div><p className="agent-tab-purpose">선택한 클라이언트의 실제 설정을 복사합니다. 인증 실패도 화면에 남깁니다.</p></div><AgentsClient /></section>

        <section className="agents-v4-section agents-v4-tools" aria-labelledby="tools-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">TOOLS THE AGENT CAN CALL</span><h2 id="tools-heading">연결 후 바로 부르는<br /><em>{MCP_HTTP_TOOL_COUNT}개 도구</em></h2></div><p>검사·생성·증거 연결의 도구가 같은 계약을 공유합니다. 원격 HTTP는 로컬 경로를 읽지 않습니다.</p></div><div className="agents-v4-tool-grid">{MCP_HTTP_TOOL_CATALOG.map((tool, index) => <article key={tool.name}><span>0{index + 1}</span><code>{tool.name}</code><strong>{tool.summary}</strong><small>입력 {tool.input} · 출력 {tool.output}</small></article>)}</div></section>

        <section className="agents-v4-section agents-v4-boundary" aria-labelledby="boundary-heading"><div className="agents-v4-heading"><span className="eyebrow">READ THE RESULT CORRECTLY</span><h2 id="boundary-heading">구조 PASS와<br /><em>화면 PASS는 다릅니다.</em></h2><p>{RULE_SET.id}는 hash·parser·policy를 증명합니다. 실제 shipped frame, player-facing 화면, 사람의 판단은 자동으로 승격하지 않습니다.</p><Link className="text-link" href="/docs#contracts">계약과 상태 보기 <Icon name="arrowRight" size={14} /></Link></div><div className="agents-v4-statuses"><article><span>STATIC / TECHNICAL</span><strong>PASS</strong><small>bytes · hash · policy · blocker</small></article><article><span>VISUAL RUNTIME</span><strong>GAP</strong><small>shipped renderer frame 필요</small></article><article><span>PLAYER FACING</span><strong>NOT_EVALUATED</strong><small>게임 화면 판정 전</small></article><article><span>HUMAN REVIEW</span><strong>PENDING</strong><small>사람의 화면 판정 대기</small></article></div><div className="agents-v4-profile-strip">{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}>{profile.label}</span>)}</div></section>

        <section className="agents-v4-handoff" aria-labelledby="handoff-heading"><div><span className="eyebrow">EVIDENCE HANDOFF</span><h2 id="handoff-heading">자동화 결과를<br /><em>사람의 검토로 보냅니다.</em></h2><p>fixture PASS나 구조 PASS를 player-facing 승인으로 부르지 않습니다. 최신 capture와 사람의 결정을 별도 lane으로 추가합니다.</p><code className="agents-v4-unavailable">environmentUnavailable는 실행하지 않은 런타임을 PASS로 바꾸지 않습니다.</code></div><div className="agents-v4-handoff-card"><div><span>STRUCTURAL</span><b>PASS</b></div><div><span>visualRuntime</span><b>GAP</b></div><div><span>playerFacing</span><b>NOT_EVALUATED</b></div><div><span>humanDecision</span><b>NO_GO / PENDING</b></div></div></section>
        <div className="agents-v4-machine-note"><code>clunk_inspect · clunk_passport · HF M105 · environmentUnavailable · readinessReason=PLAYER_FACING_SCENE_GAP · sceneReviewCli · assetEvidenceRef · NOT CURRENT APPROVAL</code></div>
        <section className="agents-v4-final"><div><span className="eyebrow">NEXT</span><h2>실제 에셋을<br /><em>한 번 호출해 보세요.</em></h2></div><div className="agents-v4-actions"><a className="button button-primary" href="#connect">클라이언트 설정하기 <Icon name="arrowUpRight" size={15} /></a><Link className="button button-quiet" href="/app">내 파일 검사 · 로그인 <Icon name="arrowRight" size={15} /></Link></div></section>
      </main>
    </SiteShell>
  );
}
