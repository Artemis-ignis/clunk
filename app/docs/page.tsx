import Image from "next/image";
import Link from "../components/NativeLink";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import "./docs-v5.css";
import { DocsSearch } from "./DocsSearch";
import { AssetFamilyVisual } from "../components/AssetFamilyVisual";
import { SampleRunWorkbench } from "../components/SampleRunWorkbench";
import { createPageMetadata } from "../components/site-metadata";
import { EvidenceStatusGrid } from "../components/EvidenceStatusGrid";
import {
  ASSET_INSPECTION_EVIDENCE_V2_CONTRACT,
  ASSET_KIND_COVERAGE,
  COLLABORATION_CONTRACT,
  FRAME_REVIEW_CONTRACT,
  HF_HANDOFF_VERIFIER_STATUS,
  HF_M105_TRACTOR_INSPECTION,
  MCP_CONFIG_SNIPPET,
  MCP_HTTP_TOOL_COUNT,
  MCP_SERVER,
  MCP_TOOLS,
  RULE_SET,
  SPRITE_SHEET_REVIEW_CONTRACT,
  SURFACES,
  TARGET_PROFILES,
  TEXTURE_AUDIT_CONTRACT,
} from "../components/product-facts";

export const metadata = createPageMetadata({
  title: "문서와 연동 가이드",
  description: "Clunk MCP, CLI, AssetOps, frame evidence 계약을 빠르게 찾고 실제로 연결하는 문서입니다.",
  path: "/docs",
});

const CLI_COMMANDS = `# 검사: 실제 바이트에서 JSON evidence 생성
$ npm.cmd run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 정책 판정: blocker 또는 기준 미달이면 exit 2
$ npm.cmd run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 원본은 유지하고 별도 파일만 작성
$ npm.cmd run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# source/output 재검사 결과를 Passport로 묶기
$ npm.cmd run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb`;

const AUDIT_COMMANDS = `# texture: 실제 gameplay 거리 band를 포함한 정적 측정
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict

# portrait UI: 실제 CSS renderPx에서 ΔE 측정
$ npm.cmd run asset:ui-readability -- --config examples/ui-readability/harvest-frontier.portraits.json --format json --strict

# evidence: source identity와 capture를 분리해 normalize
$ npm.cmd run asset:evidence -- normalize --input evidence.json
$ npm.cmd run asset:evidence -- validate --input evidence.json --required`;

const HTTP_SESSION = `$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }

$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

# 원격 ${MCP_HTTP_TOOL_COUNT}개와 로컬 stdio ${MCP_TOOLS.length}개는 같은 Core 계약을 사용합니다.`;

const EVIDENCE_EXAMPLE = `{
  "schema": "clunk.asset-inspection-evidence.v2",
  "evidenceKind": "CONTRACT_FIXTURE",
  "inputHash": "<sha256-of-source-bytes>",
  "resultDigest": "<sha256-of-canonical-result>",
  "byteLength": 680412,
  "coreBuildId": "0.1.0",
  "ruleSetVersion": "0.1.0",
  "profileId": "pc",
  "profileHash": "<sha256-of-profile>",
  "inspectionRunId": "HF-M117-tractor-r01",
  "qualityPolicy": { "requireRuntimeEvidence": "ADVISORY" },
  "findings": [{
    "code": "GEO-MISSING-NORMALS",
    "severity": "INFO",
    "observed": 7,
    "threshold": 0,
    "ownership": "unknown",
    "enforcement": "ADVISORY",
    "recommendation": "Confirm target-engine import policy before changing source bytes."
  }]
}`;

const FRAME_EXAMPLE = `{
  "schema": "clunk.frame-manifest.v1",
  "runId": "HF-M111-baseline",
  "sourceCommit": "<HF_SOURCE_HEAD>",
  "renderer": "WEBGPU",
  "viewport": { "width": 1920, "height": 1080, "dpr": 1 },
  "shippedPath": true,
  "frames": [{
    "id": "farm-nohud-webgpu",
    "path": "<ABSOLUTE_OR_UPLOADED_PATH>",
    "bytes": 2844135,
    "sha256": "<sha256>",
    "hud": false,
    "console": { "errors": 0, "warnings": 0 }
  }],
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED"
}`;

const BUNDLE_EXAMPLE = `{
  "schema": "clunk.asset-inspection-request.v2",
  "entryFileName": "skeleton.json",
  "fileCount": 3,
  "files": [
    { "path": "skeleton.json", "role": "spine-json", "relatesTo": ["atlas.atlas"] },
    { "path": "atlas.atlas", "role": "atlas", "relatesTo": ["texture.png"] },
    { "path": "texture.png", "role": "texture", "relatesTo": [] }
  ]
}`;

const STUDIO_COMMANDS = `# 2D Sprite / Atlas / Spine JSON bundle
$ npm.cmd run asset:author -- --asset-kind 2d-image --target-profile harvest-frontier-web-three --recipe-id sprite-sheet-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind sprite-atlas --target-profile harvest-frontier-web-three --recipe-id sprite-atlas-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind spine-project --target-profile harvest-frontier-web-three --recipe-id spine-json-factory-v1 --recipe-version 1.0.0 --output-directory output/generated

# 3D model / animation
$ npm.cmd run asset:generate -- --factory examples/generated/windmill.factory.mjs --target-profile harvest-frontier-web-three --recipe-id threejs-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind animation-clip --target-profile harvest-frontier-web-three --recipe-id threejs-animation-factory-v1 --recipe-version 1.0.0 --output-directory output/generated

# 모든 output은 별도 폴더에 쓰고 같은 target profile로 reopen합니다.
# local stdio MCP: clunk_asset_author uses the same fields and writes only locally.
# remote HTTPS MCP: upload the generated bundle; it never writes local paths.
# structural PASS != visualRuntime PASS != human player-facing PASS`;

const CLUNK_SERIES_COMMANDS = `# Clunk Series: 내부 코드로 실행하는 Game Ready mesh pass
$ npm.cmd run series:mesh -- game-ready public/samples/clunk-messy-sample.glb --out output/game-ready/optimized.glb --target-profile web-three-mobile --run-id series-game-ready-001

# output과 같은 이름의 .clunk.json sidecar에 input/output hash와 fresh evidence 기록
# 원본은 절대 덮어쓰지 않음
# provider: clunk-series-native-v1
# productionReady: false until runtime capture and human review are supplied`;

const SPRITE_SHEET_COMMANDS = `schema: clunk.sprite-sheet-review.v1
targetProfileId: yeongheo-pixi-2d
evidenceKind: CONTRACT_FIXTURE | PLAYER_FACING_CAPTURE
checks: grid/cell/direction/state/fps/loop/holdLast/pivot/hitbox/opaque-bottom
checks: duplicate/motion delta/clipping/alpha spill/border/silhouette/runtime-size

# local exact RGBA bytes rehash
$ npm.cmd run asset:sprite-audit -- validate --input manifest.json --format json --required
# exit 0 PASS · exit 2 policy/quality FAIL · exit 4 UNAVAILABLE or required review missing

# HTTP API is metadata-only and never dereferences a local path
verificationMode: DECLARED_METADATA_ONLY
visualRuntime: GAP · playerFacing: NOT_EVALUATED · humanDecision: NOT_EVALUATED`;

const HF_EVIDENCE_RULES = `# player-facing scene review output
comparisonSchema: clunk.frame-comparison.v1
reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED
inspectionRunId is required for a CURRENT reinspection

# frame evidence writes
append: keep prior frames/gaps and upsert the same stable id
replace: replace the named evidence lane only; do not erase other lanes
same renderer + viewport + cameraPoseHash + sourceTreeHash are required

# received HF evidence (not a template)
HF-M94-packaged-r01-03-game-nohud.png
sha256: 5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15
scene gaps: distant-terrain-band · dialogue-composition · poseFocusCoverage
texture follow-up: wood SOFT-SEAM

M104 comparison acceptance
HF M105 WebGPU/WebGL2 handoff
HF M105 fresh tractor inspection
frameSourceCommit and sourceCommit stay separate

asset evidence: clunk.asset-evidence-ref.v1
STALE EVIDENCE · NOT CURRENT APPROVAL
stale notarisation is not an execution error

$ npm.cmd exec -- tsx scripts/frame-manifest-cli.ts validate --input evidence.json --required`;

const WEBMCP_EXAMPLE = `// Chrome WebMCP imperative API
// Clunk registers these only when the browser exposes document.modelContext.
document.modelContext.getTools();

// Read-only browser tools
clunk_connection_check       // public /api/mcp status
clunk_product_capabilities   // contracts + state boundary

// The result never upgrades these states:
visualRuntime: GAP
playerFacing: NOT_EVALUATED
humanDecision: PENDING`;

export default function DocsPage() {
  return (
    <SiteShell active="docs">
      {/* cv5 chrome: docs is dark-committed and sits on the cv5 navy ground
          (docs-v5.css). Content structure below is untouched. */}
      <ForceDarkTheme />
      <main className="docs-page-redesign docs-cv5">
        <header className="docs-hero-v2 public-hero-frame public-hero-docs">
          <div>
            <span className="eyebrow">CLUNK DOCUMENTATION</span>
            <h1>연결하고, 검사하고,<br /><em>근거로 판단하세요.</em></h1>
            <p>GitBook식으로 빠른 시작, 클라이언트 설정, API 계약, 실제 화면 검토를 분리했습니다. 읽는 순서가 곧 실행 순서입니다.</p>
          </div>
          <div className="docs-hero-meta">
            <span className="docs-meta-label">CURRENT CORE</span>
            <strong>Clunk v{MCP_SERVER.version}</strong>
            <small>{RULE_SET.id} · {SURFACES.length} surfaces</small>
          </div>
        </header>

        <section className="docs-evidence-visual" aria-label="Clunk 증거 판정 시각 안내">
          <div className="docs-evidence-visual-art">
            <Image src="/landing/tractor-hero.png" alt="실제 GLB 검사 결과를 보여주는 Clunk 트랙터 렌더" width={900} height={560} priority />
            <span className="docs-evidence-visual-tag">REAL BYTES · TRACTOR.GLB</span>
          </div>
          <div className="docs-evidence-visual-copy">
            <span className="eyebrow">ONE FILE · THREE STATES</span>
            <h2>검사 결과를 화면으로 읽는 법</h2>
            <p>같은 에셋도 구조 계약, 실제 런타임, 사람의 화면 판정은 서로 다른 증거입니다.</p>
            <div className="docs-evidence-state-row">
              <div><span>STRUCTURAL</span><strong>PASS</strong><small>hash · policy · blocker</small></div>
              <div><span>RUNTIME</span><strong>GAP</strong><small>shipped frame 필요</small></div>
              <div><span>PLAYER FACING</span><strong>대기</strong><small>실제 화면 판정 전</small></div>
              <div><span>HUMAN</span><strong>대기</strong><small>자동 승격하지 않음</small></div>
            </div>
          </div>
        </section>

        <section className="docs-visual-quickstart" aria-label="포맷별 문서 시작점"><div><span className="eyebrow">CHOOSE YOUR STARTING POINT</span><h2>문서를 읽기 전에<br /><em>내 파일부터 고르세요.</em></h2><p>각 포맷은 같은 판정 흐름을 공유하지만, 확인하는 근거가 다릅니다.</p></div><div className="docs-visual-quickstart-grid"><div><AssetFamilyVisual kind="sprite" compact /><strong>2D Sprite / Atlas / Spine</strong><small>pixel contract · bundle</small></div><div><AssetFamilyVisual kind="motion" compact /><strong>Motion / Animation</strong><small>clip · loop · playback</small></div><div><AssetFamilyVisual kind="model" compact /><strong>GLB / GLTF</strong><small>mesh · scene · hash</small></div></div></section>

        <section className="docs-product-loop" aria-labelledby="docs-product-loop-heading"><div className="docs-product-loop-heading"><span className="eyebrow">A QUICK VISUAL START</span><h2 id="docs-product-loop-heading">문서를 읽기 전에<br /><em>결과부터 한 번 보세요.</em></h2><p>샘플은 계약 fixture로 표시됩니다. 실제 플레이어 화면과 사람 승인은 별도 capture에서만 생깁니다.</p></div><SampleRunWorkbench compact /></section>

        <div className="docs-layout">
          <aside className="docs-sidebar" aria-label="문서 목차">
            <div className="docs-sidebar-heading">
              <span className="mono-label">DOCUMENTATION</span>
              <strong>문서 목차</strong>
            </div>
            <DocsSearch />
            <nav className="docs-nav" aria-label="문서 섹션">
              <a href="#quickstart"><span>01</span>빠른 시작</a>
              <a href="#clients"><span>02</span>클라이언트별 설정</a>
              <a href="#cli"><span>03</span>CLI와 CI</a>
              <a href="#asset-studio"><span>04</span>Asset Studio</a>
              <a href="#contracts"><span>05</span>계약과 상태</a>
              <a href="#harvest-frontier"><span>06</span>Harvest Frontier</a>
              <a href="#webmcp"><span>07</span>브라우저 WebMCP</a>
              <a href="#scope"><span>08</span>지원 범위</a>
            </nav>
            <div className="docs-sidebar-callout">
              <span className="status-dot status-dot-on" />
              <strong>실제 증거를 기준으로 합니다</strong>
              <p>fixture PASS와 shipped frame PASS는 같은 뜻이 아닙니다.</p>
            </div>
          </aside>

          <article className="docs-content" id="docs-content">
            <section className="docs-section-v2 docs-section-first" id="quickstart">
              <div className="docs-section-heading">
                <span className="section-number">01</span>
                <div><span className="eyebrow">START HERE</span><h2>빠른 시작</h2></div>
              </div>
              <p className="docs-lead-v2">원격 에이전트는 HTTPS MCP, 로컬 파일은 stdio를 사용합니다. <Link href="/agents#connect">에이전트 연결 화면</Link>에서 키를 발급하면 클라이언트별 설정이 완성됩니다.</p>
              <div className="docs-two-column">
                <CodeBlock title="mcpServers" language="json" code={MCP_CONFIG_SNIPPET} caption="/connect에서 발급한 endpoint와 Bearer 키를 넣습니다." />
                <details className="docs-details">
                  <summary>실제 handshake 예시 <span>initialize → tools/list 열기</span></summary>
                  <CodeBlock title="실제 연결 확인" language="bash" code={HTTP_SESSION} caption="설정 복사 뒤 실제 서버 응답을 확인합니다." />
                </details>
              </div>
              <div className="docs-next-card"><span>다음</span><Link href="#clients">클라이언트별 설정으로 이동 <Icon name="arrowRight" size={14} /></Link></div>
            </section>

            <section className="docs-section-v2" id="clients">
              <div className="docs-section-heading">
                <span className="section-number">02</span>
                <div><span className="eyebrow">COPY THE RIGHT SHAPE</span><h2>클라이언트별 설정</h2></div>
              </div>
              <p className="docs-lead-v2">클라이언트가 읽는 설정 모양만 고르면 됩니다. 키는 workspace에서 발급하고 화면에서 복사합니다.</p>
              <div className="client-route-grid">
                <article><span>CLAUDE CODE</span><strong>CLI 등록</strong><code>claude mcp add --transport http</code><p>HTTPS endpoint와 Bearer 헤더를 한 명령으로 등록합니다.</p></article>
                <article><span>CODEX</span><strong>환경변수 분리</strong><code>codex mcp add --bearer-token-env-var</code><p>키를 환경변수로 보관하고 설정은 JSON으로 확인합니다.</p></article>
                <article><span>CURSOR · DESKTOP</span><strong>mcpServers JSON</strong><code>.cursor/mcp.json</code><p>프로젝트 또는 앱 설정 파일에 원격 서버 블록을 넣습니다.</p></article>
                <article><span>VS CODE · COPILOT</span><strong>servers / CLI</strong><code>servers · copilot mcp add</code><p>VS Code는 servers 키, Copilot은 등록 명령을 사용합니다.</p></article>
              </div>
              <Link className="button button-primary docs-inline-button" href="/agents#connect">완성된 설정 블록 열기 <Icon name="arrowUpRight" size={15} /></Link>
            </section>

            <section className="docs-section-v2" id="cli">
              <div className="docs-section-heading">
                <span className="section-number">03</span>
                <div><span className="eyebrow">AUTOMATE THE GATE</span><h2>CLI와 CI</h2></div>
              </div>
              <p className="docs-lead-v2">CLI는 실제 바이트를 읽고 JSON evidence와 0/2/4 exit code를 남깁니다. 긴 예시는 필요할 때만 펼칩니다.</p>
              <div className="docs-detail-list">
                <details className="docs-details" open><summary>GLB/GLTF inspect · validate · optimize <span>실행 명령 보기</span></summary><CodeBlock title="clunk-cli" language="bash" code={CLI_COMMANDS} caption="원본은 유지하고 output을 fresh reopen합니다." /></details>
                <details className="docs-details"><summary>texture · portrait · evidence <span>읽기 쉬움·증거 CLI 보기</span></summary><CodeBlock title="texture + portrait + evidence" language="bash" code={AUDIT_COMMANDS} caption={`${TEXTURE_AUDIT_CONTRACT.schema}: 0 PASS · 2 FAIL · 4 UNAVAILABLE.`} /></details>
                <details className="docs-details"><summary>Pixi sprite sheet review <span>RGBA rehash와 HTTP 경계 보기</span></summary><CodeBlock title="Pixi sprite sheet review" language="bash" code={SPRITE_SHEET_COMMANDS} caption={`${SPRITE_SHEET_REVIEW_CONTRACT.schema}: local byte rehash와 HTTP DECLARED_METADATA_ONLY를 분리합니다.`} /></details>
                <details className="docs-details"><summary>Atlas · PNG · Spine bundle <span>멀티파일 manifest 보기</span></summary><CodeBlock title="multi-file AssetOps bundle" language="json" code={BUNDLE_EXAMPLE} caption="entryFileName·fileCount·역할·relatesTo를 보존합니다." /></details>
              </div>
            </section>

            <section className="docs-section-v2 docs-studio-section" id="asset-studio">
              <div className="docs-section-heading">
                <span className="section-number">04</span>
                <div><span className="eyebrow">AUTHOR · INSPECT · ATTACH</span><h2>Asset Studio</h2></div>
              </div>
              <p className="docs-lead-v2">2D와 3D 모두 provenance를 남기고 검사합니다. 생성 완료와 게임 화면 승인은 다른 증거입니다.</p>
              <div className="docs-two-column">
                <div className="docs-studio-facts">
                  <article><span>CLUNK SERIES · NATIVE</span><strong>Forge · Sprite · Material · Motion · Game Ready</strong><p>GitHub 자료는 감사된 source material로만 기록하고, 실제 실행은 Clunk 내부 코드와 Core 계약으로 수행합니다. <Link href="/series">여섯 시리즈와 소스 장부 보기 <Icon name="arrowUpRight" size={14} /></Link></p></article>
                </div>
                <details className="docs-details"><summary>Game Ready mesh pass <span>별도 GLB · fresh evidence</span></summary><CodeBlock title="Clunk Series CLI" language="bash" code={CLUNK_SERIES_COMMANDS} caption="외부 생성 API를 호출하지 않으며, output과 evidence sidecar를 별도로 작성합니다." /></details>
              </div>
              <div className="docs-two-column">
                <div className="docs-studio-facts">
                  <article><span>2D</span><strong>Sprite · Atlas · Spine JSON</strong><p>PNG page, region bounds, bones, slots, attachments, animation 이름과 atlas 관계를 검사합니다.</p></article>
                  <article><span>3D</span><strong>Model · Mesh · Motion</strong><p>GLB/GLTF 구조, 재질, bounds, animation sampler와 target node를 검사합니다.</p></article>
                  <article><span>ENGINE</span><strong>Web · Godot · Unity · Unreal · Mobile</strong><p>실제 runner가 없으면 import/runtime은 ENVIRONMENT_UNAVAILABLE로 남깁니다.</p></article>
                </div>
                <details className="docs-details"><summary>Asset Studio 실행 명령 <span>Sprite · Spine · GLB · motion</span></summary><CodeBlock title="Asset Studio CLI" language="bash" code={STUDIO_COMMANDS} caption="별도 output을 작성하고 fresh reopen 후 AssetEvidence를 반환합니다." /></details>
              </div>
              <div className="docs-contract-note"><strong>사용 제한</strong><span>로컬 stdio의 clunk_asset_author와 CLI만 출력 파일을 작성합니다. 원격 HTTPS MCP는 로컬 경로를 읽거나 쓰지 않고 업로드된 bundle만 검사합니다. .skel binary parser와 실제 엔진 playback은 아직 adapter/runner가 필요하며, CONTRACT_FIXTURE나 structural PASS만으로 player-facing 승인을 만들지 않습니다.</span></div>
            </section>

            <section className="docs-section-v2" id="contracts">
              <div className="docs-section-heading">
                <span className="section-number">05</span>
                <div><span className="eyebrow">READ THE RESULT CORRECTLY</span><h2>계약과 상태</h2></div>
              </div>
              <p className="docs-lead-v2">점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 자동 승격하지 않습니다.</p>
              <EvidenceStatusGrid
                className="docs-shared-status-grid"
                ariaLabel="계약과 상태"
                items={[
                  { label: "STATIC", value: "PASS", detail: "bytes · hash · policy", tone: "pass" },
                  { label: "RUNTIME", value: "GAP", detail: "shipped frame 필요", tone: "gap" },
                  { label: "PLAYER", value: "NOT_EVALUATED", detail: "실제 화면 전", tone: "pending" },
                  { label: "HUMAN", value: "PENDING", detail: "사람 판정 대기", tone: "pending" },
                ]}
              />
              <div className="docs-detail-list">
                <details className="docs-details"><summary>asset inspection evidence JSON <span>계약 예시 보기</span></summary><CodeBlock title="clunk.asset-inspection-evidence.v2" language="json" code={EVIDENCE_EXAMPLE} caption={`${ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.evidenceKind}; finding ownership을 보존합니다.`} /></details>
                <details className="docs-details"><summary>shipped frame manifest JSON <span>runtime 입력 보기</span></summary><CodeBlock title="frame-manifest.v1" language="json" code={FRAME_EXAMPLE} caption={`${FRAME_REVIEW_CONTRACT.defaultBoundary}; renderer pair는 별도 제출합니다.`} /></details>
              </div>
              <div className="docs-contract-note"><strong>기본 경계</strong><span>reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED</span></div>
            </section>

            <section className="docs-section-v2 docs-hf-section" id="harvest-frontier">
              <div className="docs-section-heading">
                <span className="section-number">06</span>
                <div><span className="eyebrow">COLLABORATION EXAMPLE</span><h2>Harvest Frontier</h2></div>
              </div>
              <p className="docs-lead-v2">HF는 Clunk의 구조 evidence를 소비하지만 원본 에셋과 최종 플레이어 화면 판정의 source of truth를 유지합니다.</p>
              <div className="docs-hf-snapshot">
                <div><span className="mono-label">STATIC INSPECTION</span><strong>score 100 · hard blockers 0</strong><small>tractor.compact.m1.glb · read-only</small></div>
                <div><span className="mono-label">OBSERVATIONS</span><strong>88 draws · texture 0</strong><small>missing normals 7 · UV 88 · non-unit scale 181</small></div>
                <div><span className="mono-label">PLAYER REVIEW</span><strong>NO_GO · GAP</strong><small>정적 PASS는 화면 승인이 아님</small></div>
              </div>
              <div className="docs-detail-list">
                <details className="docs-details"><summary>HF tractor reinspection <span>외부 handoff 예시 보기</span></summary><CodeBlock title="canonical reinspection · received evidence" language="json" code={HF_M105_TRACTOR_INSPECTION} caption="HF 값은 외부 handoff이며 Clunk checkout에서 재검증하지 않았습니다." /></details>
                <details className="docs-details"><summary>stale evidence와 fresh run <span>현재 승인과 구분하기</span></summary><CodeBlock title="freshness · stale vs error" language="json" code={HF_HANDOFF_VERIFIER_STATUS} caption="stale coverage는 current-artifact approval이 아닙니다." /></details>
                <details className="docs-details"><summary>player-facing scene review <span>comparison과 human lane 보기</span></summary><CodeBlock title="player-facing scene review output" language="bash" code={HF_EVIDENCE_RULES} caption="comparison pair·asset provenance·human review를 합치지 않습니다." /></details>
              </div>
              <p className="docs-lead-v2 docs-footnote">협업 API는 {COLLABORATION_CONTRACT.evidenceWriteMode}, {COLLABORATION_CONTRACT.evidenceDefaults}, {COLLABORATION_CONTRACT.evidenceOnlyApi}를 사용합니다.</p>
            </section>

            <section className="docs-section-v2" id="webmcp">
              <div className="docs-section-heading">
                <span className="section-number">07</span>
                <div><span className="eyebrow">BROWSER-NATIVE AGENT FLOW</span><h2>브라우저에서 직접 확인</h2></div>
              </div>
              <p className="docs-lead-v2">WebMCP가 노출된 브라우저에서는 읽기 전용 상태 도구를 확인할 수 있습니다. 원본 파일을 바꾸거나 시각 승인을 만들지 않습니다.</p>
              <div className="docs-status-grid docs-webmcp-status-grid">
                <article className="docs-status-card docs-status-static"><span>HTTP MCP</span><strong>/api/mcp</strong><p>키 발급 후 initialize → tools/list를 실제 호출</p></article>
                <article className="docs-status-card docs-status-runtime"><span>WEBMCP</span><strong>REGISTERED / UNAVAILABLE</strong><p>브라우저 API 노출 여부를 라이브 상태로 표시</p></article>
                <article className="docs-status-card docs-status-human"><span>SAFETY BOUNDARY</span><strong>READ-ONLY</strong><p>structural PASS와 visualRuntime/GAP은 독립</p></article>
              </div>
              <details className="docs-details"><summary>document.modelContext 예시 <span>브라우저 도구 보기</span></summary><CodeBlock title="document.modelContext" language="bash" code={WEBMCP_EXAMPLE} caption="document.modelContext를 우선 확인하고 구형 호환 브라우저에서는 navigator.modelContext를 확인합니다." /></details>
            </section>

            <section className="docs-section-v2" id="scope">
              <div className="docs-section-heading">
                <span className="section-number">08</span>
                <div><span className="eyebrow">WHAT CLUNK CAN VERIFY</span><h2>지원 범위</h2></div>
              </div>
              <div className="docs-scope-grid">
                {ASSET_KIND_COVERAGE.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.detail}</strong></article>)}
              </div>
              <div className="docs-profile-list">
                {TARGET_PROFILES.map((profile) => <div key={profile.id}><strong>{profile.label}</strong><span>{profile.engine} · {profile.platform}</span><code>{profile.id}</code></div>)}
              </div>
              <p className="docs-lead-v2">지원 surface: {SURFACES.map((surface) => surface.label).join(" · ")}. 자세한 모델·재질·Spine·애니메이션 범위는 입력 종류별로 분리되어 반환됩니다.</p>
              <Link className="text-link" href="/llms.txt">에이전트용 요약 보기 <Icon name="arrowUpRight" size={14} /></Link>
            </section>

            <section className="docs-final-card">
              <div><span className="eyebrow">NEED THE UI?</span><h2>문서에서 바로 실행 화면으로 이동하세요.</h2><p>설명만 읽고 끝나지 않도록 연결 키 발급과 샘플 검사를 바로 열어 둡니다.</p></div>
              <div><Link className="button button-primary" href="/agents#connect">에이전트 연결 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/app">내 파일 검사 · 로그인 <Icon name="arrowRight" size={15} /></Link></div>
            </section>
          </article>
        </div>
      </main>
    </SiteShell>
  );
}
