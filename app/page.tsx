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
  OPTIMIZE_SAMPLE,
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



const formatKb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

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

        <section className="snap-sec sec3 sec3-band" id="terminal">
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
                <strong className="num">{formatKb(OPTIMIZE_SAMPLE.beforeBytes)}</strong>
                <code className="num">sha256 {shortHash(OPTIMIZE_SAMPLE.sourceHash)}</code>
                <span className="status-pill status-conditional">score {OPTIMIZE_SAMPLE.beforeScore}</span>
              </div>
              <div className="chain3-ops" aria-label="허용 목록 작업">
                {OPTIMIZE_SAMPLE.operations.map((op) => (
                  <span key={op.id} className="chain3-op">
                    <code>{op.id}</code>
                    {op.label} {op.count}건
                  </span>
                ))}
              </div>
              <div className="chain3-node">
                <span className="mono-label">새 파일 · 원본 무손실</span>
                <strong className="num">{formatKb(OPTIMIZE_SAMPLE.afterBytes)}</strong>
                <code className="num">sha256 {shortHash(OPTIMIZE_SAMPLE.outputHash)}</code>
                <span className="status-pill status-conditional">
                  score {OPTIMIZE_SAMPLE.afterScore} · 그대로
                </span>
              </div>
              {/* 예전에는 이 자리가 score 99 → 100 · READY였다. 그건 정점 4개짜리 장난감
                  샘플의 값이었고, 실제 게임 에셋으로 바꾼 뒤에도 옛 숫자가 남아 있었다.
                  지금 값은 실측이고, 점수가 오르지 않는다. 그리고 그게 이 제품의 주장이다. */}
              <p className="chain3-verdict">
                <strong>{OPTIMIZE_SAMPLE.operations.reduce((sum, op) => sum + op.count, 0)}건을 지웠는데 점수는 그대로입니다.</strong>{" "}
                남은 경고는 무손실로 고칠 수 없는 것들이라서요 — 스케일 축이 0인 노드, 합쳐야
                할 프리미티브, 빠진 노멀. 그건 사람이 결정할 일이고, 우리는 그걸 점수로
                덮지 않습니다.
              </p>
              <p className="chain3-note">
                Passport에는 원본과 결과물의 해시, 검사 다이제스트, 적용 작업, 그리고 그 판정을
                내린 규칙 세트의 지문이 함께 봉인됩니다. 받는 쪽이 같은 규칙으로 재검증했는지
                확인할 수 있어야 증명서 구실을 하기 때문입니다.
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

        <section className="snap-sec sec3 sec3-band cta3" id="start">
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
