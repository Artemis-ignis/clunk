import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import {
  CLI_SAMPLE,
  ASSET_KIND_COVERAGE,
  COLLABORATION_CONTRACT,
  EDITOR_PACKAGES,
  MCP_CONFIG_SNIPPET,
  MCP_SERVER,
  MCP_TOOLS,
  RULE_SET,
  SURFACES,
  TARGET_PROFILES,
  TEXTURE_AUDIT_CONTRACT,
  UI_READABILITY_CONTRACT,
  VSCODE_COMMANDS,
} from "../components/product-facts";

export const metadata: Metadata = {
  title: "연동과 지원 범위",
  description: "Clunk를 에이전트와 CLI에 붙이는 방법, 그리고 v1이 실제로 하는 일과 하지 않는 일입니다.",
};

const CLI_COMMANDS = `# 검사: 리포트 한 덩어리를 stdout으로
$ npm run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 판정: 정책을 만족하지 않으면 exit code 2
$ npm run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 최적화: 원본은 두고 새 파일을 씁니다
$ npm run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# Passport: 원본과 결과물을 각각 다시 검사해 하나로 묶습니다
$ npm run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb`;

const ASSET_AUDIT_COMMANDS = `# 3D / 2D target contract
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict

# Portrait UI readability at the actual draw size
$ npm.cmd run asset:ui-readability -- --config portrait-ui.json --format json --strict
# exit 0 PASS · exit 2 FAIL · exit 4 UNAVAILABLE · clunk.ui-readability.v1`;

const AGENT_SESSION = `$ echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | npm run mcp
  protocolVersion  ${MCP_SERVER.protocolVersion}
  serverInfo       ${MCP_SERVER.name} v${MCP_SERVER.version}

$ tools/list
  ${MCP_TOOLS.map((tool) => tool.name).join("\n  ")}

$ tools/call clunk_inspect { "path": "${CLI_SAMPLE.file}", "profile": "${CLI_SAMPLE.profileId}" }
  score          ${CLI_SAMPLE.score}/100
  findings       ${CLI_SAMPLE.findings.length}
  inputHash      ${CLI_SAMPLE.inputHash.slice(0, 24)}`;

export default function DocsPage() {
  return (
    <SiteShell active="docs">
      <main className="page">
        <header className="page-head">
          <span className="eyebrow">연동 가이드</span>
          <h1>
            에이전트에 붙이고,
            <br />
            <em>CI에서 막습니다.</em>
          </h1>
          <p className="lead">
            Clunk는 MCP 서버와 CLI를 함께 제공합니다. 두 경로 모두 웹 검사기와 같은 Core를 호출하므로 같은 해시와 같은
            점수가 나옵니다.
          </p>
        </header>

        <section className="doc-section">
          <h2>MCP로 연결하기</h2>
          <p className="doc-lead">
            서버는 stdio JSON-RPC로 동작합니다. 아래 설정을 에이전트의 MCP 클라이언트 설정 파일에 넣으면 도구 4개가
            그대로 노출됩니다. MCP 표준을 지원하는 에이전트라면 별도 어댑터 없이 사용할 수 있습니다.
          </p>
          <div className="doc-split">
            <CodeBlock
              title=".mcp.json"
              language="json"
              code={MCP_CONFIG_SNIPPET}
              caption="저장소에 들어 있는 plugins/clunk-assetops/.mcp.json과 같은 형태입니다."
            />
            <CodeBlock
              title="검증한 호출 흐름"
              language="bash"
              code={AGENT_SESSION}
              caption="initialize에서 tools/list, clunk_inspect까지 실제로 확인한 값입니다."
            />
          </div>
          <Link className="text-link" href="/agents">
            Claude Code · Codex · Cursor별 연결 탭 보기
            <Icon name="arrowRight" size={15} />
          </Link>

          <ul className="tool-table">
            {MCP_TOOLS.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <p>{tool.summary}</p>
                <span className="mono-label">입력 {tool.input}</span>
                <span className="mono-label">출력 {tool.output}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="doc-section">
          <h2>CLI로 실행하기</h2>
          <p className="doc-lead">
            네 개 명령 모두 JSON 한 덩어리를 stdout으로 출력합니다. <code>validate</code>는 정책을 만족하지 않으면 exit
            code 2로 끝나므로 CI 게이트에 그대로 넣을 수 있습니다.
          </p>
          <CodeBlock title="terminal" language="bash" code={CLI_COMMANDS} />
        </section>

        <section className="doc-section">
          <h2>2D·3D와 엔진 대상 계약</h2>
          <p className="doc-lead">
            GLB 숫자만으로 게임 준비 완료를 선언하지 않습니다. PNG·JPG·WebP 이미지, Sprite atlas,
            Spine JSON, glTF animation clip도 실제 바이트를 읽어 구조·정책을 판정합니다. Godot,
            Unity, Unreal, Web/Three.js와 Android·iOS 프로파일은 좌표·포맷·텍스처·애니메이션·디바이스
            조건을 선언하며, 실제 import/runtime을 호출하지 못한 단계는 PASS가 아니라 환경 미사용으로 남습니다.
          </p>
          <div className="doc-coverage-grid">
            {ASSET_KIND_COVERAGE.map((item) => <div className="doc-coverage-card" key={item.label}><strong>{item.label}</strong><span>{item.detail}</span></div>)}
          </div>
          <div className="doc-profile-table">
            {TARGET_PROFILES.map((profile) => <div key={profile.id}><strong>{profile.label}</strong><code>{profile.id}</code><span>{profile.engine} · {profile.platform}{profile.requiresDeviceGate ? " · device gate" : ""}</span></div>)}
          </div>
        </section>

        <section className="doc-section">
          <h2>외부 프로젝트 CI 계약</h2>
          <p className="doc-lead">
            Harvest Frontier처럼 외부 프로젝트가 호출할 수 있는 명령은 측정 종류별로 분리합니다.
            텍스처 PASS와 UI raster PASS를 하나의 player-facing READY로 합치지 않습니다.
          </p>
          <CodeBlock title="asset-audit" language="bash" code={ASSET_AUDIT_COMMANDS} />
          <div className="doc-ci-contracts">
            <article><span className="mono-label">TEXTURE · SHIPPED</span><code>{TEXTURE_AUDIT_CONTRACT.schema}</code><p>exit {TEXTURE_AUDIT_CONTRACT.passExit}=PASS · {TEXTURE_AUDIT_CONTRACT.policyExit}=strict 위반 · {TEXTURE_AUDIT_CONTRACT.unavailableExit}=미지원</p></article>
            <article><span className="mono-label">UI RASTER · SHIPPED</span><code>{UI_READABILITY_CONTRACT.schema}</code><p>{UI_READABILITY_CONTRACT.status} · {UI_READABILITY_CONTRACT.capability} · exit {UI_READABILITY_CONTRACT.exit}. {UI_READABILITY_CONTRACT.render} · player-facing {UI_READABILITY_CONTRACT.playerFacing}.</p></article>
          </div>
        </section>

        <section className="doc-section">
          <h2>Harvest Frontier 협업 상태</h2>
          <p className="doc-lead">
            인증된 workspace 스레드에 inputHash, custom/base profile, rule-set, Clunk 감사 상태와
            visual/runtime 상태를 함께 기록합니다. {COLLABORATION_CONTRACT.statuses.join(" · ")} 상태를
            사용하며, <code>SCENE_GAP</code>은 Clunk asset audit PASS 이후에도 게임 화면 검토가 남았다는 뜻입니다.
            스크린샷/frame manifest는 <code>{COLLABORATION_CONTRACT.evidence}</code>로 저장하고, 그 안의
            <code>reviewStatus: NOT_EVALUATED</code>는 실제 WebGPU/무-HUD 화면 판정을 대신하지 않습니다.
          </p>
          <div className="doc-api-contract"><code>{COLLABORATION_CONTRACT.list}</code><code>{COLLABORATION_CONTRACT.create}</code><code>{COLLABORATION_CONTRACT.detail}</code><code>{COLLABORATION_CONTRACT.message}</code></div>
        </section>

        <section className="doc-section">
          <h2>에디터와 플러그인</h2>
          <p className="doc-lead">
            터미널을 열지 않고 편집기 안에서 바로 돌리고 싶을 때 쓰는 경로입니다. 세 패키지 모두 저장소 안에 들어
            있고, 각자 새 분석기를 만들지 않고 같은 Core를 호출합니다.
          </p>
          <ul className="package-list">
            {EDITOR_PACKAGES.map((item) => (
              <li key={item.key}>
                <div className="package-top">
                  <Icon name="plug" size={15} />
                  <strong>{item.label}</strong>
                  <code>{item.path}</code>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
          <div className="command-strip">
            <span className="mono-label">VS Code 명령 팔레트</span>
            <ul>
              {VSCODE_COMMANDS.map((command) => (
                <li key={command.id}>
                  <code>{command.title}</code>
                  <p>{command.summary}</p>
                  <span className="mono-label">{command.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="doc-section">
          <h2>어디서 실행해도 계약은 같습니다</h2>
          <ul className="surface-list">
            {SURFACES.map((surface) => (
              <li key={surface.path}>
                <Icon name="boxes" size={15} />
                <strong>{surface.label}</strong>
                <code>{surface.path}</code>
              </li>
            ))}
          </ul>
          <p className="doc-lead">
            네 표면 모두 <code>coreBuildId</code>, <code>ruleSetId</code>, <code>inputHash</code>,{" "}
            <code>resultDigest</code>를 기록합니다. 에이전트가 읽을 요약본은 <a href="/llms.txt">/llms.txt</a>에 있습니다.
          </p>
        </section>

        <section className="doc-section">
          <h2>v1이 하는 일과 하지 않는 일</h2>
          <div className="scope-grid">
            <article className="scope-card">
              <h3>지원 입력</h3>
              <p>
                GLB와 glTF 2.0을 지원합니다. GLB는 바이트가 자체 포함되어 파일럿에 권장됩니다. 외부 glTF 리소스는 선택한
                로컬 번들에 포함된 경우에만 처리합니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>자동으로 적용하는 변경</h3>
              <p>
                쓰이지 않는 identity 노드 제거, 동일 머티리얼 dedupe, 명시적 메타데이터 정리, 별도 출력 파일 재패킹까지
                네 가지입니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>자동으로 적용하지 않는 변경</h3>
              <p>
                mesh 단순화, texture 재인코딩, Draco와 Meshopt 압축, quantization, animation과 skin 변경, 알 수 없는
                extension 수정은 v1에서 하지 않습니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>준비 완료의 조건</h3>
              <p>
                파싱, 정책, 점수, 출력 재검사, blocker 검토, 다운로드 artifact 재오픈이 모두 통과해야 합니다. 점수 기준은{" "}
                {RULE_SET.readyScoreThreshold}점이고 규칙 세트는 {RULE_SET.id} v{RULE_SET.version}입니다.
              </p>
            </article>
          </div>
        </section>

        <section className="callout">
          <div>
            <h2>브라우저에서 바로 확인</h2>
            <p>같은 Core가 브라우저에서도 동작합니다. 샘플 파일 하나로 전체 흐름을 볼 수 있습니다.</p>
          </div>
          <Link className="button button-primary" href="/app">
            검사기 열기
            <Icon name="arrowUpRight" size={15} />
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}
