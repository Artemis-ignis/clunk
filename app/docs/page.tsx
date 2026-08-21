import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import {
  CLI_SAMPLE,
  EDITOR_PACKAGES,
  MCP_CONFIG_SNIPPET,
  MCP_INSTALL_COMMAND,
  MCP_SERVER,
  MCP_TOOL_COUNT,
  MCP_TOOLS,
  RULE_SET,
  SURFACES,
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
$ npm run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb

# 서버 검증 Passport 확인: 서명이 깨졌거나 파일이 다르면 exit code 2
$ npm run clunk -- verify passport.json --asset model.glb --key clunk-verification-key.json`;

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
            연결은 두 줄,
            <br />
            <em>그다음은 에이전트가 합니다.</em>
          </h1>
          <p className="lead">
            파일 하나를 내려받아 에이전트에 등록하면 끝입니다. 저장소를 클론할 필요도, 의존성을 설치할
            필요도 없습니다. CLI도 같은 Core를 호출하므로 어느 쪽으로 돌려도 해시와 점수가 같습니다.
          </p>
        </header>

        <section className="doc-section">
          <h2>MCP로 연결하기</h2>
          <p className="doc-lead">
            서버는 Node 내장 모듈만 쓰는 단일 파일입니다. 내려받아 등록하면 도구 {MCP_TOOL_COUNT}개가 그대로
            노출됩니다. MCP를 지원하는 에이전트라면 어댑터가 따로 필요하지 않습니다.
          </p>
          <CodeBlock
            title="Claude Code"
            language="bash"
            code={MCP_INSTALL_COMMAND}
            caption="다른 도구는 아래 설정 파일 형식을 쓰세요. command는 node, args는 내려받은 파일의 절대 경로입니다."
          />
          <div className="doc-split">
            <CodeBlock
              title=".mcp.json"
              language="json"
              code={MCP_CONFIG_SNIPPET}
              caption="Codex·Cursor 등 설정 파일을 쓰는 도구용입니다."
            />
            <CodeBlock
              title="검증한 호출 흐름"
              language="bash"
              code={AGENT_SESSION}
              caption="initialize에서 tools/list, clunk_inspect까지 실제로 확인한 값입니다."
            />
          </div>

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
            검사 계열 명령은 JSON 한 덩어리를 stdout으로 출력합니다. <code>validate</code>와 <code>verify</code>는 판정이
            실패하면 exit code 2로 끝나므로 CI 게이트에 그대로 넣을 수 있습니다.
          </p>
          <CodeBlock title="terminal" language="bash" code={CLI_COMMANDS} />
        </section>

        <section className="doc-section">
          <h2>서버 검증 Passport</h2>
          <p className="doc-lead">
            기본 검사는 이용자의 기기에서 실행되므로, 그 기록은 <strong>같은 파일로 재현할 수 있다</strong>는 뜻이지
            제3자가 대조할 수 있는 증명서는 아닙니다. 서명하는 쪽과 주장하는 쪽이 같은 기계이기 때문입니다. 제출용
            증명서가 필요하면 <strong>서버 검증</strong>을 요청하십시오. 선택한 파일만 Clunk 서버로 업로드되고, 서버가
            직접 검사한 결과에 Ed25519 서명이 붙습니다.
          </p>
          <ul className="principle-list">
            <li>
              <strong>옵트인</strong> — 요청한 파일에만 적용됩니다. 그 외 에셋은 지금까지처럼 브라우저 밖으로 나가지
              않습니다.
            </li>
            <li>
              <strong>바이트를 보관하지 않습니다</strong> — 업로드된 바이트는 검사에만 쓰이고 즉시 폐기됩니다. 남는
              것은 sha256, 검사 결과, 서명뿐입니다.
            </li>
            <li>
              <strong>누구나 확인할 수 있습니다</strong> — 공개키는{" "}
              <code>/.well-known/clunk-verification-key</code>에 있습니다. 한 번 받아 파일로 보관하면 이후에는 네트워크
              없이 <code>npm run clunk -- verify</code>로 대조할 수 있습니다.
            </li>
            <li>
              <strong>증명하는 범위</strong> — “Clunk 서버가 이 sha256을 가진 바이트를 직접 열어 이 규칙 세트로
              검사했고 결과가 이렇다”까지입니다. 그 에셋이 특정 게임·엔진에서 실제로 잘 돈다는 보증은 아닙니다.
            </li>
          </ul>
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
