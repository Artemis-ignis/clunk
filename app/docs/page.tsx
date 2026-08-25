import type { Metadata } from "next";
import Link from "../components/NativeLink";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { DocsSearch } from "./DocsSearch";
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
  SURFACES,
  TARGET_PROFILES,
  TEXTURE_AUDIT_CONTRACT,
  UI_READABILITY_CONTRACT,
} from "../components/product-facts";

export const metadata: Metadata = {
  title: "문서와 연동 가이드 | Clunk",
  description: "Clunk MCP, CLI, AssetOps, frame evidence 계약을 빠르게 찾고 실제로 연결하는 문서입니다.",
};

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

export default function DocsPage() {
  return (
    <SiteShell active="docs">
      <main className="docs-page-redesign">
        <header className="docs-hero-v2">
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
              <a href="#contracts"><span>04</span>계약과 상태</a>
              <a href="#harvest-frontier"><span>05</span>Harvest Frontier</a>
              <a href="#scope"><span>06</span>지원 범위</a>
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
                <CodeBlock title="mcpServers" language="json" code={MCP_CONFIG_SNIPPET} caption="endpoint와 Bearer 키는 /agents에서 발급한 실제 값으로 채워집니다." />
                <CodeBlock title="실제 연결 확인" language="bash" code={HTTP_SESSION} caption="설정 파일만 복사하지 않고 initialize와 tools/list를 실제로 확인합니다." />
              </div>
              <div className="docs-next-card"><span>다음</span><Link href="#clients">클라이언트별 설정으로 이동 <Icon name="arrowRight" size={14} /></Link></div>
            </section>

            <section className="docs-section-v2" id="clients">
              <div className="docs-section-heading">
                <span className="section-number">02</span>
                <div><span className="eyebrow">COPY THE RIGHT SHAPE</span><h2>클라이언트별 설정</h2></div>
              </div>
              <p className="docs-lead-v2">모든 클라이언트에 같은 문장을 넣는 것이 아니라, 각 도구가 실제로 읽는 명령·JSON·servers 키를 사용합니다.</p>
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
              <p className="docs-lead-v2">CLI stdout의 JSON이 CI의 기준입니다. 실패와 미지원은 서로 다른 exit code로 남기고, optimize는 요청된 별도 output에만 씁니다.</p>
              <CodeBlock title="clunk-cli" language="bash" code={CLI_COMMANDS} caption="parse · policy · output reopen · Passport 순서를 유지합니다." />
              <CodeBlock title="texture + portrait + evidence" language="bash" code={AUDIT_COMMANDS} caption={`${TEXTURE_AUDIT_CONTRACT.schema}: exit 0 PASS · 2 FAIL · 4 UNAVAILABLE. ${UI_READABILITY_CONTRACT.schema}도 같은 경계를 사용합니다.`} />
              <CodeBlock title="multi-file AssetOps bundle" language="json" code={BUNDLE_EXAMPLE} caption="atlas·PNG·Spine처럼 함께 움직이는 파일은 entryFileName, fileCount, 역할, relatesTo를 한 요청으로 보존합니다." />
            </section>

            <section className="docs-section-v2" id="contracts">
              <div className="docs-section-heading">
                <span className="section-number">04</span>
                <div><span className="eyebrow">READ THE RESULT CORRECTLY</span><h2>계약과 상태</h2></div>
              </div>
              <p className="docs-lead-v2">점수는 구조 계약의 한 축입니다. 실제 게임 화면과 사람의 판단은 각각 별도 필드이며 자동 승격하지 않습니다.</p>
              <div className="docs-status-grid">
                <article className="docs-status-card docs-status-static"><span>STRUCTURAL</span><strong>PASS</strong><p>bytes, hash, parser, policy, hard blocker</p></article>
                <article className="docs-status-card docs-status-runtime"><span>VISUAL RUNTIME</span><strong>GAP</strong><p>shipped renderer와 frame evidence가 없으면 GAP</p></article>
                <article className="docs-status-card docs-status-human"><span>HUMAN DECISION</span><strong>NO_GO / PENDING</strong><p>사람의 화면 리뷰 없이는 PASS가 아님</p></article>
              </div>
              <CodeBlock title="clunk.asset-inspection-evidence.v2" language="json" code={EVIDENCE_EXAMPLE} caption={`${ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.evidenceKind}; qualityPolicy와 finding ownership을 보존합니다.`} />
              <CodeBlock title="frame-manifest.v1" language="json" code={FRAME_EXAMPLE} caption={`${FRAME_REVIEW_CONTRACT.defaultBoundary}; WebGPU와 WebGL2는 별도 pair로 제출합니다.`} />
              <div className="docs-contract-note"><strong>기본 경계</strong><span>reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED</span></div>
            </section>

            <section className="docs-section-v2 docs-hf-section" id="harvest-frontier">
              <div className="docs-section-heading">
                <span className="section-number">05</span>
                <div><span className="eyebrow">COLLABORATION EXAMPLE</span><h2>Harvest Frontier</h2></div>
              </div>
              <p className="docs-lead-v2">HF는 Clunk의 구조 evidence를 소비하지만 원본 에셋과 최종 플레이어 화면 판정의 source of truth를 유지합니다.</p>
              <div className="docs-hf-snapshot">
                <div><span className="mono-label">STATIC INSPECTION</span><strong>score 100 · hard blockers 0</strong><small>tractor.compact.m1.glb · read-only</small></div>
                <div><span className="mono-label">OBSERVATIONS</span><strong>88 draws · texture 0</strong><small>missing normals 7 · UV 88 · non-unit scale 181</small></div>
                <div><span className="mono-label">PLAYER REVIEW</span><strong>NO_GO · GAP</strong><small>정적 PASS는 화면 승인이 아님</small></div>
              </div>
              <CodeBlock title="canonical reinspection · received evidence" language="json" code={HF_M105_TRACTOR_INSPECTION} caption="실제 HF 값은 fixture template와 분리하고, optimize 없이 read-only로 보존합니다." />
              <CodeBlock title="freshness · stale vs error" language="json" code={HF_HANDOFF_VERIFIER_STATUS} caption="27 never-notarised는 coverage incomplete이며 current-artifact approval이 아닙니다." />
              <CodeBlock title="player-facing scene review output" language="bash" code={HF_EVIDENCE_RULES} caption="comparison pair·asset provenance·human review를 한 상태로 합치지 않습니다." />
              <p className="docs-lead-v2 docs-footnote">협업 API는 {COLLABORATION_CONTRACT.evidenceWriteMode}, {COLLABORATION_CONTRACT.evidenceDefaults}, {COLLABORATION_CONTRACT.evidenceOnlyApi}를 사용합니다.</p>
            </section>

            <section className="docs-section-v2" id="scope">
              <div className="docs-section-heading">
                <span className="section-number">06</span>
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
              <div><Link className="button button-primary" href="/agents#connect">에이전트 연결 <Icon name="arrowUpRight" size={15} /></Link><Link className="button button-quiet" href="/app">검사기 열기 <Icon name="arrowRight" size={15} /></Link></div>
            </section>
          </article>
        </div>
      </main>
    </SiteShell>
  );
}
