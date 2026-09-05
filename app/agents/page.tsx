import Link from "../components/NativeLink";
import { getChatGPTUser } from "../chatgpt-auth";
import { AgentsClient } from "./AgentsClient";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import { AssetFamilyVisual, type AssetFamilyVisualKind } from "../components/AssetFamilyVisual";
import { SampleRunWorkbench } from "../components/SampleRunWorkbench";
import { LiveEvidenceShowcase } from "../components/LiveEvidenceShowcase";
import { createPageMetadata } from "../components/site-metadata";
import { MCP_HTTP_TOOL_COUNT, MCP_SERVER, MCP_TOOLS, RULE_SET, TARGET_PROFILES } from "../components/product-facts";
import { AGENT_TOOL_CARDS } from "./tool-cards";
import "./agents-v5.css";

// Rendered per request: the page reads the session, and a prerendered copy told signed-in
// visitors to sign in.
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({ title: "에이전트 연결", description: "Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code에 Clunk를 연결하는 방법입니다. 키를 발급하고 설정을 붙여 넣으면 이 웹사이트와 같은 규칙으로 에셋을 고르고 검사합니다.", path: "/agents" });

// 번호는 왼쪽 칸(01~04)이 이미 붙입니다. 제목에 "1." 을 또 적으면 "01 1. 키 발급"으로 읽힙니다.
const setupSteps = [
  ["01", "키 발급", "내 계정 전용 키를 한 번 받습니다"],
  ["02", "클라이언트 선택", "쓰는 도구를 고릅니다"],
  ["03", "설정 복사", "연결 주소와 키가 채워진 설정을 붙여 넣습니다"],
  ["04", "연결 확인", "서버가 실제로 응답하는지 확인합니다"],
] as const;

const AGENT_ASSETS: Array<{ kind: AssetFamilyVisualKind; label: string }> = [
  { kind: "sprite", label: "2D 이미지" },
  { kind: "atlas", label: "스프라이트 시트" },
  { kind: "spine", label: "본 애니메이션" },
  { kind: "motion", label: "애니메이션 클립" },
  { kind: "model", label: "3D 모델" },
];

/**
 * packages/core/src/assetops-profiles.ts의 첫 프로필 label이 깨진 글자
 * ("영허검가 PixiJS 2D")로 저장되어 있어 화면에 그대로 나오고 있었습니다.
 * 원본 상수가 고쳐질 때까지 화면에서만 읽을 수 있는 이름으로 바꿉니다.
 */
function profileLabel(profile: { id: string; label: string }): string {
  return profile.id === "yeongheo-pixi-2d" ? "PixiJS 2D" : profile.label;
}

export default async function AgentsPage() {
  const user = await getChatGPTUser();
  return (
    /* cv5 chrome. The `agents-v4-*` rules read `--v4-ink` / `--v4-line` /
       `--v4-cyan`, which globals.css only declares on `.clunk-v4` — a class this
       page never carried, so every one of those rules resolved to an invalid
       value and the whole surface rendered as raw text. cv5-surface.css
       declares that ramp (on the navy palette) alongside the rest. */
    <div className="cv5 cv5-surface agents-cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="agents">
      <main className="agents-page agents-v4-page">
        <section className="agents-v4-hero public-hero-frame public-hero-agents"><div className="agents-v4-copy"><div className="hero-status-line"><span className="status-dot status-dot-on" /><span>Clunk 연결 서버</span><code>v{MCP_SERVER.version}</code></div><span className="eyebrow">AI 도구 연결(MCP)</span><h1>생성 직후,<br /><em>에이전트가 검사합니다.</em></h1><p>Clunk가 직접 운영하는 연결 서버를 한 번 걸어 두면 Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code가 이 웹사이트와 똑같은 규칙으로 에셋을 고르고 검사합니다. 브라우저를 열지 않고도 마켓에서 에셋을 찾고, 파일을 올려 검사하고, 같은 검사 기록을 받아 갑니다.</p><div className="agents-v4-actions"><a className="button button-primary" href="#connect">연결 시작 <Icon name="chevronDown" size={15} /></a><Link className="button button-quiet" href="/docs/quickstart">설정 가이드 <Icon name="arrowRight" size={15} /></Link></div><div className="agents-v4-proof"><span>웹으로 바로 쓰는 도구 <b>{MCP_HTTP_TOOL_COUNT}</b>개</span><span>내 컴퓨터에서 쓰는 도구 <b>{MCP_TOOLS.length}</b>개</span><span>원본 파일 덮어쓰기 <b>0</b></span></div></div><LiveEvidenceShowcase variant="agents" compact /></section>

        <section className="agents-v4-rail" aria-label="연결 정보"><div><span>연결 주소</span><strong>/api/mcp</strong><small>웹으로 바로 연결합니다</small></div><div><span>인증</span><strong>내 계정 전용 키</strong><small>로그인 후 키 발급</small></div><div><span>쓸 수 있는 도구</span><strong>웹으로 바로 쓰는 도구 {MCP_HTTP_TOOL_COUNT}개</strong><small>내 컴퓨터의 파일을 직접 읽고 쓰는 일은 내 컴퓨터에서 쓰는 도구 {MCP_TOOLS.length}개(로컬 stdio)가 맡습니다. 그 도구는 내 컴퓨터에 설치해야 씁니다.</small></div><McpEndpointStatus /></section>

        <section className="agent-asset-strip" aria-label="에이전트가 검사할 수 있는 에셋 종류"><div className="agent-asset-strip-copy"><span className="eyebrow">한 번 연결하면 다섯 종류</span><strong>에이전트가 부르면<br />이 흐름으로 들어옵니다.</strong><small>파일은 내 컴퓨터에서 열거나, 직접 올려서 시작합니다.</small></div><div className="agent-asset-strip-items">{AGENT_ASSETS.map((item) => <div key={item.kind}><AssetFamilyVisual kind={item.kind} compact /><span>{item.label}</span></div>)}</div></section>

        <section className="agents-v4-section agents-v4-product-loop" aria-labelledby="agent-product-loop-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">연결하기 전에 결과부터</span><h2 id="agent-product-loop-heading">에이전트가 부르면<br /><em>이 결과가 돌아옵니다.</em></h2></div><p>아래는 미리 준비된 예시라 실행 횟수가 들지 않습니다. 엔진 렌더와 게임 시점은 따로 남습니다.</p></div><SampleRunWorkbench compact /></section>

        <section className="agents-v4-section agents-v4-setup"><div className="agents-v4-heading"><span className="eyebrow">네 단계면 끝납니다</span><h2>연결은 짧고,<br /><em>결과는 실제여야 합니다.</em></h2><p>키를 발급하고, 설정을 복사하고, 서버가 실제로 응답하는지까지 확인합니다.</p></div><ol className="agents-v4-steps agent-journey">{setupSteps.map(([number, title, detail]) => <li key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></li>)}</ol></section>

        <section className="agents-v4-section agents-v4-connect" id="connect"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">쓰는 도구 설정</span><h2>쓰는 도구를 고르면<br /><em>설정이 완성됩니다.</em></h2></div><p className="agent-tab-purpose">선택한 클라이언트에 그대로 붙여 넣을 설정을 복사합니다. 인증에 실패하면 실패한 사실도 화면에 그대로 남습니다.</p></div><AgentsClient initiallyAuthenticated={Boolean(user)} /></section>

        <section className="agents-v4-section agents-v4-tools" aria-labelledby="tools-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">에이전트가 부를 수 있는 도구</span><h2 id="tools-heading">연결하면 바로 쓰는<br /><em>도구 {MCP_HTTP_TOOL_COUNT}개</em></h2></div><p>고르기·검사하기·기록 연결이 같은 규칙을 씁니다. 웹으로 연결한 쪽은 내 컴퓨터에 있는 파일을 열지 않습니다. 그 일은 내 컴퓨터에 설치하는 도구가 맡습니다.</p></div><div className="agents-v4-tool-grid">{AGENT_TOOL_CARDS.map((tool, index) => <article key={tool.name}><span>{String(index + 1).padStart(2, "0")}</span><code>{tool.name}</code><strong>{tool.does}</strong>{tool.when ? <small>{tool.when}</small> : null}<details className="agent-tool-schema"><summary>정확한 입출력 보기</summary><dl><dt>넣는 값</dt><dd><code>{tool.schema.input}</code></dd><dt>돌아오는 값</dt><dd><code>{tool.schema.output}</code></dd></dl></details></article>)}</div></section>

        <section className="agents-v4-section agents-v4-boundary" aria-labelledby="boundary-heading"><div className="agents-v4-heading"><span className="eyebrow">결과를 바르게 읽는 법</span><h2 id="boundary-heading">파일 검사 통과와<br /><em>화면 통과는 다릅니다.</em></h2><p>Clunk의 검사 규칙({RULE_SET.id})이 확인하는 것은 파일 내용과 구조, 규칙 위반입니다. 엔진에서 실제로 그린 화면은 따로 남으며, 자동으로 통과가 되지 않습니다.</p><Link className="text-link" href="/docs/contracts">규칙과 상태 보기 <Icon name="arrowRight" size={14} /></Link></div><div className="agents-v4-statuses"><article><span>파일 검사</span><strong>통과</strong><small>파일 내용 · 지문 · 규칙 · 차단 문제</small></article><article><span>엔진 렌더</span><strong>증거 없음</strong><small>엔진에서 그린 화면이 아직 없습니다</small></article><article><span>게임 시점</span><strong>확인 전</strong><small>게임 안에서 본 장면이 아직 없습니다</small></article><article><span>판정</span><strong>보류</strong><small>앞의 두 단계가 채워지면 판정합니다</small></article></div><div className="agents-v4-profile-strip">{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}>{profileLabel(profile)}</span>)}</div></section>

        <section className="agents-v4-handoff" aria-labelledby="handoff-heading"><div><span className="eyebrow">판정까지 가는 길</span><h2 id="handoff-heading">파일 검사는<br /><em>네 단계 중 첫 칸입니다.</em></h2><p>파일 검사는 규격을 봅니다. 게임에 넣어도 되는지는 엔진에서 그린 화면과 게임 안에서 본 장면까지 모여야 판정이 됩니다. 그 칸이 비어 있으면 Clunk는 비어 있다고 적고, 채워진 것처럼 바꾸지 않습니다.</p><code className="agents-v4-unavailable">돌려 보지 않은 엔진은 &quot;확인할 환경 없음&quot;으로 남고, 통과로 바뀌지 않습니다.</code><div className="agents-v4-handoff-actions"><Link className="button button-primary button-sm" href="/studio">에셋 제작 열기 <Icon name="arrowUpRight" size={14} /></Link><Link className="button button-quiet button-sm" href="/marketplace">에셋 마켓 보기 <Icon name="arrowRight" size={14} /></Link></div></div><div className="agents-v4-handoff-card"><div><span>파일 검사</span><b>통과</b></div><div><span>엔진 렌더</span><b>증거 없음</b></div><div><span>게임 시점</span><b>확인 전</b></div><div><span>판정</span><b>보류</b></div></div></section>
        <section className="agents-v4-final"><div><span className="eyebrow">다음</span><h2>실제 에셋을<br /><em>한 번 호출해 보세요.</em></h2></div><div className="agents-v4-actions"><a className="button button-primary" href="#connect">클라이언트 설정하기 <Icon name="arrowUpRight" size={15} /></a><Link className="button button-quiet" href="/app">내 파일 검사하기 <Icon name="arrowRight" size={15} /></Link></div></section>
      </main>
      </SiteShell>
    </div>
  );
}
