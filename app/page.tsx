/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "./components/NativeLink";
import { BrandMark } from "./components/BrandMark";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import { McpEndpointStatus } from "./components/McpEndpointStatus";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { ASSET_KIND_COVERAGE, CLI_SAMPLE, MCP_TOOL_COUNT, RULE_COUNT, RULE_SET, SURFACE_COUNT, TARGET_PROFILES } from "./components/product-facts";

export const metadata: Metadata = {
  title: "모든 에셋을 근거 있게",
  description: "AI 에이전트가 만든 2D·3D 에셋을 생성 직후 검사하고, 실제 사용 경로와 근거를 연결하는 품질 게이트입니다.",
};

const FLOW = [
  { number: "01", title: "파일을 넣습니다", body: "PNG, Atlas, Spine, animation, GLB/GLTF의 실제 바이트와 hash에서 시작합니다.", icon: "upload" as const },
  { number: "02", title: "검사 결과를 봅니다", body: "파싱·정책·finding·런타임 gap을 한 화면에서 나눠 확인합니다.", icon: "scan" as const },
  { number: "03", title: "게임에 넣을지 결정합니다", body: "구조 PASS, 화면 evidence, 사람 검토를 섞지 않고 다음 작업을 정합니다.", icon: "fingerprint" as const },
];

export default function Home() {
  const sprite = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("sprite")) ?? ASSET_KIND_COVERAGE[0];
  const model = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("glb")) ?? ASSET_KIND_COVERAGE[ASSET_KIND_COVERAGE.length - 1];
  return (
    <div className="site-shell clunk-v4">
      <SnapRoot /><SiteNav active="home" />
      <main className="landing-v4">
        <section className="landing-v4-hero" id="home">
          <div className="landing-v4-copy"><span className="eyebrow">GAME ASSETOPS · 2D + 3D</span><h1>에이전트가 만든 에셋을<br /><em>게임에 넣기 전에 판정합니다.</em></h1><p>파일 하나가 근거 있는 결과가 되는 과정. Clunk는 생성된 Sprite, Atlas, Spine, motion, GLB를 실제 바이트에서 검사하고, 게임 화면과 사람의 검토를 별도 상태로 연결합니다.</p><div className="landing-v4-actions"><Link className="button button-primary" href="/app" prefetch={false}>검사기 열기 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/agents" prefetch={false}>에이전트 연결 <Icon name="arrowRight" size={15} /></Link></div><div className="landing-v4-trust"><span><i />실제 파일 hash</span><span><i />원본 별도 보존</span><span><i />재검사 후 결정</span></div></div>
          <div className="inspection-board inspection-board-hero" aria-label="실제 에셋 검사 제품 화면 미리보기"><div className="inspection-board-head"><span><i /> LIVE INSPECTION</span><code>{CLI_SAMPLE.file}</code><b>RUN 07F2</b></div><div className="inspection-board-main"><div className="inspection-render"><div className="inspection-render-grid" aria-hidden="true" /><img src="/landing/tractor-hero.png" alt="Clunk가 검사 중인 3D 트랙터" width={900} height={720} /><div className="inspection-sprite" aria-label="Sprite motion preview"><span>2D MOTION</span><div>{Array.from({ length: 12 }, (_, index) => <i key={index} className={`inspection-pixel pixel-${index % 4}`} />)}</div><small>idle · 6 frames · 12 fps</small></div><span className="inspection-crosshair inspection-crosshair-a" aria-hidden="true" /><span className="inspection-crosshair inspection-crosshair-b" aria-hidden="true" /></div><div className="inspection-result"><div className="inspection-file"><span className="file-chip"><Icon name="fileJson" size={16} /></span><div><strong>{CLI_SAMPLE.file}</strong><small>{CLI_SAMPLE.byteLength.toLocaleString()} B · sha256 {CLI_SAMPLE.inputHash.slice(0, 10)}…</small></div></div><div className="inspection-score"><span>STATIC POLICY</span><strong>{CLI_SAMPLE.score}<small>/100</small></strong><b><i /> PASS · blocker 0</b></div><div className="inspection-state inspection-state-gap"><span>VISUAL RUNTIME</span><strong>GAP</strong><small>shipped frame 필요</small></div><div className="inspection-state inspection-state-pending"><span>HUMAN REVIEW</span><strong>PENDING</strong><small>자동 승격하지 않음</small></div><div className="inspection-next"><span className="is-done">01 hash</span><span className="is-done">02 inspect</span><span>03 capture</span><span>04 decide</span></div></div></div><div className="inspection-board-foot"><span>one file</span><i>→</i><span>fresh evidence</span><i>→</i><strong>release decision</strong></div></div>
        </section>

        <section className="landing-v4-section landing-v4-flow" id="flow"><div className="landing-v4-section-head"><div><span className="eyebrow">THE PRODUCT LOOP</span><h2>파일 하나가 근거 있는<br /><em>결과가 되는 과정</em></h2></div><p>설명서가 아니라 실제 작업 흐름입니다. 생성 에이전트가 만든 결과를 넣고, 어떤 증거가 있고 무엇이 비어 있는지 바로 봅니다.</p></div><div className="landing-v4-flow-grid">{FLOW.map((step) => <article key={step.number}><span className="flow-number">{step.number}</span><Icon name={step.icon} size={19} /><h3>{step.title}</h3><p>{step.body}</p></article>)}</div><div className="landing-v4-sample"><div><span className="mono-label">REAL SAMPLE · CLUNK CORE</span><strong>점수는 결과의 일부입니다.</strong><p>이 샘플은 <b>{CLI_SAMPLE.score}/100</b>이지만 warning {CLI_SAMPLE.findings.length}건이 남아 있어 조건부입니다.</p></div><div className="sample-status"><span>STATIC</span><strong>PASS</strong><small>visualRuntime GAP · human PENDING</small></div><Link className="text-link" href="/app" prefetch={false}>샘플 검사 열기 <Icon name="arrowRight" size={14} /></Link></div></section>

        <section className="landing-v4-section landing-v4-coverage" id="coverage"><div className="landing-v4-section-head"><div><span className="eyebrow">WHAT CLUNK SHOWS</span><h2>2D와 3D를<br /><em>같은 기준으로 봅니다.</em></h2></div><p>에셋 종류와 엔진은 다르지만, 결과 화면은 같은 질문에 답해야 합니다. 파일이 무엇인지, 구조가 괜찮은지, 실제 게임에서 확인됐는지.</p></div><div className="landing-v4-family-grid"><article className="family-card family-card-2d"><div className="family-visual family-visual-sprite"><span>SPRITE / ATLAS</span><div>{Array.from({ length: 16 }, (_, index) => <i key={index} className={`inspection-pixel pixel-${index % 4}`} />)}</div><small>grid · pivot · hitbox · motion</small></div><div><span className="family-kicker">2D AUTHORING + REVIEW</span><h3>{sprite.label}</h3><p>{sprite.detail}</p><Link href="/studio" className="text-link">Studio에서 보기 <Icon name="arrowRight" size={14} /></Link></div></article><article className="family-card family-card-3d"><div className="family-visual family-visual-model"><img src="/landing/tractor-hero.png" alt="검사 중인 GLB 모델" width={620} height={420} /><span>GLB / GLTF</span></div><div><span className="family-kicker">3D MODEL + MOTION</span><h3>{model.label}</h3><p>{model.detail}</p><Link href="/docs#contracts" className="text-link">검사 계약 보기 <Icon name="arrowRight" size={14} /></Link></div></article></div><div className="landing-v4-profile-row"><span className="mono-label">TARGET PROFILES · {TARGET_PROFILES.length}</span>{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}><i />{profile.label}</span>)}</div></section>

        <section className="landing-v4-section landing-v4-connect" id="agents"><div className="landing-v4-connect-copy"><span className="eyebrow">CONNECT THE AGENT</span><h2>생성 직후,<br /><em>에이전트가 직접 부릅니다.</em></h2><p>Clunk HTTP MCP는 실제 endpoint와 도구 목록을 제공합니다. 로컬 파일은 stdio/CLI에서 바이트를 다시 읽고, 원격 요청은 업로드된 bundle만 검사합니다.</p><div className="landing-v4-metrics"><span><b>{MCP_TOOL_COUNT}</b> tools</span><span><b>{RULE_COUNT}</b> rules</span><span><b>{SURFACE_COUNT}</b> surfaces</span></div><Link className="button button-quiet" href="/agents" prefetch={false}>연결 화면 열기 <Icon name="arrowRight" size={15} /></Link></div><div className="landing-v4-mcp"><LandingMcpDemo /><div className="landing-v4-mcp-meta"><span>{MCP_TOOL_COUNT} tools · {RULE_SET.id}</span><span>HTTPS MCP · workspace key</span></div><McpEndpointStatus /></div></section>

        <div className="landing-v4-machine-marker"><code>clunk_inspect · clunk_passport · STATIC POLICY SCORE · {RULE_SET.id} · visualRuntime=GAP · humanDecision=NOT_EVALUATED</code></div>
        <section className="landing-v4-final" id="start"><div><span className="eyebrow">START WITH ONE ASSET</span><h2>다음 에셋부터<br /><em>근거를 남기세요.</em></h2><p>샘플 GLB 또는 직접 만든 2D/3D 파일로 Clunk의 흐름을 확인할 수 있습니다.</p></div><div className="landing-v4-actions"><Link className="button button-primary" href="/app" prefetch={false}>검사기 열기 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/docs" prefetch={false}>문서 보기 <Icon name="arrowRight" size={15} /></Link></div></section>
        <footer className="landing-v4-footer"><div className="site-footer-brand"><span className="brand-mark"><BrandMark size={30} gradientId="clunk-v4-footer" /></span><div><strong>Clunk</strong><span>2D + 3D 에셋 품질·근거 게이트</span></div></div><nav className="site-footer-nav" aria-label="사이트 링크"><Link href="/app" prefetch={false}>검사기</Link><Link href="/agents" prefetch={false}>에이전트</Link><Link href="/dashboard" prefetch={false}>대시보드</Link><Link href="/docs" prefetch={false}>문서</Link><a href="/llms.txt">llms.txt</a></nav><span className="demo-marker">DEMO MODE · 실제 결제 아님</span></footer>
      </main>
    </div>
  );
}
