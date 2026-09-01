import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { RevealObserver } from "./components/Reveal";
import { ForceDarkTheme } from "./components/ForceDarkTheme";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { AgentLiveDemo } from "./components/AgentLiveDemo";
import { SiteFooter } from "./components/SiteFooter";
import { createPageMetadata } from "./components/site-metadata";
import { MCP_HTTP_TOOL_COUNT, RULE_COUNT } from "./components/product-facts";

export const metadata = createPageMetadata({
  title: "게임 에셋 파운드리",
  description: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사하고, 마켓에 파는 것까지 Clunk 하나로. 저폴리 3D 모델과 2D 스프라이트를 크레딧으로 바로 사용하세요.",
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
      alt={`${name} 저폴리 3D 에셋 렌더`}
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
              <h1 id="home-heading">
                게임 제작의 모든 과정을<br /><em>CLUNK 하나로</em>
              </h1>
              <p className="cv5-hero-lede">
                만든 에셋이 내 게임에서 돌아갈지, 넣기 전에 알려줍니다.
                삼각형 수와 드로우콜을 엔진 기준에 맞춰 검사하고, 넘치면 그 자리에서 줄입니다.
              </p>
              <div className="cv5-cta-row">
                <Link className="cv5-btn cv5-btn-primary" href="/studio" prefetch={false}>
                  무료로 시작하기 <Icon name="arrowUpRight" size={17} />
                </Link>
                <Link className="cv5-btn cv5-btn-ghost" href="/marketplace" prefetch={false}>
                  마켓 둘러보기
                </Link>
              </div>
              <div className="cv5-flow" aria-label="Clunk 워크플로우">
                {FLOW.map((step, index) => (
                  <span key={step}>
                    <b>{String(index + 1).padStart(2, "0")}</b> {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="cv5-hero-visual" aria-hidden="true">
              <div className="cv5-hv-panel">
                <div className="cv5-hv-head"><span>CLUNK <b>MARKET</b></span><span>GLB 파일</span></div>
                <div className="cv5-hv-grid">
                  {HERO_CELLS.map((asset) => (
                    <figure className="cv5-hv-cell" key={asset.slug} style={{ margin: 0 }}>
                      <ShowcaseImg slug={asset.slug} name={asset.name} eager />
                      <span>{asset.tris} TRIS</span>
                    </figure>
                  ))}
                </div>
                <div className="cv5-hv-foot">
                  <span>트랙터 검사 결과</span>
                  <b>100/100 · 블로커 0</b>
                </div>
              </div>
              <div className="cv5-float cv5-float-a"><img src="/landing/showcase/conifer-spire.webp" alt="" width={240} height={240} loading="eager" /><small>860 TRIS</small></div>
              <div className="cv5-float cv5-float-b"><img src="/landing/showcase/crate-produce.webp" alt="" width={200} height={200} loading="eager" /><small>782 TRIS</small></div>
              <div className="cv5-float cv5-float-c"><img src="/landing/showcase/haystack.webp" alt="" width={220} height={220} loading="eager" /><small>1,322 TRIS</small></div>
            </div>
          </div>
        </section>

        {/* 01 — MAKE & SELL ------------------------------------------- */}
        <section className="cv5-sec" id="make" data-snap-section="make" aria-labelledby="sec-make">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">01</span><small>제작과 판매</small></div>
              <h2 id="sec-make">게임 에셋 제작 및 판매</h2>
              <p>
                한 줄이면 2D가, 몇 초면 3D 모델이 나옵니다. 검사를 통과한 것만 마켓에 올립니다.
              </p>
              <ul className="cv5-points">
                <li><b>2D 이미지</b> — 스프라이트·아이콘·이펙트를 문장으로</li>
                <li><b>3D 모델</b> — 게임에 바로 넣는 저폴리 GLB로</li>
                <li><b>라이선스 명시</b> — 어디에 써도 되는지 상품마다 표시</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/marketplace" prefetch={false}>마켓 보기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/studio" prefetch={false}>직접 만들기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>CLUNK <b>MARKET</b></span><span>1차 19종</span></div>
                <div className="cv5-mock-body cv5-market">
                  <div className="cv5-market-side">
                    <span className="on">추천</span>
                    <span>구조물</span>
                    <span>수목</span>
                    <span>소품</span>
                    <span>2D · VFX</span>
                  </div>
                  <div className="cv5-market-grid">
                    {MARKET_CELLS.map((asset) => (
                      <figure className="cv5-market-card" key={asset.slug} style={{ margin: 0 }}>
                        <ShowcaseImg slug={asset.slug} name={asset.name} />
                        <figcaption>{asset.name}<b>{asset.tris} TRIS</b></figcaption>
                      </figure>
                    ))}
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
                <li><b>실제 수치</b> — 삼각형·드로우콜·텍스처 용량을 파일에서 직접</li>
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
                <div className="cv5-mock-bar"><span>ASSET <b>INSPECTOR</b></span><span>tractor.compact.m1.glb · 2026-09-01 실측 · HF 프로파일</span></div>
                <div className="cv5-mock-body cv5-inspect">
                  <div className="cv5-inspect-preview">
                    <img src="/landing/tractor-hero.png" alt="저폴리 트랙터 3D 에셋 렌더" width={900} height={610} loading="lazy" />
                    <small>직접 개발 중인 게임의 에셋</small>
                  </div>
                  <div className="cv5-inspect-panel">
                    <div className="cv5-score">
                      <span className="cv5-score-ring"><i>100</i></span>
                      <div><span>GAME-READY SCORE · HF 프로파일</span><b>하드 블로커 0 · 경고 1</b></div>
                    </div>
                    <div className="cv5-find">
                      <div><b>TRIANGLES</b><span>39,320 / HF 예산 40,000 · 98%</span></div>
                      <div><b>DRAW CALLS</b><span>98</span></div>
                      <div><b>BYTES · SHA-256</b><span>840,136 · f64e63b2…</span></div>
                      <div data-tone="warn"><b>GEO-TRIANGLE-BUDGET</b><span>WARNING · 예산 98% 사용</span></div>
                    </div>
                    <div className="cv5-ops">
                      <span><b>✓</b>빈 노드 정리</span>
                      <span><b>✓</b>중복 머티리얼 병합</span>
                      <span><b>✓</b>메타데이터 정리</span>
                      <span><b>✓</b>재패킹</span>
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
                <li><b>직접 쓰면서 만듭니다</b> — 저희가 개발 중인 게임에 넣어 가며 다듬고 있습니다</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/connect" prefetch={false}>에이전트 연결 가이드 <Icon name="arrowRight" size={15} /></Link>
              </div>
              <div className="cv5-flow" aria-label="Clunk를 연결할 수 있는 MCP 클라이언트" style={{ marginTop: 26 }}>
                {AGENT_CLIENTS.map((client) => (
                  <span key={client}>{client}</span>
                ))}
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>AGENT <b>WORKSPACE</b></span><span>LIVE · MCP REAL ENDPOINT</span></div>
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

        {/* STATS — measured only ---------------------------------------- */}
        <section className="cv5-stats" data-snap-section="proof" aria-label="Clunk 실측 지표">
          <div className="cv5-frame">
            <p className="cv5-stats-note cv5-stats-note-top">지금 Clunk가 할 수 있는 것</p>
            <div className="cv5-stats-grid">
              <div className="cv5-stat"><b>{RULE_COUNT}</b><span>파일 하나를 검사하는 항목 수</span></div>
              <div className="cv5-stat"><b>{MCP_HTTP_TOOL_COUNT}</b><span>에이전트가 쓸 수 있는 기능</span></div>
              <div className="cv5-stat"><b>19</b><span>마켓 1차 상품 · 파일 94개</span></div>
              <div className="cv5-stat"><b>100/100</b><span>게임에 실제로 들어간 트랙터 검사 점수</span></div>
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
                저희가 개발 중인 농장 게임에 넣어 가며 다듬은 저폴리 모델입니다.
              </p>
            </div>
            <ul className="cv5-showcase-grid" aria-label="Wave 1 실제 에셋 12종">
              {SHOWCASE.map((asset, index) => (
                <li className="cv5-showcase-card cv5-reveal" data-delay={String(index % 4)} key={asset.slug}>
                  <Link href="/marketplace" prefetch={false} aria-label={`${asset.name} — 마켓에서 보기`}>
                    <ShowcaseImg slug={asset.slug} name={asset.name} />
                    <span className="cv5-showcase-meta"><b>{asset.name}</b><span>{asset.tris} TRIS</span></span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="cv5-showcase-foot cv5-reveal">
              <Link className="cv5-more" href="/marketplace" prefetch={false}>
                마켓에서 전체 인벤토리 보기 <Icon name="arrowRight" size={15} />
              </Link>
              <small>통신판매업 신고 절차가 끝나는 대로 판매를 시작합니다.</small>
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
              <Link className="cv5-btn cv5-btn-ghost" href="/connect" prefetch={false}>
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
