import Link from "../components/NativeLink";
import { getChatGPTUser } from "../chatgpt-auth";
import { AgentsClient } from "./AgentsClient";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { McpEndpointStatus } from "../components/McpEndpointStatus";
import { AssetFamilyVisual, type AssetFamilyVisualKind } from "../components/AssetFamilyVisual";
import { SampleRunWorkbench } from "../components/SampleRunWorkbench";
import { LiveEvidenceShowcase } from "../components/LiveEvidenceShowcase";
import { createPageMetadata } from "../components/site-metadata";
import { MCP_HTTP_TOOL_COUNT, MCP_SERVER, MCP_TOOLS, RULE_SET, TARGET_PROFILES } from "../components/product-facts";
import { AGENT_TOOL_CARDS } from "./tool-cards";
import tractorEvidence from "../data/evidence/hf-tractor-compact.visual-evidence.json";
import "./agents-v5.css";

// Rendered per request: the page reads the session, and a prerendered copy told signed-in
// visitors to sign in.
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({ title: "에이전트 연결", description: "Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code에 Clunk를 연결하는 방법입니다. 키를 발급하고 설정을 붙여 넣으면 웹에서와 같은 규칙으로 에셋을 고르고 검사합니다.", path: "/agents" });

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
  // 본 애니메이션 칸은 비워 둔다(2026-09-05): 보여 줄 만한 리깅 캐릭터가 아직 없다.
  // 마스터 기준(tmp/character/reference/thomas-the-farmer-sheet.png)을 넘는 캐릭터가 승인되면 되살린다.
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

/**
 * "판정까지 가는 길" 카드. 트랙터의 실제 자동 판정 기록(app/data/evidence, 위 쇼룸이 읽는
 * 그 파일)을 그대로 읽는다. 전에는 빈 상태 세 낱말이 상수로 박혀 있어 같은
 * 페이지 위쪽의 기계 판정과 반대말을 했다(2026-09-05).
 */
const LANE_WORDS: Record<string, string> = {
  PASS: "통과", APPROVED: "통과", CONDITIONAL: "조건부 통과", FAIL: "불통과", REJECTED: "불통과",
  REVIEW: "재검토 권장", GAP: "측정 안 됨", NOT_EVALUATED: "측정 안 됨", PENDING: "측정 안 됨",
};
const HANDOFF_LANES: ReadonlyArray<readonly [string, string]> = (() => {
  const lane = tractorEvidence.statuses;
  const word = (value: string) => LANE_WORDS[value] ?? value;
  const verdict = lane.humanDecision === "NOT_REQUIRED"
    ? `자동 ${word(lane.autoVerdict)} · 사람 검토 불필요`
    : lane.humanDecision === "OPTIONAL_REVIEW" ? "자동 재검토 권장" : String(lane.humanDecision);
  return [
    ["파일 검사", word(lane.structural)],
    ["자체 렌더", word(lane.visualRuntime)],
    ["게임 시점", word(lane.playerFacing)],
    ["판정", verdict],
  ];
})();

export default async function AgentsPage() {
  const user = await getChatGPTUser();
  return (
    /* cv5 chrome. The `agents-v4-*` rules read `--v4-ink` / `--v4-line` /
       `--v4-cyan`, which globals.css only declares on `.clunk-v4` — a class this
       page never carried, so every one of those rules resolved to an invalid
       value and the whole surface rendered as raw text. cv5-surface.css
       declares that ramp (on the navy palette) alongside the rest. */
    <div className="cv5 cv5-surface agents-cv5">
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="agents">
      <main className="agents-page agents-v4-page">
        <section className="agents-v4-hero public-hero-frame public-hero-agents"><div className="agents-v4-copy"><div className="hero-status-line"><span className="status-dot status-dot-on" /><span>Clunk 연결 서버</span><code>v{MCP_SERVER.version}</code></div><span className="eyebrow">AI 도구 연결(MCP)</span><h1>제작 직후,<br /><em>에이전트가 검사합니다.</em></h1><p>Clunk가 직접 운영하는 연결 서버를 한 번 연결해 두면 Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code가 이 웹사이트와 똑같은 규칙으로 에셋을 고르고 검사합니다. 브라우저를 열지 않고도 마켓에서 에셋을 찾고, 파일을 올려 검사하고, 같은 검사 기록을 받아 갑니다.</p><div className="agents-v4-actions"><a className="button button-primary" href="#connect">연결 시작 <Icon name="chevronDown" size={15} /></a><Link className="button button-quiet" href="/docs/quickstart">설정 가이드 <Icon name="arrowRight" size={15} /></Link></div><div className="agents-v4-proof"><span>웹으로 바로 쓰는 도구 <b>{MCP_HTTP_TOOL_COUNT}</b>개</span><span>내 컴퓨터에서 쓰는 도구 <b>{MCP_TOOLS.length}</b>개</span><span>원본 파일 덮어쓰기 <b>0</b></span></div></div><LiveEvidenceShowcase variant="agents" compact /></section>

        <section className="agents-v4-rail" aria-label="연결 정보"><div><span>연결 주소</span><strong>/api/mcp</strong><small>웹으로 바로 연결합니다</small></div><div><span>인증</span><strong>내 계정 전용 키</strong><small>로그인 후 키 발급</small></div><div><span>쓸 수 있는 도구</span><strong>웹으로 바로 쓰는 도구 {MCP_HTTP_TOOL_COUNT}개</strong><small>내 컴퓨터의 파일을 직접 읽고 쓰는 일은 설치해서 쓰는 도구 {MCP_TOOLS.length}개가 맡습니다.</small></div><McpEndpointStatus /></section>

        <section className="agent-asset-strip" aria-label="에이전트가 검사할 수 있는 에셋 종류"><div className="agent-asset-strip-copy"><span className="eyebrow">한 번 연결하면 네 종류</span><strong>에이전트가 부르면<br />이 흐름으로 들어옵니다.</strong><small>파일은 내 컴퓨터에서 열거나, 직접 올려서 시작합니다.</small></div><div className="agent-asset-strip-items">{AGENT_ASSETS.map((item) => <div key={item.kind}><AssetFamilyVisual kind={item.kind} compact /><span>{item.label}</span></div>)}</div></section>

        <section className="agents-v4-section agents-v4-product-loop" aria-labelledby="agent-product-loop-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">연결하기 전에 결과부터</span><h2 id="agent-product-loop-heading">에이전트가 부르면<br /><em>이 결과가 돌아옵니다.</em></h2></div><p>미리 준비된 예시라 실행 횟수가 들지 않습니다. 자체 렌더와 게임 시점은 파일 점수와 별개로 직접 그려 측정한 뒤 판정합니다.</p></div><SampleRunWorkbench compact /></section>

        <section className="agents-v4-section agents-v4-setup"><div className="agents-v4-heading"><span className="eyebrow">네 단계면 끝납니다</span><h2>연결은 짧고,<br /><em>결과는 그 자리에서 나옵니다.</em></h2><p>키를 발급하고, 설정을 복사하고, 서버가 실제로 응답하는지까지 확인합니다.</p></div><ol className="agents-v4-steps agent-journey">{setupSteps.map(([number, title, detail]) => <li key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></li>)}</ol></section>

        <section className="agents-v4-section agents-v4-connect" id="connect"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">쓰는 도구 설정</span><h2>쓰는 도구를 고르면<br /><em>설정이 완성됩니다.</em></h2></div><p className="agent-tab-purpose">고른 도구에 그대로 붙여 넣을 설정을 복사합니다. 연결에 실패하면 무엇이 막혔는지 그 자리에서 알려 드립니다.</p></div><AgentsClient initiallyAuthenticated={Boolean(user)} /></section>

        <section className="agents-v4-section agents-v4-tools" aria-labelledby="tools-heading"><div className="agents-v4-heading agents-v4-heading-wide"><div><span className="eyebrow">에이전트가 부를 수 있는 도구</span><h2 id="tools-heading">연결하면 바로 쓰는<br /><em>도구 {MCP_HTTP_TOOL_COUNT}개</em></h2></div><p>고르기·검사·기록이 같은 규칙을 씁니다. 웹으로 연결한 쪽은 내 컴퓨터의 파일을 열지 않고, 그 일은 설치해서 쓰는 도구가 맡습니다.</p></div><div className="agents-v4-tool-grid">{AGENT_TOOL_CARDS.map((tool, index) => <article key={tool.name}><span>{String(index + 1).padStart(2, "0")}</span><code>{tool.name}</code><strong>{tool.does}</strong>{tool.when ? <small>{tool.when}</small> : null}<details className="agent-tool-schema"><summary>정확한 입출력 보기</summary><dl><dt>넣는 값</dt><dd><code>{tool.schema.input}</code></dd><dt>돌아오는 값</dt><dd><code>{tool.schema.output}</code></dd></dl></details></article>)}</div></section>

        <section className="agents-v4-section agents-v4-boundary" aria-labelledby="boundary-heading"><div className="agents-v4-heading"><span className="eyebrow">결과를 바르게 읽는 법</span><h2 id="boundary-heading">파일 검사 통과와<br /><em>화면 통과는 다릅니다.</em></h2><p>Clunk의 검사 규칙({RULE_SET.id})이 보는 것은 파일 내용과 구조입니다. 자체 렌더와 게임 시점은 Clunk가 직접 그려 측정한 뒤 따로 판정하고, 파일 검사 점수가 그 판정을 대신하지 않습니다.</p><Link className="text-link" href="/docs/contracts">규칙과 상태 보기 <Icon name="arrowRight" size={14} /></Link></div><div className="agents-v4-statuses"><article><span>파일 검사</span><strong>형식 · 예산 · 물리</strong><small>형식과 예산, 재질·텍스처, 부품이 놓인 자리(접지·부양·관통)를 규칙으로 측정</small></article><article><span>자체 렌더</span><strong>4각도 렌더</strong><small>3/4·정면·측면·위를 Clunk가 직접 그려 접지·노출·팔레트를 측정</small></article><article><span>게임 시점</span><strong>눈높이 5 m · 15 m</strong><small>플레이어 카메라 높이에서 실루엣과 46 px 가독성을 측정</small></article><article><span>판정</span><strong>기계가 냅니다</strong><small>네 칸을 모아 자동으로 판정하고, 사람 검토는 필요할 때만 권합니다</small></article></div><div className="agents-v4-profile-strip">{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}>{profileLabel(profile)}</span>)}</div></section>

        <section className="agents-v4-handoff" aria-labelledby="handoff-heading"><div><span className="eyebrow">판정까지 가는 길</span><h2 id="handoff-heading">파일 검사는<br /><em>네 단계 중 첫 칸입니다.</em></h2><p>파일 검사는 규격을 봅니다. 게임에 넣어도 되는지는 자체 렌더와 게임 시점까지 Clunk가 직접 그려 측정한 뒤 판정합니다. 측정하지 못한 칸은 비어 있다고 적습니다.</p><code className="agents-v4-unavailable">돌려 보지 않은 엔진은 &quot;확인할 환경 없음&quot;으로 남습니다.</code><div className="agents-v4-handoff-actions"><Link className="button button-primary button-sm" href="/studio">에셋 제작 열기 <Icon name="arrowUpRight" size={14} /></Link><Link className="button button-quiet button-sm" href="/marketplace">에셋 마켓 보기 <Icon name="arrowRight" size={14} /></Link></div></div><div className="agents-v4-handoff-card">{HANDOFF_LANES.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section>
        <section className="agents-v4-final"><div><span className="eyebrow">다음</span><h2>실제 에셋을<br /><em>한 번 호출해 보세요.</em></h2></div><div className="agents-v4-actions"><a className="button button-primary" href="#connect">클라이언트 설정하기 <Icon name="arrowUpRight" size={15} /></a><Link className="button button-quiet" href="/app">내 파일 검사하기 <Icon name="arrowRight" size={15} /></Link></div></section>
      </main>
      </SiteShell>
    </div>
  );
}
