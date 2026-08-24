import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "./components/BrandMark";
import { Icon, type IconName } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import {
  ASSET_KIND_COVERAGE,
  CLI_SAMPLE,
  MCP_CONFIG_SNIPPET,
  MCP_TOOL_COUNT,
  OPERATION_COUNT,
  RULE_COUNT,
  RULE_SET,
  SURFACE_COUNT,
  TARGET_PROFILES,
} from "./components/product-facts";

export const metadata: Metadata = {
  title: "모든 에셋을 근거 있게",
  description:
    "AI 에이전트가 만든 GLB와 GLTF를 생성 직후 검사하고, 허용된 범위만 최적화하고, 결과를 다시 증명하는 품질 게이트입니다.",
};

const STEPS: { index: string; icon: IconName; title: string; body: string; detail: string }[] = [
  {
    index: "01",
    icon: "upload",
    title: "실제 파일을 넘깁니다",
    body: "생성 에이전트가 만든 GLB와 GLTF의 바이트에서 시작합니다.",
    detail: "filename · format · byte length · sha256",
  },
  {
    index: "02",
    icon: "scan",
    title: "Core가 판정합니다",
    body: "씬, 지오메트리, 머티리얼, 텍스처, 런타임 finding을 정책과 대조합니다.",
    detail: "metrics · findings · score · blocker",
  },
  {
    index: "03",
    icon: "fingerprint",
    title: "Passport로 연결합니다",
    body: "허용된 작업만 새 파일에 적용하고 출력물을 다시 검사합니다.",
    detail: "source hash · output hash · fresh digest",
  },
];

const HARVEST_TRACTOR = {
  file: "tractor.compact.m1.glb",
  bytes: "680,412 B",
  hash: "d92ae932…b3222c",
  triangles: "30,188",
  vertices: "83,090",
  score: 100,
} as const;

export default function Home() {
  const sampleTerminal = [
    "$ npm.cmd run clunk -- inspect " + CLI_SAMPLE.file + " --profile " + CLI_SAMPLE.profileId,
    "",
    "score         " + CLI_SAMPLE.score + "/100",
    "hard blockers " + CLI_SAMPLE.hardBlockerCount,
    "findings      " + CLI_SAMPLE.findings.map((finding) => finding.ruleId).join(" · "),
    "input hash    " + CLI_SAMPLE.inputHash.slice(0, 18) + "…",
    "result digest " + CLI_SAMPLE.resultDigest.slice(0, 18) + "…",
  ].join("\n");

  return (
    <div className="site-shell benchmark-home">
      <SnapRoot />
      <SiteNav active="home" />
      <main>
        <section className="landing-snap-section landing-hero" id="home">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <span className="eyebrow">GAME ASSETOPS · 3D 품질 게이트</span>
              <h1>
                에이전트가 만든 GLB를
                <em>게임에 넣기 전에 판정합니다.</em>
              </h1>
              <p className="landing-hero-lead">
                Claude Code, Codex 같은 에이전트가 쓴 에셋을 사람이 열어보기 전에 실제 바이트로
                검사하고, 점수와 근거, Passport를 남깁니다.
              </p>
              <div className="landing-hero-actions">
                <Link className="button button-primary" href="/app">
                  검사기 열기
                  <Icon name="arrowUpRight" size={15} />
                </Link>
                <Link className="button button-quiet" href="/agents">
                  에이전트 연결
                  <Icon name="arrowRight" size={15} />
                </Link>
              </div>
              <div className="landing-trust">
                <span><Icon name="shield" size={14} />원본 무손실</span>
                <span><Icon name="fingerprint" size={14} />로컬 우선</span>
                <span><Icon name="circleCheck" size={14} />재검사 필수</span>
              </div>
            </div>

            <div className="landing-asset-stage">
              <div className="landing-stage-grid" aria-hidden="true" />
              <div className="landing-stage-glow" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/tractor-hero.png"
                alt="Harvest Frontier 트랙터 GLB 렌더"
                width={1600}
                height={1200}
              />
              <div className="landing-stage-card landing-stage-card-geometry">
                <span>GEOMETRY</span>
                <strong>{HARVEST_TRACTOR.triangles}</strong>
                <small>triangles · {HARVEST_TRACTOR.vertices} vertices</small>
              </div>
              <div className="landing-stage-card landing-stage-card-score">
                <span>STATIC POLICY SCORE</span>
                <strong>{HARVEST_TRACTOR.score}<small>/100</small></strong>
                <b><i />STATIC PASS · 하드 블로커 0</b>
                <small>readiness CONDITIONAL · visualRuntime NOT_EVALUATED</small>
              </div>
              <div className="landing-stage-card landing-stage-card-file">
                <code>{HARVEST_TRACTOR.file}</code>
                <small>{HARVEST_TRACTOR.bytes} · sha256 {HARVEST_TRACTOR.hash}</small>
              </div>
              <p className="landing-stage-caption">Harvest Frontier 런타임 에셋 · clunk_inspect 실측 응답</p>
            </div>
          </div>
          <a className="landing-scroll-cue" href="#flow" aria-label="검사 흐름으로 이동">
            <span>SCROLL TO INSPECT</span>
            <i />
          </a>
        </section>

        <section className="landing-snap-section landing-flow-section" id="flow">
          <div className="landing-section-inner">
            <div className="landing-section-heading">
              <span className="eyebrow">HOW IT WORKS · 3 STEPS</span>
              <h2>파일 하나가 <em>근거 있는 결과</em>가 되는 과정</h2>
              <p>
                미리보기나 감으로 통과시키지 않습니다. 같은 Core가 입력 바이트부터 결과
                Passport까지 이어지는 한 세션을 기록합니다.
              </p>
            </div>
            <div className="landing-steps">
              {STEPS.map((step) => (
                <article className="landing-step-card" key={step.index}>
                  <div className="landing-step-top">
                    <span>{step.index}</span>
                    <Icon name={step.icon} size={21} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <code>{step.detail}</code>
                </article>
              ))}
            </div>
            <div className="landing-flow-proof">
              <div className="landing-flow-proof-copy">
                <span className="mono-label">REAL SAMPLE · CLUNK CORE</span>
                <h3>검사 결과는 이렇게 남습니다.</h3>
                <p>
                  번들 샘플은 실제 GLB 바이트에서 <strong>{CLI_SAMPLE.score}/100</strong>을 받았지만
                  경고가 있어 조건부 상태입니다. 점수 하나만으로 READY라고 부르지 않습니다.
                </p>
                <span className="status-pill status-conditional">CONDITIONAL · WARNING {CLI_SAMPLE.findings.length}</span>
              </div>
              <div className="landing-flow-terminal">
                <div className="landing-terminal-head">
                  <span><i /><i /><i /></span>
                  <code>clunk_inspect · {CLI_SAMPLE.file}</code>
                </div>
                <pre><code>{sampleTerminal}</code></pre>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-snap-section landing-coverage-section" id="coverage">
          <div className="landing-section-inner">
            <div className="landing-section-heading">
              <span className="eyebrow">ENGINE-AWARE · 2D + 3D</span>
              <h2>점수 하나로 <em>게임 준비를 가장하지 않습니다.</em></h2>
              <p>
                PNG부터 Spine, glTF animation, GLB까지 실제 바이트를 읽고, Godot·Unity·Unreal·Web/Three.js와
                모바일 대상 조건을 분리합니다. 초상화 UI는 원본을 실제 renderPx로 재래스터화해 읽힘을 측정하지만,
                엔진 import·player-facing runtime·실브라우저 프레임을 호출하지 못한 결과는 끝까지 별도 상태로 남깁니다.
              </p>
            </div>
            <div className="landing-coverage-grid">
              {ASSET_KIND_COVERAGE.map((item, index) => (
                <article className="landing-coverage-card" key={item.label}>
                  <span>0{index + 1}</span>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
            <div className="landing-profile-band">
              <div><span className="mono-label">TARGET PROFILES</span><strong>{TARGET_PROFILES.length}개 선언 · runtime PASS와 별도</strong></div>
              <div className="landing-profile-list">{TARGET_PROFILES.slice(0, 5).map((profile) => <span key={profile.id}><i />{profile.label}</span>)}</div>
            </div>
          </div>
        </section>

        <section className="landing-snap-section landing-agents-section" id="agents">
          <div className="landing-section-inner">
            <div className="landing-agents-layout">
              <div className="landing-section-heading landing-agents-copy">
                <span className="eyebrow">CONNECT IT · MCP</span>
                <h2>에이전트가 <em>바로 부르는 도구</em></h2>
                <p>
                  현재 Clunk의 정식 외부 연결은 Windows stdio MCP입니다. Claude Code, Codex, Cursor,
                  Claude Desktop, VS Code와 같은 Core를 연결합니다.
                </p>
                <Link className="text-link" href="/agents">
                  클라이언트별 설정 보기 <Icon name="arrowRight" size={15} />
                </Link>
              </div>
              <div className="landing-mcp-panel">
                <div className="landing-mcp-tabs">
                  <span>Claude Code</span>
                  <span>Codex</span>
                  <span>Cursor</span>
                  <span>Claude Desktop</span>
                  <span>VS Code</span>
                  <span>기타 stdio</span>
                </div>
                <div className="landing-mcp-code">
                  <div className="landing-terminal-head">
                    <span><i /><i /><i /></span>
                    <code>plugins/clunk-assetops/.mcp.json</code>
                  </div>
                  <pre><code>{MCP_CONFIG_SNIPPET}</code></pre>
                </div>
                <div className="landing-mcp-foot">
                  <span>{MCP_TOOL_COUNT} tools · {RULE_SET.id}</span>
                  <span>공개 HTTP MCP는 아직 제공하지 않습니다</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-snap-section landing-proof-section" id="proof">
          <div className="landing-section-inner">
            <div className="landing-section-heading">
              <span className="eyebrow">EVIDENCE, NOT A BADGE</span>
              <h2>통과했다는 말 대신 <em>증명을 남깁니다.</em></h2>
              <p>
                Clunk의 정책, 허용 작업, 표면 수는 소스 계약에서 직접 읽습니다. 원본과 출력의
                hash가 연결되고, 다운로드한 파일을 다시 열어야 마지막 문이 열립니다.
              </p>
            </div>
            <div className="landing-evidence-grid">
              <div className="landing-fact-board">
                <div><strong>{RULE_COUNT}</strong><span>정책 규칙</span><small>{RULE_SET.id}</small></div>
                <div><strong>{OPERATION_COUNT}</strong><span>허용 작업</span><small>lossless / metadata</small></div>
                <div><strong>{MCP_TOOL_COUNT}</strong><span>MCP 도구</span><small>agent callable</small></div>
                <div><strong>{SURFACE_COUNT}</strong><span>같은 표면</span><small>web · CLI · MCP · VS Code</small></div>
              </div>
              <div className="landing-passport-card">
                <div className="landing-passport-head">
                  <span className="mono-label">ASSET PASSPORT</span>
                  <span className="status-pill status-conditional">CONDITIONAL</span>
                </div>
                <div className="landing-passport-node">
                  <span>source.glb</span>
                  <strong>{CLI_SAMPLE.inputHash.slice(0, 12)}…</strong>
                  <small>{CLI_SAMPLE.byteLength.toLocaleString()} B · score {CLI_SAMPLE.score}</small>
                </div>
                <div className="landing-passport-line"><i />fresh reinspection · <code>clunk_passport</code><i /></div>
                <div className="landing-passport-node landing-passport-node-muted">
                  <span>output.glb</span>
                  <strong>not created for this sample</strong>
                  <small>warning remains · optimize is explicit</small>
                </div>
                <p>Passport는 READY를 꾸미는 배지가 아니라 원본과 결과를 다시 검사한 기록입니다.</p>
              </div>
            </div>
            <div className="landing-hf-note">
              <Icon name="boxes" size={20} />
              <div>
                <strong>Harvest Frontier 파일럿</strong>
                <p>
                  실제 런타임 GLB를 Clunk에 연결해 게임 프로젝트의 export 품질을 검증하는 협업 루프를
                  진행 중입니다. 게임 원본은 그대로 두고, 검사 결과와 별도 출력만 Clunk 쪽에 기록합니다.
                </p>
              </div>
              <Link className="text-link" href="/agents">연결 흐름 <Icon name="arrowRight" size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="landing-snap-section landing-final-section" id="start">
          <div className="landing-final-card">
            <span className="eyebrow">START WITH ONE ASSET</span>
            <h2>에셋 하나로 <em>바로 확인해 보세요.</em></h2>
            <p>샘플로 시작하거나 직접 만든 GLB를 검사기에 넣어 보세요. 실제 파일에서 계산한 결과만 남습니다.</p>
            <div className="landing-hero-actions">
              <Link className="button button-primary" href="/app">
                검사기 열기 <Icon name="arrowUpRight" size={15} />
              </Link>
              <Link className="button button-quiet" href="/login">
                워크스페이스 시작 <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
          <footer className="landing-footer">
            <div className="site-footer-brand">
              <span className="brand-mark"><BrandMark size={32} gradientId="clunk-benchmark-footer" /></span>
              <div><strong>Clunk</strong><span>팀을 위한 실시간 3D 에셋 품질 게이트</span></div>
            </div>
            <nav className="site-footer-nav" aria-label="사이트 링크">
              <Link href="/app">검사기</Link>
              <Link href="/agents">에이전트 연결</Link>
              <Link href="/dashboard">대시보드</Link>
              <Link href="/docs">문서</Link>
              <a href="/llms.txt">llms.txt</a>
            </nav>
            <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
