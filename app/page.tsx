/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "./components/NativeLink";
import { BrandMark } from "./components/BrandMark";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import { McpEndpointStatus } from "./components/McpEndpointStatus";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { ProductFlowPreview } from "./components/ProductFlowPreview";
import { ASSET_KIND_COVERAGE, CLI_SAMPLE, MCP_TOOLS, MCP_TOOL_COUNT, RULE_COUNT, RULE_SET, SURFACE_COUNT, TARGET_PROFILES } from "./components/product-facts";

export const metadata: Metadata = {
  title: "모든 에셋을 근거 있게",
  description: "AI 에이전트가 만든 2D·3D 에셋을 생성 직후 검사하고, 실제 사용 경로와 근거를 연결하는 품질 게이트입니다.",
};

const FLOW = [
  { number: "01", label: "입력", title: "실제 파일을 올립니다", body: "PNG, Atlas, Spine, motion, GLB/GLTF를 원본과 분리해 읽습니다.", icon: "upload" as const },
  { number: "02", label: "검사", title: "근거를 한 화면에서 봅니다", body: "hash, 파싱, 정책, finding과 비어 있는 runtime 증거를 나눠 봅니다.", icon: "scan" as const },
  { number: "03", label: "판정", title: "다음 증거를 결정합니다", body: "구조 PASS를 사람 승인이나 player-facing PASS로 과장하지 않습니다.", icon: "fingerprint" as const },
];

export default function Home() {
  const sprite = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("sprite")) ?? ASSET_KIND_COVERAGE[0];
  const model = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("glb")) ?? ASSET_KIND_COVERAGE[ASSET_KIND_COVERAGE.length - 1];

  return (
    <div className="site-shell clunk-v5">
      <SnapRoot />
      <SiteNav active="home" />
      <main className="landing-v5">
        <section className="landing-v5-hero" id="home">
          <div className="landing-v5-hero-copy">
            <span className="eyebrow">CLUNK / ASSET EVIDENCE WORKSPACE</span>
            <h1><span>에이전트가 만든 에셋을</span><em>게임에 넣기 전에 판정합니다.</em></h1>
            <p>파일 하나가 근거 있는 결과가 되는 과정. Clunk는 생성된 Sprite, Atlas, Spine, motion, GLB를 실제 바이트에서 검사하고 게임 화면과 사람의 검토를 별도 상태로 연결합니다.</p>
            <div className="landing-v5-actions"><Link className="button button-primary" href="/app" prefetch={false}>검사기 열기 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/studio" prefetch={false}>에셋 흐름 보기 <Icon name="arrowRight" size={15} /></Link></div>
            <div className="landing-v5-proof"><span><i /> 실제 파일 hash</span><span><i /> fresh reinspection</span><span><i /> 사람 판정 별도</span></div>
          </div>
          <ProductFlowPreview />
        </section>

        <section className="landing-v5-strip" aria-label="Clunk가 연결하는 결과">
          <div><span className="strip-value">2D + 3D</span><span>Sprite · Atlas · Spine · motion · GLB</span></div>
          <div><span className="strip-value">{MCP_TOOL_COUNT} tools</span><span>HTTP + local stdio MCP</span></div>
          <div><span className="strip-value">3 verdicts</span><span>static · runtime · human</span></div>
          <div><span className="strip-value">1 source</span><span>bytes → evidence → decision</span></div>
        </section>

        <section className="landing-v5-section landing-v5-flow" id="flow">
          <div className="landing-v5-section-head"><div><span className="eyebrow">HOW THE WORK ACTUALLY MOVES</span><h2>설명서가 아니라<br /><em>작업 순서로 보여줍니다.</em></h2></div><p>에셋을 만든 뒤 Clunk에서 바로 무엇이 확인됐고, 무엇이 아직 비어 있는지 확인합니다. 각 단계는 서로 다른 상태를 가진 하나의 제품 흐름입니다.</p></div>
          <div className="landing-v5-flow-grid">{FLOW.map((step) => <article key={step.number} className={`flow-card flow-card-${step.number}`}><div className="flow-card-top"><span>{step.number}</span><span>{step.label}</span></div><div className="flow-card-visual" aria-hidden="true">{step.number === "01" && <><span className="flow-file-shape flow-file-shape-a">GLB</span><span className="flow-file-shape flow-file-shape-b">PNG</span><span className="flow-file-shape flow-file-shape-c">ATLAS</span></>}{step.number === "02" && <><span className="flow-report-line flow-report-line-wide" /><span className="flow-report-line" /><span className="flow-report-line flow-report-line-short" /><b>99<small>/100</small></b></>}{step.number === "03" && <><span className="flow-decision-chip flow-decision-chip-pass">STATIC PASS</span><span className="flow-decision-chip flow-decision-chip-gap">RUNTIME GAP</span><span className="flow-decision-chip flow-decision-chip-pending">HUMAN PENDING</span></>}</div><Icon name={step.icon} size={18} /><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
          <div className="landing-v5-sample"><div><span className="mono-label">REAL SAMPLE · CLUNK CORE</span><strong>{CLI_SAMPLE.file}</strong><p>{CLI_SAMPLE.byteLength.toLocaleString()} B · sha256 {CLI_SAMPLE.inputHash.slice(0, 12)}… · {CLI_SAMPLE.findings.length} findings</p></div><div className="sample-verdict"><span>STATIC POLICY</span><strong>{CLI_SAMPLE.score}<small>/100</small></strong><b>PASS · blocker 0</b></div><Link className="text-link" href="/app" prefetch={false}>샘플 검사 열기 <Icon name="arrowRight" size={14} /></Link></div>
        </section>

        <section className="landing-v5-section landing-v5-families" id="coverage">
          <div className="landing-v5-section-head"><div><span className="eyebrow">THE ASSET FAMILIES</span><h2>2D와 3D를<br /><em>같은 질문으로 봅니다.</em></h2></div><p>포맷은 달라도 질문은 같습니다. 이 파일이 무엇인지, 구조가 괜찮은지, 실제 게임에서 확인됐는지, 사람이 마지막으로 결정했는지.</p></div>
          <div className="landing-v5-family-grid"><article className="family-card-v5 family-card-v5-2d"><div className="family-v5-visual family-v5-sprite"><span>PIXEL CONTRACT</span><div>{Array.from({ length: 20 }, (_, index) => <i key={index} className={`inspection-pixel pixel-${index % 4}`} />)}</div><small>grid · cell · pivot · hitbox · motion</small></div><div className="family-v5-copy"><span className="family-kicker">2D AUTHORING + REVIEW</span><h3>{sprite.label}</h3><p>{sprite.detail}</p><Link href="/studio" className="text-link">Sprite Studio 열기 <Icon name="arrowRight" size={14} /></Link></div></article><article className="family-card-v5 family-card-v5-3d"><div className="family-v5-visual family-v5-model"><img src="/landing/tractor-hero.png" alt="Clunk가 검사 중인 3D 트랙터" width={620} height={420} /><span>SCENE / GLB / GLTF</span><div className="family-v5-axis"><i /><i /><i /></div></div><div className="family-v5-copy"><span className="family-kicker">3D MODEL + MOTION</span><h3>{model.label}</h3><p>{model.detail}</p><Link href="/docs#contracts" className="text-link">3D 계약 보기 <Icon name="arrowRight" size={14} /></Link></div></article></div>
          <div className="landing-v5-profile-row"><span className="mono-label">TARGET PROFILES · {TARGET_PROFILES.length}</span>{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}><i />{profile.label}</span>)}</div>
        </section>

        <section className="landing-v5-section landing-v5-agent" id="agents"><div className="landing-v5-agent-copy"><span className="eyebrow">FOR THE GENERATING AGENT</span><h2>만든 즉시 부르고,<br /><em>결과를 다시 받습니다.</em></h2><p>Clunk HTTP MCP는 실제 endpoint와 도구 목록을 제공합니다. 로컬 파일은 stdio/CLI에서 바이트를 다시 읽고, 원격 요청은 업로드된 bundle만 검사합니다.</p><div className="landing-v5-tool-line"><span><b>{MCP_TOOL_COUNT}</b> tools</span><span><b>{RULE_COUNT}</b> rules</span><span><b>{SURFACE_COUNT}</b> surfaces</span></div><Link className="button button-primary" href="/agents" prefetch={false}>연결 화면 열기 <Icon name="arrowRight" size={15} /></Link></div><div className="landing-v5-agent-panel"><div className="agent-panel-head"><span><i /> LIVE MCP CATALOG</span><code>/api/mcp</code><b>AUTH KEY</b></div><div className="agent-tool-list">{MCP_TOOLS.slice(0, 5).map((tool, index) => <div key={tool.name}><span>{String(index + 1).padStart(2, "0")}</span><strong>{tool.name}</strong><small>{tool.summary}</small></div>)}</div><div className="agent-panel-foot"><span>{MCP_TOOL_COUNT} tools · {RULE_SET.id}</span><span>HTTPS MCP · workspace key</span></div><LandingMcpDemo /><McpEndpointStatus /></div></section>

        <section className="landing-v5-boundary" aria-label="Clunk의 판정 경계"><div><span className="eyebrow">THE IMPORTANT BOUNDARY</span><h2>점수와 승인은<br /><em>같은 말이 아닙니다.</em></h2></div><div className="boundary-v5-table"><div className="boundary-v5-row boundary-v5-pass"><span><i /> STATIC / POLICY</span><strong>PASS</strong><small>실제 바이트, hash, fresh reinspection</small></div><div className="boundary-v5-row boundary-v5-gap"><span><i /> VISUAL RUNTIME</span><strong>GAP</strong><small>shipped frame이 연결되기 전</small></div><div className="boundary-v5-row boundary-v5-pending"><span><i /> HUMAN REVIEW</span><strong>PENDING</strong><small>사람이 확인하기 전 자동 승격하지 않음</small></div></div></section>

        <div className="landing-v5-machine-marker"><code>clunk_inspect · clunk_passport · STATIC POLICY SCORE · {RULE_SET.id} · visualRuntime=GAP · humanDecision=NOT_EVALUATED</code></div>
        <section className="landing-v5-final" id="start"><div><span className="eyebrow">START WITH ONE REAL ASSET</span><h2>다음 에셋부터<br /><em>근거를 남기세요.</em></h2><p>샘플 GLB 또는 직접 만든 2D/3D 파일로 실제 검사 흐름을 확인합니다.</p></div><div className="landing-v5-actions"><Link className="button button-primary" href="/app" prefetch={false}>검사기 열기 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/docs" prefetch={false}>문서 보기 <Icon name="arrowRight" size={15} /></Link></div></section>
        <footer className="landing-v5-footer"><div className="site-footer-brand"><span className="brand-mark"><BrandMark size={30} gradientId="clunk-v5-footer" /></span><div><strong>Clunk</strong><span>2D + 3D 에셋 품질·근거 게이트</span></div></div><nav className="site-footer-nav" aria-label="사이트 링크"><Link href="/app" prefetch={false}>검사기</Link><Link href="/agents" prefetch={false}>에이전트</Link><Link href="/dashboard" prefetch={false}>대시보드</Link><Link href="/docs" prefetch={false}>문서</Link><a href="/llms.txt">llms.txt</a></nav><span className="demo-marker">DEMO MODE · 실제 결제 아님</span></footer>
      </main>
    </div>
  );
}
