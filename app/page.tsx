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
import { LandingMarketShowcase } from "./components/LandingMarketShowcase";
import { EmbeddedGlbViewer } from "./components/review/EmbeddedGlbViewer";

export const metadata = createPageMetadata({
  // The title and description are the operator's exact wording (2026-09-02): the three
  // products in one line, no internal vocabulary. Do not "improve" them.
  title: "AI 게임 에셋 생성 & 게임 제작 에이전트",
  description: "2D·3D 게임 에셋을 생성하고, 검사·수정하고, AI 에이전트와 함께 게임까지 제작하세요.",
  path: "/",
});

/**
 * Public landing v5 — master-reference rebuild (2026-08-31). Structure follows
 * the approved reference: hero with a product-panel visual, three numbered
 * product sections each carrying a REAL-data UI mockup, a measured stats band,
 * and the wave-1 real-inventory grid. Every number rendered here is a real
 * measurement (renderer-measured tris, the 2026-08-31 tractor reinspection,
 * counts derived from code) — the reference layout's invented-stat band is
 * deliberately replaced with measured facts.
 */

const FLOW = ["생성", "검사", "수정", "게시", "에이전트"] as const;

/**
 * The one model section 01 shows, in one place. Swap `src` and `name` here and
 * the stage, the caption and the heading text all follow — nothing else in this
 * file names the file.
 *
 * This is the tractor Harvest Frontier actually ships — the operator's own game, the
 * file players see — not a stand-in authored for the page (2026-09-02: a code-built
 * tractor stood here for a day and read as a toy next to the real one).
 * `measured` is not typed by hand: every value is the 2026-08-31 re-inspection record
 * (.clunk-evidence/.../tractor.compact.m1-pc-inspection.json): triangleCount 39,320 ·
 * drawCallCount 98 · 840,136 bytes = 840 KB. If the file changes, re-read the record.
 */
const FEATURED_MODEL = {
  src: "/landing/tractor.compact.m1.glb",
  poster: "/landing/tractor-hero.png",
  name: "트랙터",
  fileName: "tractor.compact.m1.glb",
  measured: { faces: "39,320", drawCalls: "98", size: "840 KB" },
} as const;

/**
 * Section 02's inspected file. Numbers come from the 2026-08-31 re-inspection
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

/** Renderer-measured triangle counts — outputs/market-launch/wave1/measurements. */
const SHOWCASE = [
  { slug: "market-stall", name: "시장 노점", tris: "2,456" },
  { slug: "greenhouse", name: "온실", tris: "5,756" },
  { slug: "storage-shed", name: "창고 헛간", tris: "1,620" },
  { slug: "haystack", name: "건초 더미", tris: "1,322" },
  { slug: "fence-gate", name: "울타리 게이트", tris: "520" },
  { slug: "crate-produce", name: "농산물 상자", tris: "782" },
  { slug: "broadleaf-full", name: "활엽수 · 라운드", tris: "1,730" },
  { slug: "column-flame", name: "활엽수 · 플레임", tris: "2,120" },
  { slug: "conifer-spire", name: "침엽수 · 스파이어", tris: "860" },
  { slug: "broadleaf-forked", name: "활엽수 · 포크", tris: "2,136" },
  { slug: "conifer-umbrella", name: "침엽수 · 우산", tris: "1,772" },
  { slug: "crate-closed", name: "뚜껑 상자", tris: "700" },
] as const;

const HERO_CELLS = SHOWCASE.slice(0, 6);
const MARKET_CELLS = SHOWCASE.slice(0, 6);

function ShowcaseImg({ slug, name, eager }: { slug: string; name: string; eager?: boolean }) {
  return (
    <img
      src={`/landing/showcase/${slug}.webp`}
      alt={`${name} 3D 에셋 렌더`}
      width={560}
      height={560}
      loading={eager ? "eager" : "lazy"}
    />
  );
}

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
        <section className="cv5-hero public-hero-frame" data-snap-section="hero" aria-labelledby="home-heading">
          <div className="cv5-frame cv5-hero-grid">
            <div>
              <span className="cv5-badge">✦ 게임 제작을 위한 <b>단 하나의 AI 슈퍼앱</b></span>
              {/* Korean headlines are broken by hand at each breakpoint, the way
                  the Korean reference site does it: a browser wrapping Hangul
                  splits on whatever fits, which lands mid-어절 at narrow widths.
                  Desktop takes two lines, mobile four. */}
              <h1 id="home-heading">
                <span className="cv5-line-wide">
                  게임 제작의 모든 과정을<br /><em>CLUNK 하나로</em>
                </span>
                <span className="cv5-line-narrow">
                  게임 제작의<br />모든 과정을<br /><em>CLUNK<br />하나로</em>
                </span>
              </h1>
              {/* The operator's own sentence (2026-09-02). It says what the product does in
                  the words a visitor uses — not how the inspector does it. */}
              <p className="cv5-hero-lede">
                2D·3D 게임 에셋을 생성하고, 검사·수정하고, AI 에이전트와 함께 게임까지 제작하세요.
                만든 에셋이 게임에서 문제없이 돌아가는지도 바로 확인해 드립니다.
              </p>
              <div className="cv5-cta-row">
                <Link className="cv5-btn cv5-btn-primary" href="/studio" prefetch={false}>
                  무료로 시작하기 <Icon name="arrowUpRight" size={17} />
                </Link>
                <Link className="cv5-btn cv5-btn-ghost" href="/marketplace" prefetch={false}>
                  마켓 둘러보기
                </Link>
              </div>
              {/* Five steps. On a phone they used to wrap 4 + 1, which reads as
                  a mistake; the mobile rule in site-v5.css lays them out 3 + 2
                  and centres both rows so the break looks deliberate. */}
              <div className="cv5-flow" aria-label="Clunk 작업 순서">
                {FLOW.map((step, index) => (
                  <span key={step}>
                    <b>{String(index + 1).padStart(2, "0")}</b> {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="cv5-hero-visual" aria-hidden="true">
              <div className="cv5-hv-panel">
                {/* "TRIS" told a visitor nothing and "면" was our own coinage. 폴리곤 is
                    the word game people already use; the panel head says once which way
                    is better so the number under every thumbnail reads without a glossary. */}
                <div className="cv5-hv-head"><span>마켓에 올라온 <b>에셋</b></span><span>폴리곤 수 · 적을수록 가벼움</span></div>
                <div className="cv5-hv-grid">
                  {HERO_CELLS.map((asset) => (
                    <figure className="cv5-hv-cell" key={asset.slug} style={{ margin: 0 }}>
                      <ShowcaseImg slug={asset.slug} name={asset.name} eager />
                      <span>{asset.tris} 폴리곤</span>
                    </figure>
                  ))}
                </div>
                <div className="cv5-hv-foot">
                  {/* The Harvest Frontier tractor's own record (tractor.compact.m1-pc-inspection.json):
                      score 99, hardBlockerCount 0, two warnings. It has never scored 100. */}
                  <span>트랙터 검사 결과</span>
                  <b>99점 · 막는 문제 0건</b>
                </div>
              </div>
              <div className="cv5-float cv5-float-a"><img src="/landing/showcase/conifer-spire.webp" alt="" width={240} height={240} loading="eager" /><small>860 폴리곤</small></div>
              <div className="cv5-float cv5-float-b"><img src="/landing/showcase/crate-produce.webp" alt="" width={200} height={200} loading="eager" /><small>782 폴리곤</small></div>
              <div className="cv5-float cv5-float-c"><img src="/landing/showcase/haystack.webp" alt="" width={220} height={220} loading="eager" /><small>1,322 폴리곤</small></div>
            </div>
          </div>
        </section>

        {/* 01 — MAKE & SELL ------------------------------------------- */}
        <section className="cv5-sec" id="make" data-snap-section="make" aria-labelledby="sec-make">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">01</span><small>에셋 제작</small></div>
              <h2 id="sec-make">게임 에셋 제작</h2>
              <p>
                한 줄이면 2D가, 몇 초면 3D 모델이 나옵니다. 검사를 통과한 것만 마켓에 올립니다.
              </p>
              <ul className="cv5-points">
                <li><b>2D 이미지</b> — 스프라이트·아이콘·이펙트를 문장으로</li>
                <li><b>3D 모델</b> — 게임 엔진에 바로 넣는 가벼운 3D 파일(GLB)로</li>
                <li><b>라이선스 명시</b> — 어디에 써도 되는지 상품마다 표시</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/marketplace" prefetch={false}>마켓 보기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/studio" prefetch={false}>직접 만들기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>실제 게임에 <b>들어간 모델</b></span><span>{FEATURED_MODEL.fileName}</span></div>
                {/* This section is about MAKING an asset, so it shows one Clunk
                    authored, turning, with the numbers its own inspector read off
                    the file. A grid of things to buy belongs in the market section
                    below and was showing the same widget twice on one page. */}
                <div className="cv5-mock-body cv5-make">
                  <div className="cv5-make-stage">
                    <EmbeddedGlbViewer
                      src={FEATURED_MODEL.src}
                      poster={FEATURED_MODEL.poster}
                      alt={`Harvest Frontier에 들어간 ${FEATURED_MODEL.name} — 드래그해서 돌려보세요`}
                      hint="드래그 회전 · 휠 줌 · 실제 게임에 들어간 파일"
                    />
                  </div>
                  <div className="cv5-make-facts">
                    <div className="cv5-make-name">
                      <b>{FEATURED_MODEL.name}</b>
                      <span>Harvest Frontier에서 실제로 쓰는 파일 · 아래 숫자는 이 파일에서 직접 읽은 값</span>
                    </div>
                    <div><span>폴리곤</span><b>{FEATURED_MODEL.measured.faces}개</b><small>적을수록 가볍습니다</small></div>
                    <div><span>그리기 횟수</span><b>{FEATURED_MODEL.measured.drawCalls}회</b><small>적을수록 빠릅니다</small></div>
                    <div><span>파일 크기</span><b>{FEATURED_MODEL.measured.size}</b><small>내려받는 파일 하나</small></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — INSPECT & REPAIR --------------------------------------- */}
        <section className="cv5-sec" id="inspect" data-tone="green" data-snap-section="inspect" aria-labelledby="sec-inspect">
          <div className="cv5-frame cv5-sec-grid" data-flip="true">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">02</span><small>검사와 수정</small></div>
              <h2 id="sec-inspect">게임 에셋 검사 및 수정</h2>
              <p>
                올리면 {RULE_COUNT}가지를 검사해 점수로 알려줍니다. 고치는 것도 여기서, 원본은 그대로.
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
                      hint="드래그 회전 · 휠 줌 · 실제 게임에 들어간 파일"
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
                        Each row now says what the number means, what it is, and
                        what to compare it against. 39,320 / 98 / 840 KB are the
                        2026-08-31 re-inspection record; 40,000 is the ceiling
                        assetops-profiles.ts declares for a web game. */}
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

        {/* 03 — GAME AGENT --------------------------------------------- */}
        <section className="cv5-sec" id="agent" data-snap-section="agent" aria-labelledby="sec-agent">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">03</span><small>제작 에이전트</small></div>
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

        {/* SHOWCASE ------------------------------------------------------ */}
        <section className="cv5-showcase" id="showcase" data-snap-section="showcase" aria-labelledby="showcase-heading">
          <div className="cv5-frame">
            <div className="cv5-showcase-head cv5-reveal">
              <div>
                <span className="cv5-eyebrow">마켓</span>
                <h2 id="showcase-heading">마켓에 올라와 있는 에셋</h2>
              </div>
              <p>
                농장·마을 배경에 바로 쓰는 3D 모델, 2D 스프라이트 시트, 이어 붙여도 이음매가 안 보이는 텍스처입니다.
                카드마다 폴리곤 수(적을수록 가벼움)가 적혀 있고, 베타 기간에는 로그인만 하면 무료로 받습니다.
              </p>
            </div>
            <LandingMarketShowcase />
            <div className="cv5-showcase-foot cv5-reveal">
              <Link className="cv5-more" href="/marketplace" prefetch={false}>
                마켓에서 전체 목록 보기 <Icon name="arrowRight" size={15} />
              </Link>
              
            </div>
          </div>
        </section>

        {/* CLOSER -------------------------------------------------------- */}
        <section className="cv5-closer" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="cv5-frame">
            <span className="cv5-eyebrow" style={{ justifyContent: "center" }}>시작하기</span>
            <h2 id="start-heading">필요한 에셋부터<br /><em>골라 보세요</em></h2>
            <p>마켓에서 바로 받거나, 직접 만들어 보세요.</p>
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
