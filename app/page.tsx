import Image from "next/image";
import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import { LiveEvidenceShowcase } from "./components/LiveEvidenceShowcase";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { McpEndpointStatus } from "./components/McpEndpointStatus";
import type { AssetFamilyVisualKind } from "./components/AssetFamilyVisual";
import { FoundryAssetStage } from "./components/FoundryAssetStage";
import { createPageMetadata } from "./components/site-metadata";
import {
  ASSET_KIND_COVERAGE,
  CLI_SAMPLE,
  MCP_TOOL_COUNT,
  RULE_COUNT,
  RULE_SET,
  SURFACE_COUNT,
  TARGET_PROFILES,
} from "./components/product-facts";

export const metadata = createPageMetadata({
  title: "아이디어에서 Game Ready까지",
  description: "게임 에셋을 만들고, 실제 바이트에서 검사하고, 근거와 함께 팀에 전달하는 Clunk AI Game Asset Foundry입니다.",
  path: "/",
});

const FLOW = [
  { name: "IDEA", detail: "brief · prompt", status: "START" },
  { name: "PLAN", detail: "target profile", status: "BACKED" },
  { name: "CREATE", detail: "actual artifact", status: "LIVE" },
  { name: "REFINE", detail: "separate output", status: "LIVE" },
  { name: "REMIX", detail: "provider path", status: "FUTURE" },
  { name: "ANIMATE", detail: "family contract", status: "FUTURE" },
  { name: "VALIDATE", detail: "Core policy", status: "LIVE" },
  { name: "GAME READY", detail: "evidence lanes", status: "LIVE" },
  { name: "PACKAGE", detail: "Passport · bundle", status: "LIVE" },
  { name: "DISCOVER", detail: "asset catalogue", status: "LIVE" },
  { name: "DISTRIBUTE", detail: "download · draft", status: "LIVE" },
  { name: "INTEGRATE", detail: "MCP · CLI", status: "LIVE" },
] as const;

const ASSET_SHELF: Array<{ kind: AssetFamilyVisualKind; label: string; detail: string; status: string }> = [
  { kind: "sprite", label: "Sprite", detail: "픽셀 계약과 프레임 구조", status: "2D · PNG" },
  { kind: "atlas", label: "Atlas", detail: "page와 region의 연결", status: "2D · bundle" },
  { kind: "spine", label: "Spine", detail: "bones · slots · clips", status: "2D · JSON" },
  { kind: "motion", label: "Motion", detail: "clip과 loop의 구조", status: "3D · glTF" },
  { kind: "model", label: "GLB / GLTF", detail: "mesh · material · scene", status: "3D · bytes" },
];

export default function Home() {
  const sprite = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("sprite")) ?? ASSET_KIND_COVERAGE[0];
  const model = ASSET_KIND_COVERAGE.find((item) => item.label.toLowerCase().includes("glb")) ?? ASSET_KIND_COVERAGE[ASSET_KIND_COVERAGE.length - 1];

  return (
    <div className="site-shell foundry-page">
      <SnapRoot />
      <SiteNav active="home" />
      <main>
        <section className="foundry-frame foundry-hero public-hero-frame" aria-labelledby="foundry-hero-heading">
          <div className="foundry-hero-copy">
            <span className="foundry-eyebrow">CLUNK / AI GAME ASSET FOUNDRY</span>
            <h1 id="foundry-hero-heading">아이디어를<br /><em>Game Ready</em> 에셋으로.</h1>
            <p className="foundry-hero-lede">생성한 Sprite, Atlas, Spine, motion, GLB를 실제 바이트에서 만들고 검사합니다. Clunk는 구조 점수와 게임 화면, 사람의 결정을 한 덩어리로 과장하지 않고 다음 작업으로 연결합니다.</p>
            <div className="foundry-actions">
              <Link className="foundry-button foundry-button-primary" href="/studio" prefetch={false}>Create workspace <Icon name="arrowUpRight" size={15} /></Link>
              <Link className="foundry-button foundry-button-quiet" href="#evidence" prefetch={false}>See the evidence <Icon name="chevronDown" size={15} /></Link>
            </div>
            <div className="foundry-proof-row" aria-label="Clunk가 실제로 확인하는 것">
              <span>real bytes + hash</span>
              <span>fresh reinspection</span>
              <span>human review separate</span>
            </div>
          </div>
          <FoundryAssetStage />
        </section>

        <section className="foundry-frame foundry-section" aria-labelledby="foundry-flow-heading">
          <div className="foundry-section-heading">
            <div>
              <span className="foundry-eyebrow">THE PRODUCT PATH</span>
              <h2 className="foundry-heading" id="foundry-flow-heading">만드는 순간부터<br /><em>출시 가능한 근거까지.</em></h2>
            </div>
            <p>전체 흐름은 하나의 제품처럼 보이지만, 현재 살아 있는 단계와 향후 연결 단계는 분리해 표시합니다. 실제 artifact가 없는 작업은 완료된 것처럼 보이지 않습니다.</p>
          </div>
          <div className="foundry-flow-grid">
            {FLOW.map((step, index) => (
              <article className={`foundry-flow-step${step.status === "LIVE" ? " is-live" : ""}`} key={step.name}>
                <div className="foundry-flow-step-number"><span>{String(index + 1).padStart(2, "0")}</span><span>{step.status}</span></div>
                <strong>{step.name}</strong>
                <small>{step.detail}</small>
              </article>
            ))}
          </div>
          <div className="foundry-evidence-strip" aria-label="Game Ready 증거 요약">
            <div><span>REAL SAMPLE · CLUNK CORE</span><strong>{CLI_SAMPLE.file}</strong><small>{CLI_SAMPLE.byteLength.toLocaleString()} B · sha256 {CLI_SAMPLE.inputHash.slice(0, 12)}…</small></div>
            <div><span>STATIC POLICY SCORE</span><strong>{CLI_SAMPLE.score}/100</strong><small>PASS · blocker 0 · {CLI_SAMPLE.findings.length} findings</small></div>
            <div><span>VISUAL RUNTIME</span><strong>GAP</strong><small>shipped renderer capture 필요</small></div>
            <div><span>PLAYER / HUMAN</span><strong>NOT_EVALUATED</strong><small>자동 승격하지 않음</small></div>
          </div>
        </section>

        <section className="foundry-frame foundry-section" aria-labelledby="foundry-assets-heading">
          <div className="foundry-section-heading">
            <div>
              <span className="foundry-eyebrow">ASSET-FIRST WORKBENCH</span>
              <h2 className="foundry-heading" id="foundry-assets-heading">2D와 3D를<br /><em>같은 작업면에서.</em></h2>
            </div>
            <p>에셋 패밀리를 먼저 고르고, 실제로 가능한 Create·Inspect·Review·Draft 흐름만 다음 단계로 엽니다.</p>
          </div>
          <div className="foundry-showcase-grid">
            <article className="foundry-showcase-card">
              <div className="foundry-showcase-visual"><Image src="/samples/product-sprite/clunk-sprite-sample.png" alt="Clunk Sprite 샘플" width={512} height={512} /></div>
              <div className="foundry-showcase-copy"><span className="foundry-kicker">2D · CONTRACT FIXTURE</span><h3>{sprite.label}</h3><p>{sprite.detail}. 실제 검사는 업로드된 PNG와 선언된 검토 계약을 각각 확인합니다.</p><Link className="foundry-button foundry-button-quiet" href="/studio" prefetch={false}>Create a Sprite <Icon name="arrowRight" size={14} /></Link></div>
            </article>
            <article className="foundry-showcase-card">
              <div className="foundry-showcase-visual"><Image src="/landing/tractor-hero.png" alt="Clunk 3D 트랙터 샘플" width={900} height={610} /></div>
              <div className="foundry-showcase-copy"><span className="foundry-kicker">3D · REAL SHIPPED SAMPLE</span><h3>{model.label}</h3><p>{model.detail}. 정적 정책 PASS는 player-facing 화면이나 사람 승인을 의미하지 않습니다.</p><Link className="foundry-button foundry-button-quiet" href="/app" prefetch={false}>Open Game Ready <Icon name="arrowRight" size={14} /></Link></div>
            </article>
          </div>
        </section>

        <section className="foundry-frame foundry-section" id="evidence" aria-labelledby="foundry-evidence-heading">
          <div className="foundry-section-heading">
            <div>
              <span className="foundry-eyebrow">GAME READY / EVIDENCE</span>
              <h2 className="foundry-heading" id="foundry-evidence-heading">점수는 시작이고,<br /><em>승인은 별도입니다.</em></h2>
            </div>
            <p>아래 인터랙션은 실제 Clunk Core 결과를 사용하는 계약 fixture입니다. 구조·런타임·player-facing·human 상태를 나눠 읽을 수 있습니다.</p>
          </div>
          <LiveEvidenceShowcase variant="landing" />
          <details className="foundry-disclosure">
            <summary>ADVANCED EVIDENCE · STATIC POLICY / RUNTIME / PLAYER / HUMAN</summary>
            <div className="foundry-disclosure-content">{RULE_SET.id} · static policy score · fresh reinspection · visualRuntime=NOT_EVALUATED · playerFacing=NOT_EVALUATED · humanDecision=NOT_EVALUATED. 이 레인은 실제 shipped capture와 사람의 판단이 추가될 때까지 비어 있을 수 있습니다.</div>
          </details>
        </section>

        <section className="foundry-frame foundry-section" aria-labelledby="foundry-catalog-heading">
          <div className="foundry-section-heading">
            <div>
              <span className="foundry-eyebrow">DISCOVER · DEVELOPERS · SHIP</span>
              <h2 className="foundry-heading" id="foundry-catalog-heading">에셋을 만들고,<br /><em>필요한 곳으로 보냅니다.</em></h2>
            </div>
            <p>공개 카탈로그는 실제 preview·license·download 상태를 먼저 보여줍니다. MCP와 CLI는 같은 도구 목록과 규칙 집합을 공유합니다.</p>
          </div>
          <div className="foundry-showcase-grid">
            <article className="foundry-showcase-card">
              <div className="foundry-showcase-visual"><Image src="/landing/tractor-hero.png" alt="Discover에 표시되는 Clunk 샘플" width={900} height={610} /></div>
              <div className="foundry-showcase-copy"><span className="foundry-kicker">DISCOVER / ASSET CATALOGUE</span><h3>실제 미리보기와 라이선스</h3><p>샘플은 판매용으로 가장하지 않으며, 게시된 listing만 구매 가능 상태를 표시합니다.</p><Link className="foundry-button foundry-button-quiet" href="/marketplace" prefetch={false}>Open Discover <Icon name="arrowRight" size={14} /></Link></div>
            </article>
            <article className="foundry-showcase-card">
              <div className="foundry-showcase-visual"><div className="foundry-showcase-console"><span>HTTP MCP / LOCAL CLI</span><strong>{MCP_TOOL_COUNT} tools</strong><small>{RULE_SET.id}</small><i>clunk_inspect</i><i>clunk_passport</i></div></div>
              <div className="foundry-showcase-copy"><span className="foundry-kicker">DEVELOPERS / INTEGRATE</span><h3>만든 즉시 연결</h3><p>실제 endpoint, workspace key, CLI/MCP 계약으로 생성 에이전트의 결과를 이어 붙입니다.</p><Link className="foundry-button foundry-button-quiet" href="/connect" prefetch={false}>Open Developers <Icon name="arrowRight" size={14} /></Link></div>
            </article>
          </div>
          <div className="foundry-evidence-strip" aria-label="Clunk 제품 계약">
            <div><span>ASSET FAMILIES</span><strong>{ASSET_SHELF.length}</strong><small>Sprite · Atlas · Spine · Motion · GLB</small></div>
            <div><span>MCP TOOLS</span><strong>{MCP_TOOL_COUNT}</strong><small>HTTP + local stdio</small></div>
            <div><span>RULE SET</span><strong>{RULE_COUNT}</strong><small>{RULE_SET.id}</small></div>
            <div><span>SURFACES</span><strong>{SURFACE_COUNT}</strong><small>{TARGET_PROFILES.length} target profiles</small></div>
          </div>
        </section>

        <section className="foundry-frame foundry-section" aria-labelledby="foundry-mcp-heading">
          <div className="foundry-section-heading">
            <div>
              <span className="foundry-eyebrow">LIVE CONNECTION SURFACE</span>
              <h2 className="foundry-heading" id="foundry-mcp-heading">실제 endpoint와<br /><em>실제 응답을 확인합니다.</em></h2>
            </div>
            <p>이 상태는 에이전트 연결 증거입니다. 연결 성공을 에셋의 Game Ready 승인으로 부르지 않습니다.</p>
          </div>
          <div className="foundry-mcp-panel"><LandingMcpDemo /><McpEndpointStatus /></div>
        </section>

        <section className="foundry-frame foundry-final" aria-labelledby="foundry-final-heading">
          <div><span className="foundry-eyebrow">CREATE · REVIEW · GAME READY</span><h2 id="foundry-final-heading">다음 에셋을<br /><em>작업면에 올려보세요.</em></h2><p>공개 샘플은 바로 확인하고, 내 파일은 로그인한 Studio에서 실제 artifact·검사·검토 Draft로 이어갑니다.</p></div>
          <div className="foundry-actions"><Link className="foundry-button foundry-button-primary" href="/studio" prefetch={false}>Create in Studio <Icon name="arrowUpRight" size={15} /></Link><Link className="foundry-button foundry-button-quiet" href="/docs#contracts" prefetch={false}>Read the contracts <Icon name="arrowRight" size={14} /></Link></div>
        </section>
        <footer className="foundry-frame foundry-footer">
          <div><strong>Clunk</strong><span>AI Game Asset Foundry · 2D + 3D 에셋 품질·근거 게이트</span></div>
          <nav aria-label="Clunk 제품 링크"><Link href="/marketplace" prefetch={false}>Discover</Link><Link href="/studio" prefetch={false}>Create</Link><Link href="/app" prefetch={false}>Game Ready</Link><Link href="/connect" prefetch={false}>Developers</Link><Link href="/docs" prefetch={false}>Docs</Link><a href="/llms.txt">llms.txt</a></nav>
        </footer>
      </main>
    </div>
  );
}
