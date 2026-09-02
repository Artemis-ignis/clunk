import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { RevealObserver } from "./components/Reveal";
import { ForceDarkTheme } from "./components/ForceDarkTheme";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { AgentLiveDemo } from "./components/AgentLiveDemo";
import { SiteFooter } from "./components/SiteFooter";
import { createPageMetadata } from "./components/site-metadata";
import { RULE_COUNT } from "./components/product-facts";
import { EmbeddedGlbViewer } from "./components/review/EmbeddedGlbViewer";
import { VendingHall } from "./components/vending/VendingHall";
import "./components/vending/vending.css";

export const metadata = createPageMetadata({
  // The title and description are the operator's exact wording (2026-09-02): the three
  // products in one line, no internal vocabulary. Do not "improve" them.
  title: "AI 게임 에셋 생성 & 게임 제작 에이전트",
  description: "2D·3D 게임 에셋을 생성하고, 검사·수정하고, AI 에이전트와 함께 게임까지 제작하세요.",
  path: "/",
});

/**
 * Public landing — the vending hall (2026-09-02).
 *
 * The operator's own picture of the product: "사이트에 자판기가 있고 그 자판기에 크레딧
 * 넣으면 에셋들 뽑는 거지. 각 테마가 들어 있는 자판기들이 있고, 그래서 Clunk임.
 * 자판기에서 물건 떨어질 때 소리가 Clunk잖아."
 *
 * So the landing is a hall of themed vending machines reading the live catalogue
 * (/api/marketplace) rather than a hand-typed grid of cards. What used to be section 01
 * ("에셋 제작", a turning tractor beside three bullets) is gone: the hall below is the
 * market, and the page was showing the same twelve assets twice — once in the hero panel,
 * once in the showcase grid. The inspection and agent sections stay, because neither is
 * visible from a vending machine.
 *
 * Every number below is a real measurement — the 2026-08-31 re-inspection record for the
 * Harvest Frontier tractor and the ceiling assetops-profiles.ts declares. Nothing here is
 * estimated, and the machines invent nothing either: their counts, prices and polygon
 * figures all come out of the catalogue response (app/components/vending/vending-catalog.ts).
 */

const FLOW = ["생성", "검사", "수정", "게시", "에이전트"] as const;

/**
 * Section 01's inspected file. Numbers come from the 2026-08-31 re-inspection
 * record (.clunk-evidence/.../tractor.compact.m1-pc-inspection.json):
 * triangleCount 39,320 · drawCallCount 98 · 840,136 bytes = 840 KB.
 * The 40,000 ceiling is code: `harvest-frontier-web-three`.inspectionPolicy
 * .maxTriangles in packages/core/src/assetops-profiles.ts.
 */
const INSPECTED_MODEL = {
  src: "/landing/tractor.compact.m1.glb",
  poster: "/landing/tractor-hero.png",
  name: "트랙터",
  fileName: "tractor.glb",
  measured: { faces: "39,320", drawCalls: "98", size: "840 KB", faceLimit: "40,000", limitPercent: "98" },
} as const;

const AGENT_CLIENTS = ["Claude Code", "Codex CLI", "Cursor", "VS Code", "Grok Build", "Antigravity", "DeepSeek", "GLM", "로컬 에이전트"] as const;

export default function Home() {
  return (
    <div className="cv5 cv5-snap">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav active="home" />

      <main id="main-content">
        {/* HERO ------------------------------------------------------- */}
        {/* public-hero-frame is the shared first-viewport contract every public hero
            carries (app/globals.css). Under .cv5 its alignment rules are deliberately
            inert, so it changes nothing here and keeps the landing in the same family
            as /agents and /pricing. */}
        <section className="cv5-hero public-hero-frame" data-snap-section="hero" aria-labelledby="home-heading">
          <div className="cv5-frame vh-hero">
            <span className="cv5-badge">✦ 게임 제작을 위한 <b>단 하나의 AI 슈퍼앱</b></span>
            <h1 id="home-heading">
              크레딧을 넣고,<br /><em>에셋을 뽑으세요</em>
            </h1>
            <p className="cv5-hero-lede">
              테마별 자판기에 마켓의 에셋이 그대로 들어 있습니다. 번호를 고르고 뽑기를 누르면 파일이 배출구로 떨어집니다.
              뽑은 에셋이 게임에서 문제없이 돌아가는지도 바로 확인해 드립니다.
            </p>
            <p className="vh-why">자판기에서 물건이 떨어질 때 나는 소리, 그게 Clunk 입니다.</p>
            <div className="cv5-cta-row">
              <Link className="cv5-btn cv5-btn-primary" href="/studio" prefetch={false}>
                무료로 시작하기 <Icon name="arrowUpRight" size={17} />
              </Link>
              <Link className="cv5-btn cv5-btn-ghost" href="/marketplace" prefetch={false}>
                마켓 둘러보기
              </Link>
            </div>
            {/* Five steps. On a phone they used to wrap 4 + 1, which reads as
                a mistake; the mobile rule in site-v5.css lays them out 3 + 2. */}
            <div className="cv5-flow" aria-label="Clunk 작업 순서">
              {FLOW.map((step, index) => (
                <span key={step}>
                  <b>{String(index + 1).padStart(2, "0")}</b> {step}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 자판기 홀 --------------------------------------------------- */}
        <section className="cv5-showcase" id="hall" data-snap-section="hall" aria-labelledby="hall-heading">
          <div className="cv5-frame">
            <div className="cv5-showcase-head cv5-reveal">
              <div>
                <span className="cv5-eyebrow">자판기 홀</span>
                <h2 id="hall-heading">마켓에 올라와 있는 에셋</h2>
              </div>
              <p>
                농장·마을 배경에 바로 쓰는 3D 모델, 2D 스프라이트 시트, 이어 붙여도 이음매가 안 보이는 텍스처입니다.
                슬롯마다 폴리곤 수(적을수록 가벼움)가 적혀 있고, 베타 기간에는 로그인만 하면 무료로 뽑습니다.
              </p>
            </div>
            <VendingHall />
            <div className="cv5-showcase-foot cv5-reveal">
              <Link className="cv5-more" href="/marketplace" prefetch={false}>
                마켓에서 전체 목록 보기 <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* 01 — INSPECT & REPAIR --------------------------------------- */}
        <section className="cv5-sec" id="inspect" data-tone="green" data-snap-section="inspect" aria-labelledby="sec-inspect">
          <div className="cv5-frame cv5-sec-grid" data-flip="true">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">01</span><small>검사와 수정</small></div>
              <h2 id="sec-inspect">게임 에셋 검사 및 수정</h2>
              <p>
                뽑은 것이든 직접 만든 것이든, 올리면 {RULE_COUNT}가지를 검사해 점수로 알려줍니다. 고치는 것도 여기서, 원본은 그대로.
              </p>
              <ul className="cv5-points">
                <li><b>실제 수치</b> — 폴리곤 수, 그리기 횟수, 텍스처 크기를 파일에서 직접 읽습니다</li>
                <li><b>2D도 함께</b> — 스프라이트 시트(Sprite·Atlas)와 Spine까지</li>
                <li><b>눈으로 확인</b> — 3D 뷰어로 돌려 보고 판단하세요</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/app" prefetch={false}>검사 시작 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/docs" prefetch={false}>문서 보기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>에셋 <b>검사</b></span><span>{INSPECTED_MODEL.fileName}</span></div>
                <div className="cv5-mock-body cv5-inspect">
                  {/* A picture of a 3D asset proves nothing about a 3D asset.
                      This is the tractor's own GLB, loaded and turning, so the
                      section about inspecting files shows a real file. */}
                  <div className="cv5-inspect-preview">
                    <EmbeddedGlbViewer
                      src={INSPECTED_MODEL.src}
                      poster={INSPECTED_MODEL.poster}
                      alt={`Harvest Frontier에 들어간 ${INSPECTED_MODEL.name} — 드래그해서 돌려보세요`}
                    />
                    <small>Harvest Frontier에 들어간 파일</small>
                  </div>
                  <div className="cv5-inspect-panel">
                    <div className="cv5-score">
                      {/* The 2026-08-31 record for this exact file (tractor.compact.m1-pc-inspection.json):
                          score 99 of 100, hardBlockerCount 0, two warnings. It has never scored 100. */}
                      <span className="cv5-score-ring"><i>99</i></span>
                      <div><span>게임 적합도</span><b>막는 문제 0건 · 주의 2건</b></div>
                    </div>
                    {/* A number with no unit and no ceiling is not information.
                        39,320 / 98 / 840 KB are the 2026-08-31 re-inspection record;
                        40,000 is the ceiling assetops-profiles.ts declares for a web game. */}
                    <div className="cv5-find">
                      <div data-tone="warn">
                        <b>폴리곤</b>
                        <span><em>{INSPECTED_MODEL.measured.faces}개</em> · 웹 게임 권장 상한 {INSPECTED_MODEL.measured.faceLimit}개의 {INSPECTED_MODEL.measured.limitPercent}%</span>
                      </div>
                      <div>
                        <b>그리기 횟수</b>
                        <span><em>{INSPECTED_MODEL.measured.drawCalls}회</em> · 적을수록 빠릅니다</span>
                      </div>
                      <div>
                        <b>파일 크기</b>
                        <span><em>{INSPECTED_MODEL.measured.size}</em> · 내려받는 파일 하나</span>
                      </div>
                    </div>
                    <div className="cv5-ops">
                      <span><b>✓</b>빈 덩어리 정리</span>
                      <span><b>✓</b>중복 재질 합치기</span>
                      <span><b>✓</b>파일 정보 정리</span>
                      <span><b>✓</b>새 파일로 저장</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — GAME AGENT --------------------------------------------- */}
        <section className="cv5-sec" id="agent" data-snap-section="agent" aria-labelledby="sec-agent">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">02</span><small>제작 에이전트</small></div>
              <h2 id="sec-agent">게임 제작 에이전트</h2>
              <p>
                Claude Code, Cursor, Codex에 연결하면, 에이전트가 대화만으로 에셋을 만들고 검사까지 끝냅니다.
              </p>
              <ul className="cv5-points">
                <li><b>말로 만듭니다</b> — &ldquo;시장 노점 만들어줘&rdquo; 한 줄이면 GLB가 나옵니다</li>
                <li><b>문제를 먼저 알려줍니다</b> — 무엇이 걸렸는지 짚어 주고, 고칠지 물어봅니다</li>
                <li><b>어디서든 그대로</b> — Unity, Godot, Three.js에 바로 넣어 씁니다</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/agents" prefetch={false}>에이전트 연결 가이드 <Icon name="arrowRight" size={15} /></Link>
              </div>
              <div className="cv5-flow" aria-label="Clunk를 연결할 수 있는 AI 도구" style={{ marginTop: 26 }}>
                {AGENT_CLIENTS.map((client) => (
                  <span key={client}>{client}</span>
                ))}
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>에이전트 <b>작업 화면</b></span><span>실제로 연결된 상태</span></div>
                <div className="cv5-mock-body cv5-agent-mock">
                  <AgentLiveDemo />
                  <div className="cv5-mcp-demo">
                    <LandingMcpDemo />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CLOSER -------------------------------------------------------- */}
        <section className="cv5-closer" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="cv5-frame">
            <span className="cv5-eyebrow" style={{ justifyContent: "center" }}>시작하기</span>
            <h2 id="start-heading">필요한 에셋부터<br /><em>골라 보세요</em></h2>
            <p>자판기에서 바로 뽑거나, 직접 만들어 보세요.</p>
            <div className="cv5-cta-row" style={{ marginTop: 34 }}>
              <Link className="cv5-btn cv5-btn-primary" href="/studio" prefetch={false}>
                Clunk 시작하기 <Icon name="arrowUpRight" size={17} />
              </Link>
              <Link className="cv5-btn cv5-btn-ghost" href="/agents" prefetch={false}>
                에이전트 연결
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
