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
  description: "게임 제작의 모든 과정을 CLUNK 하나로 — 에셋 제작·판매, 검사·수정, 게임 제작 에이전트를 크레딧 하나로 사용합니다. 모든 수치는 실제 바이트와 감사 로그의 실측값입니다.",
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
                에셋 생성과 판매, 품질 검사와 수정, 그리고 에이전트 제작 자동화까지 —
                게임 제작 워크플로우를 하나의 크레딧으로 연결하세요.
                모든 결과는 실제 바이트와 검사 근거로 남습니다.
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
                <div className="cv5-hv-head"><span>CLUNK <b>MARKET</b></span><span>REAL FILES · GLB</span></div>
                <div className="cv5-hv-grid">
                  {HERO_CELLS.map((asset) => (
                    <figure className="cv5-hv-cell" key={asset.slug} style={{ margin: 0 }}>
                      <ShowcaseImg slug={asset.slug} name={asset.name} eager />
                      <span>{asset.tris} TRIS</span>
                    </figure>
                  ))}
                </div>
                <div className="cv5-hv-foot">
                  <span>실게임 납품 GLB 재검사</span>
                  <b>100/100 · PASS</b>
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
              <div className="cv5-sec-kicker"><span className="cv5-num">01</span><small>CLUNK · MAKE &amp; SELL</small></div>
              <h2 id="sec-make">게임 에셋 제작 및 판매</h2>
              <p>
                프롬프트에서 2D를, 팩토리 레일에서 3D GLB를 실제 파일로 만들고,
                게시 게이트를 통과한 에셋만 마켓에 올립니다. 파일·해시·라이선스가
                상품 단위로 따라갑니다.
              </p>
              <ul className="cv5-points">
                <li><b>luna 이미지 엔진</b> — 프롬프트·모델·해시가 provenance로 기록</li>
                <li><b>Three.js 팩토리</b> — 저폴리 GLB, 베이크 변환·인스턴싱 대응</li>
                <li><b>게시 게이트 7조건</b> — 저장·출처·라이선스·검사·검수 전부 PASS여야 공개</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/marketplace" prefetch={false}>마켓 보기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/studio" prefetch={false}>Studio에서 제작 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>CLUNK <b>MARKET</b></span><span>WAVE 1 · 19 PRODUCTS</span></div>
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
              <div className="cv5-sec-kicker"><span className="cv5-num">02</span><small>CLUNK · INSPECT &amp; REPAIR</small></div>
              <h2 id="sec-inspect">게임 에셋 검사 및 수정</h2>
              <p>
                에셋을 실제 바이트로 열어 {RULE_COUNT}개 정책 룰로 검사하고 Game-Ready
                점수를 받습니다. 수리는 허용 목록 연산만, 원본은 불변, 전 과정은
                Passport digest로 봉인됩니다.
              </p>
              <ul className="cv5-points">
                <li><b>바이트 실측</b> — 삼각형·드로우콜·텍스처 메모리를 파서가 직접 셉니다</li>
                <li><b>Sprite · Atlas · Spine</b> — 페이지·리전·본·슬롯 관계를 번들로 검증</li>
                <li><b>정직한 상태 분리</b> — 구조 점수는 사람 승인과 절대 섞이지 않습니다</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/app" prefetch={false}>검사 시작 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/docs" prefetch={false}>검사 계약 읽기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>ASSET <b>INSPECTOR</b></span><span>tractor.compact.m1.glb · 2026-08-31 실측</span></div>
                <div className="cv5-mock-body cv5-inspect">
                  <div className="cv5-inspect-preview">
                    <img src="/landing/tractor-hero.png" alt="실게임에 납품된 저폴리 트랙터 3D 에셋 렌더" width={900} height={610} loading="lazy" />
                    <small>HARVEST FRONTIER 납품분</small>
                  </div>
                  <div className="cv5-inspect-panel">
                    <div className="cv5-score">
                      <span className="cv5-score-ring"><i>100</i></span>
                      <div><span>GAME-READY SCORE</span><b>FRESH REINSPECTION · PASS</b></div>
                    </div>
                    <div className="cv5-find">
                      <div><b>TRIANGLES</b><span>39,320 / 예산 40,000</span></div>
                      <div><b>DRAW CALLS</b><span>98</span></div>
                      <div><b>BYTES · SHA-256</b><span>840,136 · f64e63b2…</span></div>
                      <div data-tone="warn"><b>GEO-TRIANGLE-BUDGET</b><span>WARNING · 숨기지 않음</span></div>
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
              <div className="cv5-sec-kicker"><span className="cv5-num">03</span><small>CLUNK · GAME AGENT</small></div>
              <h2 id="sec-agent">게임 제작 에이전트</h2>
              <p>
                Clunk MCP·CLI·플러그인을 붙이면 에이전트가 에셋 생성·검사·패키징을
                직접 호출합니다. HTTP와 로컬이 같은 {MCP_HTTP_TOOL_COUNT}개 툴 계약이라
                CI와 로컬이 동일하게 동작합니다.
              </p>
              <ul className="cv5-points">
                <li><b>MCP {MCP_HTTP_TOOL_COUNT}툴</b> — 생성·검사·evidence·리뷰를 에이전트가 직접 실행</li>
                <li><b>CLI · VS Code · Codex 플러그인</b> — exit code 계약으로 CI에 바로 연결</li>
                <li><b>실게임 검증 루프</b> — 실제 게임 2종의 납품·감사 데이터로 다듬는 중</li>
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
            <p className="cv5-stats-note cv5-stats-note-top">NO INVENTED METRICS — 아래 수치는 전부 코드와 감사 로그에서 직접 읽은 실측값입니다</p>
            <div className="cv5-stats-grid">
              <div className="cv5-stat"><b>{RULE_COUNT}</b><span>정적 검사 정책 룰 — 코드에서 직접 셉니다</span></div>
              <div className="cv5-stat"><b>{MCP_HTTP_TOOL_COUNT}</b><span>에이전트용 MCP 툴 — HTTP·로컬 동일 계약</span></div>
              <div className="cv5-stat"><b>19</b><span>실물 에셋 상품 · 94개 파일 — 게시 대기</span></div>
              <div className="cv5-stat"><b>100/100</b><span>실게임 납품 GLB 재검사 · 2026-08-31</span></div>
            </div>
          </div>
        </section>

        {/* SHOWCASE ------------------------------------------------------ */}
        <section className="cv5-showcase" id="showcase" data-snap-section="showcase" aria-labelledby="showcase-heading">
          <div className="cv5-frame">
            <div className="cv5-showcase-head cv5-reveal">
              <div>
                <span className="cv5-eyebrow">REAL INVENTORY · WAVE 1</span>
                <h2 id="showcase-heading">목업이 아니라, 실제 제품 파일입니다</h2>
              </div>
              <p>
                아래 12종은 실게임(Harvest Frontier) 납품 라인에서 나온 최적화 GLB의 렌더입니다.
                삼각형 수는 손으로 적은 값이 아니라 렌더러가 실측한 수치 그대로입니다.
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
              <small>19종 준비 완료 · 판매 개시는 통신판매업 신고 완료 후</small>
            </div>
          </div>
        </section>

        {/* CLOSER -------------------------------------------------------- */}
        <section className="cv5-closer" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="cv5-frame">
            <span className="cv5-eyebrow" style={{ justifyContent: "center" }}>START WITH CLUNK</span>
            <h2 id="start-heading">증거 있는 에셋으로,<br /><em>게임을 만드세요</em></h2>
            <p>마켓에서 실제 파일을 고르거나, 크레딧으로 직접 만들고 검사하세요. 에이전트 연결은 몇 분이면 끝납니다.</p>
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
