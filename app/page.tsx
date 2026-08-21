import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "./components/BrandMark";
import { CountUp } from "./components/CountUp";
import { HeroAutopsy } from "./components/HeroAutopsy";
import { Icon, type IconName } from "./components/Icon";
import { InstallCommands } from "./components/InstallCommands";
import { McpPlayground } from "./components/McpPlayground";
import { PipelineFlow } from "./components/PipelineFlow";
import { RevealText } from "./components/RevealText";
import { SampleResult } from "./components/SampleResult";
import { SiteNav } from "./components/SiteNav";
import { SnapRoot } from "./components/SnapRoot";
import { SurfaceShowcase } from "./components/SurfaceShowcase";
import {
  MCP_TOOL_COUNT,
  OPERATION_COUNT,
  RULE_COUNT,
  RULE_SET,
  SURFACE_COUNT,
} from "./components/product-facts";

export const metadata: Metadata = {
  title: "모든 에셋을 근거 있게",
  description:
    "AI 에이전트가 만든 GLB와 GLTF를 생성 직후 검사하고, 허용된 범위만 최적화하고, 결과를 다시 증명하는 품질 게이트입니다.",
};

/**
 * Real values from the recorded optimize/passport session in mcp-transcript.ts:
 * the bundled messy sample cleaned by the three allowlisted operations.
 */
const CHAIN = {
  sourceHash: "181473ff…e8fdf1",
  outputHash: "718f2fba…c8302b",
  operations: [
    { id: "prune-empty-nodes", label: "빈 노드 정리" },
    { id: "dedupe-materials", label: "중복 머티리얼 병합" },
    { id: "clean-metadata", label: "메타데이터 정리" },
  ],
  before: { score: 99, bytes: "1,124 B" },
  after: { score: 100, bytes: "908 B" },
} as const;

export default function Home() {
  return (
    <div className="site-shell">
      <SnapRoot />
      <SiteNav active="home" />
      <main className="landing-v3">
        <HeroAutopsy />

        <section className="snap-sec sec3 sec3-alt" id="flow">
          <div className="snap-inner">
            <div className="sec3-head">
              <span className="eyebrow">한 세션 안에서 끝나는 게이트</span>
              <RevealText className="h2" as="h2">
                {"에이전트가 만들고,\n같은 자리에서 판정받습니다."}
              </RevealText>
              <p className="lead">
                사람이 파일을 다시 열어보는 단계를 기다리지 않습니다. 아래 파이프라인과 결과
                카드는 번들 GLB를 브라우저에서 실제로 검사해 채워집니다.
              </p>
            </div>
            <div className="evidence-layout">
              <PipelineFlow />
              <SampleResult />
            </div>
          </div>
        </section>

        <section className="snap-sec sec3" id="playground">
          <div className="snap-inner">
            <div className="sec3-head">
              <span className="eyebrow">AI 에이전트 연동 — 왜 필요한가</span>
              <RevealText className="h2" as="h2">
                {"AI가 만들게 했다면,\n검사도 AI 손에서 끝나야죠."}
              </RevealText>
              <p className="lead">
                Claude Code·Codex에 설정 5줄로 Clunk를 연결하면, 에이전트가 에셋을 만든 직후
                스스로 검사받고 통과 증명까지 남깁니다. 사람이 파일을 하나하나 열어보는 병목이
                사라집니다. 아래는 가장 많이 쓰이는 도구 4개 — 골라 보세요, 실제 기록된 응답이
                재생됩니다.
              </p>
            </div>
            <McpPlayground />
          </div>
        </section>

        <section className="snap-sec sec3 sec3-alt" id="terminal">
          <div className="snap-inner">
            <div className="terminal-layout">
              <div className="terminal-copy">
                <span className="eyebrow">같은 Core, 네 개의 표면</span>
                <RevealText className="h2" as="h2">
                  {"터미널에서도\n같은 값이 나옵니다."}
                </RevealText>
                <p className="lead">
                  웹 검사기, CLI, MCP, VS Code 확장이 전부 같은 Core 계약을 호출합니다. 아래에서
                  표면을 바꿔 보세요 — 같은 파일, 같은 해시, 같은 점수가 네 가지 모습으로
                  나옵니다.
                </p>
                <Link className="button button-quiet" href="/docs">
                  CLI와 MCP 사용법
                  <Icon name="arrowRight" size={15} />
                </Link>
              </div>
              <SurfaceShowcase />
            </div>
          </div>
        </section>

        <section className="snap-sec sec3" id="proof">
          <div className="snap-inner">
            <div className="sec3-head">
              <span className="eyebrow">판정의 근거</span>
              <RevealText className="h2" as="h2">
                {"통과했다는 말 대신,\n증명을 남깁니다."}
              </RevealText>
            </div>

            <div className="proof3-stats" aria-label="Clunk 구성 요약">
              <ProofStat value={RULE_COUNT} label="정책 규칙" note={RULE_SET.id} />
              <ProofStat value={OPERATION_COUNT} label="허용 작업" note="손실 없는 정리만" />
              <ProofStat value={MCP_TOOL_COUNT} label="MCP 도구" note="에이전트가 직접 호출" />
              <ProofStat value={SURFACE_COUNT} label="작업 표면" note="같은 Core 계약" />
            </div>

            <div className="chain3 panel">
              <div className="chain3-node">
                <span className="mono-label">원본 GLB</span>
                <strong className="num">{CHAIN.before.bytes}</strong>
                <code className="num">sha256 {CHAIN.sourceHash}</code>
                <span className="status-pill status-conditional">score {CHAIN.before.score}</span>
              </div>
              <div className="chain3-ops" aria-label="허용 목록 작업">
                {CHAIN.operations.map((op) => (
                  <span key={op.id} className="chain3-op">
                    <code>{op.id}</code>
                    {op.label}
                  </span>
                ))}
              </div>
              <div className="chain3-node">
                <span className="mono-label">새 파일 · 원본 무손실</span>
                <strong className="num">{CHAIN.after.bytes}</strong>
                <code className="num">sha256 {CHAIN.outputHash}</code>
                <span className="status-pill status-ready">score {CHAIN.after.score} · READY</span>
              </div>
              <p className="chain3-note">
                Passport에는 원본과 결과물의 해시, 검사 다이제스트, 적용 작업이 함께 봉인됩니다.
                출력 GLB를 다시 파싱해 해시가 맞아야 준비 완료가 됩니다.
              </p>
              {/* The claim only means something if the person receiving it can check it
                  themselves, so the section shows the command rather than asserting trust. */}
              <p className="chain3-verify">
                제출용은 <strong>서버 검증</strong>을 고르면 서버가 그 바이트를 직접 열어 검사하고
                서명합니다. 받는 쪽이 대조합니다. <code>clunk verify passport.json --asset model.glb</code>
              </p>
            </div>

            <dl className="principle3-row">
              <Principle icon="shield" title="원본은 그대로" body="최적화는 항상 새 파일에 씁니다." />
              <Principle icon="fingerprint" title="로컬 우선" body="바이트는 브라우저에서 분석하고 서버에는 해시와 결과만 남깁니다." />
              <Principle icon="circleCheck" title="화면으로 통과 없음" body="미리보기는 게이트가 아닙니다. 재파싱된 해시만 믿습니다." />
            </dl>
          </div>
        </section>

        <section className="snap-sec sec3 cta3" id="start">
          <div className="snap-inner cta3-inner">
            <div className="cta3-copy">
              <RevealText className="h2" as="h2">
                {"에셋 하나로\n바로 확인해 보세요."}
              </RevealText>
              <p className="lead">
                샘플로 시작하거나 직접 만든 GLB를 실행할 수 있습니다. 크레딧은 결제 약속이 아니라
                모든 증감이 사유와 함께 남는 원장입니다.
              </p>
              <div className="hero-actions cta3-actions">
                <Link className="button button-primary" href="/app">
                  검사기 열기
                  <Icon name="arrowUpRight" size={15} />
                </Link>
                <Link className="button button-quiet" href="/pricing">
                  요금과 크레딧
                  <Icon name="arrowRight" size={15} />
                </Link>
              </div>
            </div>

            <InstallCommands />

            <footer className="cta3-foot">
              <div className="site-footer-brand">
                <span className="brand-mark">
                  <BrandMark size={30} gradientId="clunk-footer3" />
                </span>
                <div>
                  <strong>Clunk</strong>
                  <span>팀을 위한 실시간 3D 에셋 품질 게이트</span>
                </div>
              </div>
              <nav className="site-footer-nav" aria-label="사이트 링크">
                <Link href="/app">검사기</Link>
                <Link href="/dashboard">대시보드</Link>
                <Link href="/pricing">요금</Link>
                <Link href="/docs">문서</Link>
                <Link href="/support">지원</Link>
                <a href="/llms.txt">llms.txt</a>
              </nav>
              <nav className="site-footer-legal" aria-label="법적 고지">
                <Link href="/legal/terms">이용약관</Link>
                <Link href="/legal/privacy">개인정보처리방침</Link>
                <Link href="/legal/refund">환불·청약철회</Link>
              </nav>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProofStat({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="proof3-stat">
      <strong>
        <CountUp value={value} />
      </strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function Principle({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="principle3">
      <dt>
        <Icon name={icon} size={16} />
        {title}
      </dt>
      <dd>{body}</dd>
    </div>
  );
}
