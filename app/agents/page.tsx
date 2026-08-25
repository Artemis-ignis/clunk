import type { Metadata } from "next";
import { SiteShell } from "../components/SiteShell";
import { AgentsClient } from "./AgentsClient";
import {
  ASSET_INSPECTION_CONTRACT,
  ASSET_INSPECTION_EVIDENCE_V2_CONTRACT,
  GENERATION_CONTRACT,
  ASSET_KIND_COVERAGE,
  COLLABORATION_CONTRACT,
  MCP_SERVER,
  MCP_TOOLS,
  RULE_SET,
  SURFACES,
  TARGET_PROFILES,
  TEXTURE_AUDIT_CONTRACT,
  UI_READABILITY_CONTRACT,
  QUALITY_WARNING_CONTRACT,
  HF_TEXTURE_SCENE_GAPS,
  HF_M105_CURRENT_HANDOFF,
  HF_M105_TRACTOR_INSPECTION,
  HF_HANDOFF_VERIFIER_STATUS,
} from "../components/product-facts";

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
              Clunk가 직접 발급한 HTTPS MCP endpoint와 workspace 키를 클라이언트에 한 번 연결하세요.
              로컬 GLB는 stdio로, 원격 에이전트와 협업 증거는 HTTP로 같은 Clunk Core에 전달됩니다.
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
              <span>streamable HTTP · workspace key</span>
              <code>clunk v{MCP_SERVER.version}</code>
            </div>
            <div className="agents-terminal-line">
              <span className="tok-prompt">$</span>
              <span>/api/mcp · Authorization: Bearer clunk_live_…</span>
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
            <strong>Clunk HTTPS endpoint 하나</strong>
            <p>키를 한 번 발급하면 클라이언트별 설정에 자동으로 삽입됩니다.</p>
          </div>
          <div>
            <span className="mono-label">SAME CORE</span>
            <strong>{SURFACES.length}개 표면, 같은 결과</strong>
            <p>웹 검사기·CLI·HTTP·stdio가 같은 계약을 호출합니다.</p>
          </div>
          <div>
            <span className="mono-label">NO FAKE READY</span>
            <strong>점수보다 근거를 저장</strong>
            <p>hash, finding, fresh reinspection과 Passport를 구분합니다.</p>
          </div>
        </section>

        <section className="agents-connection-status" aria-labelledby="mcp-status-heading">
          <div>
            <span className="eyebrow">현재 연결 상태</span>
            <h2 id="mcp-status-heading">이제 여기서 실제 연결을 확인하세요.</h2>
            <p>
              ‘Clunk 연결 키 만들기’를 누르면 이 workspace 전용 Bearer 키가 발급됩니다. 연결 확인은
              실제 <code>initialize</code>와 <code>tools/list</code> 요청을 보내므로, 설정 블록만 복사하고 끝나지 않습니다.
            </p>
          </div>
          <div className="agents-connection-checks">
            <article>
              <strong>1. 원격 연결은 Clunk 키로 인증</strong>
              <p>HTTPS endpoint에는 workspace에서 발급한 <code>Authorization: Bearer clunk_live_…</code>가 필요합니다. 키는 화면에서 한 번만 보여 줍니다.</p>
            </article>
            <article>
              <strong>2. 로컬 파일은 stdio fallback</strong>
              <p>원격 HTTP는 에이전트가 제출한 base64 asset bundle 또는 검증된 evidence만 받습니다. 컴퓨터의 절대 경로는 로컬 stdio에서만 읽습니다.</p>
            </article>
            <article>
              <strong>3. 클라이언트 설정은 완성본</strong>
              <p>키를 만든 뒤 Claude Code 명령, Codex/Cursor/Claude Desktop JSON, VS Code servers JSON에 실제 endpoint와 키가 들어갑니다.</p>
            </article>
            <article>
              <strong>4. 결과의 경계</strong>
              <p>구조 score=100은 구조 계약 PASS일 뿐입니다. visualRuntime, playerFacing, humanDecision은 사람이 확인하기 전까지 자동 승격하지 않습니다.</p>
            </article>
          </div>
          <pre className="agents-connection-smoke"><code>{`POST /api/mcp
Authorization: Bearer clunk_live_…
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }
# Clunk 연결 확인 버튼이 위 요청과 tools/list를 실제 실행합니다.`}</code></pre>
        </section>

        <section className="agents-connect-section" id="connect">
          <div className="agents-section-head">
            <span className="eyebrow">CLIENT SETUP</span>
            <h2>쓰는 클라이언트에 맞춰 한 블록만 복사하세요.</h2>
            <p>
              클라이언트별 설정을 Clunk가 직접 생성합니다. 키를 발급한 뒤 한 블록을 복사하거나
              파일로 다운로드하면 endpoint·인증 헤더·클라이언트별 루트가 이미 채워집니다.
            </p>
          </div>
          <AgentsClient />
        </section>

        <section className="agents-tools-section">
          <div className="agents-section-head agents-section-head-tight">
            <span className="eyebrow">TOOLS THE AGENT CAN CALL</span>
            <h2>에이전트가 실제로 부르는 {MCP_TOOLS.length}가지 도구</h2>
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

        <section className="agents-evidence-section" aria-labelledby="target-contract-heading">
          <div className="agents-section-head">
            <span className="eyebrow">ENGINE-AWARE · 2D + 3D</span>
            <h2 id="target-contract-heading">숫자만 READY라고 부르지 않습니다.</h2>
            <p>
              같은 에셋도 Godot, Unity, Unreal, Web/Three.js, 모바일의 import·텍스처·좌표·디바이스
              조건이 다릅니다. 아래는 검사 대상 계약이며, 실제 엔진을 호출하지 못한 단계는 PASS로 바꾸지
              않고 <code>environmentUnavailable</code> 또는 <code>unsupported</code>로 남깁니다.
            </p>
          </div>
          <div className="agents-coverage-grid">
            {ASSET_KIND_COVERAGE.map((item) => (
              <article key={item.label} className="agents-coverage-card">
                <span className="mono-label">{item.label}</span>
                <strong>{item.detail}</strong>
              </article>
            ))}
          </div>
          <div className="agents-profile-grid">
            {TARGET_PROFILES.map((profile) => (
              <article key={profile.id} className="agents-profile-card">
                <div><strong>{profile.label}</strong><span>{profile.engine} · {profile.platform}{profile.requiresDeviceGate ? " · device gate" : ""}</span></div>
                <code>{profile.id}</code>
                <small>{profile.assetKinds.join(" · ")} · {profile.formats.join(", ")}</small>
              </article>
            ))}
          </div>
          <div className="agents-ci-grid agents-generation-contract">
            <article className="agents-ci-card">
              <span className="mono-label">PROFILE-AWARE AUTHORING</span>
              <code>{GENERATION_CONTRACT.result}</code>
              <p>{GENERATION_CONTRACT.supported}. {GENERATION_CONTRACT.verification}.</p>
              <pre><code>{GENERATION_CONTRACT.command}</code></pre>
            </article>
            <article className="agents-ci-card">
              <span className="mono-label">NO PRETEND OUTPUT</span>
              <code>{GENERATION_CONTRACT.request}</code>
              <p>{GENERATION_CONTRACT.unavailable}. {GENERATION_CONTRACT.passport}.</p>
            </article>
          </div>
        </section>

        <section className="agents-ci-section" aria-labelledby="ci-contract-heading">
          <div className="agents-section-head agents-section-head-tight">
            <span className="eyebrow">CI CONTRACTS · NO BLIND SPOTS</span>
            <h2 id="ci-contract-heading">텍스처와 UI readability는 별도 게이트입니다.</h2>
          </div>
          <div className="agents-ci-grid">
            <article className="agents-ci-card agents-ci-card-pass">
              <span className="mono-label">SHIPPED · TEXTURE</span>
              <code>{TEXTURE_AUDIT_CONTRACT.schema}</code>
              <p><strong>{TEXTURE_AUDIT_CONTRACT.passExit}</strong> PASS · <strong>{TEXTURE_AUDIT_CONTRACT.policyExit}</strong> strict 위반 · <strong>{TEXTURE_AUDIT_CONTRACT.unavailableExit}</strong> 미지원</p>
              <pre><code>{TEXTURE_AUDIT_CONTRACT.command}</code></pre>
              <small>GPU 밉 메모리·심리스·거리 band·밴딩 전이·판독성 측정. evaluationProfile의 renderer/viewport/distanceBands/requiredGrade/resolutionPolicy를 기록하지만 엔진 import/runtime 또는 플레이어 화면 PASS가 아닙니다.</small>
            </article>
            <article className="agents-ci-card agents-ci-card-pass">
              <span className="mono-label">SHIPPED · UI RASTER</span>
              <code>{UI_READABILITY_CONTRACT.schema}</code>
              <p><strong>{UI_READABILITY_CONTRACT.status}</strong> · capability <strong>{UI_READABILITY_CONTRACT.capability}</strong> · exit <strong>{UI_READABILITY_CONTRACT.exit}</strong></p>
              <pre><code>{UI_READABILITY_CONTRACT.command}</code></pre>
              <small>원본 128px을 config의 실제 renderPx( HF는 46px )로 재래스터화해 명도 범위·엣지·국소 대비·그룹 ΔE76을 측정합니다. {UI_READABILITY_CONTRACT.metadata} · {UI_READABILITY_CONTRACT.deltaE}. PASS여도 엔진 import/runtime과 실제 플레이어 프레임은 <strong>NOT_EVALUATED</strong>입니다.</small>
            </article>
          </div>
          <p className="agents-section-note">
            texture 품질 후속은 <code>{QUALITY_WARNING_CONTRACT.field}</code>의 <code>{QUALITY_WARNING_CONTRACT.status}</code>로
            hard validation과 분리합니다. HF 경고인 grass-meadow 15m D, dirt-path C, soil-tilled D,
            wood-planks C, plaster C, roof tiles B는 실제 shipped frame 거리와 사용처를 붙여 개선합니다.
          </p>
          <div className="agents-warning-list" aria-label="Harvest Frontier texture warning prescriptions">
            {HF_TEXTURE_SCENE_GAPS.map((item) => (
              <article key={item.id}>
                <div><strong>{item.label} · {item.grade}</strong><span>{item.priority} · NON_BLOCKING</span></div>
                <p>{item.context}</p>
                <small>{item.prescription}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="agents-loop-section">
          <div className="agents-loop-copy">
            <span className="eyebrow">THE HANDOFF</span>
            <h2>Harvest Frontier처럼 실제 게임 프로젝트에 연결하는 흐름</h2>
              <p>
              생성 에이전트가 에셋을 만든 뒤 Clunk를 호출하고, 게임 프로젝트는 원본과 검사 결과를
              분리해 받습니다. Clunk는 아직 게임 엔진을 대신 실행하지 않지만, 어느 파일을 어떤
              규칙으로 넘겼는지 재현 가능한 증거를 남깁니다. 엔진 인지 검사는
              <code>clunk_asset_inspect</code>와 <code>npm.cmd run asset:inspect</code>에서 같은
              <code>AssetEvidence</code>를 반환합니다.
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
          <div className="agents-contract-callout">
            <span className="eyebrow">V2 EVIDENCE LANE</span>
            <h3>{ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.schema}</h3>
            <p>
              CI에서 <code>CONTRACT_FIXTURE</code>와 <code>PLAYER_FACING_CAPTURE</code>를 분리해 제출합니다.
              identity는 {ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.identity}를 보존하고,
              {ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.defaultBoundary}.
              오디오 캡처는 {ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.audio}.
            </p>
            <code>{ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.cli}</code>
          </div>
        </section>

        <section className="agents-boundary">
          <div>
            <span className="eyebrow">PUBLIC API STATUS</span>
            <h2>Clunk가 직접 운영하는 HTTP MCP</h2>
            <p>
              HTTP MCP는 Clunk가 직접 제공하는 <code>/api/mcp</code> endpoint로 출시되어 있습니다. 연결 키는
              workspace에 묶이고 폐기할 수 있으며, HTTP는 local absolute path를 읽지 않고 업로드된 bytes나
              검증된 evidence만 처리합니다. Clunk 웹의 <code>/api/me</code>, <code>/api/runs</code>,
              <code>/api/passports</code>는 여전히 인증된 앱 경계입니다.
            </p>
          </div>
          <div className="agents-boundary-stamp">
            <span className="status-pill status-ready">SHIPPED</span>
            <strong>HTTP MCP</strong>
            <code>https endpoint + workspace bearer key</code>
          </div>
        </section>

        <section className="agents-collaboration-note" aria-labelledby="collaboration-contract-heading">
          <div>
            <span className="eyebrow">AUTHENTICATED COLLABORATION</span>
            <h2 id="collaboration-contract-heading">Harvest Frontier 피드백은 workspace 스레드에 저장합니다.</h2>
            <p>
              Clunk 감사 결과와 visual/runtime gap을 한 숫자로 합치지 않습니다. 로그인한 workspace에서
              <code>{COLLABORATION_CONTRACT.create}</code>로 스레드를 만들고, <code>inputHash</code>와
              custom/base profile을 고정한 뒤 메모와 <code>{COLLABORATION_CONTRACT.evidence}</code>를 함께 추가합니다.
              frame manifest의 <code>sceneGaps</code>는 증거를 보존하지만 player-facing 판정을 자동으로 PASS로 올리지
              않고 <code>{COLLABORATION_CONTRACT.playerFacing}</code>로 남습니다. texture/gameplay-band detail loss는
              <code>{COLLABORATION_CONTRACT.prescriptions}</code>로 다음 조치를 남길 수 있습니다. 기본 상태는
              <code>{COLLABORATION_CONTRACT.evidenceDefaults}</code>이며, 다음 캡처는
              <code>{COLLABORATION_CONTRACT.evidenceWriteMode}</code>로 기존 gap/prescription 보존 여부를 명시합니다.
              현재 실제 M94 저장값은 <code>{COLLABORATION_CONTRACT.storedM94}</code>입니다. 협업 증거도 발급 키로 HTTP MCP에서 제출할 수 있습니다.
              원본 에셋을 frame과 묶을 때는 <code>{COLLABORATION_CONTRACT.linkedAssetInspection}</code>을 사용하며,
              frame manifest만 갱신할 때는 <code>{COLLABORATION_CONTRACT.evidenceOnlyApi}</code>를 사용합니다. procedural/runtime-generated
              작물·식생·NPC는 <code>origin</code>과 <code>provenance.sourceRef</code>를 함께 기록하지만 별도 GLB 바이트 PASS로 만들지 않습니다.
              연결된 정적 에셋의 fresh provenance는 <code>{COLLABORATION_CONTRACT.assetEvidenceRef}</code>로 표시하며,
              <code>CURRENT</code>는 구조 재검사 provenance일 뿐 시각 승인 이력이 아니고 <code>STALE</code>·<code>UNKNOWN</code>은
              모두 <code>NOT CURRENT APPROVAL</code>입니다. 해시 불일치나 잘못된 digest는 저장을 거부합니다.
              fresh HF asset entry에는 <code>inspectionRunId</code>와 <code>targetProfileId</code>도 필수입니다.
              협업 상태의 <code>readinessReason</code>은 <code>{COLLABORATION_CONTRACT.readinessReason}</code> enum으로 남으며,
              <code>ENGINE_ENVIRONMENT_UNAVAILABLE</code>은 Godot/Unity/Unreal/mobile 런너 미제공을 뜻할 뿐 PASS가 아닙니다.
              플레이어 화면 gap을 구조화하려면 <code>{COLLABORATION_CONTRACT.sceneReviewCli}</code>를 사용합니다.
              이 결과는 severity, evidence path/hash, affected scene/asset, ownership, nextStep을 반환하지만
              <code>visualRuntime: GAP</code>·<code>playerFacing: NOT_EVALUATED</code>·human review PENDING을 유지합니다.
              before/after 증거는 <code>{COLLABORATION_CONTRACT.comparisonSchema}</code>로 묶고,
              <code>{COLLABORATION_CONTRACT.comparisonMismatch}</code>가 하나라도 있으면 저장을 거부합니다.
              M105처럼 renderer가 다른 두 후보 frame은 <code>{COLLABORATION_CONTRACT.comparisonIngest}</code>로
              수신만 하고 pair를 만들지 않습니다. score 100과 INFO 관찰은
              <code>{COLLABORATION_CONTRACT.numericFindingBoundary}</code>로 표시하며,
              stale notarisation은 <code>{COLLABORATION_CONTRACT.reinspectionWorkflow}</code>를 따릅니다.
              gap별 closeout은 <code>{COLLABORATION_CONTRACT.gapCloseout}</code>이며,
              <code>{COLLABORATION_CONTRACT.proceduralRule}</code>입니다.
              최신 HF handoff의 sourceHead <code>3e5fffa</code>와 M84 capture 경로는 수신했지만,
              Clunk가 실제 파일 bytes/hash를 확인하기 전까지는 <code>PATH_RECEIVED_HASH_PENDING</code>으로 기록합니다.
              최신 M104 컨트롤러 판정 sourceHead <code>ed6302b</code>는 human <code>NO_GO</code>·
              <code>visualRuntime: GAP</code>로 수신했으며, 대화 NPC 가독성·딜러/장터 구도·흙/잔디/길
              경계·반복 식생/지형/전경 관통의 네 gap은 <code>OPEN</code>으로 기록합니다.
              pair/hash/camera 메타데이터가 아직 없으므로 pair 자체는 <code>NOT_EVALUATED</code>이고,
              <code>CLOSED</code>나 <code>REOPENED</code> closeout은 주장하지 않습니다.
              따라서 그 네 scene gap은 실제 hash가 제출되기 전에는 <code>scene-review</code>의 reviewable evidence로
              승격되지 않습니다.
              M103 packaged WebGPU의 no-HUD frame hash, title/hud/walk auxiliary hash와 report PASS도
              <code>HANDOFF_RECEIVED</code>로 별도 보존했지만, report PASS는 human visual approval이 아닙니다.
              현재 M103 human decision은 <code>NO_GO / PLAYER_FACING_SCENE_GAP</code>이며
              <code>reviewStatus: NOT_EVALUATED</code>·<code>visualRuntime: GAP</code>·<code>playerFacing: NOT_EVALUATED</code>를 유지합니다.
              바이트 검사는 <code>{ASSET_INSPECTION_CONTRACT.request}</code>의 인증 API 또는
              <code>{ASSET_INSPECTION_CONTRACT.cli}</code>로 실행합니다.
            </p>
            <details className="agents-handoff-details">
              <summary>HF M105 및 최신 read-only 관찰 상태 펼치기</summary>
              <pre><code>{HF_M105_CURRENT_HANDOFF}</code></pre>
              <pre><code>{HF_M105_TRACTOR_INSPECTION}</code></pre>
              <pre><code>{HF_HANDOFF_VERIFIER_STATUS}</code></pre>
            </details>
          </div>
          <a className="button button-quiet button-sm" href="/dashboard">대시보드에서 메모 남기기 <span aria-hidden="true">→</span></a>
        </section>
      </main>
    </SiteShell>
  );
}
